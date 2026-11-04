// Draws the map for one view into the base canvas (artwork + pending-area hatch), the overlay canvas (boundary,
// status badges, failure placeholders - kept out of the effects pipeline so text stays crisp) and the optional
// screen-aligned aux layers (packed heights, life mask).
import type { CoverageInfo, Manifest, TileEntry, ViewState } from '../types';
import { MAX_FAST_RETRIES, type Resource, ResourceLoader } from './loader';

/**
 * Below this many device px per canvas px (zoom x dpr) the whole published area is drawn from overview.webp
 * (64 px per tile: about native resolution here, so retina screens switch to 256 px tiles at half the CSS zoom).
 */
export const OVERVIEW_ZOOM = 0.07;
/** At or above this zoom artwork is drawn with nearest-neighbour sampling (crisp pixels). */
export const PIXELATED_ZOOM = 1.5;
/** Aux layers are only filled above this zoom (life / heights are invisible further out and would cost memory). */
export const AUX_MIN_ZOOM = 0.1;
const FADE_MS = 180;
const BG = '#1d2024';
/** Exact bytes for packed data tiles: no colour management, no premultiplication. */
export const RAW_DECODE: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export interface DrawParams {
  view: ViewState; w: number; h: number; dpr: number; now: number;
  coverage: boolean;      // pending hatch, reference badges, boundary
  moving: boolean;        // camera in motion: cheaper resampling
}

export interface FailedTile { i: number; j: number; key: string; stalled: boolean }

export interface DrawResult {
  tilesDrawn: number;
  fading: boolean;        // a tile is still fading in -> keep animating
  failed: FailedTile[];   // tiles drawn as failure placeholders this frame
}

interface TileRange { i0: number; i1: number; j0: number; j1: number }

export const tileKey = (i: number, j: number) => `${i}_${j}`;

export class MapRenderer {
  readonly F: number;
  private readonly published = new Map<string, TileEntry>();
  private readonly pending = new Set<string>();      // city tiles without artwork yet
  private readonly lods: number[];
  private overview: ImageBitmap | null = null;
  private overviewFailed = false;
  private hatch: CanvasPattern | null = null;

  constructor(private readonly m: Manifest, private readonly cov: CoverageInfo | null, private readonly loader: ResourceLoader) {
    this.F = m.frame_px;
    this.lods = [...m.lods_px].sort((a, b) => a - b);
    for (const t of Object.values(m.tiles)) this.published.set(tileKey(t.i, t.j), t);
    for (const [i, j] of cov?.city_tiles ?? []) if (!this.published.has(tileKey(i, j))) this.pending.add(tileKey(i, j));
  }

  /** The decoded overview, or null if it could not be loaded (zoomed-out views then fall back to 256 px tiles). */
  setOverview(b: ImageBitmap | null): void { this.overview = b; this.overviewFailed = !b; }

  tile(i: number, j: number): TileEntry | undefined { return this.published.get(tileKey(i, j)); }
  isPending(i: number, j: number): boolean { return this.pending.has(tileKey(i, j)); }

  artUrl(t: TileEntry, lod: number) { return `data/tiles/${lod}/${t.i}_${t.j}.webp?v=${t.v}`; }
  heightUrl(t: TileEntry) { return `data/heights/${t.i}_${t.j}.png?v=${t.hv}`; }
  lifeUrl(t: TileEntry) { return `data/life/${t.i}_${t.j}.png?v=${t.lv ?? t.v}`; }

  /** Smallest LOD whose resolution covers the tile's on-screen size in device px. */
  lodFor(deviceTilePx: number): number {
    return this.lods.find((l) => l >= deviceTilePx) ?? this.lods[this.lods.length - 1];
  }

  heightKey(i: number, j: number, size: number) { return `h:${i}_${j}@${size}`; }
  lifeKey(i: number, j: number, size: number) { return `l:${i}_${j}@${size}`; }
  /** Decode options for an aux tile at a reduced size (nearest-neighbour downsampling keeps packed values exact). */
  auxDecode(native: number, size: number): ImageBitmapOptions {
    return size === native ? RAW_DECODE : { ...RAW_DECODE, resizeWidth: size, resizeHeight: size, resizeQuality: 'pixelated' };
  }

