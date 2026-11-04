// MapView: owns the view state, camera motion, tile loading and the base / overlay / aux canvases, and implements
// the MapAPI contract (web/src/types.ts) the effects, actor and UI modules build on.
import { Frame } from '../frame';
import type { CoverageInfo, FrameInfo, Manifest, MapAPI, PerfStats, Settings, ViewState } from '../types';
import { attachInput, type CameraControl } from './input';
import { ResourceLoader } from './loader';
import { FrameStats } from './perf';
import { type DrawParams, type DrawResult, MapRenderer, RAW_DECODE, tileKey } from './renderer';
import { loadSettings, mergeSettings, saveSettings } from './settings';
import {
  clampZoom, easeInOutCubic, flyPath, formatHash, homeView, parseHash, prefersReducedMotion, type Rect, tilesRect,
} from './view';

const MAX_CONCURRENT_FETCHES = 6;
const MB = 1024 * 1024;
const HEIGHT_TILE_CACHE = 32;              // decoded Float32 height tiles kept (1 MB each)
const HASH_WRITE_DELAY_MS = 300;
const SMOOTH_ZOOM_TAU_MS = 70;             // time constant of wheel / key zoom easing
const INERTIA_TAU_MS = 320;                // time constant of drag inertia decay
const KEY_PAN_SPEED = 0.8;                 // CSS px per ms (x2.5 with Shift)
const MOVING_GRACE_MS = 140;               // after the last camera change, redraw once more in high quality

/** Small screens / low-memory devices get a smaller cache and half-resolution aux layers in 'auto' quality. */
const smallScreen = () => Math.min(innerWidth, innerHeight) < 600 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;

type Listener<T> = (x: T) => void;

export async function createMap(root: HTMLElement): Promise<MapAPI> {
  const [manifest, coverage] = await Promise.all([
    fetch('data/manifest.json').then((r) => { if (!r.ok) throw new Error(`manifest.json: HTTP ${r.status}`); return r.json() as Promise<Manifest>; }),
    fetch('data/coverage.json').then((r) => (r.ok ? (r.json() as Promise<CoverageInfo>) : null)).catch(() => null),
  ]);
  if (!manifest.coverage && coverage) manifest.coverage = coverage;
  return new MapView(root, manifest).api;
}

class MapView implements CameraControl {
  readonly frame: Frame;
  readonly api: MapAPI;
  private readonly base: HTMLCanvasElement;
  private readonly baseCtx: CanvasRenderingContext2D;
  private readonly overlay: HTMLCanvasElement;
  private readonly overlayCtx: CanvasRenderingContext2D;
  private readonly hud: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly loader: ResourceLoader;
  private readonly renderer: MapRenderer;
  private readonly bounds: Rect;
  private readonly stats = new FrameStats();

  private settings: Settings = loadSettings();
  private view: ViewState = { cx: 0, cy: 0, zoom: 0.5 };
  private w = 1; private h = 1; private dpr = 1;
  interactive = true;

  // camera motion (at most one of fly / smoothZoom / inertia at a time; key panning composes)
  private fly: { at: (t: number) => ViewState; to: ViewState; start: number; dur: number } | null = null;
  private smoothZoom: { logTarget: number; anchor: [number, number]; sx: number; sy: number } | null = null;
  private inertia: { vx: number; vy: number } | null = null;
  private keyPan = { dx: 0, dy: 0, fast: false };
  private lastMoveT = -1e9;

  // redraw scheduling
  private raf = 0;
  private lastT = 0;
  private baseDirty = true;
  private invalidated = false;
  private lastDrawMoving = false;
  private lastDraw: DrawResult = { tilesDrawn: 0, fading: false, failed: [] };

  // aux layers
  private aux = { height: false, life: false };
  private heightCanvas: HTMLCanvasElement | null = null;
  private lifeCanvas: HTMLCanvasElement | null = null;

  // decoded height tiles (LRU by Map insertion order)
  private readonly heightTiles = new Map<string, Float32Array>();
  private readonly heightLoads = new Map<string, Promise<Float32Array | null>>();
  private scratch: OffscreenCanvasRenderingContext2D | null = null;

  private readonly frameL = new Set<Listener<FrameInfo>>();
  private readonly viewL = new Set<Listener<ViewState>>();
  private readonly settingsL = new Set<Listener<Settings>>();
  private hashTimer = 0;
  private ownHash = location.hash;       // last hash this view wrote (or adopted from navigation)
  private toastTimer = 0;

