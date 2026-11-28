// Goose actor (depth/): fly a Canada goose over the illustrated map.
//
// element = container (absolute, inset 0, no pointer input) holding two transparent three.js canvases aligned with the
// map: a SHADOW canvas (CSS multiply) and an ACTOR canvas (normal). Rendering happens on map 'frame' events using the
// frame's view (the one the base map was drawn with), so goose, shadow and artwork always agree; while flying the
// module calls map.invalidate() every frame and pans the camera after the goose with map.setView (zoom is kept).
//
// Modules: flight.ts (deterministic flight + collision response), heightWindow.ts (3x3 decoded height tiles),
// actorRenderer.ts (camera, pixel-art target, occlusion stipple), shadowRenderer.ts (sun shadow on the visible
// surface), particles.ts, hud.ts. Design notes and measured test results: docs/DEPTH.md.
import type { Vec3 } from '../frame';
import { idleTurn } from '../idle';
import type { ActorModule, FrameInfo, MapAPI, ViewState } from '../types';
import type { GooseAttitude, Viewport } from './actorRenderer';
import { CollisionField } from './collision';
import { type Feather, FeatherProgress, feathersNear, loadFeathers } from './feathers';
import { FLIGHT, Flight, type FlightInput, GOOSE_SCALE, type HitInfo, NO_INPUT, type StepEvents } from './flight';
import { GOOSE_WINGSPAN_M } from './gooseDims';
import { HeightWindow } from './heightWindow';
import { FlightHud, type FeatherMarker } from './hud';
import type { Renderers } from './renderers';

const COLLECT_RADIUS_M = 10;
const MIN_FLIGHT_ZOOM = 1;            // below this the camera zooms in to FLIGHT_ZOOM on take-off
const FLIGHT_ZOOM = 1.6;              // goose ~30 CSS px long: readable, with ~120 m of map around it on a laptop
const FOLLOW_TAU_S = 0.35;            // easing of the camera's look-ahead offset
const LEAD_S = 0.12;                  // the camera centre sits this far ahead of the goose along its velocity
const INTRO_TIMEOUT_MS = 3200;
const CHUNK_RADIUS_M = 320;           // collision chunks kept loaded around the goose
const CHUNK_REFRESH_M = 80;
const WAIT_RETRY_MS = 500;            // how often a goose paused over missing collision data asks for it again
const EDGE_MARGIN_PX = 48;            // keep the goose this far inside the published artwork
const HONK_INTERVAL_MS = 2500;
const FENCE_TOAST_MS = 5000;
const START_WAIT_MS = 2500;           // longest wait for the height window before take-off
const WARM_UP_WAIT_MS = 1500;         // ... and for the shader programs to link (never holds up a take-off for longer)
/** Light frustum half-size: half the scaled wingspan plus room for bank / pitch. */
const SHADOW_RADIUS_M = (GOOSE_WINGSPAN_M / 2) * GOOSE_SCALE * 1.25;

type Key = 'left' | 'right' | 'up' | 'down' | 'boost' | 'flap' | 'land';
const KEYS: Record<string, Key> = {
  a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
  shift: 'boost', ' ': 'flap', l: 'land', escape: 'land',
};

export interface ActorDebugState {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  heading: number; speed: number; surface: number; inCanopy: boolean; overWater: boolean; waiting: boolean;
  /** `speed` with the direction scale taken out (Flight.nominalSpeed): comparable with FLIGHT.cruise / boost. */
  nominalSpeed: number;
  time: number; lastHit: HitInfo | null;
}

