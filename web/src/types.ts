// Shared contracts between Tiny Waterloo browser modules.
// Owners: map/ (MapView, tiles, UI) - depth/ (actor, shadows, occlusion, collision) - fx/ (life + tilt-shift compositor).
// Every module talks to the others ONLY through these interfaces.
import type { Frame, Vec3 } from './frame';

export interface TileEntry {
  i: number; j: number;
  kind: 'art' | 'reference';      // 'reference' = procedural reference render awaiting generated artwork
  v: string;                      // content hash of the 1024 artwork (cache-busting query ?v=)
  hv: string;                     // content hash of the height tile
  lv?: string;                    // content hash of the life mask (older manifests: absent, fall back to v)
  art_version: string | null; batch: string | null;
  finish?: string | null;          // pixel-art finish id (config/world.json art_finish) or null = full-resolution art
}

export interface Manifest {
  name: string; generated_utc: string;
  frame_px: number; lods_px: number[]; height_px: number;
  camera: { right_enu: Vec3; up_enu: Vec3; back_enu: Vec3; sun_enu: Vec3; meters_per_px: number; frame_px: number };
  heights: { floor_m: number; units_per_m: number };
  origin: { lat: number; lon: number }; datum_m: number; proj4: string;
  classes: Record<string, number>;
  overview: { url: string; i0: number; j0: number; cols: number; rows: number; px_per_tile: number };
  regions: Record<string, { title: string; stage: number; tiles: [number, number][] }>;
  tiles: Record<string, TileEntry>;          // key "i_j"
  counts: { tiles: number; art: number; reference: number };
  attribution: string[];
  coverage?: CoverageInfo;
}

/** Citywide tile plan (web/public/data/coverage.json, merged into manifest.coverage when present). */
export interface CoverageInfo {
  city_tiles: [number, number][];            // tiles intersecting the verified municipal boundary
  boundary_canvas: [number, number][][];     // boundary rings in canvas px (for drawing)
  boundary_source: string;
}

export interface Landmark {
  id: string; name: string; short?: string;
  category: string;
  lonlat: [number, number];
  canvas: [number, number];                  // canvas px at roof / ground level used for camera jump
  zoom: number;
  description: string;
  facts?: string[];
  sources: { label: string; url?: string }[];
  geometry_source: string;                   // e.g. "OSM way 43250626 via Overture 2026-10-21.0"
  height_source: string;                     // osm_height | osm_levels (approx) | ms_ml_height (estimate) | class_default (approx)
  status: 'covered' | 'pending';
}

/** One named building label (web/public/data/labels.json, built by pipeline/build_labels.py). */
export interface BuildingLabel {
  id: string; name: string;
  short: string | null;                      // curated University of Waterloo building code (MC, DC ...) or null
  cls: string;                               // OSM building class (university, retail, apartments ...)
  group: 'campus' | 'civic' | 'commercial' | 'residential' | 'other';
  canvas: [number, number];                  // canvas px at the roof of the part under a representative footprint point
  area_m2: number; height_m: number;
  priority: number;                          // higher is placed first
  min_zoom: number;                          // smallest view zoom at which the label is considered
  osm: string;                               // e.g. "w43250626@28" (type + id @ version)
  source: string; height_source: string; tile: string;
  campus?: string;                           // university land use the building sits in
  alt?: string[];                            // alternative OSM names
  display?: string;                          // drawn text at zoom >= 1 when it differs from name (<= 32 chars: shorter alt
                                             // name, abbreviated or cut at a word; 'V1 East 3')
  display_short?: string;                    // drawn text below zoom 1 when it differs from display (<= 26 chars)
  landmark?: boolean; landmark_id?: string;  // also has a landmark card (landmarks.json id)
  osm_all?: string[];                        // merged same-name buildings
}