  constructor(private readonly root: HTMLElement, readonly manifest: Manifest) {
    this.frame = new Frame(manifest);
    this.base = (root.querySelector('#map-base') as HTMLCanvasElement | null) ?? root.appendChild(document.createElement('canvas'));
    this.base.id = 'map-base';
    this.baseCtx = this.base.getContext('2d', { alpha: false })!;
    // overlay: boundary + status badges, above the effects / actor canvases (z-order set in style.css)
    this.overlay = root.appendChild(document.createElement('canvas'));
    this.overlay.id = 'map-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.overlayCtx = this.overlay.getContext('2d')!;
    this.hud = document.createElement('div');
    this.hud.id = 'hud';
    root.after(this.hud);
    this.toastEl = document.createElement('div');
    this.toastEl.id = 'toast';
    this.toastEl.setAttribute('role', 'status');
    this.toastEl.setAttribute('aria-live', 'polite');
    this.hud.after(this.toastEl);

    this.loader = new ResourceLoader(MAX_CONCURRENT_FETCHES, (smallScreen() ? 120 : 220) * MB, () => this.markDirty());
    this.renderer = new MapRenderer(manifest, manifest.coverage ?? null, this.loader);
    const extent = [...Object.values(manifest.tiles).map((t) => [t.i, t.j] as [number, number]), ...(manifest.coverage?.city_tiles ?? [])];
    this.bounds = tilesRect(extent, manifest.frame_px);

    this.api = this.buildApi();
    this.measure();
    this.view = this.clamp(parseHash(location.hash) ?? homeView(manifest, this.w, this.h));
    this.loadOverview();
    attachInput(root, this);
    new ResizeObserver(() => this.measure()).observe(root);
    addEventListener('resize', () => this.measure());   // devicePixelRatio changes (browser zoom, moving screens)
    addEventListener('hashchange', () => {
      this.ownHash = location.hash;
      const v = parseHash(location.hash);
      if (v && formatHash(v) !== formatHash(this.view)) this.setView(v, true);
    });
    this.requestFrame();
  }

  // ------------------------------------------------------------------ public API object

  private buildApi(): MapAPI {
    const self = this;
    return {
      frame: this.frame,
      manifest: this.manifest,
      getView: () => ({ ...this.view }),
      setView: (v, opts) => this.setView({ ...this.view, ...v }, !!opts?.animate),
      screenToCanvas: (sx, sy) => this.screenToCanvas(sx, sy),
      canvasToScreen: (cx, cy) => [(cx - this.view.cx) * this.view.zoom + this.w / 2, (cy - this.view.cy) * this.view.zoom + this.h / 2],
      heightAt: (cx, cy) => this.heightAt(cx, cy),
      getHeightTile: (i, j) => this.getHeightTile(i, j),
      peekHeightTile: (i, j) => this.heightTiles.get(tileKey(i, j)) ?? null,
      getLifeTile: (i, j) => {
        const t = this.renderer.tile(i, j);
        return t ? this.loader.load(this.renderer.lifeKey(i, j, this.frame.F), this.renderer.lifeUrl(t), 0, RAW_DECODE) : Promise.resolve(null);
      },
      get baseCanvas() { return self.base; },
      requestAuxLayers: (l) => this.requestAux(l),
      get heightCanvas() { return self.heightCanvas; },
      get lifeCanvas() { return self.lifeCanvas; },
      on: ((ev: 'frame' | 'viewchange', cb: Listener<never>) => {
        const set = (ev === 'frame' ? this.frameL : this.viewL) as Set<Listener<never>>;
        set.add(cb);
        return () => set.delete(cb);
      }) as MapAPI['on'],
      invalidate: () => { this.invalidated = true; this.requestFrame(); },
      get settings() { return self.settings; },
      onSettings: (cb) => { this.settingsL.add(cb); return () => this.settingsL.delete(cb); },
      updateSettings: (patch) => this.updateSettings(patch),
      setInteractive: (on) => { this.interactive = on; if (!on) { this.inertia = null; this.keyPan = { dx: 0, dy: 0, fast: false }; } },
      perf: () => this.perf(),
      toast: (msg) => this.toast(msg),
      get hudRoot() { return self.hud; },
    };
  }

  // ------------------------------------------------------------------ CameraControl (used by input.ts)

  size() { return { w: this.w, h: this.h }; }
  zoom() { return this.view.zoom; }

