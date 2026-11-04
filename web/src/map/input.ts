// Pointer, wheel, touch and keyboard input for the map stage. Translates gestures into camera operations;
// all camera state and animation lives in MapView (CameraControl).

/** Camera operations MapView exposes to the input layer. Screen coordinates are CSS px relative to the stage. */
export interface CameraControl {
  readonly interactive: boolean;
  size(): { w: number; h: number };
  /** Cancel fly-to, inertia, smooth zoom and key panning. */
  stopMotion(): void;
  panBy(dx: number, dy: number): void;
  /** Zoom by `factor` keeping the canvas point under (sx, sy) fixed. smooth = animated toward the target. */
  zoomAround(factor: number, sx: number, sy: number, smooth: boolean): void;
  /** Pinch: canvas point `anchor` placed at screen point (sx, sy) with the given zoom. */
  placeAnchor(anchor: [number, number], sx: number, sy: number, zoom: number): void;
  screenToCanvas(sx: number, sy: number): [number, number];
  zoom(): number;
  startInertia(vx: number, vy: number): void;           // CSS px per ms
  setKeyPan(dx: number, dy: number, fast: boolean): void; // unit direction (0,0 = stop)
  home(): void;
  /** Single click / tap without drag (retries a failed tile under the pointer). */
  tap(sx: number, sy: number): void;
}

const DRAG_THRESHOLD_PX = 4;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
const VELOCITY_WINDOW_MS = 80;
const KEY_ZOOM = 1.6;

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1], A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1],
};

export function attachInput(stage: HTMLElement, cam: CameraControl): void {
  const pointers = new Map<number, { x: number; y: number }>();
  let drag: { id: number; x: number; y: number; moved: boolean; samples: { t: number; x: number; y: number }[] } | null = null;
  let pinch: { dist: number; zoom: number; anchor: [number, number] } | null = null;
  let lastTap = { t: 0, x: 0, y: 0 };

  const local = (e: { clientX: number; clientY: number }) => {
    const r = stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const centre = () => { const { w, h } = cam.size(); return { x: w / 2, y: h / 2 }; };

  const pinchGeometry = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  const startPinch = () => {
    const g = pinchGeometry(), m = cam.interactive ? g.mid : centre();
    pinch = { dist: g.dist, zoom: cam.zoom(), anchor: cam.screenToCanvas(m.x, m.y) };
    drag = null;
  };
  const startDrag = (id: number, x: number, y: number) => {
    drag = { id, x, y, moved: false, samples: [{ t: performance.now(), x, y }] };
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('#hud')) return;   // actor HUD controls handle their own input
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (e.target === stage || (e.target as HTMLElement).tagName === 'CANVAS') stage.focus({ preventScroll: true });
    cam.stopMotion();
    if (pointers.size === 1) startDrag(e.pointerId, p.x, p.y);
    else if (pointers.size === 2) { startPinch(); stage.setPointerCapture(e.pointerId); }
  });

  stage.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size >= 2) {
      const g = pinchGeometry(), m = cam.interactive ? g.mid : centre();
      cam.placeAnchor(pinch.anchor, m.x, m.y, (pinch.zoom * g.dist) / pinch.dist);
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moved && Math.hypot(p.x - drag.x, p.y - drag.y) > DRAG_THRESHOLD_PX) {
      drag.moved = true;
      stage.setPointerCapture(e.pointerId);   // captured only once dragging, so plain clicks still reach labels
      stage.classList.add('dragging');
    }
    if (drag.moved && cam.interactive) cam.panBy(p.x - prev.x, p.y - prev.y);
    const t = performance.now();
    drag.samples.push({ t, x: p.x, y: p.y });
    while (drag.samples.length > 2 && drag.samples[0].t < t - VELOCITY_WINDOW_MS) drag.samples.shift();
  });

  const end = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    stage.classList.remove('dragging');
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) { const [[id, p]] = [...pointers]; startDrag(id, p.x, p.y); drag!.moved = true; }
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const d = drag; drag = null;
    if (e.type === 'pointercancel') return;
    if (d.moved) {
      const a = d.samples[0], b = d.samples[d.samples.length - 1], dt = b.t - a.t;
      if (cam.interactive && dt > 0 && performance.now() - b.t < 50) cam.startInertia((b.x - a.x) / dt, (b.y - a.y) / dt);
      return;
    }
    const p = local(e), t = performance.now();
    if (t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < DOUBLE_TAP_PX) {
      lastTap.t = 0;
      const c = cam.interactive ? p : centre();
      cam.zoomAround(2, c.x, c.y, true);
    } else {
      lastTap = { t, x: p.x, y: p.y };
      cam.tap(p.x, p.y);
    }
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? cam.size().h : 1;
    // ctrlKey = trackpad pinch (small deltas); otherwise mouse wheel / two-finger scroll
    const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0022));
    const p = cam.interactive ? local(e) : centre();
    cam.zoomAround(factor, p.x, p.y, true);
  }, { passive: false });

  // ---- keyboard: active when the stage (or nothing in particular) has focus
  const held = new Set<string>();
  let fast = false;
  const updateKeyPan = () => {
    let dx = 0, dy = 0;
    for (const k of held) { dx += PAN_KEYS[k][0]; dy += PAN_KEYS[k][1]; }
    const n = Math.hypot(dx, dy) || 1;
    cam.setKeyPan(dx / n, dy / n, fast);
  };
  const ours = (e: KeyboardEvent) => (e.target === stage || e.target === document.body) && !e.ctrlKey && !e.metaKey && !e.altKey;

  addEventListener('keydown', (e) => {
    if (!ours(e)) return;
    fast = e.shiftKey;
    if (PAN_KEYS[e.key]) {
      e.preventDefault();
      if (!cam.interactive) return;
      held.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      updateKeyPan();
      return;
    }
    const c = centre();
    if (e.key === '+' || e.key === '=') { e.preventDefault(); cam.zoomAround(KEY_ZOOM, c.x, c.y, true); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); cam.zoomAround(1 / KEY_ZOOM, c.x, c.y, true); }
    else if (e.key === '0' && cam.interactive) { e.preventDefault(); cam.home(); }
  });
  addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (held.delete(k)) updateKeyPan();
    fast = e.shiftKey;
  });
  addEventListener('blur', () => { held.clear(); updateKeyPan(); });
}
