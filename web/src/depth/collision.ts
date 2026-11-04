// Top-down collision field for the goose actor (data: web/public/data/collision/, built by pipeline/build_collision.py).
// Pure TypeScript (no three.js, no DOM): runs in the browser and in Node >= 18 for self-checks.
//
// Grid: 2 m cells in local ENU metres, 512 m chunks of 256 x 256 cells, chunk (ix, iy) = floor(x / 512), floor(y / 512).
// Global cell (gc, gr) = floor(x / 2), floor(y / 2) has its centre at ((gc + 0.5) * 2, (gr + 0.5) * 2). Inside a chunk PNG the
// row order is north-up: col = gc - 256 ix, row = 255 - (gr - 256 iy). See docs/DEPTH_DATA.md for the full codec.
//
// Sampling rules: ground() is bilinear (smooth terrain); solidTop(), canopyTop() and kind() use the nearest cell so walls stay sharp.
// Everything is synchronous once the chunks are loaded; call ensure()/ensureAround() ahead of the actor to load them.
import type { Vec3 } from '../frame';

export const KIND_BUILDING = 1;
export const KIND_TREE = 2;
export const KIND_WATER = 4;
export const KIND_VALID = 8;

export interface CollisionMeta {
  version: number;
  scope: string;
  cell_m: number;
  chunk_cells: number;
  chunk_m: number;
  datum_m: number;
  z_codec: { floor_m: number; units_per_m: number };
  files: { solid: string; ground: string };   // patterns with {ix} {iy}, relative to meta.json
  canopy_units_per_m: number;
  chunks: Record<string, { zmax: number | null; zmin: number | null; v: string }>;
}

export type HitKind = 'none' | 'building' | 'ground' | 'tree';

export interface SweepResult {
  hit: HitKind;
  /** Last non-penetrating position along the segment (within ~3 cm); equals `to` when hit = 'none'. */
  point: Vec3;
  /** Unit contact normal: horizontal for walls / tree sides, up (0,0,1) for ground, roofs and canopy tops; zero when hit = 'none'. */
  normal: Vec3;
  /** Fraction of the segment travelled before contact, in [0, 1]. */
  t: number;
  /** True when part of the swept volume lies over chunks that are not loaded (treated as free space). */
  missing: boolean;
}

export interface CollisionOptions {
  /** Bounded chunk cache size. Each decoded chunk holds ~390 KB. Default 48 (~19 MB). */
  maxChunks?: number;
  /** Byte loader (defaults to fetch). Node self-checks pass a file reader. */
  load?: (url: string) => Promise<ArrayBuffer | Uint8Array>;
}

interface Chunk {
  solid: Uint16Array;   // packed solid-top codes, row-major north-up
  ground: Uint16Array;  // packed terrain codes
  canopy: Uint8Array;   // canopy height above ground, 1 / canopy_units_per_m m
  kind: Uint8Array;     // KIND_* bits
  used: number;         // LRU clock
}

const RING = 8;
const RING_DX = Array.from({ length: RING }, (_, k) => Math.cos((k / RING) * Math.PI * 2));
const RING_DY = Array.from({ length: RING }, (_, k) => Math.sin((k / RING) * Math.PI * 2));
const NORMAL_RING = 24;           // directions used to estimate a side normal after a hit
const REFINE_STEPS = 5;           // bisection after a hit: 1 m / 2^5 ~ 3 cm contact precision

// Probe outcome codes (internal).
const P_NONE = 0, P_WALL = 1, P_ROOF = 2, P_TREE_SIDE = 3, P_TREE_TOP = 4, P_GROUND = 5;

const chunkKey = (ix: number, iy: number) => (ix + 32768) * 65536 + (iy + 32768);

export class CollisionField {
  private readonly chunks = new Map<number, Chunk>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly failed = new Set<number>();
  private readonly zmax = new Map<number, number>();   // per listed chunk: highest solid / canopy z (fast reject)
  private readonly maxChunks: number;
  private readonly load: (url: string) => Promise<ArrayBuffer | Uint8Array>;
  private readonly cell: number;
  private readonly floor: number;
  private readonly units: number;
  private readonly canopyUnits: number;
  private clock = 0;
  // one-entry lookup cache (consecutive samples almost always hit the same chunk)
  private lastKey = NaN;
  private lastChunk: Chunk | undefined;
  private sawMissing = false;   // set by probe() during one sweep

