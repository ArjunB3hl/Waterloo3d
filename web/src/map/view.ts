// View math shared by MapView, input and UI: limits, home framing, URL hash format and fly-to interpolation.
import type { Manifest, ViewState } from '../types';

export const MIN_ZOOM = 0.04;
export const MAX_ZOOM = 3;

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Canvas-px rectangle covered by the given tiles. */
export function tilesRect(tiles: Iterable<[number, number]>, F: number): Rect {
  const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [i, j] of tiles) {
    r.x0 = Math.min(r.x0, i * F); r.y0 = Math.min(r.y0, j * F);
    r.x1 = Math.max(r.x1, (i + 1) * F); r.y1 = Math.max(r.y1, (j + 1) * F);
  }
  return r;
}

/** Fit a canvas rectangle into a w x h CSS px viewport with a small margin. */
export function fitRect(r: Rect, w: number, h: number, margin = 0.96): ViewState {
  return {
    cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2,
    zoom: clampZoom(margin * Math.min(w / (r.x1 - r.x0), h / (r.y1 - r.y0))),
  };
}

/** Home view: the stage-1 campus 2x2 patch framed in the viewport (falls back to all published tiles). */
export function homeView(m: Manifest, w: number, h: number): ViewState {
  const tiles = m.regions.campus2x2?.tiles ?? Object.values(m.tiles).map((t) => [t.i, t.j] as [number, number]);
  return fitRect(tilesRect(tiles, m.frame_px), w, h);
}

/** "#cx,cy,zoom" - integers for position, 4 significant decimals for zoom. */
export function formatHash(v: ViewState): string {
  const r = (x: number) => (Object.is(Math.round(x), -0) ? 0 : Math.round(x));
  return `#${r(v.cx)},${r(v.cy)},${Number(v.zoom.toFixed(4))}`;
}

export function parseHash(hash: string): ViewState | null {
  const parts = hash.replace(/^#/, '').split(',').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite) || parts[2] <= 0) return null;
  return { cx: parts[0], cy: parts[1], zoom: clampZoom(parts[2]) };
}

/**
 * Smooth "zoom out, travel, zoom in" camera path between two views (van Wijk & Nuij, "Smooth and efficient zooming
 * and panning", 2003). Works on the visible width w = viewportWidth / zoom. Returns the interpolator and its
 * natural length S (used to pick a duration).
 */
export function flyPath(a: ViewState, b: ViewState, viewportW: number): { at: (t: number) => ViewState; S: number } {
  const rho = Math.SQRT2;
  const w0 = viewportW / a.zoom, w1 = viewportW / b.zoom;
  const dx = b.cx - a.cx, dy = b.cy - a.cy, d2 = dx * dx + dy * dy, d1 = Math.sqrt(d2);
  if (d1 < 1e-6 * w0) {
    // pure zoom: logarithmic interpolation of the visible width
    const S = Math.abs(Math.log(w1 / w0)) / rho;
    return { S, at: (t) => ({ cx: a.cx + t * dx, cy: a.cy + t * dy, zoom: viewportW / (w0 * Math.pow(w1 / w0, t)) }) };
  }
  const b0 = (w1 * w1 - w0 * w0 + rho ** 4 * d2) / (2 * w0 * rho * rho * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho ** 4 * d2) / (2 * w1 * rho * rho * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return {
    S,
    at: (t) => {
      const s = t * S;
      const u = (w0 / (rho * rho * d1)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
      const w = (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0);
      return { cx: a.cx + u * dx, cy: a.cy + u * dy, zoom: viewportW / w };
    },
  };
}

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const prefersReducedMotion = (() => {
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return () => !!mq?.matches;
})();