/** Test hooks (window.__tinyWaterloo.actor.debug). All of them require an active flight. */
export interface ActorDebug {
  getState(): ActorDebugState;
  /** Move the goose (no collision), snap the camera to it and wait for collision + height data there. */
  teleport(x: number, y: number, z: number, heading: number): Promise<void>;
  /** One deterministic simulation step (same code as the live loop, including collision response and pickups). */
  step(dt: number, input?: Partial<FlightInput>): StepEvents;
  /** false = the live loop stops advancing the simulation (rendering and camera follow continue). */
  setAutoStep(on: boolean): void;
  /** Fraction of the goose's pixels drawn as the occluded stipple (renders first). */
  occludedFraction(): number;
  /** Alpha-weighted centroid of the shadow on screen, CSS px (renders first). */
  shadowCentreScreen(): { x: number; y: number; pixels: number } | null;
  /** A world point on the sun ray through the centroid of the goose's light-pass silhouette (renders first). */
  shadowRay(): Vec3 | null;
  /** World point -> screen CSS px through the three.js render camera and the blit mapping. */
  projectToScreen(x: number, y: number, z: number): [number, number];
  /** Screen pixels of the last actor render by class (renders first). */
  stippleStats(): { fill: number; outline: number; rim: number; shaded: number };
  /** Height-window sample at canvas px (NaN = unknown). */
  windowHeight(cx: number, cy: number): number;
  /** Whether the goose may fly at this world point (published artwork with collision data). */
  inside(x: number, y: number, z: number): boolean;
  readonly collision: CollisionField | null;
}

export type Actor = ActorModule & { readonly debug: ActorDebug };

export function createActor(map: MapAPI): Actor {
  return new GooseActor(map);
}

interface Data { col: CollisionField; feathers: Feather[]; progress: FeatherProgress }

class GooseActor implements Actor {
  readonly element: HTMLElement;
  readonly debug: ActorDebug;
  private readonly shadowCanvas: HTMLCanvasElement;
  private readonly actorCanvas: HTMLCanvasElement;
  private readonly heights: HeightWindow;
  private readonly published: Set<string>;
  private readonly unsubscribe: () => void;
  private data: Data | null = null;
  private dataLoad: Promise<Data> | null = null;
  private gl: Renderers | null = null;
  private flight: Flight | null = null;
  private hud: FlightHud | null = null;
  private starting: Promise<void> | null = null;
  private startCancelled = false;
  private isActive = false;
  private autoStep = true;
  private lastTime = NaN;
  private intro: { until: number; prev: ViewState | null } | null = null;
  /** Camera centre minus goose, canvas px: the eased look-ahead. The camera is always goose + lead. */
  private lead = { x: 0, y: 0 };
  private followZoom = 1;        // zoom the follow camera last saw (a change means the user is zooming)
  private lastTurnKey: 'left' | 'right' = 'left';
  private lastWaitRetry = -Infinity;
  private readonly keys = new Set<Key>();
  private chunkCentre: [number, number] = [Infinity, Infinity];
  private lastViewport: Viewport | null = null;
  private frameSize: { width: number; height: number; dpr: number } | null = null;   // of the map's last frame
  private lastHonk = -Infinity;
  private lastFence = -Infinity;
  private emitClock = { leaf: 0, spray: 0, wake: 0 };

