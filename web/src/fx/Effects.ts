// Effects module (fx/): composes the map base canvas with animated vegetation / water ("life") and a depth-aware
// tilt-shift blur into its own WebGL2 canvas, which sits above #map-base and below the actor and overlay layers.
// While an effect is visible the base canvas is hidden (but still drawn into: it is our source texture).
import type { EffectsModule, FrameInfo, MapAPI, Settings } from '../types';
import { Compositor, type ComposeParams, type TiltParams } from './compositor';

/** Life animation step rates (pixel-art rhythm, not 60 fps). */
const TREE_STEP_MS = 1000 / 8;
const WATER_STEP_MS = 1000 / 6;
/** Animation clocks wrap after an hour so float32 time stays precise in the shader. */
const CLOCK_WRAP_S = 3600;
/** MapView leaves the aux layers empty below this zoom, so life has nothing to animate there. */
const LIFE_MIN_ZOOM = 0.1;

/** Tilt-shift: maximum blur radius (CSS px) at strength 100. */
const TILT_MAX_COC_CSS = 16;
/** Sharp band and full-blur distance, as a fraction of the viewport height (see cocAt in shaders.ts). */
const TILT_BAND = 0.06;
const TILT_FULL = 0.45;
/** Weight of the plain screen-row distance next to the depth distance (miniature look). */
const TILT_ROW_WEIGHT = 0.25;
/** Blur fades out between these visible-tile counts and is off beyond the upper one. */
const TILT_FADE_TILES = [28, 40] as const;
/** Time constant of the focus easing. */
const FOCUS_TAU_MS = 140;
/** Device-pixel count above which 'auto' quality computes the blur at half resolution. */
const HALF_RES_PIXELS = 2_400_000;
/** CoC radius (device px) above which the blur is always computed at half resolution. */
const HALF_RES_COC = 8;

export interface EffectsDebug {
  webgl2: boolean;
  visible: boolean;          // fx canvas shown (base hidden)
  life: boolean;             // life animation drawn in the last frame
  tilt: boolean;             // tilt-shift drawn in the last frame
  tiltFade: number;          // 0..1 zoom-out fade of the blur
  lastFocusDepth: number;    // eased focus depth (metres toward the camera)
  focusSettled: boolean;
  cocMax: number;            // max CoC radius in device px for the last frame
  blurScale: number;
  renderMs: number;          // CPU time of the last render (uploads + draw submission)
  frames: number;            // frames composed so far
  uploads: number;           // base texture uploads so far
}