  // ---------------------------------------------------------------- base layer

  drawBase(ctx: CanvasRenderingContext2D, p: DrawParams): DrawResult {
    const { view, w, h, dpr } = p;
    const s = view.zoom * dpr;                                   // device px per canvas px
    const left = view.cx - w / 2 / view.zoom, top = view.cy - h / 2 / view.zoom;
    const X = (cx: number) => Math.round((cx - left) * s), Y = (cy: number) => Math.round((cy - top) * s);
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const range = this.range(view, w, h, 0);
    const result: DrawResult = { tilesDrawn: 0, fading: false, failed: [] };
    if (p.coverage && this.pending.size) this.drawPendingHatch(ctx, range, X, Y, s, left, top);

    ctx.imageSmoothingEnabled = view.zoom < PIXELATED_ZOOM;
    ctx.imageSmoothingQuality = p.moving ? 'low' : 'high';
    // while the overview is still loading, wait for it rather than fetching every tile at 256 px
    const useOverview = s < OVERVIEW_ZOOM && !this.overviewFailed;
    const lod = this.lodFor(this.F * s);

    for (let j = range.j0; j <= range.j1; j++) {
      for (let i = range.i0; i <= range.i1; i++) {
        const t = this.tile(i, j);
        if (!t) continue;
        const x0 = X(i * this.F), y0 = Y(j * this.F), dw = X((i + 1) * this.F) - x0, dh = Y((j + 1) * this.F) - y0;
        result.tilesDrawn++;
        if (useOverview) { this.drawOverviewCrop(ctx, i, j, x0, y0, dw, dh); continue; }
        const want = this.loader.want(`a:${i}_${j}@${lod}`, this.artUrl(t, lod), this.priority(i, j, view));
        if (want.state === 'ready') {
          const alpha = Math.max(0, Math.min(1, (p.now - want.arrivedAt) / FADE_MS));
          if (alpha < 1) { this.drawFallback(ctx, i, j, lod, x0, y0, dw, dh); result.fading = true; }
          ctx.globalAlpha = alpha;
          ctx.drawImage(this.loader.use(want), x0, y0, dw, dh);
          ctx.globalAlpha = 1;
        } else {
          const hadArt = this.drawFallback(ctx, i, j, lod, x0, y0, dw, dh);
          if (want.state === 'failed' && !hadArt) {
            result.failed.push({ i, j, key: want.key, stalled: want.attempts > MAX_FAST_RETRIES });
            ctx.fillStyle = 'rgba(20,22,26,0.55)';
            ctx.fillRect(x0, y0, dw, dh);
          }
        }
      }
    }
    if (!useOverview) this.prefetchRing(view, w, h, lod);
    return result;
  }

  /** Draw the best already-decoded stand-in for a tile: another LOD, else the overview crop. Returns true if artwork LOD. */
  private drawFallback(ctx: CanvasRenderingContext2D, i: number, j: number, lod: number, x: number, y: number, w: number, h: number): boolean {
    // prefer the nearest LOD, higher resolutions first (they downsample cleanly)
    const order = [...this.lods].filter((l) => l !== lod).sort((a, b) => Math.abs(Math.log(a / lod)) - Math.abs(Math.log(b / lod)) || b - a);
    for (const l of order) {
      const r = this.loader.peek(`a:${i}_${j}@${l}`);
      if (r) { ctx.drawImage(this.loader.use(r), x, y, w, h); return true; }
    }
    this.drawOverviewCrop(ctx, i, j, x, y, w, h);
    return false;
  }

