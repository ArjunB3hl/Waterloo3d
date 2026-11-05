// Named building labels (data/labels.json), drawn by MapView on the overlay canvas so the text stays sharp above the
// effects and actor canvases.
//
// Placement: labels are taken in a fixed priority order (pipeline priority, then id) and placed greedily; one that
// would overlap a label already placed (or a landmark pill) by less than PAD px is skipped. Collisions are tested in
// zoom-scaled canvas coordinates, NOT screen coordinates, so the result does not depend on the pan position: panning
// only changes which labels are considered (viewport + margin), and the margin keeps those changes off-screen. That
// gives a flicker-free set while dragging without any frame-to-frame state.
// Zoom: each label has a min_zoom (footprint about MIN_SCREEN_PX wide on screen; lower for campus codes, higher for
// shops and houses). Campus buildings with a code show just the code until FULL_TEXT_ZOOM, then "CODE · name" when it
// fits. Names are the pipeline's display texts (<= 32 chars from FULL_TEXT_ZOOM, <= 26 below it); the card keeps the
// full OSM name.
// Fixed UI (search bar, controls, landmark strip, minimap, flight HUD, open panels) does not take part in placement -
// that would make labels pop in and out while panning past it - but a label under it is neither painted nor picked.
import type { BuildingLabel, BuildingLabelStats, DrawnLabel, ViewState } from '../types';

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const CODE_FONT = `700 10.5px ${FONT_FAMILY}`;
const NAME_FONT = `500 11px ${FONT_FAMILY}`;
const PILL_FONT = `600 11px ${FONT_FAMILY}`;   // landmark pills (.map-label in style.css), for their obstacle rects
const SEP = ' · ';
const PAD = 4;                  // min gap between labels (CSS px)
const PX = 5;                   // horizontal padding inside a label
const BOX_H = 17;
/** At or above this zoom campus labels show "CODE · name" and other names use their longer display text. */
export const FULL_TEXT_ZOOM = 1.0;
const FULL_NAME_CHARS = 34;     // safety caps on the pipeline's display texts (32 / 26 chars)
const SHORT_NAME_CHARS = 26;
const FLIGHT_ALPHA = 0.6;       // in goose flight the codes sit above the goose: keep them see-through
const MARGIN = 0.3;             // considered area beyond the viewport, as a fraction of its size
const LANDMARK_PILL_MIN_ZOOM = 0.15;   // = LABEL_MIN_ZOOM in widgets/landmarks.ts
const CELL = 128;               // collision grid cell (CSS px)

const COLORS = {
  box: 'rgba(17, 19, 23, 0.66)',
  code: '#f6c58f',              // campus codes: soft amber, quieter than the landmark pills' accent dot + border
  campus: '#f3dcc0',            // campus names (Laurier, uncoded UW buildings): warm, so they read as university
  name: '#ece6dc',              // civic
  dim: '#c4beb4',               // commercial / residential / other
};
const nameColor = (g: BuildingLabel['group']) => (g === 'campus' ? COLORS.campus : g === 'civic' ? COLORS.name : COLORS.dim);

/** Cut at a word boundary with an ellipsis (display texts from the pipeline already fit; this is a safety net). */
function cap(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1), sp = cut.lastIndexOf(' ');
  return `${(sp > n / 2 ? cut.slice(0, sp) : cut).replace(/[\s,&·-]+$/, '')}…`;
}

interface Rect { x0: number; y0: number; x1: number; y1: number }
interface Texts { full: string; short: string }
interface Placed { l: BuildingLabel; code: string; name: string; codeW: number; x: number; y: number; w: number; occluded: boolean }

export interface LabelDrawParams {
  view: ViewState; w: number; h: number; dpr: number;
  enabled: boolean;             // settings.buildingLabels
  pills: boolean;               // settings.labels (landmark pills shown)
}

export class BuildingLabelLayer {
  private labels: BuildingLabel[] = [];
  private readonly byId = new Map<string, BuildingLabel>();
  private readonly texts = new Map<string, Texts>();
  private occl: Rect[] = [];      // fixed UI, screen CSS px
  private pills: { id: string; canvas: [number, number]; text: string }[] = [];
  private pillIds = new Set<string>();
  private flight = false;
  private readonly widths = new Map<string, number>();
  private placed: Placed[] = [];
  private lastView: ViewState = { cx: 0, cy: 0, zoom: 1 };
  private lastW = 0; private lastH = 0;
  private lastEnabled = false;
  private considered = 0;
  private readonly times: number[] = [];
  private lastMs = 0;
  /** Test / benchmark hook: ignore min_zoom (every label in view competes for space). */
  debugIgnoreMinZoom = false;

  /** zoom: the current view zoom; labels that can show at about that zoom are measured right away, the rest in idle time. */
  setData(labels: BuildingLabel[], zoom = 1): void {
    this.labels = [...labels].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.byId.clear();
    this.texts.clear();
    for (const l of this.labels) {
      this.byId.set(l.id, l);
      const full = cap(l.display ?? l.name, FULL_NAME_CHARS);
      this.texts.set(l.id, { full, short: cap(l.display_short ?? full, SHORT_NAME_CHARS) });
    }
    this.warmWidths(zoom);
  }