  readonly meta: CollisionMeta;
  private readonly baseUrl: string;

  // (no constructor parameter properties: the module must also run under Node's type stripping)
  private constructor(meta: CollisionMeta, baseUrl: string, opts: CollisionOptions) {
    this.meta = meta;
    this.baseUrl = baseUrl;
    if (meta.chunk_cells !== 256) throw new Error(`collision: unsupported chunk_cells ${meta.chunk_cells}`);
    this.maxChunks = Math.max(4, opts.maxChunks ?? 48);
    this.load = opts.load ?? (async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
      return r.arrayBuffer();
    });
    this.cell = meta.cell_m;
    this.floor = meta.z_codec.floor_m;
    this.units = meta.z_codec.units_per_m;
    this.canopyUnits = meta.canopy_units_per_m;
    for (const [k, c] of Object.entries(meta.chunks)) {
      const [ix, iy] = k.split('_').map(Number);
      this.zmax.set(chunkKey(ix, iy), c.zmax ?? -Infinity);
    }
  }

  /** Load meta.json from `metaUrl` (e.g. 'data/collision/meta.json'); chunk files resolve relative to it. */
  static async open(metaUrl: string, opts: CollisionOptions = {}): Promise<CollisionField> {
    const loader = opts.load ?? (async (u: string) => (await fetch(u)).arrayBuffer());
    const meta = JSON.parse(new TextDecoder().decode(await loader(metaUrl))) as CollisionMeta;
    return new CollisionField(meta, metaUrl.slice(0, metaUrl.lastIndexOf('/') + 1), opts);
  }

  // ------------------------------------------------------------------ loading

  /** Load every listed chunk intersecting the bbox (local metres). Keep the box small (actor neighbourhood): the cache is bounded. */
  async ensure(x0: number, y0: number, x1: number, y1: number): Promise<void> {
    const m = this.meta.chunk_m, jobs: Promise<void>[] = [];
    for (let ix = Math.floor(Math.min(x0, x1) / m); ix <= Math.floor(Math.max(x0, x1) / m); ix++)
      for (let iy = Math.floor(Math.min(y0, y1) / m); iy <= Math.floor(Math.max(y0, y1) / m); iy++) jobs.push(this.loadChunk(ix, iy));
    await Promise.all(jobs);
  }

  ensureAround(x: number, y: number, radius: number): Promise<void> {
    return this.ensure(x - radius, y - radius, x + radius, y + radius);
  }

  /** True when the chunk under (x, y) is decoded and in memory. */
  isLoaded(x: number, y: number): boolean {
    return this.chunkAt(Math.floor(x / this.cell), Math.floor(y / this.cell)) !== undefined;
  }

  /** True when collision data exists for (x, y) at all (chunk listed in meta.json). */
  covers(x: number, y: number): boolean {
    const m = this.meta.chunk_m;
    return this.zmax.has(chunkKey(Math.floor(x / m), Math.floor(y / m)));
  }

  stats(): { loaded: number; capacity: number; bytes: number } {
    return { loaded: this.chunks.size, capacity: this.maxChunks, bytes: this.chunks.size * 256 * 256 * 6 };
  }

  private loadChunk(ix: number, iy: number): Promise<void> {
    const key = chunkKey(ix, iy);
    const have = this.chunks.get(key);
    if (have) { have.used = ++this.clock; return Promise.resolve(); }
    const rec = this.meta.chunks[`${ix}_${iy}`];
    if (!rec || this.failed.has(key)) return Promise.resolve();
    const inflight = this.pending.get(key);
    if (inflight) return inflight;
    const url = (pattern: string) => `${this.baseUrl}${pattern.replace('{ix}', String(ix)).replace('{iy}', String(iy))}?v=${rec.v}`;
    const job = (async () => {
      try {
        const [s, g] = await Promise.all([this.load(url(this.meta.files.solid)), this.load(url(this.meta.files.ground))]);
        const [sp, gp] = await Promise.all([decodePng(toBytes(s)), decodePng(toBytes(g))]);
        if (sp.width !== 256 || sp.height !== 256 || sp.channels !== 4 || gp.width !== 256 || gp.height !== 256 || gp.channels < 3)
          throw new Error('unexpected chunk image format');
        const n = 256 * 256;
        const c: Chunk = { solid: new Uint16Array(n), ground: new Uint16Array(n), canopy: new Uint8Array(n), kind: new Uint8Array(n), used: ++this.clock };
        const S = sp.data, G = gp.data, gs = gp.channels;
        for (let k = 0; k < n; k++) {
          c.solid[k] = (S[k * 4] << 8) | S[k * 4 + 1];
          c.canopy[k] = S[k * 4 + 2];
          c.kind[k] = S[k * 4 + 3];
          c.ground[k] = (G[k * gs] << 8) | G[k * gs + 1];
        }
        this.insert(key, c);
      } catch (e) {
        this.failed.add(key);   // do not retry every frame; the area simply reads as "not loaded"
        console.warn(`collision: chunk ${ix},${iy} unavailable`, e);
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, job);
    return job;
  }

  private insert(key: number, c: Chunk) {
    this.chunks.set(key, c);
    while (this.chunks.size > this.maxChunks) {
      let oldest = -1, age = Infinity;
      for (const [k, v] of this.chunks) if (v.used < age && k !== key) { age = v.used; oldest = k; }
      this.chunks.delete(oldest);
    }
    this.lastKey = NaN; this.lastChunk = undefined;
  }

  // ------------------------------------------------------------------ sampling

  private chunkAt(gc: number, gr: number): Chunk | undefined {
    const key = chunkKey(gc >> 8, gr >> 8);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastChunk = this.chunks.get(key);
      if (this.lastChunk) this.lastChunk.used = ++this.clock;
    }
    return this.lastChunk;
  }

  /** Flat index of global cell (gc, gr) inside its chunk (north-up rows). */
  private static index(gc: number, gr: number): number {
    return (255 - (gr & 255)) * 256 + (gc & 255);
  }

  private z(code: number): number { return code / this.units + this.floor; }

  /** Terrain z (bilinear). NaN when not loaded / outside data. */
  ground(x: number, y: number): number {
    const fx = x / this.cell - 0.5, fy = y / this.cell - 0.5;
    const gc = Math.floor(fx), gr = Math.floor(fy), tx = fx - gc, ty = fy - gr;
    const a = this.groundCell(gc, gr), b = this.groundCell(gc + 1, gr), c = this.groundCell(gc, gr + 1), d = this.groundCell(gc + 1, gr + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  private groundCell(gc: number, gr: number): number {
    const ch = this.chunkAt(gc, gr);
    if (!ch) return NaN;
    const k = CollisionField.index(gc, gr);
    return ch.kind[k] & KIND_VALID ? this.z(ch.ground[k]) : NaN;
  }

  /** Highest solid surface (terrain or building / roof) at (x, y). NaN when not loaded. */
  solidTop(x: number, y: number): number {
    const gc = Math.floor(x / this.cell), gr = Math.floor(y / this.cell);
    const ch = this.chunkAt(gc, gr);
    if (!ch) return NaN;
    const k = CollisionField.index(gc, gr);
    const kb = ch.kind[k];
    if (!(kb & KIND_VALID)) return NaN;
    const g = this.ground(x, y);
    return kb & KIND_BUILDING ? Math.max(this.z(ch.solid[k]), g) : g;
  }

  /** Absolute z of the tree canopy top at (x, y); NaN when there is no canopy (or not loaded). */
  canopyTop(x: number, y: number): number {
    const gc = Math.floor(x / this.cell), gr = Math.floor(y / this.cell);
    const ch = this.chunkAt(gc, gr);
    if (!ch) return NaN;
    const k = CollisionField.index(gc, gr);
    return ch.canopy[k] ? this.z(ch.ground[k]) + ch.canopy[k] / this.canopyUnits : NaN;
  }

  /** KIND_* bit mask at (x, y); 0 when not loaded (KIND_VALID absent). */
  kind(x: number, y: number): number {
    const gc = Math.floor(x / this.cell), gr = Math.floor(y / this.cell);
    const ch = this.chunkAt(gc, gr);
    return ch ? ch.kind[CollisionField.index(gc, gr)] : 0;
  }

  /** Highest obstacle (solid or canopy) at (x, y): the minimum safe altitude for a point-sized flyer. NaN when not loaded. */
  obstacleTop(x: number, y: number): number {
    const s = this.solidTop(x, y), c = this.canopyTop(x, y);
    return c > s ? c : s;
  }

  // ------------------------------------------------------------------ sweep

  /**
   * Move a sphere of `radius` metres from `from` to `to`, sampling at <= `step` m (default and maximum 1 m).
   * The first contact is refined by bisection. Unloaded chunks are free space (result.missing = true) unless the
   * chunk's precomputed zmax proves the sphere passes above everything in it.
   */
  sweep(from: Vec3, to: Vec3, radius = 0, step = 1): SweepResult {
    this.sawMissing = false;
    const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    const n = Math.max(1, Math.ceil(len / Math.min(1, Math.max(0.05, step))));
    const at = (t: number): Vec3 => [from[0] + dx * t, from[1] + dy * t, from[2] + dz * t];
    let prev = -1;
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      let code = this.probe(from[0] + dx * t, from[1] + dy * t, from[2] + dz * t, radius);
      if (code === P_NONE) { prev = t; continue; }
      let lo = prev, hi = t;
      if (lo >= 0) {
        for (let k = 0; k < REFINE_STEPS; k++) {
          const mid = (lo + hi) / 2;
          const c = this.probe(from[0] + dx * mid, from[1] + dy * mid, from[2] + dz * mid, radius);
          if (c === P_NONE) lo = mid; else { hi = mid; code = c; }
        }
      }
      const tc = Math.max(0, lo);
      const p = at(tc), h = at(hi);
      // A centre-column contact is a roof / canopy top only if the sphere was above that column just before;
      // otherwise it entered sideways (e.g. a point-sized probe flying into a facade) and the contact is a side.
      if ((code === P_ROOF || code === P_TREE_TOP) && lo >= 0) {
        const top = code === P_ROOF ? this.solidTop(h[0], h[1]) : this.canopyTop(h[0], h[1]);
        if (p[2] - radius < top - 0.05) code = code === P_ROOF ? P_WALL : P_TREE_SIDE;
      }
      const normal: Vec3 = code === P_WALL || code === P_TREE_SIDE ? this.sideNormal(h, radius, code === P_WALL, dx, dy) : [0, 0, 1];
      return { hit: hitName(code), point: p, normal, t: tc, missing: this.sawMissing };
    }
    return { hit: 'none', point: [to[0], to[1], to[2]], normal: [0, 0, 0], t: 1, missing: this.sawMissing };
  }

  /**
   * Horizontal outward normal of a wall / crown side at a contact: occupancy-weighted ring of columns taller than the
   * contact height around the contact point. For a straight facade the occupied arc is symmetric about its normal.
   */
  private sideNormal(p: Vec3, r: number, building: boolean, mdx: number, mdy: number): Vec3 {
    const R = r + 1.5 * this.cell;
    let nx = 0, ny = 0;
    for (let k = 0; k < NORMAL_RING; k++) {
      const a = (k / NORMAL_RING) * Math.PI * 2, cx = Math.cos(a), cy = Math.sin(a);
      for (const f of [0.5, 1]) {
        const qx = p[0] + cx * R * f, qy = p[1] + cy * R * f;
        const occupied = building ? this.kind(qx, qy) & KIND_BUILDING && this.solidTop(qx, qy) > p[2] : this.canopyTop(qx, qy) > p[2];
        if (occupied) { nx -= cx; ny -= cy; }
      }
    }
    let l = Math.hypot(nx, ny);
    if (l < 1e-6) { nx = -mdx; ny = -mdy; l = Math.hypot(nx, ny); }   // enclosed or degenerate: push back along the motion
    return l < 1e-6 ? [0, 0, 1] : [nx / l, ny / l, 0];
  }

  /** Sphere-vs-columns test at one position (see docs/DEPTH_DATA.md for the contact rules). */
  private probe(x: number, y: number, z: number, r: number): number {
    if (this.passesAbove(x, y, z - r, r)) return P_NONE;
    const bottom = z - r;
    // ring columns at the sphere's equator: any column taller than the centre height touches the side of the sphere
    let tree = false;
    if (r > 0) {
      for (let k = 0; k < RING; k++) {
        const qx = x + RING_DX[k] * r, qy = y + RING_DY[k] * r;
        const s = this.solidTop(qx, qy);
        if (s !== s) { this.sawMissing ||= !this.isLoaded(qx, qy); continue; }
        if (z < s && this.kind(qx, qy) & KIND_BUILDING) return P_WALL;
        if (z < this.canopyTop(qx, qy)) tree = true;
      }
    }
    // centre column: the bottom of the sphere must stay above the surface directly below
    const s = this.solidTop(x, y);
    if (s !== s) { this.sawMissing ||= !this.isLoaded(x, y); return P_NONE; }
    if (this.kind(x, y) & KIND_BUILDING && bottom < s) return P_ROOF;
    if (tree) return P_TREE_SIDE;
    if (bottom < this.canopyTop(x, y)) return P_TREE_TOP;
    if (bottom < s) return P_GROUND;
    return P_NONE;
  }

  /** Fast reject: every chunk the sphere touches is listed and its zmax is below the sphere bottom (no decode needed). */
  private passesAbove(x: number, y: number, bottom: number, r: number): boolean {
    const m = this.meta.chunk_m;
    const ix0 = Math.floor((x - r) / m), ix1 = Math.floor((x + r) / m), iy0 = Math.floor((y - r) / m), iy1 = Math.floor((y + r) / m);
    for (let ix = ix0; ix <= ix1; ix++)
      for (let iy = iy0; iy <= iy1; iy++) {
        const zm = this.zmax.get(chunkKey(ix, iy));
        if (zm === undefined || !(bottom > zm)) return false;
      }
    return true;
  }
}

function hitName(code: number): HitKind {
  switch (code) {
    case P_WALL: case P_ROOF: return 'building';
    case P_TREE_SIDE: case P_TREE_TOP: return 'tree';
    case P_GROUND: return 'ground';
    default: return 'none';
  }
}

function toBytes(b: ArrayBuffer | Uint8Array): Uint8Array {
  return b instanceof Uint8Array ? b : new Uint8Array(b);
}

// ------------------------------------------------------------------ PNG decoding
// The chunks keep data in the alpha channel, so they must NOT go through a 2D canvas (premultiplied alpha would
// corrupt RGB wherever A < 255). This minimal decoder covers what the pipeline writes: 8-bit, non-interlaced,
// grey / grey+alpha / RGB / RGBA. zlib inflation uses the platform DecompressionStream (browsers, Node >= 18).

export interface DecodedPng { width: number; height: number; channels: number; data: Uint8Array }

export async function decodePng(bytes: Uint8Array): Promise<DecodedPng> {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let k = 0; k < 8; k++) if (bytes[k] !== sig[k]) throw new Error('not a PNG');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, channels = 0;
  const idat: Uint8Array[] = [];
  for (let p = 8; p + 8 <= bytes.length;) {
    const len = dv.getUint32(p), type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const body = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(p + 8); height = dv.getUint32(p + 12);
      const depth = body[8], color = body[9], interlace = body[12];
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[color] ?? 0;
      if (depth !== 8 || !channels || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour ${color}, interlace ${interlace})`);
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!channels || !idat.length) throw new Error('PNG without IHDR / IDAT');
  const stream = new Blob(idat as BlobPart[]).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer());
  const stride = width * channels, out = new Uint8Array(stride * height);
  if (raw.length < (stride + 1) * height) throw new Error('truncated PNG data');
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[dst + i - channels] : 0;
      const b = y > 0 ? out[up + i] : 0;
      const c = y > 0 && i >= channels ? out[up + i - channels] : 0;
      let v = raw[src + i];
      switch (f) {
        case 0: break;
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; break; }
        default: throw new Error(`bad PNG filter ${f}`);
      }
      out[dst + i] = v & 255;
    }
  }
  return { width, height, channels, data: out };
}
