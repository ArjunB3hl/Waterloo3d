// 3 x 3 tile window of decoded visible-surface heights around the actor, shared by the occlusion and shadow passes.
//
// Layout: one Float32 value per height texel (each covers 2 x 2 artwork px, sampled at the block centre), 1536 x 1536
// texels, row 0 = smallest canvas y (top of the map). Texel (tx, ty) covers canvas px [originX + 2 tx, +2) x
// [originY + 2 ty, +2). Missing tiles and invalid texels hold HEIGHT_UNKNOWN, which the shaders treat as "no data":
// no occlusion and no shadow there (never an invented surface).
//
// Every renderer gets its own R32F DataTexture over the same array (one GL context cannot sample another's texture);
// flush() re-uploads them at most once per frame, only after the contents changed. No three.js at runtime here: this
// module is part of the always-loaded actor shell.
import type { DataTexture } from 'three';
import type { MapAPI } from '../types';

export const HEIGHT_UNKNOWN = -10000;
const EMPTY = new Float32Array([HEIGHT_UNKNOWN]);

export class HeightWindow {
  readonly tilesAcross = 3;
  readonly texels: number;
  originX = 0;
  originY = 0;
  private data: Float32Array | null = null;
  private centre: [number, number] | null = null;
  private generation = 0;      // bumps on every recentre so late tile loads for an old window are dropped
  private dirty = false;
  private readonly textures = new Set<DataTexture>();
  private readonly tilePx: number;
  private readonly tileTexels: number;
  private readonly loaded = new Set<string>();

  constructor(private readonly map: MapAPI) {
    this.tilePx = map.frame.F;
    this.tileTexels = map.frame.heightPx;
    this.texels = this.tileTexels * this.tilesAcross;
  }

  /** Tile (i, j) currently at the window centre, or null before the first centreOn(). */
  get centreTile(): [number, number] | null { return this.centre; }

  /** The window's current array (textures are created over it by shaders.ts heightTexture()). */
  get array(): Float32Array { return this.ensureData(); }

  /** Track a renderer's texture over the array: re-uploaded by flush(), re-pointed and freed by release(). */
  register(tex: DataTexture): void { this.textures.add(tex); }

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
    this.loaded.clear();
    this.ensureData().fill(HEIGHT_UNKNOWN);
    this.dirty = true;
    // the 3 x 3 window, then a low-priority ring so the next recentre usually finds its tiles decoded already
    const jobs: Promise<void>[] = [];
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++)
        jobs.push(this.map.getHeightTile(i + di, j + dj).then((t) => { if (t && gen === this.generation) this.copy(t, di + 1, dj + 1); }, () => {}));
    const all = Promise.all(jobs).then(() => {
      if (gen !== this.generation) return;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++)
          if (Math.max(Math.abs(di), Math.abs(dj)) === 2) void this.map.getHeightTile(i + di, j + dj).catch(() => null);
    });
    return all;
  }

  /** CPU sample (same addressing as the shader): z at canvas px or NaN when unknown. */
  sample(cx: number, cy: number): number {
    if (!this.data) return NaN;
    const tx = Math.floor((cx - this.originX) / 2), ty = Math.floor((cy - this.originY) / 2);
    if (tx < 0 || ty < 0 || tx >= this.texels || ty >= this.texels) return NaN;
    const v = this.data[ty * this.texels + tx];
    return v <= HEIGHT_UNKNOWN + 1 ? NaN : v;
  }

  /** Upload changed contents to every texture (call once per frame before rendering). */
  flush(): void {
    if (!this.dirty) return;
    this.dirty = false;
    for (const t of this.textures) t.needsUpdate = true;
  }

  /** Number of the 9 window tiles that hold data. */
  get tilesLoaded(): number { return this.loaded.size; }

  /**
   * Free the CPU array and the GPU copies while the actor is idle. Textures stay registered: the next centreOn()
   * allocates a fresh array, points them at it and three.js re-uploads on first use.
   */
  release(): void {
    for (const t of this.textures) { t.dispose(); t.image = { data: EMPTY, width: 1, height: 1 }; }
    this.data = null;
    this.centre = null;
    this.loaded.clear();
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
      for (const t of this.textures) { t.image = { data, width: this.texels, height: this.texels }; t.needsUpdate = true; }
    }
    return this.data;
  }

  private copy(tile: Float32Array, col: number, row: number): void {
    const data = this.ensureData(), n = this.tileTexels, W = this.texels;
    for (let y = 0; y < n; y++) {
      const dst = (row * n + y) * W + col * n;
      for (let x = 0; x < n; x++) {
        const v = tile[y * n + x];
        data[dst + x] = v === v ? v : HEIGHT_UNKNOWN;   // NaN (invalid texel) -> sentinel
      }
    }
    this.loaded.add(`${col}_${row}`);
    this.dirty = true;
    this.map.invalidate();
  }
}