  /** Pre-measure label texts so no frame pays for hundreds of first-time measureText calls: labels visible at about
   *  the current zoom synchronously (otherwise the first passes would measure them mid-frame), the rest in idle time. */
  private warmWidths(zoom: number): void {
    const ctx = new OffscreenCanvas(1, 1).getContext('2d') as unknown as CanvasRenderingContext2D | null;
    if (!ctx) return;
    const now: [string, string][] = [], later: [string, string][] = [];
    for (const l of this.labels) {
      const t = this.texts.get(l.id)!, out = l.min_zoom <= zoom * 1.25 ? now : later;
      if (l.short) out.push([CODE_FONT, l.short], [NAME_FONT, SEP + t.full]);
      else out.push([NAME_FONT, t.full], [NAME_FONT, t.short]);
    }
    for (const [f, s] of now) this.measure(ctx, f, s);
    const idle = (cb: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 16));
    let k = 0;
    const step = () => {
      const end = Math.min(later.length, k + 80);
      for (; k < end; k++) this.measure(ctx, later[k][0], later[k][1]);
      if (k < later.length) idle(step);
    };
    idle(step);
  }

  get all(): readonly BuildingLabel[] { return this.labels; }
  get(id: string): BuildingLabel | undefined { return this.byId.get(id); }
  setPills(p: { id: string; canvas: [number, number]; text: string }[]): void { this.pills = p; this.pillIds = new Set(p.map((x) => x.id)); }
  setFlight(on: boolean): boolean { const changed = on !== this.flight; this.flight = on; return changed; }
  /** Fixed UI rects (screen CSS px); returns whether they changed. */
  setOcclusion(rects: { x: number; y: number; w: number; h: number }[]): boolean {
    const next = rects.filter((r) => r.w > 0 && r.h > 0).map((r) => ({ x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }));
    const same = next.length === this.occl.length && next.every((r, k) => {
      const o = this.occl[k];
      return Math.abs(r.x0 - o.x0) < 0.5 && Math.abs(r.y0 - o.y0) < 0.5 && Math.abs(r.x1 - o.x1) < 0.5 && Math.abs(r.y1 - o.y1) < 0.5;
    });
    this.occl = next;
    return !same;
  }

  stats(): BuildingLabelStats {
    const s = [...this.times].sort((a, b) => a - b);
    const p95 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
    const r = (x: number) => Math.round(x * 1000) / 1000;
    return { total: this.labels.length, considered: this.considered, drawn: this.placed.length,
      occluded: this.placed.reduce((n, p) => n + +p.occluded, 0), drawMs: r(this.lastMs), drawP95Ms: r(p95),
      view: { ...this.lastView }, enabled: this.lastEnabled };
  }

  /** Screen rects (CSS px) of the labels placed in the last pass (occluded ones are placed but not painted). */
  drawn(): DrawnLabel[] {
    const { left, top, z } = this.frameOf(this.lastView, this.lastW, this.lastH);
    return this.placed.map((p) => ({
      id: p.l.id, text: p.code && p.name ? `${p.code}${SEP}${p.name}` : p.code || p.name,
      x: p.x - left * z, y: p.y - top * z, w: p.w, h: BOX_H, occluded: p.occluded,
    }));
  }

  /** The painted label nearest to a screen point within `slop` px (labels never overlap, so inside wins outright). */
  pick(sx: number, sy: number, slop = 2): BuildingLabel | null {
    const { left, top, z } = this.frameOf(this.lastView, this.lastW, this.lastH);
    const gx = sx + left * z, gy = sy + top * z;
    let best: BuildingLabel | null = null, bestD = Infinity;
    for (const p of this.placed) {
      if (p.occluded) continue;
      const dx = Math.max(p.x - gx, 0, gx - (p.x + p.w)), dy = Math.max(p.y - gy, 0, gy - (p.y + BOX_H));
      const d = Math.hypot(dx, dy);
      if (d <= slop && d < bestD) { best = p.l; bestD = d; }
    }
    return best;
  }

  private frameOf(v: ViewState, w: number, h: number) {
    return { z: v.zoom, left: v.cx - w / 2 / v.zoom, top: v.cy - h / 2 / v.zoom };
  }

  private measure(ctx: CanvasRenderingContext2D, font: string, text: string): number {
    const key = font === CODE_FONT ? `c|${text}` : font === NAME_FONT ? `n|${text}` : `p|${text}`;
    let w = this.widths.get(key);
    if (w === undefined) {
      if (ctx.font !== font) ctx.font = font;
      w = ctx.measureText(text).width;
      this.widths.set(key, w);
    }
    return w;
  }

  /** Placement + drawing. The overlay canvas has already been cleared by the renderer. */
  draw(ctx: CanvasRenderingContext2D, p: LabelDrawParams): void {
    const t0 = performance.now();
    const { view, w, h, dpr } = p;
    this.lastView = { ...view }; this.lastW = w; this.lastH = h; this.lastEnabled = p.enabled;
    this.placed = [];
    this.considered = 0;
    if (!p.enabled || !this.labels.length) { this.record(t0); return; }

    const { z, left, top } = this.frameOf(view, w, h);
    // considered area in zoom-scaled canvas coordinates (g = canvas * zoom)
    const mx = w * MARGIN, my = h * MARGIN;
    const gx0 = left * z - mx, gy0 = top * z - my, gx1 = gx0 + w + 2 * mx, gy1 = gy0 + h + 2 * my;
    const grid = new Map<number, Rect[]>();
    const cellKey = (i: number, j: number) => i * 73856093 ^ j * 19349663;
    const cells = (r: Rect, fn: (k: number) => boolean | void): boolean => {
      for (let j = Math.floor(r.y0 / CELL); j <= Math.floor(r.y1 / CELL); j++)
        for (let i = Math.floor(r.x0 / CELL); i <= Math.floor(r.x1 / CELL); i++) if (fn(cellKey(i, j))) return true;
      return false;
    };
    const hits = (r: Rect) => cells(r, (k) => grid.get(k)?.some((o) => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0));
    const add = (r: Rect) => cells(r, (k) => { const c = grid.get(k); if (c) c.push(r); else grid.set(k, [r]); });

    // landmark pills are obstacles (they win over every building label)
    const pillsShown = p.pills && !this.flight && z >= LANDMARK_PILL_MIN_ZOOM;
    if (pillsShown) {
      for (const pl of this.pills) {
        const gx = Math.round(pl.canvas[0] * z), gy = Math.round(pl.canvas[1] * z);
        const pw = this.measure(ctx, PILL_FONT, pl.text) + 27, ph = 21.2;
        add({ x0: gx - pw / 2 - PAD, y0: gy - 6 - ph - PAD, x1: gx + pw / 2 + PAD, y1: gy - 6 + PAD });
      }
    }

    const full = z >= FULL_TEXT_ZOOM;
    for (const l of this.labels) {
      if (!this.debugIgnoreMinZoom && z < l.min_zoom) continue;
      if (this.flight && !(l.short && l.group === 'campus')) continue;
      if (pillsShown && l.landmark_id && this.pillIds.has(l.landmark_id)) continue;   // the pill already names it
      const gx = l.canvas[0] * z, gy = l.canvas[1] * z;
      if (gx < gx0 || gx > gx1 || gy < gy0 || gy > gy1) continue;
      this.considered++;
      // candidate texts, most informative first
      const code = l.short ?? '';
      const t = this.texts.get(l.id)!;
      const options: [string, string][] = code
        ? (full && !this.flight ? [[code, t.full], [code, '']] : [[code, '']])
        : [['', full ? t.full : t.short]];
      for (const [c, n] of options) {
        const cw = c ? this.measure(ctx, CODE_FONT, c) : 0;
        const nw = n ? this.measure(ctx, NAME_FONT, c ? SEP + n : n) : 0;
        const bw = Math.ceil(cw + nw + 2 * PX);
        const x = Math.round(gx - bw / 2), y = Math.round(gy - BOX_H / 2);
        const r = { x0: x - PAD, y0: y - PAD, x1: x + bw + PAD, y1: y + BOX_H + PAD };
        if (hits(r)) continue;
        add(r);
        // under fixed UI: keeps its place (and blocks others, so nothing shifts while panning) but is not painted
        const sx0 = x - left * z, sy0 = y - top * z, sx1 = sx0 + bw, sy1 = sy0 + BOX_H;
        const occluded = this.occl.some((o) => sx0 < o.x1 && sx1 > o.x0 && sy0 < o.y1 && sy1 > o.y0);
        this.placed.push({ l, code: c, name: n, codeW: cw, x, y, w: bw, occluded });
        break;
      }
    }
    const paint = this.placed.filter((q) => !q.occluded);

    // draw: one path for all boxes, then the text runs
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = Math.round(left * z * dpr) / dpr, oy = Math.round(top * z * dpr) / dpr;   // whole device px
    ctx.translate(-ox, -oy);
    if (this.flight) ctx.globalAlpha = FLIGHT_ALPHA;
    ctx.fillStyle = COLORS.box;
    ctx.beginPath();
    for (const q of paint) ctx.roundRect(q.x, q.y, q.w, BOX_H, 4);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const ty = BOX_H / 2 + 0.5;
    ctx.font = CODE_FONT; ctx.fillStyle = COLORS.code;
    for (const q of paint) if (q.code) ctx.fillText(q.code, q.x + PX, q.y + ty);
    ctx.font = NAME_FONT;
    for (const q of paint) {
      if (!q.name) continue;
      ctx.fillStyle = q.code ? COLORS.name : nameColor(q.l.group);
      ctx.fillText(q.code ? SEP + q.name : q.name, q.x + PX + q.codeW, q.y + ty);
    }
    ctx.restore();
    this.record(t0);
  }

  private record(t0: number): void {
    this.lastMs = performance.now() - t0;
    this.times.push(this.lastMs);
    if (this.times.length > 120) this.times.shift();
  }
}