  private drawOverviewCrop(ctx: CanvasRenderingContext2D, i: number, j: number, x: number, y: number, w: number, h: number) {
    const o = this.m.overview, b = this.overview;
    if (!b) return;
    const ci = i - o.i0, cj = j - o.j0;
    if (ci < 0 || cj < 0 || ci >= o.cols || cj >= o.rows) return;
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, ci * o.px_per_tile, cj * o.px_per_tile, o.px_per_tile, o.px_per_tile, x, y, w, h);
    ctx.imageSmoothingEnabled = smoothing;
  }

  /** Low-priority requests for the ring of tiles just outside the viewport so short pans find artwork ready. */
  private prefetchRing(view: ViewState, w: number, h: number, lod: number) {
    const inner = this.range(view, w, h, 0), outer = this.range(view, w, h, 0.5);
    for (let j = outer.j0; j <= outer.j1; j++) for (let i = outer.i0; i <= outer.i1; i++) {
      if (i >= inner.i0 && i <= inner.i1 && j >= inner.j0 && j <= inner.j1) continue;
      const t = this.tile(i, j);
      if (t) this.loader.want(`a:${i}_${j}@${lod}`, this.artUrl(t, lod), 100 + this.priority(i, j, view), undefined, true);
    }
  }

  private drawPendingHatch(ctx: CanvasRenderingContext2D, r: TileRange, X: (x: number) => number, Y: (y: number) => number,
    s: number, left: number, top: number) {
    ctx.beginPath();
    for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
      if (!this.pending.has(tileKey(i, j))) continue;
      const x0 = X(i * this.F), y0 = Y(j * this.F);
      ctx.rect(x0, y0, X((i + 1) * this.F) - x0, Y((j + 1) * this.F) - y0);
    }
    const pat = this.hatchPattern(ctx);
    // anchor the hatch to the map so it travels with pans (constant on-screen spacing at any zoom)
    pat.setTransform(new DOMMatrix().translateSelf(Math.round((-left * s) % 16), Math.round((-top * s) % 16)));
    ctx.fillStyle = pat;
    ctx.fill();
  }

  private hatchPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
    if (this.hatch) return this.hatch;
    const c = new OffscreenCanvas(16, 16), g = c.getContext('2d')!;
    g.fillStyle = '#25292e'; g.fillRect(0, 0, 16, 16);
    g.strokeStyle = '#2f343b'; g.lineWidth = 2;
    g.beginPath();
    for (const o of [-16, 0, 16]) { g.moveTo(o, 16); g.lineTo(o + 16, 0); }
    g.stroke();
    return (this.hatch = ctx.createPattern(c, 'repeat')!);
  }

  // ---------------------------------------------------------------- overlay (crisp, not run through effects)

  drawOverlay(ctx: CanvasRenderingContext2D, p: DrawParams, base: DrawResult): void {
    const { view, w, h, dpr } = p;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);       // draw in CSS px
    const left = view.cx - w / 2 / view.zoom, top = view.cy - h / 2 / view.zoom;
    const sx = (cx: number) => (cx - left) * view.zoom, sy = (cy: number) => (cy - top) * view.zoom;
    const tileCss = this.F * view.zoom;

    if (p.coverage && this.cov) {
      ctx.save();
      ctx.lineWidth = 1.25;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(244, 226, 200, 0.55)';
      ctx.beginPath();
      for (const ring of this.cov.boundary_canvas) {
        ring.forEach(([x, y], k) => (k ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
        ctx.closePath();
      }
      ctx.stroke();
      ctx.restore();
    }

    const r = this.range(view, w, h, 0);
    ctx.textBaseline = 'middle';
    if (p.coverage) {
      let refs = 0, shown = 0;
      for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
        const x0 = sx(i * this.F), y0 = sy(j * this.F);
        if (this.pending.has(tileKey(i, j))) {
          if (tileCss < 170) continue;
          ctx.font = `600 13px ${UI_FONT}`; ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(214, 206, 194, 0.55)';
          ctx.fillText('Coming soon', x0 + tileCss / 2, y0 + tileCss / 2);
        } else if (this.tile(i, j)) {
          shown++;
          if (this.tile(i, j)!.kind === 'reference') refs++;
        }
      }
      // One status chip for the view instead of a badge per tile (per-tile badges cluttered labels).
      if (refs > 0) {
        const msg = refs === shown ? 'Reference renders - artwork pending' : `${refs} of ${shown} tiles in view are reference renders`;
        ctx.font = `600 12px ${UI_FONT}`; ctx.textAlign = 'left';
        const tw = ctx.measureText(msg).width;
        this.pill(ctx, msg, w - tw - 36, h - 62, 0.7);
      }
    }
    for (const f of base.failed) {
      // centre the message in the visible part of the tile
      const x0 = sx(f.i * this.F), y0 = sy(f.j * this.F);
      const cx = (Math.max(x0, 0) + Math.min(x0 + tileCss, w)) / 2, cy = (Math.max(y0, 0) + Math.min(y0 + tileCss, h)) / 2;
      const msg = f.stalled ? 'Tile failed to load - tap to retry' : 'Tile failed - retrying';
      ctx.font = `600 12px ${UI_FONT}`;
      const tw = ctx.measureText(msg).width;
      this.pill(ctx, msg, cx - tw / 2 - 10, cy - 11, 0.92, '#e8892f');
    }
  }

  private pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number, color = '#e9e4dc') {
    ctx.font = `600 11px ${UI_FONT}`; ctx.textAlign = 'left';
    const tw = ctx.measureText(text).width, bw = tw + 20, bh = 22;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(24, 26, 30, 0.78)';
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 11); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, x + 10, y + bh / 2 + 0.5);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- aux layers

  /**
   * Draw packed heights ('height') or the life mask ('life') screen aligned with the base canvas into `ctx`
   * (whose canvas may be smaller than the base: scale = canvas.width / CSS width). Nearest sampling only.
   */
  drawAux(kind: 'height' | 'life', ctx: CanvasRenderingContext2D, p: DrawParams): void {
    const { view, w, h } = p;
    const s = view.zoom * (ctx.canvas.width / w);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (view.zoom < AUX_MIN_ZOOM) return;
    ctx.imageSmoothingEnabled = false;
    const left = view.cx - w / 2 / view.zoom, top = view.cy - h / 2 / view.zoom;
    const X = (cx: number) => Math.round((cx - left) * s), Y = (cy: number) => Math.round((cy - top) * s);
    const native = kind === 'height' ? this.m.height_px : this.F;
    const sizes = [256, 512, 1024].filter((z) => z <= native);
    const size = sizes.find((z) => z >= this.F * s) ?? native;
    const r = this.range(view, w, h, 0);
    for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
      const t = this.tile(i, j);
      if (!t) continue;
      const key = kind === 'height' ? this.heightKey(i, j, size) : this.lifeKey(i, j, size);
      const url = kind === 'height' ? this.heightUrl(t) : this.lifeUrl(t);
      let res: Resource | undefined = this.loader.want(key, url, 50 + this.priority(i, j, view), this.auxDecode(native, size));
      if (res.state !== 'ready') {
        res = sizes.map((z) => this.loader.peek(kind === 'height' ? this.heightKey(i, j, z) : this.lifeKey(i, j, z))).find(Boolean);
      }
      if (!res) continue;
      const x0 = X(i * this.F), y0 = Y(j * this.F);
      ctx.drawImage(this.loader.use(res), x0, y0, X((i + 1) * this.F) - x0, Y((j + 1) * this.F) - y0);
    }
  }

  // ---------------------------------------------------------------- helpers

  private range(view: ViewState, w: number, h: number, marginTiles: number): TileRange {
    const hw = w / 2 / view.zoom, hh = h / 2 / view.zoom, m = marginTiles * this.F;
    return {
      i0: Math.floor((view.cx - hw - m) / this.F), i1: Math.floor((view.cx + hw + m) / this.F),
      j0: Math.floor((view.cy - hh - m) / this.F), j1: Math.floor((view.cy + hh + m) / this.F),
    };
  }

  /** Distance of the tile centre from the view centre, in tiles. */
  private priority(i: number, j: number, v: ViewState): number {
    return Math.hypot((i + 0.5) * this.F - v.cx, (j + 0.5) * this.F - v.cy) / this.F;
  }
}

