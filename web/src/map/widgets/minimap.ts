// Minimap: whole-city overview (published tiles from overview.webp, pending city tiles muted, municipal boundary)
// with the current viewport rectangle. Click jumps (animated), drag scrubs.
import type { MapAPI } from '../../types';
import { type Rect, tilesRect } from '../view';
import { h } from './dom';

const PAD_TILES = 0.5;

export function createMinimap(map: MapAPI): { el: HTMLElement; setVisible(v: boolean): void; setEnabled(v: boolean): void } {
  const m = map.manifest, F = m.frame_px, cov = m.coverage;
  const tiles = [...Object.values(m.tiles).map((t) => [t.i, t.j] as [number, number]), ...(cov?.city_tiles ?? [])];
  const r0 = tilesRect(tiles, F);
  const world: Rect = { x0: r0.x0 - PAD_TILES * F, y0: r0.y0 - PAD_TILES * F, x1: r0.x1 + PAD_TILES * F, y1: r0.y1 + PAD_TILES * F };
  const aspect = (world.y1 - world.y0) / (world.x1 - world.x0);

  const canvas = h('canvas', { class: 'minimap-canvas', 'aria-hidden': 'true' });
  const el = h('div', { class: 'minimap panel-chrome', role: 'region', 'aria-label': 'Minimap of Waterloo. Click to jump.' }, canvas);
  el.style.setProperty('--aspect', String(aspect));
  const ctx = canvas.getContext('2d')!;
  let layer: HTMLCanvasElement | null = null;
  let overview: HTMLImageElement | null = null;
  let cssW = 0, cssH = 0, dpr = 1;
  let stage = { w: innerWidth, h: innerHeight };

  const toMini = (cx: number, cy: number): [number, number] => [((cx - world.x0) / (world.x1 - world.x0)) * cssW, ((cy - world.y0) / (world.y1 - world.y0)) * cssH];
  const toCanvas = (mx: number, my: number): [number, number] => [world.x0 + (mx / cssW) * (world.x1 - world.x0), world.y0 + (my / cssH) * (world.y1 - world.y0)];

  /** Static layer (tiles + boundary), rebuilt on resize or when the overview image arrives. */
  const buildLayer = () => {
    layer = document.createElement('canvas');
    layer.width = Math.round(cssW * dpr); layer.height = Math.round(cssH * dpr);
    const g = layer.getContext('2d')!;
    g.scale(dpr, dpr);
    const tw = (F / (world.x1 - world.x0)) * cssW, th = (F / (world.y1 - world.y0)) * cssH;
    g.fillStyle = '#2a2e34';
    for (const [i, j] of cov?.city_tiles ?? []) { const [x, y] = toMini(i * F, j * F); g.fillRect(x, y, tw + 0.3, th + 0.3); }
    const o = m.overview;
    for (const t of Object.values(m.tiles)) {
      const [x, y] = toMini(t.i * F, t.j * F);
      const ci = t.i - o.i0, cj = t.j - o.j0;
      if (overview && ci >= 0 && cj >= 0 && ci < o.cols && cj < o.rows) {
        g.drawImage(overview, ci * o.px_per_tile, cj * o.px_per_tile, o.px_per_tile, o.px_per_tile, x, y, tw + 0.3, th + 0.3);
      } else { g.fillStyle = '#7f9a62'; g.fillRect(x, y, tw + 0.3, th + 0.3); }
    }
    if (cov) {
      g.strokeStyle = 'rgba(244, 226, 200, 0.6)'; g.lineWidth = 1;
      g.beginPath();
      for (const ring of cov.boundary_canvas) { ring.forEach(([x, y], k) => { const [a, b] = toMini(x, y); if (k) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); }
      g.stroke();
    }
  };

  const draw = () => {
    if (!cssW) return;
    if (!layer) buildLayer();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer!, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const [ax, ay] = map.screenToCanvas(0, 0), [bx, by] = map.screenToCanvas(stage.w, stage.h);
    const [x0, y0] = toMini(ax, ay), [x1, y1] = toMini(bx, by);
    ctx.strokeStyle = '#e8892f'; ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(232, 137, 47, 0.16)';
    if (x1 - x0 < 6) {   // viewport too small to read as a rectangle: crosshair marker
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    }
  };

  new ResizeObserver(() => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    if (!r.width) return;
    cssW = r.width; cssH = r.height;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    layer = null;
    draw();
  }).observe(canvas);

  const img = new Image();
  img.decoding = 'async';
  img.onload = () => { overview = img; layer = null; draw(); };
  img.src = `data/${m.overview.url}?v=${encodeURIComponent(m.generated_utc)}`;

  map.on('viewchange', draw);
  map.on('frame', (f) => { if (f.width !== stage.w || f.height !== stage.h) { stage = { w: f.width, h: f.height }; draw(); } });

  // ---- pointer: click = animated jump, drag = scrub
  let scrubbing = false;
  const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return toCanvas(e.clientX - r.left, e.clientY - r.top); };
  canvas.addEventListener('pointerdown', (e) => {
    scrubbing = true;
    canvas.setPointerCapture(e.pointerId);
    const [cx, cy] = local(e);
    map.setView({ cx, cy }, { animate: true });
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!scrubbing || (e.pointerType === 'mouse' && !(e.buttons & 1))) return;
    const [cx, cy] = local(e);
    map.setView({ cx, cy });
  });
  const stop = () => { scrubbing = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  return {
    el,
    setVisible: (v) => { el.hidden = !v; if (v) requestAnimationFrame(draw); },
    setEnabled: (v) => el.classList.toggle('disabled', !v),
  };
}