  screenToCanvas(sx: number, sy: number): [number, number] {
    return [this.view.cx + (sx - this.w / 2) / this.view.zoom, this.view.cy + (sy - this.h / 2) / this.view.zoom];
  }

  stopMotion(): void {
    this.fly = null; this.smoothZoom = null; this.inertia = null;
  }

  panBy(dx: number, dy: number): void {
    this.fly = null;
    this.applyView({ cx: this.view.cx - dx / this.view.zoom, cy: this.view.cy - dy / this.view.zoom, zoom: this.view.zoom });
  }

  zoomAround(factor: number, sx: number, sy: number, smooth: boolean): void {
    this.fly = null; this.inertia = null;
    const current = this.smoothZoom ? this.smoothZoom.logTarget : Math.log(this.view.zoom);
    const logTarget = Math.log(clampZoom(Math.exp(current) * factor));
    // keep the anchor of an ongoing smooth zoom if the pointer has not moved, so repeated wheel ticks stay put
    const keep = this.smoothZoom && Math.hypot(this.smoothZoom.sx - sx, this.smoothZoom.sy - sy) < 2;
    const anchor = keep ? this.smoothZoom!.anchor : this.screenToCanvas(sx, sy);
    if (!smooth || prefersReducedMotion()) {
      this.smoothZoom = null;
      this.placeAnchor(anchor, sx, sy, Math.exp(logTarget));
      return;
    }
    this.smoothZoom = { logTarget, anchor, sx, sy };
    this.requestFrame();
  }

  placeAnchor(anchor: [number, number], sx: number, sy: number, zoom: number): void {
    const z = clampZoom(zoom);
    this.applyView({ cx: anchor[0] - (sx - this.w / 2) / z, cy: anchor[1] - (sy - this.h / 2) / z, zoom: z });
  }

  startInertia(vx: number, vy: number): void {
    if (prefersReducedMotion() || Math.hypot(vx, vy) < 0.05) return;
    this.inertia = { vx, vy };
    this.requestFrame();
  }

  setKeyPan(dx: number, dy: number, fast: boolean): void {
    if (!this.interactive) dx = dy = 0;
    if (dx || dy) this.fly = null;
    this.keyPan = { dx, dy, fast };
    this.requestFrame();
  }

  home(): void { this.setView(homeView(this.manifest, this.w, this.h), true); }

  tap(sx: number, sy: number): void {
    const [i, j] = this.frame.tileOf(...this.screenToCanvas(sx, sy));
    const failed = this.lastDraw.failed.find((f) => f.i === i && f.j === j);
    if (failed) this.loader.retry(failed.key);
  }

  // ------------------------------------------------------------------ view state

  private clamp(v: ViewState): ViewState {
    const b = this.bounds, m = this.frame.F / 2;
    return {
      cx: Math.min(b.x1 + m, Math.max(b.x0 - m, v.cx)),
      cy: Math.min(b.y1 + m, Math.max(b.y0 - m, v.cy)),
      zoom: clampZoom(v.zoom),
    };
  }

  private setView(v: ViewState, animate: boolean): void {
    const to = this.clamp(v);
    this.stopMotion();
    if (!animate || prefersReducedMotion()) { this.applyView(to); return; }
    const path = flyPath(this.view, to, this.w);
    if (!Number.isFinite(path.S) || path.S < 1e-3) { this.applyView(to); return; }
    this.fly = { at: path.at, to, start: performance.now(), dur: Math.min(2600, Math.max(450, path.S * 650)) };
    this.requestFrame();
  }

  /** Single place where the view changes: clamps, marks dirty, notifies, schedules the URL update. */
  private applyView(v: ViewState): void {
    const c = this.clamp(v);
    if (c.cx === this.view.cx && c.cy === this.view.cy && c.zoom === this.view.zoom) return;
    this.view = c;
    this.lastMoveT = performance.now();
    this.markDirty();
    for (const cb of this.viewL) cb({ ...c });
    this.scheduleHashWrite();
  }

  /** Mirror the view into the URL (replaceState, debounced) once the camera has come to rest. */
  private scheduleHashWrite(): void {
    clearTimeout(this.hashTimer);
    this.hashTimer = window.setTimeout(() => {
      if (this.fly || this.smoothZoom || this.inertia || this.keyPan.dx || this.keyPan.dy) { this.scheduleHashWrite(); return; }
      // a hash navigation whose hashchange has not been handled yet wins over our pending write
      if (location.hash !== this.ownHash) return;
      this.ownHash = formatHash(this.view);
      history.replaceState(history.state, '', this.ownHash);
    }, HASH_WRITE_DELAY_MS);
  }

