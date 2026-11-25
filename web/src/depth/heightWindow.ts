// 3 x 3 tile window of decoded visible-surface heights around the actor, shared by the occlusion and shadow passes.
//
// Layout: one Float32 value per height texel (each covers 2 x 2 artwork px, sampled at the block centre), 1536 x 1536
// texels. The array is a ring: the texel for canvas px (cx, cy) is (floor(cx / 2) mod 1536, floor(cy / 2) mod 1536), so
// tile (i, j) always lives in block (i mod 3, j mod 3) and keeps that block for as long as it is in the window.
// Crossing a tile boundary therefore rewrites only the three blocks whose tiles changed; nothing is shifted. The window
// itself is canvas px [originX, originX + 3072) x [originY, originY + 3072): readers test that range first, because a
// texel outside it would alias onto some other tile's block. Missing tiles and invalid texels hold HEIGHT_UNKNOWN, which
// the shaders treat as "no data": no occlusion and no shadow there (never an invented surface).
//
// Every renderer gets its own R32F DataTexture over the same array (one GL context cannot sample another's texture);
// flush() uploads the blocks that changed, at most once per frame. No three.js at runtime here: this module is part of
// the always-loaded actor shell.
import type { DataTexture } from 'three';
import type { MapAPI } from '../types';

export const HEIGHT_UNKNOWN = -10000;
const EMPTY = new Float32Array([HEIGHT_UNKNOWN]);
/** Loader priority of the read-ahead ring: behind everything on screen (the map's visible tiles are 0-10, its own ring 100+). */
const RING_PRIORITY = 200;

/** Upload texels [x, x + size) x [y, y + size) of the window array into one renderer's texture. */
export type BlockUpload = (x: number, y: number, size: number) => void;

const mod = (a: number, n: number) => ((a % n) + n) % n;

export class HeightWindow {
  readonly tilesAcross = 3;
  readonly texels: number;
  originX = 0;
  originY = 0;
  private data: Float32Array | null = null;
  private centre: [number, number] | null = null;
  private generation = 0;      // bumps on every recentre so late tile loads for an old window are dropped
  /** Tile key ('i_j') whose heights each block holds, '' while the block is unknown. Row-major, block = row * 3 + col. */
  private readonly held: string[] = Array<string>(9).fill('');
  private readonly dirty = new Set<number>();
  /** The array was (re)allocated: three.js uploads all of it on the next render, so block uploads would be redundant. */
  private whole = false;
  /** Renderer textures over the array, each with its block uploader (null: re-upload the whole texture instead). */
  private readonly textures = new Map<DataTexture, BlockUpload | null>();
  /** Whether a decoded tile contains invalid (NaN) texels, so the common all-valid tile is copied without a fix-up pass. */
  private readonly invalid = new WeakMap<Float32Array, boolean>();
  private readonly tilePx: number;
  private readonly tileTexels: number;

  constructor(private readonly map: MapAPI) {
    this.tilePx = map.frame.F;
    this.tileTexels = map.frame.heightPx;
    this.texels = this.tileTexels * this.tilesAcross;
  }

  /** Tile (i, j) currently at the window centre, or null before the first centreOn(). */
  get centreTile(): [number, number] | null { return this.centre; }

  /** The window's current array (textures are created over it by shaders.ts heightTexture()). */
  get array(): Float32Array { return this.ensureData(); }

  /** Track a renderer's texture over the array: uploaded by flush(), re-pointed and freed by release(). */
  register(tex: DataTexture, upload: BlockUpload | null = null): void { this.textures.set(tex, upload); }

