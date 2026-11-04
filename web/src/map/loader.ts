// Image resource loader for map tiles: priority queue (nearest to the view centre first), bounded concurrency,
// cancellation of work that scrolled out of view, retry with backoff, and an LRU cache bounded by decoded bytes.
//
// Per redraw the renderer calls beginFrame(), want() for every resource it would like to draw (with a priority) and
// use() for every bitmap it actually draws, then endFrame(): wanted-but-missing resources are fetched in priority
// order, in-flight requests nobody wants any more are aborted, and the least recently drawn bitmaps are evicted
// (bitmap.close()) once the byte budget is exceeded. load() is the promise API for explicit requests (height/life
// tiles for other modules); those are pinned until they settle and are never cancelled by view changes.

export type ResourceState = 'queued' | 'loading' | 'ready' | 'failed';

export interface Resource {
  readonly key: string;
  readonly url: string;
  readonly decode: ImageBitmapOptions | undefined;
  state: ResourceState;
  bitmap: ImageBitmap | null;
  bytes: number;
  priority: number;          // lower = sooner
  wantedFrame: number;       // last frame that asked for it
  usedFrame: number;         // last frame that drew it (LRU order)
  arrivedAt: number;         // performance.now() when decoded (fade-in)
  attempts: number;          // failed attempts so far
  retryAt: number;           // performance.now() after which a failed resource may be fetched again
  abort: AbortController | null;
  waiters: ((b: ImageBitmap | null) => void)[];
}

/** Delay before retry n (1-based). After the last one the resource keeps retrying slowly and asks for a tap. */
const RETRY_DELAYS_MS = [1500, 4000, 10000];
const SLOW_RETRY_MS = 30000;
export const MAX_FAST_RETRIES = RETRY_DELAYS_MS.length;

export class ResourceLoader {
  private readonly res = new Map<string, Resource>();
  private frame = 0;
  private inflight = 0;
  private bytes = 0;
  private wakeTimer = 0;
  private wakeAt = Infinity;

  /** onChange: something arrived / failed / became retryable; the owner should redraw (which calls want() again). */
  constructor(private readonly maxConcurrent: number, public budgetBytes: number, private readonly onChange: () => void) {
    addEventListener('online', () => this.retryAll());
  }

  beginFrame(): void { this.frame++; }

  /** Register interest in a resource for this frame. Returns it (possibly not ready yet). */
  want(key: string, url: string, priority: number, decode?: ImageBitmapOptions): Resource {
    let r = this.res.get(key);
    if (!r) {
      r = { key, url, decode, state: 'queued', bitmap: null, bytes: 0, priority, wantedFrame: 0, usedFrame: 0, arrivedAt: 0,
        attempts: 0, retryAt: 0, abort: null, waiters: [] };
      this.res.set(key, r);
    }
    // several callers may want the same resource in one frame: keep the most urgent priority
    r.priority = r.wantedFrame === this.frame ? Math.min(r.priority, priority) : priority;
    r.wantedFrame = this.frame;
    return r;
  }

  /** Ready bitmap for key without registering interest (fallback lookup). */
  peek(key: string): Resource | undefined {
    const r = this.res.get(key);
    return r && r.state === 'ready' ? r : undefined;
  }

  /** Mark a ready resource as drawn this frame (protects it from eviction, refreshes LRU order). */
  use(r: Resource): ImageBitmap { r.usedFrame = this.frame; return r.bitmap!; }

  endFrame(): void {
    for (const r of this.res.values()) {
      if (r.wantedFrame === this.frame || r.waiters.length) continue;
      if (r.state === 'loading') { r.abort?.abort(); this.res.delete(r.key); }
      else if (r.state !== 'ready') this.res.delete(r.key);   // queued or failed and no longer visible: forget it
    }
    this.pump();
    this.evict();
  }