  constructor(private readonly map: MapAPI) {
    this.element = document.createElement('div');
    this.element.className = 'actor-layer';
    this.element.setAttribute('aria-hidden', 'true');
    this.shadowCanvas = document.createElement('canvas');
    this.shadowCanvas.className = 'actor-shadow';
    this.actorCanvas = document.createElement('canvas');
    this.actorCanvas.className = 'actor-goose';
    this.element.append(this.shadowCanvas, this.actorCanvas);
    for (const c of [this.shadowCanvas, this.actorCanvas])
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost(); });
    this.heights = new HeightWindow(map);
    this.published = new Set(Object.keys(map.manifest.tiles));
    this.unsubscribe = map.on('frame', (f) => this.render(f));
    this.debug = this.buildDebug();
  }

  get active(): boolean { return this.isActive; }

  // ------------------------------------------------------------------ lifecycle

  start(at?: { cx: number; cy: number }): Promise<void> {
    if (this.isActive) return Promise.resolve();
    this.startCancelled = false;
    this.starting ??= this.takeOff(at).finally(() => { this.starting = null; });
    return this.starting;
  }

  /** Drop a take-off that is still loading: start()'s promise then resolves with the goose grounded. A later start() undoes this. */
  cancelStart(): void { this.startCancelled = true; }

  /** Download what a take-off needs (collision index, feathers, the three.js renderers) without creating GL contexts. */
  prefetch(): void {
    this.loadData().catch(() => { /* start() retries */ });
    import('./renderers').catch(() => { /* start() retries */ });
  }

  stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.intro = null;
    this.keys.clear();
    removeEventListener('keydown', this.onKey);
    removeEventListener('keyup', this.onKey);
    removeEventListener('blur', this.onBlur);
    removeEventListener('focusin', this.onFocusIn);
    this.hud?.show(false);
    this.hud?.setMarkers([]);
    if (this.gl) { this.gl.actor.particles.clear(); this.gl.actor.clear(); this.gl.shadow.clear(); }
    this.heights.release();
    this.map.setInteractive(true);
    const p = this.data?.progress;
    this.map.toast(p ? `Landed. Feathers found: ${p.count} of ${p.total}` : 'Landed');
    this.map.invalidate();
  }

  render(f: FrameInfo): void {
    this.frameSize = { width: f.width, height: f.height, dpr: f.dpr };
    if (!this.isActive || !this.gl || !this.flight) return;
    const vp: Viewport = { view: f.view, width: f.width, height: f.height, dpr: f.dpr };
    this.lastViewport = vp;
    const dt = Number.isFinite(this.lastTime) ? Math.min(0.1, Math.max(0, (f.time - this.lastTime) / 1000)) : 0;
    this.lastTime = f.time;
    const flying = this.updateIntro(f.view);
    // Draw first: f.view is the camera that follow() set last frame from the goose's state at that moment, so the
    // goose is drawn in that same state and stands still on screen in straight flight however long a frame took.
    // (Stepping first drew the new goose against the old camera: a late frame showed as a lurch of the goose.)
    this.draw(vp);
    if (flying && this.autoStep) this.advance(dt, this.input());
    else this.flight.idle(dt);
    this.gl.actor.particles.update(dt);
    if (flying) this.follow(f.view, dt);
    this.updateHud(vp);
    this.map.invalidate();
  }

  dispose(): void {
    this.stop();
    this.unsubscribe();
    this.gl?.actor.dispose();
    this.gl?.shadow.dispose();
    this.gl = null;
    this.heights.dispose();
    this.hud?.dispose();
    this.element.remove();
  }

  private async takeOff(at?: { cx: number; cy: number }): Promise<void> {
    const data = await this.loadData();
    await this.ensureGl(data);
    const flight = this.flight!, gl = this.gl!;
    // Warm-up, first half, while the start point and its height tiles load: size both canvases and link every shader
    // program. Left to the first flying frame, this made one frame of over 100 ms right at take-off.
    const linked = gl.actor.prepare(this.viewportNow()).then(nextFrame).then(() => gl.shadow.prepare(this.viewportNow())).catch(() => {});
    const start = await this.startPoint(at, data.col);
    flight.teleport(start[0], start[1], start[2], screenUpHeading(this.map));
    this.chunkCentre = [start[0], start[1]];
    const c = this.map.frame.worldToCanvas(...start);
    await withTimeout(this.heights.centreOn(c.cx, c.cy), START_WAIT_MS);
    await withTimeout(linked, WARM_UP_WAIT_MS);
    // Second half, each step in a frame of its own while the map is still: upload the height window (9.4 MB) to each
    // GL context, then draw once and wipe it, which is the programs' first real use. flush() comes first: it settles
    // what the window has marked for upload, so tiles that land from here on go up as blocks.
    this.heights.flush();
    gl.actor.uploadHeights();
    await nextFrame();
    gl.shadow.uploadHeights();
    await nextFrame();
    if (this.gl !== gl) return;                    // disposed meanwhile
    this.draw(this.viewportNow());
    gl.actor.clear();
    gl.shadow.clear();
    await nextFrame();
    if (this.gl !== gl) return;
    if (this.startCancelled) { this.heights.release(); return; }   // stop() never runs for a take-off that never began

    this.isActive = true;
    this.autoStep = true;
    this.lastTime = NaN;
    this.lastHonk = this.lastFence = -Infinity;
    addEventListener('keydown', this.onKey);
    addEventListener('keyup', this.onKey);
    addEventListener('blur', this.onBlur);
    addEventListener('focusin', this.onFocusIn);
    this.map.setInteractive(false);
    this.hud!.show(true);
    // keep keyboard focus off buttons (Space flaps; it must not press "Land")
    (this.element.parentElement as HTMLElement | null)?.focus({ preventScroll: true });

    // fly the camera to the goose (zooming in when far out), then follow it
    const v = this.map.getView();
    const zoom = v.zoom < MIN_FLIGHT_ZOOM ? FLIGHT_ZOOM : v.zoom;
    this.map.setView({ cx: c.cx, cy: c.cy, zoom }, { animate: true });
    this.intro = { until: performance.now() + INTRO_TIMEOUT_MS, prev: null };
    this.map.toast(matchMedia('(pointer: coarse)').matches
      ? 'Flying as a goose: the arrow buttons turn, climb and dive; Flap, Boost, and Land to come down'
      : 'Flying as a goose: A / D turn, W / S climb and dive, Shift boost, Space flap, L lands');
    this.map.invalidate();
  }

  private loadData(): Promise<Data> {
    this.dataLoad ??= Promise.all([CollisionField.open('data/collision/meta.json', { turn: idleTurn }), loadFeathers()]).then(([col, feathers]) => {
      this.data = { col, feathers, progress: new FeatherProgress(feathers) };
      return this.data;
    });
    // a failed load (offline) may be retried by the next start()
    this.dataLoad.catch(() => { this.dataLoad = null; });
    return this.dataLoad;
  }

  /**
   * Create both renderers, the flight model and the HUD on first use: no GL contexts (and no three.js download) until
   * someone flies.
   */
  private async ensureGl(data: Data): Promise<void> {
    if (this.gl) return;
    const { createRenderers } = await import('./renderers');
    if (this.gl) return;
    const f = this.map.frame;
    this.gl = createRenderers(this.actorCanvas, this.shadowCanvas, f, this.heights, GOOSE_SCALE, SHADOW_RADIUS_M);
    // fence orientations: the canvas x and y axes on the ground (tile edges run along them)
    const r = f.right, u = f.up, ul = Math.hypot(u[0], u[1]);
    const fences: [number, number][] = [[r[0], r[1]], [u[0] / ul, u[1] / ul]];
    this.flight = new Flight(data.col, fences, (x, y, z) => this.inside(data.col, x, y, z), [[r[0], r[1]], [u[0], u[1]]]);
    this.hud = new FlightHud(this.map.hudRoot, () => this.stop());
  }

  /** World start point: `at` (or the view centre) on the visible surface, raised FLIGHT.startAltitude; campus fallback. */
  private async startPoint(at: { cx: number; cy: number } | undefined, col: CollisionField): Promise<Vec3> {
    const f = this.map.frame, v = this.map.getView();
    const [cx, cy] = at ? [at.cx, at.cy] : [v.cx, v.cy];
    const [i, j] = f.tileOf(cx, cy);
    const tile = await this.map.getHeightTile(i, j);
    const n = f.heightPx, k = n / f.F;
    const h = tile ? tile[Math.floor((cy - j * f.F) * k) * n + Math.floor((cx - i * f.F) * k)] : NaN;
    const candidates: [number, number][] = [];
    if (h === h) { const p = f.canvasToWorld(cx, cy, h); candidates.push([p[0], p[1]]); }
    candidates.push([0, 0]);   // the world origin: centre of the UW campus landmark cluster
    for (const [x, y] of candidates) {
      await col.ensureAround(x, y, CHUNK_RADIUS_M);
      const top = col.obstacleTop(x, y);
      const z = top + FLIGHT.startAltitude;
      if (top === top && this.inside(col, x, y, z)) {
        if (x !== candidates[0][0] || y !== candidates[0][1]) this.map.toast("That spot isn't drawn yet, so the goose takes off over campus");
        return [x, y, z];
      }
    }
    throw new Error('no published area to fly over');
  }

  /** Flyable: the goose's canvas point is inside published artwork (with a margin) and collision data exists. */
  private inside(col: CollisionField, x: number, y: number, z: number): boolean {
    if (!col.covers(x, y)) return false;
    const f = this.map.frame, c = f.worldToCanvas(x, y, z);
    for (const dx of [-EDGE_MARGIN_PX, EDGE_MARGIN_PX])
      for (const dy of [-EDGE_MARGIN_PX, EDGE_MARGIN_PX]) {
        const [i, j] = f.tileOf(c.cx + dx, c.cy + dy);
        if (!this.published.has(`${i}_${j}`)) return false;
      }
    return true;
  }

  private contextLost(): void {
    if (this.isActive) { this.stop(); this.map.toast('Goose flight stopped: the graphics context was lost'); }
  }

  // ------------------------------------------------------------------ per frame

  /** Simulation step plus its consequences (particles, feedback, pickups, data streaming). */
  private advance(dt: number, input: FlightInput): StepEvents {
    const flight = this.flight!, s = flight.state, data = this.data!;
    const ev = flight.step(dt, input);
    const p: Vec3 = [s.x, s.y, s.z];
    const parts = this.gl!.actor.particles;
    if (ev.wall) {
      parts.emit('feather', [ev.wall.x, ev.wall.y, ev.wall.z], 12, [ev.wall.normal[0] * 2, ev.wall.normal[1] * 2, 0], 1.5);
      const now = performance.now();
      if (now - this.lastHonk > HONK_INTERVAL_MS) { this.lastHonk = now; this.map.toast('Honk!'); }
    }
    const emit = (kind: 'leaf' | 'spray' | 'wake', on: boolean, every: number, n: number, at: Vec3, spread: number) => {
      if (!on) { this.emitClock[kind] = 0; return; }
      this.emitClock[kind] += dt;
      for (; this.emitClock[kind] >= every; this.emitClock[kind] -= every) parts.emit(kind, at, n, [s.vx * 0.3, s.vy * 0.3, 0], spread);
    };
    const back: Vec3 = [s.x - Math.cos(s.heading) * 2.5, s.y - Math.sin(s.heading) * 2.5, s.z];
    emit('leaf', ev.canopy, 0.06, 1, p, 4);
    emit('spray', ev.water, 0.05, 2, [back[0], back[1], s.surface + 0.2], 1.5);
    emit('wake', input.boost && !ev.canopy, 0.05, 1, back, 0.6);
    if (ev.fence) {
      const now = performance.now();
      if (now - this.lastFence > FENCE_TOAST_MS) { this.lastFence = now; this.map.toast('The map ends here for now: more of Waterloo is still being drawn'); }
    }
    for (const f of feathersNear(data.feathers, p, COLLECT_RADIUS_M)) {
      if (!data.progress.collect(f.id)) continue;
      parts.emit('sparkle', [f.x, f.y, f.z], 18, [0, 0, 1], 1);
      const { count, total } = data.progress;
      this.map.toast(count === total ? `All ${total} feathers found! The last one: ${f.label}` : `Feather found: ${f.label} (${count} of ${total})`);
    }
    // keep collision chunks loaded ahead of the goose (asynchronous; motion pauses if it outruns them)
    if (Math.hypot(s.x - this.chunkCentre[0], s.y - this.chunkCentre[1]) > CHUNK_REFRESH_M) {
      this.chunkCentre = [s.x, s.y];
      void data.col.ensureAround(s.x, s.y, CHUNK_RADIUS_M);
    }
    // Paused over a chunk that is not loaded (it failed, or the goose outran it): it does not move, so the distance
    // test above never asks again. Ask here, or the goose would hang in the air until the page is reloaded.
    if (s.waiting) {
      const now = performance.now();
      if (now - this.lastWaitRetry > WAIT_RETRY_MS) { this.lastWaitRetry = now; void data.col.ensureAround(s.x, s.y, CHUNK_RADIUS_M); }
    }
    return ev;
  }

  private draw(vp: Viewport): void {
    const { actor, shadow } = this.gl!, s = this.flight!.state, f = this.map.frame;
    const c = f.worldToCanvas(s.x, s.y, s.z);
    void this.heights.centreOn(c.cx, c.cy);
    this.heights.flush();
    const a: GooseAttitude = {
      x: s.x, y: s.y, z: s.z, heading: s.heading, pitch: s.pitch, bank: s.bank,
      flapPhase: s.flapPhase, flapAmount: s.flapAmount, legs: s.surface === s.surface && s.z - s.surface < FLIGHT.clearance + 0.6 ? 0.5 : 0,
    };
    actor.render(a, vp);
    const ground = this.data!.col.ground(s.x, s.y);
    shadow.render(vp, (ground === ground ? ground : s.z - FLIGHT.maxAltitude) - 25, actor.rect.artPerTexel);
  }

  /** The viewport as the map last drew it (before the first flying frame there is no FrameInfo to take it from). */
  private viewportNow(): Viewport {
    const f = this.frameSize, el = this.element.parentElement ?? this.element;
    return {
      view: this.map.getView(),
      width: f?.width ?? el.clientWidth, height: f?.height ?? el.clientHeight, dpr: f?.dpr ?? Math.min(devicePixelRatio || 1, 2),
    };
  }

  /** The intro camera flight; returns true once the goose is under player control. */
  private updateIntro(view: ViewState): boolean {
    const intro = this.intro;
    if (!intro) return true;
    const settled = intro.prev && intro.prev.cx === view.cx && intro.prev.cy === view.cy && intro.prev.zoom === view.zoom;
    intro.prev = { ...view };
    if (!settled && performance.now() < intro.until) return false;
    this.intro = null;
    this.seedFollow(view);
    return true;
  }

  /** Start following from the current view: the look-ahead offset is whatever the view's offset from the goose is now. */
  private seedFollow(view: ViewState): void {
    const s = this.flight!.state, c = this.map.frame.worldToCanvas(s.x, s.y, s.z);
    this.lead = { x: view.cx - c.cx, y: view.cy - c.cy };
    this.followZoom = view.zoom;
  }

  /**
   * Keep the camera on the goose, a little ahead of it. The camera centre is the goose plus a look-ahead offset, and
   * only that offset is eased, so the camera never lags the goose itself: the map scrolls by exactly the goose's motion
   * each frame, plus the slow swing of the offset in a turn. Pauses while the user zooms so MapView's zoom easing runs.
   */
  private follow(view: ViewState, dt: number): void {
    if (view.zoom !== this.followZoom) { this.seedFollow(view); return; }
    const s = this.flight!.state, f = this.map.frame;
    const c = f.worldToCanvas(s.x, s.y, s.z);
    const vel = f.worldToCanvas(s.vx, s.vy, s.vz);
    const vp = this.lastViewport!;
    const lx = clamp(vel.cx * LEAD_S, (0.22 * vp.width) / view.zoom), ly = clamp(vel.cy * LEAD_S, (0.22 * vp.height) / view.zoom);
    const k = 1 - Math.exp(-dt / FOLLOW_TAU_S);
    this.lead.x += (lx - this.lead.x) * k;
    this.lead.y += (ly - this.lead.y) * k;
    this.map.setView({ cx: c.cx + this.lead.x, cy: c.cy + this.lead.y });   // MapView clamps the centre near the map edge
  }

  private updateHud(vp: Viewport): void {
    const s = this.flight!.state, data = this.data!, f = this.map.frame;
    const [gx, gy] = this.map.canvasToScreen(...canvasPx(f.worldToCanvas(s.x, s.y, s.z)));
    let nearest: { f: Feather; d: number } | null = null;
    const markers: FeatherMarker[] = [];
    for (const fe of data.feathers) {
      if (data.progress.has(fe.id)) continue;
      const d = Math.hypot(fe.x - s.x, fe.y - s.y, fe.z - s.z);
      if (!nearest || d < nearest.d) nearest = { f: fe, d };
      const [x, y] = screenOf(vp, fe.canvas);
      if (x > -20 && y > -20 && x < vp.width + 20 && y < vp.height + 20) markers.push({ id: fe.id, x, y, label: fe.label });
    }
    let pointer = null;
    if (nearest) {
      const [x, y] = screenOf(vp, nearest.f.canvas);
      pointer = { angle: Math.atan2(y - gy, x - gx), distance: nearest.d, label: nearest.f.label };
    }
    this.hud!.setMarkers(markers);
    this.hud!.update({
      altitude: s.z - s.surface, speed: this.flight!.nominalSpeed(), feathers: data.progress.count, total: data.progress.total, nearest: pointer,
    });
  }

  // ------------------------------------------------------------------ input

  private input(): FlightInput {
    const k = this.keys, t = this.hud?.touchInput() ?? NO_INPUT;
    // both turn keys held (reversing a turn before letting go of the first key): the one pressed last wins
    const left = k.has('left'), right = k.has('right');
    const keyTurn = left && right ? (this.lastTurnKey === 'left' ? 1 : -1) : (left ? 1 : 0) - (right ? 1 : 0);
    return {
      turn: clamp(keyTurn + t.turn, 1),
      climb: clamp((k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) + t.climb, 1),
      boost: k.has('boost') || t.boost,
      flap: k.has('flap') || t.flap,
    };
  }

  private readonly onKey = (e: KeyboardEvent) => {
    const key = KEYS[e.key.toLowerCase()];
    if (!key) return;
    // a release always ends the hold, wherever focus went meanwhile (e.g. into a panel opened mid-flight)
    if (e.type === 'keyup') { this.keys.delete(key); return; }
    // an Escape the map UI has already used (to close a panel) does not land the goose as well. Only Escape: the map's
    // own key handler marks the steering keys as handled too.
    if (e.key === 'Escape' && e.defaultPrevented) return;
    if (e.ctrlKey || e.metaKey || e.altKey || inControls(e.target)) return;
    if (key === 'flap' && pressable(e.target)) return;      // Space presses the button that has focus
    e.preventDefault();
    if (key === 'land') { this.stop(); return; }
    this.keys.add(key);
    if (key === 'left' || key === 'right') this.lastTurnKey = key;
  };

  private readonly onBlur = () => this.keys.clear();
  /** Focus moved into the UI (search, panels, buttons): stop steering with keys held from before. */
  private readonly onFocusIn = (e: FocusEvent) => { if (inControls(e.target)) this.keys.clear(); };

  // ------------------------------------------------------------------ debug hooks

  private buildDebug(): ActorDebug {
    const data = () => this.data;
    const need = () => {
      if (!this.isActive || !this.flight || !this.gl) throw new Error('actor debug: start() the flight first');
      return { flight: this.flight, gl: this.gl };
    };
    const viewport = (): Viewport => ({
      view: this.map.getView(),
      width: this.lastViewport?.width ?? this.element.clientWidth,
      height: this.lastViewport?.height ?? this.element.clientHeight,
      dpr: this.lastViewport?.dpr ?? Math.min(devicePixelRatio || 1, 2),
    });
    return {
      getState: () => {
        const s = need().flight.state;
        return {
          x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, heading: s.heading, speed: Math.hypot(s.vx, s.vy),
          nominalSpeed: need().flight.nominalSpeed(),
          surface: s.surface, inCanopy: s.inCanopy, overWater: s.overWater, waiting: s.waiting, time: s.time,
          lastHit: s.lastHit && { ...s.lastHit, normal: [...s.lastHit.normal] as Vec3 },
        };
      },
      teleport: async (x, y, z, heading) => {
        const { flight } = need();
        await this.data!.col.ensureAround(x, y, CHUNK_RADIUS_M);
        flight.teleport(x, y, z, heading);
        this.chunkCentre = [x, y];
        this.intro = null;
        const c = this.map.frame.worldToCanvas(x, y, z);
        this.map.setView({ cx: c.cx, cy: c.cy });
        this.seedFollow(this.map.getView());
        await this.heights.centreOn(c.cx, c.cy);
        this.heights.flush();
      },
      step: (dt, input) => { need(); return this.advance(dt, { ...NO_INPUT, ...input }); },
      setAutoStep: (on) => { this.autoStep = on; },
      occludedFraction: () => {
        const { gl } = need();
        this.draw(viewport());
        const c = gl.actor.readCoverage();
        return c.hidden + c.visible ? c.hidden / (c.hidden + c.visible) : 0;
      },
      shadowCentreScreen: () => {
        const { gl } = need();
        const vp = viewport();
        this.draw(vp);
        return gl.shadow.readCentroid(vp);
      },
      shadowRay: () => {
        const { gl } = need();
        this.draw(viewport());
        const p = gl.shadow.readLightCentroid();
        return p ? [p.x, p.y, p.z] : null;
      },
      projectToScreen: (x, y, z) => {
        const { gl } = need();
        this.draw(viewport());
        return this.map.canvasToScreen(...gl.actor.projectToCanvas(x, y, z));
      },
      stippleStats: () => {
        const { gl } = need();
        const vp = viewport();
        this.draw(vp);
        return gl.actor.readBlit(vp);
      },
      windowHeight: (cx, cy) => this.heights.sample(cx, cy),
      inside: (x, y, z) => !!this.data && this.inside(this.data.col, x, y, z),
      get collision() { return data()?.col ?? null; },
    };
  }
}