/** A label drawn in the last overlay pass: screen rect in CSS px. */
export interface DrawnLabel {
  id: string; text: string; x: number; y: number; w: number; h: number;
  /** Placed, but under fixed UI (search bar, controls, strip ...): not painted and not pickable. */
  occluded: boolean;
}

export interface BuildingLabelStats {
  total: number;                   // labels loaded
  considered: number;              // inside the viewport (+ margin) and above their min zoom in the last pass
  drawn: number;                   // placed without collisions in the last pass (including occluded ones)
  occluded: number;                // placed but under fixed UI, so not painted
  drawMs: number;                  // CPU time of the last label pass (placement + drawing)
  drawP95Ms: number;               // p95 over the last 120 passes
  view: ViewState;                 // view of the last pass
  enabled: boolean;                // building labels were on in the last pass
}

/** Building label layer (drawn by MapView on the overlay canvas, above effects and actor). */
export interface BuildingLabelsAPI {
  readonly all: readonly BuildingLabel[];
  /** Resolves once labels.json is loaded (or failed: then `all` stays empty). */
  readonly ready: Promise<void>;
  byId(id: string): BuildingLabel | undefined;
  /** Label painted under a screen point (CSS px), or null. slop: extra hit margin in px (touch uses a larger one). */
  pick(sx: number, sy: number, slop?: number): BuildingLabel | null;
  drawn(): DrawnLabel[];
  stats(): BuildingLabelStats;
  /** Landmark pills (DOM, #labels) the building labels must avoid; their own building label is then skipped. */
  setLandmarkPills(pills: { id: string; canvas: [number, number]; text: string }[]): void;
  /** Screen rects (CSS px) of fixed UI over the map. Placement ignores them (so panning cannot make labels pop);
   *  labels intersecting one are not painted or picked. */
  setOcclusionRects(rects: { x: number; y: number; w: number; h: number }[]): void;
  /** Goose flight: only campus building codes are drawn. */
  setFlightMode(on: boolean): void;
  /** Click / tap on a drawn label. */
  onTap(cb: (l: BuildingLabel) => void): () => void;
  /** Tests / benchmarks only: every label in view competes for space regardless of its min_zoom. */
  setIgnoreMinZoom?(on: boolean): void;
}

/** View state: cx, cy = canvas px at screen centre; zoom = screen CSS px per canvas px. */
export interface ViewState { cx: number; cy: number; zoom: number }

export interface FrameInfo {
  view: ViewState;
  width: number; height: number;   // CSS px
  dpr: number;
  time: number;                    // performance.now() ms
  baseDirty: boolean;              // true when baseCanvas (and aux layers) were redrawn this frame
}