  /** Explicit request (not tied to the view). Resolves null if the resource keeps failing. */
  load(key: string, url: string, priority: number, decode?: ImageBitmapOptions): Promise<ImageBitmap | null> {
    const r = this.want(key, url, priority, decode);
    r.usedFrame = this.frame;
    if (r.state === 'ready') return Promise.resolve(r.bitmap);
    const p = new Promise<ImageBitmap | null>((resolve) => r.waiters.push(resolve));
    this.pump();
    return p;
  }

  /** Retry a failed resource immediately (tap-to-retry). */
  retry(key: string): void {
    const r = this.res.get(key);
    if (r?.state === 'failed') { r.retryAt = 0; this.pump(); }
  }

  retryAll(): void {
    for (const r of this.res.values()) if (r.state === 'failed') r.retryAt = 0;
    this.pump();
    this.onChange();
  }

  stats() {
    let ready = 0, queued = 0, failed = 0;
    for (const r of this.res.values()) {
      if (r.state === 'ready') ready++;
      else if (r.state === 'failed') failed++;
      else if (r.state === 'queued') queued++;
    }
    return { bitmaps: ready, bytes: this.bytes, inflight: this.inflight, queued, failed };
  }

  private eligible(r: Resource, now: number): boolean {
    return r.state === 'queued' || (r.state === 'failed' && now >= r.retryAt);
  }

  private pump(): void {
    if (this.inflight >= this.maxConcurrent) return;
    const now = performance.now();
    const candidates = [...this.res.values()].filter((r) => this.eligible(r, now)).sort((a, b) => a.priority - b.priority);
    for (const r of candidates) {
      if (this.inflight >= this.maxConcurrent) break;
      this.start(r);
    }
    // wake up for the earliest pending retry
    let next = Infinity;
    for (const r of this.res.values()) if (r.state === 'failed') next = Math.min(next, r.retryAt);
    this.scheduleWake(next);
  }

  private scheduleWake(at: number): void {
    if (at === Infinity || at >= this.wakeAt) return;
    clearTimeout(this.wakeTimer);
    this.wakeAt = at;
    this.wakeTimer = window.setTimeout(() => { this.wakeAt = Infinity; this.pump(); this.onChange(); }, Math.max(0, at - performance.now()) + 20);
  }

  private async start(r: Resource): Promise<void> {
    const ctrl = new AbortController();
    r.state = 'loading'; r.abort = ctrl; this.inflight++;
    try {
      const resp = await fetch(r.url, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const bmp = await createImageBitmap(blob, r.decode);
      if (ctrl.signal.aborted) { bmp.close(); return; }
      r.bitmap = bmp; r.bytes = bmp.width * bmp.height * 4; r.state = 'ready'; r.arrivedAt = performance.now();
      r.usedFrame = this.frame;
      this.bytes += r.bytes;
      this.settle(r, bmp);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      r.attempts++;
      r.state = 'failed';
      r.retryAt = performance.now() + (RETRY_DELAYS_MS[r.attempts - 1] ?? SLOW_RETRY_MS);
      if (r.attempts > MAX_FAST_RETRIES) this.settle(r, null);  // explicit callers get null; the view keeps retrying slowly
    } finally {
      this.inflight--;
      r.abort = null;
      this.pump();
      this.onChange();
    }
  }

  private settle(r: Resource, b: ImageBitmap | null): void {
    const w = r.waiters; r.waiters = [];
    for (const fn of w) fn(b);
  }

  /** Close least recently drawn bitmaps until under budget. Bitmaps drawn this frame are never evicted. */
  private evict(): void {
    if (this.bytes <= this.budgetBytes) return;
    const ready = [...this.res.values()].filter((r) => r.state === 'ready' && r.usedFrame < this.frame).sort((a, b) => a.usedFrame - b.usedFrame);
    for (const r of ready) {
      if (this.bytes <= this.budgetBytes) break;
      r.bitmap!.close();
      this.bytes -= r.bytes;
      this.res.delete(r.key);
    }
  }
}