function screenUpHeading(map: MapAPI): number {
  // ground direction that points up the screen: the horizontal part of the camera's up axis
  const u = map.frame.up;
  return Math.atan2(u[1], u[0]);
}

function screenOf(vp: Viewport, c: [number, number]): [number, number] {
  return [(c[0] - vp.view.cx) * vp.view.zoom + vp.width / 2, (c[1] - vp.view.cy) * vp.view.zoom + vp.height / 2];
}

const canvasPx = (c: { cx: number; cy: number }): [number, number] => [c.cx, c.cy];

function clamp(v: number, limit: number): number { return Math.max(-limit, Math.min(limit, v)); }

/**
 * Keys aimed at a text field, a select or a dialog (a map panel such as Settings opened mid-flight, the title screen)
 * are not flight input. A plain button or link with focus does not take the flight keys: a click on the mute button
 * used to leave the goose deaf to the keyboard, L and Escape included.
 */
function inControls(t: EventTarget | null): boolean {
  return t instanceof Element && (!!t.closest('input, textarea, select, [role="dialog"]') || (t as HTMLElement).isContentEditable);
}

/** Space activates a focused button, so it does not flap there. It does nothing on a link, so it still flaps on one. */
function pressable(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest('button, [role="button"]');
}

/** The next animation frame, or 100 ms when none are being produced (a hidden tab). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); cancelAnimationFrame(frame); resolve(); };
    const timer = window.setTimeout(done, 100), frame = requestAnimationFrame(done);
  });
}

async function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  let timer = 0;
  await Promise.race([p, new Promise((r) => { timer = window.setTimeout(r, ms); })]);
  clearTimeout(timer);
}