  /**
   * Centre the window on the tile containing canvas px (cx, cy). Returns a promise that settles once the window's
   * tiles have been requested and copied (missing tiles stay unknown). No-op when the tile is unchanged.
   */
  centreOn(cx: number, cy: number): Promise<void> {
    const [i, j] = this.map.frame.tileOf(cx, cy);
    if (this.centre && this.centre[0] === i && this.centre[1] === j) return Promise.resolve();
    this.centre = [i, j];
    const gen = ++this.generation;
    this.originX = (i - 1) * this.tilePx;
    this.originY = (j - 1) * this.tilePx;
    this.ensureData();
    // Never leave the window blank for a frame: tiles that stay in the window keep their block untouched, and tiles
    // that are decoded already are copied synchronously; only the rest are unknown until their load lands.
    const jobs: Promise<void>[] = [];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ti = i + di, tj = j + dj, key = `${ti}_${tj}`;
        const block = mod(tj, this.tilesAcross) * this.tilesAcross + mod(ti, this.tilesAcross);
        if (this.held[block] === key) continue;
        const now = this.map.peekHeightTile?.(ti, tj);
        if (now) { this.copy(now, block, key); continue; }
        this.clear(block);
        jobs.push(this.map.getHeightTile(ti, tj).then((t) => { if (t && gen === this.generation) this.copy(t, block, key); }, () => {}));
      }
    // then a low-priority ring so the next recentre usually finds its tiles decoded already
    const all = Promise.all(jobs).then(() => {
      if (gen !== this.generation) return;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++)
          if (Math.max(Math.abs(di), Math.abs(dj)) === 2) void this.map.getHeightTile(i + di, j + dj, RING_PRIORITY).catch(() => null);
    });
    return all;
  }

  /** CPU sample (same addressing as the shader): z at canvas px or NaN when unknown. */
  sample(cx: number, cy: number): number {
    if (!this.data) return NaN;
    const W = this.texels, ax = Math.floor(cx / 2), ay = Math.floor(cy / 2);
    const tx = ax - this.originX / 2, ty = ay - this.originY / 2;
    if (tx < 0 || ty < 0 || tx >= W || ty >= W) return NaN;
    const v = this.data[mod(ay, W) * W + mod(ax, W)];
    return v <= HEIGHT_UNKNOWN + 1 ? NaN : v;
  }

  /** Upload changed blocks to every texture (call once per frame before rendering). */
  flush(): void {
    if (this.whole) { this.whole = false; this.dirty.clear(); return; }   // ensureData() already asked for a full upload
    if (!this.dirty.size) return;
    const n = this.tileTexels;
    for (const [tex, upload] of this.textures) {
      if (!upload) { tex.needsUpdate = true; continue; }
      for (const block of this.dirty) upload((block % this.tilesAcross) * n, Math.floor(block / this.tilesAcross) * n, n);
    }
    this.dirty.clear();
  }

  /** Number of the 9 window tiles that hold data. */
  get tilesLoaded(): number { return this.held.reduce((k, key) => k + (key ? 1 : 0), 0); }

  /**
   * Free the CPU array and the GPU copies while the actor is idle. Textures stay registered: the next centreOn()
   * allocates a fresh array, points them at it and three.js re-uploads on first use.
   */
  release(): void {
    for (const t of this.textures.keys()) { t.dispose(); t.image = { data: EMPTY, width: 1, height: 1 }; }
    this.data = null;
    this.centre = null;
    this.held.fill('');
    this.dirty.clear();
    this.whole = false;
    this.generation++;
  }

  /** Destroy for good (actor module disposed). */
  dispose(): void {
    this.release();
    this.textures.clear();
  }

  private ensureData(): Float32Array {
    if (!this.data) {
      const data = (this.data = new Float32Array(this.texels * this.texels).fill(HEIGHT_UNKNOWN));
      for (const t of this.textures.keys()) { t.image = { data, width: this.texels, height: this.texels }; t.needsUpdate = true; }
      this.whole = true;
    }
    return this.data;
  }

  /** Reset a block to unknown (its tile left the window and the new one has not been decoded yet). */
  private clear(block: number): void {
    if (!this.held[block]) return;
    const data = this.ensureData(), n = this.tileTexels, W = this.texels;
    const col = block % this.tilesAcross, row = Math.floor(block / this.tilesAcross);
    for (let y = 0; y < n; y++) { const dst = (row * n + y) * W + col * n; data.fill(HEIGHT_UNKNOWN, dst, dst + n); }
    this.held[block] = '';
    this.dirty.add(block);
  }

  private copy(tile: Float32Array, block: number, key: string): void {
    const data = this.ensureData(), n = this.tileTexels, W = this.texels;
    const col = block % this.tilesAcross, row = Math.floor(block / this.tilesAcross);
    let invalid = this.invalid.get(tile);
    if (invalid === undefined) this.invalid.set(tile, (invalid = tile.includes(NaN)));
    for (let y = 0; y < n; y++) {
      const dst = (row * n + y) * W + col * n;
      data.set(tile.subarray(y * n, (y + 1) * n), dst);
      if (invalid) for (let x = dst; x < dst + n; x++) if (data[x] !== data[x]) data[x] = HEIGHT_UNKNOWN;   // NaN -> sentinel
    }
    this.held[block] = key;
    this.dirty.add(block);
    this.map.invalidate();
  }
}