  /** Advance fly-to, smooth zoom, inertia and key panning by dt. Returns true while any is still running. */
  private stepMotion(t: number, dt: number): boolean {
    if (this.fly) {
      const u = Math.min(1, (t - this.fly.start) / this.fly.dur);
      this.applyView(u >= 1 ? this.fly.to : this.fly.at(easeInOutCubic(u)));
      if (u >= 1) this.fly = null;
    }
    if (this.smoothZoom) {
      const z = this.smoothZoom, cur = Math.log(this.view.zoom);
      const next = Math.abs(z.logTarget - cur) < 0.002 ? z.logTarget : cur + (z.logTarget - cur) * (1 - Math.exp(-dt / SMOOTH_ZOOM_TAU_MS));
      this.placeAnchor(z.anchor, z.sx, z.sy, Math.exp(next));
      if (next === z.logTarget) this.smoothZoom = null;
    }
    if (this.inertia) {
      this.panBy(this.inertia.vx * dt, this.inertia.vy * dt);
      const k = Math.exp(-dt / INERTIA_TAU_MS);
      this.inertia.vx *= k; this.inertia.vy *= k;
      if (Math.hypot(this.inertia.vx, this.inertia.vy) < 0.01) this.inertia = null;
    }
    const kp = this.keyPan;
    if (kp.dx || kp.dy) {
      const sp = KEY_PAN_SPEED * (kp.fast ? 2.5 : 1) * dt;
      this.panBy(-kp.dx * sp, -kp.dy * sp);
    }
    return !!(this.fly || this.smoothZoom || this.inertia || kp.dx || kp.dy);
  }

  // ------------------------------------------------------------------ frame loop

  private markDirty(): void { this.baseDirty = true; this.requestFrame(); }

