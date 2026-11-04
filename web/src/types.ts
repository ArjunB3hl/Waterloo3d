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
  labels: boolean;
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