export type Effects = EffectsModule & { readonly debug: Readonly<EffectsDebug> };

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function createEffects(map: MapAPI): Effects {
  const canvas = document.createElement('canvas');
  canvas.id = 'map-fx';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.pointerEvents = 'none';
  canvas.style.visibility = 'hidden';

  const debug: EffectsDebug = {
    webgl2: false, visible: false, life: false, tilt: false, tiltFade: 0, lastFocusDepth: NaN, focusSettled: true,
    cocMax: 0, blurScale: 1, renderMs: 0, frames: 0, uploads: 0,
  };
  let enabled = { life: false, tiltShift: false, strength: 0 };
  let quality: Settings['quality'] = map.settings.quality;
  let focus: { sx: number; sy: number } | null = null;
  /** Eased focus, view relative so panning never makes it lag: depth offset from the centre's ground and screen row (CSS px). */
  let eased: { off: number; row: number; t: number } | null = null;
  let lastFocusZ = 0;
  let heightRetry = 0;
  let stepTimer = 0;
  let stale = true;           // textures may not match the base canvas (we skipped frames or lost the context)
  let warned = false;

  let comp: Compositor | null = null;
  const initGL = () => {
    try { comp = new Compositor(canvas); } catch (e) { comp = null; console.warn('effects disabled:', e); }
    debug.webgl2 = !!comp;
    stale = true;
  };
  initGL();

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); comp = null; show(false); });
  canvas.addEventListener('webglcontextrestored', () => { initGL(); map.invalidate(); });

  function show(v: boolean): void {
    debug.visible = v;
    canvas.style.visibility = v ? 'visible' : 'hidden';
    map.baseCanvas.style.visibility = v ? 'hidden' : 'visible';
  }

  function setEnabled(e: { life: boolean; tiltShift: boolean; strength: number }): void {
    enabled = { life: e.life, tiltShift: e.tiltShift, strength: Math.min(100, Math.max(0, e.strength)) };
    const tiltOn = enabled.tiltShift && enabled.strength > 0;
    if (!comp && (enabled.life || tiltOn) && !warned) {
      warned = true;
      map.toast('Visual effects are unavailable in this browser (no WebGL2).');
    }
    map.requestAuxLayers({ life: !!comp && enabled.life, height: !!comp && tiltOn });
    map.invalidate();
  }

  function setFocus(sx: number | null, sy: number | null): void {
    focus = sx === null || sy === null ? null : { sx, sy };
    heightRetry = 0;
    if (debug.tilt) map.invalidate();
  }

  /** Request one frame at the next tree / water step boundary (the only redraws life needs). */
  function armStepTimer(): void {
    if (stepTimer) return;
    const now = performance.now();
    const next = Math.min((Math.floor(now / TREE_STEP_MS) + 1) * TREE_STEP_MS, (Math.floor(now / WATER_STEP_MS) + 1) * WATER_STEP_MS);
    stepTimer = window.setTimeout(() => { stepTimer = 0; map.invalidate(); }, next - now + 1);
  }

  function stopStepTimer(): void {
    clearTimeout(stepTimer);
    stepTimer = 0;
  }

  /** Ease the focus towards the surface under the pointer (or screen centre). Returns tilt uniforms. */
  function focusParams(f: FrameInfo, strengthScale: number): TiltParams {
    const { view, width: w, height: h } = f;
    const fr = map.frame, z = view.zoom;
    const sx = focus?.sx ?? w / 2, sy = focus?.sy ?? h / 2;
    const fcx = view.cx + (sx - w / 2) / z, fcy = view.cy + (sy - h / 2) / z;
    const hz = map.heightAt(fcx, fcy);
    if (Number.isFinite(hz)) { lastFocusZ = hz; heightRetry = 0; }
    else if (heightRetry < 5) {
      // height tile still loading (heightAt has started it): look again shortly
      heightRetry++;
      window.setTimeout(() => map.invalidate(), 250);
    }
    const toCss = z / fr.mpp;                                  // metres of depth -> CSS px
    const centreDepth = fr.depthAt(view.cx, view.cy, 0);
    const target = (fr.depthAt(fcx, fcy, lastFocusZ) - centreDepth) * toCss;
    if (!eased || prefersReducedMotion.matches) eased = { off: target, row: sy, t: f.time };
    else {
      const k = 1 - Math.exp(-Math.min(100, Math.max(0, f.time - eased.t)) / FOCUS_TAU_MS);
      eased = { off: eased.off + (target - eased.off) * k, row: eased.row + (sy - eased.row) * k, t: f.time };
      if (Math.abs(target - eased.off) < 0.25 && Math.abs(sy - eased.row) < 0.25) { eased.off = target; eased.row = sy; }
    }
    debug.focusSettled = eased.off === target && eased.row === sy;
    if (!debug.focusSettled) map.invalidate();
    const focusDepth = centreDepth + eased.off / toCss;
    debug.lastFocusDepth = focusDepth;

    // CoC uniforms (see cocAt): depth offset in CSS px / viewport height, linear in the decoded z and the device row.
    const W = map.baseCanvas.width, H = map.baseCanvas.height;
    const devPerCss = H / h;
    const originY = view.cy - h / 2 / z;
    const rowK = z * (fr.up[2] / fr.back[2]);                 // CSS px of depth per canvas px of row (ground)
    const depthPerZ = z / (fr.mpp * fr.back[2]);              // CSS px of depth per metre of height
    const cocMax = TILT_MAX_COC_CSS * (enabled.strength / 100) * f.dpr * strengthScale;
    // large radii are gathered at half resolution too: 24 taps spread over > 8 px would undersample the artwork
    const halfRes = quality === 'low' || cocMax > HALF_RES_COC || (quality === 'auto' && (f.dpr > 1.5 || W * H > HALF_RES_PIXELS));
    return {
      depth: [depthPerZ / h, (rowK / z / devPerCss) / h, (originY * rowK - focusDepth * toCss) / h],
      row: [eased.row * devPerCss, TILT_ROW_WEIGHT / (h * devPerCss)],
      coc: [cocMax, TILT_BAND, TILT_FULL],
      blurScale: halfRes ? 0.5 : 1,
    };
  }

  function render(f: FrameInfo): void {
    const t0 = performance.now();
    if (comp?.contextLost) comp = null;
    const z = f.view.zoom, F = map.frame.F;
    const visibleTiles = (f.width / z / F) * (f.height / z / F);
    const tiltFade = enabled.tiltShift && enabled.strength > 0
      ? Math.min(1, Math.max(0, (TILT_FADE_TILES[1] - visibleTiles) / (TILT_FADE_TILES[1] - TILT_FADE_TILES[0]))) : 0;
    const lifeCanvas = map.lifeCanvas;
    const lifeOn = enabled.life && z >= LIFE_MIN_ZOOM && !!lifeCanvas;
    const tiltOn = tiltFade > 0;
    debug.tiltFade = tiltFade;
    debug.life = !!comp && lifeOn;
    debug.tilt = !!comp && tiltOn;

    if (!comp || !(lifeOn || tiltOn)) {
      // nothing to add: show the base canvas directly and skip the GPU entirely
      show(false);
      stopStepTimer();
      stale = true;
      eased = null;
      debug.focusSettled = true;
      return;
    }

    const base = map.baseCanvas;
    if (canvas.width !== base.width || canvas.height !== base.height) {
      canvas.width = base.width; canvas.height = base.height;
    }
    const upload = f.baseDirty || stale;
    const cpdX = f.width / base.width / z, cpdY = f.height / base.height / z;
    const animate = lifeOn && !prefersReducedMotion.matches;
    const tilt = tiltOn ? focusParams(f, tiltFade) : null;
    const params: ComposeParams = {
      upload: upload ? { base, height: tiltOn ? map.heightCanvas : null, life: lifeOn ? lifeCanvas : null } : null,
      origin: [f.view.cx - f.width / 2 / z, f.view.cy - f.height / 2 / z],
      canvasPerDev: [cpdX, cpdY],
      artToDev: z * (base.width / f.width),
      heightDecode: [1 / map.frame.unitsPerM, map.frame.floorM],
      life: lifeOn ? {
        treeT: animate ? ((Math.floor(f.time / TREE_STEP_MS) * TREE_STEP_MS) / 1000) % CLOCK_WRAP_S : 0,
        waterT: animate ? ((Math.floor(f.time / WATER_STEP_MS) * WATER_STEP_MS) / 1000) % CLOCK_WRAP_S : 0,
      } : null,
      tilt,
    };
    comp.draw(params);
    if (upload) { debug.uploads++; stale = false; }
    show(true);

    if (animate) armStepTimer(); else stopStepTimer();
    if (!tiltOn) { eased = null; debug.focusSettled = true; }
    debug.cocMax = tilt ? tilt.coc[0] : 0;
    debug.blurScale = tilt ? tilt.blurScale : 1;
    debug.frames++;
    debug.renderMs = performance.now() - t0;
  }

  const syncSettings = (s: Settings) => {
    quality = s.quality;
    setEnabled({ life: s.life, tiltShift: s.tiltShift, strength: s.tiltStrength });
  };
  const offSettings = map.onSettings(syncSettings);
  const offFrame = map.on('frame', render);
  const onMotionPref = () => map.invalidate();
  prefersReducedMotion.addEventListener('change', onMotionPref);
  syncSettings(map.settings);

  return {
    canvas,
    debug,
    setEnabled,
    setFocus,
    render,
    dispose() {
      offFrame(); offSettings();
      prefersReducedMotion.removeEventListener('change', onMotionPref);
      stopStepTimer();
      comp?.dispose();
      comp = null;
      show(false);
      map.requestAuxLayers({ life: false, height: false });
      canvas.remove();
    },
  };
}