  private requestFrame(): void {
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(t: number): void {
    this.raf = 0;
    const dt = Math.min(64, this.lastT ? t - this.lastT : 16);
    this.lastT = t;
    const animating = this.stepMotion(t, dt);
    const moving = animating || t - this.lastMoveT < MOVING_GRACE_MS;
    if (this.lastDrawMoving && !moving) this.baseDirty = true;   // final high-quality pass after motion

    const drew = this.baseDirty;
    const t0 = performance.now();
    if (this.baseDirty) this.draw(t, moving);
    const invalidated = this.invalidated;
    this.invalidated = false;
    if (drew || invalidated) {
      const info: FrameInfo = { view: { ...this.view }, width: this.w, height: this.h, dpr: this.dpr, time: t, baseDirty: drew };
      for (const cb of this.frameL) cb(info);
      this.stats.record(t, performance.now() - t0);
    }
    if (animating || moving || this.lastDraw.fading || this.invalidated || this.baseDirty) this.requestFrame();
    else this.lastT = 0;
  }

  private draw(now: number, moving: boolean): void {
    this.baseDirty = false;
    this.lastDrawMoving = moving;
    const p: DrawParams = { view: this.view, w: this.w, h: this.h, dpr: this.dpr, now, coverage: this.settings.coverage, moving };
    this.loader.beginFrame();
    this.lastDraw = this.renderer.drawBase(this.baseCtx, p);
    if (this.aux.height && this.heightCanvas) this.renderer.drawAux('height', this.heightCanvas.getContext('2d')!, p);
    if (this.aux.life && this.lifeCanvas) this.renderer.drawAux('life', this.lifeCanvas.getContext('2d')!, p);
    this.renderer.drawOverlay(this.overlayCtx, p, this.lastDraw);
    this.loader.endFrame();
    if (this.lastDraw.fading) this.baseDirty = true;            // keep redrawing until fade-ins complete
  }

  private measure(): void {
    const w = Math.max(1, this.root.clientWidth), h = Math.max(1, this.root.clientHeight);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    for (const c of [this.base, this.overlay]) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    this.sizeAux();
    this.markDirty();
  }

  // ------------------------------------------------------------------ aux layers

  private auxScale(): number {
    const q = this.settings.quality;
    return q === 'low' || (q === 'auto' && smallScreen()) ? 0.5 : 1;
  }

  private requestAux(l: { height?: boolean; life?: boolean }): void {
    if (l.height !== undefined) this.aux.height = l.height;
    if (l.life !== undefined) this.aux.life = l.life;
    // canvases stay readable until disabled; they are never attached to the DOM
    if (this.aux.height && !this.heightCanvas) this.heightCanvas = document.createElement('canvas');
    if (this.aux.life && !this.lifeCanvas) this.lifeCanvas = document.createElement('canvas');
    if (!this.aux.height) this.heightCanvas = null;
    if (!this.aux.life) this.lifeCanvas = null;
    this.sizeAux();
    this.markDirty();
  }

  private sizeAux(): void {
    const s = this.auxScale();
    for (const c of [this.heightCanvas, this.lifeCanvas]) {
      if (!c) continue;
      const W = Math.max(1, Math.round(this.base.width * s)), H = Math.max(1, Math.round(this.base.height * s));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    }
  }

  // ------------------------------------------------------------------ heights

  private heightAt(cx: number, cy: number): number {
    const [i, j] = this.frame.tileOf(cx, cy);
    const key = tileKey(i, j);
    const tile = this.heightTiles.get(key);
    if (!tile) {
      if (this.renderer.tile(i, j)) void this.getHeightTile(i, j);   // warm the cache for the next call
      return NaN;
    }
    const n = this.frame.heightPx, k = n / this.frame.F;
    const tx = Math.min(n - 1, Math.max(0, Math.floor((cx - i * this.frame.F) * k)));
    const ty = Math.min(n - 1, Math.max(0, Math.floor((cy - j * this.frame.F) * k)));
    return tile[ty * n + tx];
  }

  private getHeightTile(i: number, j: number): Promise<Float32Array | null> {
    const key = tileKey(i, j);
    const cached = this.heightTiles.get(key);
    if (cached) { this.heightTiles.delete(key); this.heightTiles.set(key, cached); return Promise.resolve(cached); }
    const t = this.renderer.tile(i, j);
    if (!t) return Promise.resolve(null);
    let p = this.heightLoads.get(key);
    if (!p) {
      const n = this.frame.heightPx;
      p = this.loader.load(this.renderer.heightKey(i, j, n), this.renderer.heightUrl(t), 0, RAW_DECODE).then((bmp) => {
        this.heightLoads.delete(key);
        if (!bmp) return null;
        const data = this.decodeHeights(bmp);
        this.heightTiles.set(key, data);
        while (this.heightTiles.size > HEIGHT_TILE_CACHE) this.heightTiles.delete(this.heightTiles.keys().next().value!);
        return data;
      });
      this.heightLoads.set(key, p);
    }
    return p;
  }

  private decodeHeights(bmp: ImageBitmap): Float32Array {
    const n = this.frame.heightPx;
    this.scratch ??= new OffscreenCanvas(n, n).getContext('2d', { willReadFrequently: true })!;
    this.scratch.clearRect(0, 0, n, n);
    this.scratch.drawImage(bmp, 0, 0);
    const px = this.scratch.getImageData(0, 0, n, n).data;
    const out = new Float32Array(n * n);
    for (let k = 0; k < n * n; k++) out[k] = this.frame.decodeHeight(px[4 * k], px[4 * k + 1], px[4 * k + 2]);
    return out;
  }

  // ------------------------------------------------------------------ misc

  private async loadOverview(): Promise<void> {
    try {
      const r = await fetch(`data/${this.manifest.overview.url}?v=${encodeURIComponent(this.manifest.generated_utc)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this.renderer.setOverview(await createImageBitmap(await r.blob()));
      this.markDirty();
    } catch (e) {
      console.warn('overview unavailable; zoomed-out view will load individual tiles', e);
      this.renderer.setOverview(null);
      this.markDirty();
    }
  }

  private updateSettings(patch: Partial<Settings>): void {
    const next = mergeSettings(this.settings, patch);
    if (JSON.stringify(next) === JSON.stringify(this.settings)) return;
    this.settings = next;
    saveSettings(patch);
    this.sizeAux();
    this.markDirty();
    for (const cb of this.settingsL) cb(next);
  }

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2800);
  }

  private perf(): PerfStats {
    const l = this.loader.stats();
    const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
    return {
      ...this.stats.summary(performance.now()),
      bitmaps: l.bitmaps, bitmapMB: Math.round((l.bytes / MB) * 10) / 10, budgetMB: Math.round(this.loader.budgetBytes / MB),
      heightTiles: this.heightTiles.size, inflight: l.inflight, queued: l.queued, failed: l.failed,
      tilesDrawn: this.lastDraw.tilesDrawn, heapMB: mem ? Math.round(mem.usedJSHeapSize / MB) : null,
      dpr: this.dpr, viewport: [this.w, this.h],
    };
  }
}