/** Provided by MapView to other modules. */
export interface MapAPI {
  frame: Frame;
  manifest: Manifest;
  getView(): ViewState;
  setView(v: Partial<ViewState>, opts?: { animate?: boolean }): void;
  screenToCanvas(sx: number, sy: number): [number, number];
  canvasToScreen(cx: number, cy: number): [number, number];
  /** Decoded height (z, metres rel. datum) at canvas px from loaded height tiles; NaN if unknown/not loaded. */
  heightAt(cx: number, cy: number): number;
  /** Load (bounded LRU) and decode a height tile into Float32 metres (NaN = invalid). null if tile missing. */
  getHeightTile(i: number, j: number): Promise<Float32Array | null>;
  /** Synchronous lookup of an already decoded height tile (no load is started); null if not cached. */
  peekHeightTile?(i: number, j: number): Float32Array | null;
  /** Load a life mask tile (RGBA ImageBitmap 1024). null if missing. */
  getLifeTile(i: number, j: number): Promise<ImageBitmap | null>;
  /** 2D canvas holding the composed map for the current frame (device px = CSS px * dpr, dpr capped at 2). */
  readonly baseCanvas: HTMLCanvasElement;
  /** Optional screen-aligned layers rendered by MapView on request (same size as baseCanvas). */
  requestAuxLayers(layers: { height?: boolean; life?: boolean }): void;
  // Aux layers cover exactly the same screen area as baseCanvas but MAY have a lower pixel resolution
  // (quality 'low' => half). Consumers must sample them with normalised screen coordinates.
  readonly heightCanvas: HTMLCanvasElement | null;  // packed RGB heights, nearest sampling, screen aligned
  readonly lifeCanvas: HTMLCanvasElement | null;    // life mask RGB, nearest sampling, screen aligned
  on(ev: 'frame', cb: (f: FrameInfo) => void): () => void;
  on(ev: 'viewchange', cb: (v: ViewState) => void): () => void;
  /** Ask for a redraw next animation frame (effects/actors call this while animating). */
  invalidate(): void;
  settings: Settings;
  onSettings(cb: (s: Settings) => void): () => void;
  /** Merge a settings change, persist it (localStorage) and notify onSettings listeners. */
  updateSettings(patch: Partial<Settings>): void;
  /** false = ignore user pan input (drag, keys, inertia, double-click) e.g. while an actor steers the camera.
   *  Zoom input (wheel, pinch, +/-) keeps working but is anchored at the screen centre. Default true. */
  setInteractive(enabled: boolean): void;
  /** Live performance counters (also shown by the performance HUD; used by tests). */
  perf(): PerfStats;
  /** HUD status line / toast. */
  toast(msg: string): void;
  /** Named building labels on the overlay canvas. */
  readonly labels: BuildingLabelsAPI;
  /** Element for module HUDs (actor HUD, collectibles); stays above canvases, below modal panels. */
  readonly hudRoot: HTMLElement;
}

export interface PerfStats {
  fps: number;                     // frames drawn in the last second
  frameP95Ms: number;              // p95 interval between consecutive animation frames (last second)
  drawP95Ms: number;               // p95 CPU time spent drawing base + aux layers (last second)
  bitmaps: number;                 // decoded ImageBitmaps held by the tile cache
  bitmapMB: number;                // their estimated decoded size
  budgetMB: number;                // cache budget
  heightTiles: number;             // decoded Float32 height tiles held
  inflight: number;                // fetches in flight (max 6)
  queued: number;                  // fetches waiting
  deferred?: number;               // prefetches held back by the byte budget (not pending work)
  failed: number;                  // resources in a failed / retrying state
  tilesDrawn: number;              // artwork tiles drawn in the last base redraw
  heapMB: number | null;           // performance.memory.usedJSHeapSize when available
  dpr: number;
  viewport: [number, number];      // CSS px
}

export interface Settings {
  minimap: boolean;
  life: boolean;           // vegetation + water animation
  tiltShift: boolean;
  tiltStrength: number;    // 0..100
  labels: boolean;         // landmark pills
  buildingLabels: boolean; // named building labels (overlay canvas)
  coverage: boolean;       // show covered/pending tile outlines
  perfHud: boolean;
  quality: 'auto' | 'high' | 'low';
}

/** Effects compositor (fx/). Draws baseCanvas (+ life + tilt-shift) into its own WebGL canvas. */
export interface EffectsModule {
  readonly canvas: HTMLCanvasElement;
  setEnabled(e: { life: boolean; tiltShift: boolean; strength: number }): void;
  /** Focus point in screen CSS px (mouse) or null = screen centre. */
  setFocus(sx: number | null, sy: number | null): void;
  render(f: FrameInfo): void;   // called by MapView after baseCanvas (and aux layers) are drawn
  dispose(): void;
}

/** Actor overlay (depth/). Owns transparent canvases aligned with the map (e.g. a multiply-blended shadow
 *  canvas and a normal actor canvas) inside one absolutely positioned container element. */
export interface ActorModule {
  readonly element: HTMLElement;
  start(at?: { cx: number; cy: number }): Promise<void>;
  stop(): void;
  readonly active: boolean;
  render(f: FrameInfo): void;
  dispose(): void;
}
