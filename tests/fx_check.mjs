// Browser check for the effects compositor (web/src/fx): tilt-shift focus/blur, life animation masks and rate,
// reduced motion, zoom-out auto-disable, WebGL2 fallback, context loss and render cost.
// Starts Vite on port 5182 without HMR (or reuses a server already there), drives Chromium (software GL) via Playwright and
// writes docs/screenshots/fx_tiltshift_{on,off}.png (1280x800, dsf 1).
// Run: node tests/fx_check.mjs
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5182;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const PARK = '#4500,450,1';           // Waterloo Park / Silver Lake: dense canopy and open water

let failures = 0;
async function check(name, fn) {
  let line;
  try {
    const detail = await fn();
    line = `PASS ${name}${detail ? `  (${detail})` : ''}`;
  } catch (e) {
    failures++;
    line = `FAIL ${name}: ${e?.message ?? e}`;
  }
  console.log(line);
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}

/** Start Vite programmatically with HMR off: other modules are edited concurrently during development and a
 *  hot reload in the middle of a check would invalidate it. Returns a close function (null if a server was reused). */
async function startServer() {
  if (await serverUp()) return null;
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: path.join(ROOT, 'vite.config.ts'), root: path.join(ROOT, 'web'), logLevel: 'error',
    server: { port: PORT, strictPort: true, hmr: false },
  });
  await server.listen();
  return () => server.close();
}

function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const waitFor = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout, polling: 50 });
const idle = (page) => waitFor(page, () => {
  const p = window.__tinyWaterloo?.map?.perf();
  return p && p.inflight === 0 && p.queued === 0 && p.bitmaps > 0;
}, null, 30000);
const fxDebug = (page) => page.evaluate(() => ({ ...window.__tinyWaterloo.fx.debug }));
const settings = (page, patch) => page.evaluate((p) => window.__tinyWaterloo.map.updateSettings(p), patch);

/** Open the map at `hash`, wait for tiles and fade-ins. */
async function open(page, hash = '') {
  await page.goto(BASE + hash);
  await waitFor(page, () => window.__tinyWaterloo?.fx && window.__tinyWaterloo.map);
  await idle(page);
  await page.waitForTimeout(500);
}

/** Wait for the eased focus to settle and the frame loop to go quiet. */
async function settleFocus(page, timeout = 5000) {
  await waitFor(page, () => window.__tinyWaterloo.fx.debug.focusSettled, null, timeout);
  await page.waitForTimeout(200);
}

/** Wait until the base canvas has not been redrawn for `ms` (tile fades, LOD swaps and late aux tiles are done). */
const baseQuiet = (page, ms = 800) => page.evaluate((quiet) => new Promise((res) => {
  const { map } = window.__tinyWaterloo;
  let timer = setTimeout(done, quiet);
  const off = map.on('frame', (f) => { if (f.baseDirty) { clearTimeout(timer); timer = setTimeout(done, quiet); } });
  function done() { off(); res(); }
}), ms);

/** Two screenshots `gap` ms apart, retried until no base redraw happened between them (so only fx can differ). */
async function pairWithoutBaseRedraw(page, a, b, gap = 250) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await baseQuiet(page);
    await page.evaluate(() => { const w = window; w.__baseDraws = 0; w.__offDraws?.(); w.__offDraws = w.__tinyWaterloo.map.on('frame', (f) => { if (f.baseDirty) w.__baseDraws++; }); });
    await keep(page, a, await page.screenshot());
    await page.waitForTimeout(gap);
    await keep(page, b, await page.screenshot());
    if ((await page.evaluate(() => window.__baseDraws)) === 0) return attempt;
  }
  throw new Error('base canvas kept redrawing');
}

/** Set the zoom and wait until a frame at that zoom has been composed. */
const zoomTo = (page, zoom) => page.evaluate((z) => new Promise((res) => {
  const { map } = window.__tinyWaterloo;
  const off = map.on('frame', (f) => { if (f.view.zoom === z) { off(); setTimeout(res, 50); } });
  map.setView({ zoom: z });
}), zoom);

/** Hide DOM / overlay layers above the fx canvas so analysis screenshots see only the composed map. */
const mapOnly = (page, on) => page.evaluate((hide) => {
  for (const sel of ['#ui', '#labels', '#map-overlay', '#hud', '#attribution', '#toast']) {
    const el = document.querySelector(sel);
    if (el) el.style.visibility = hide ? 'hidden' : '';
  }
}, on);

/** Decode a PNG screenshot inside the page and keep its pixels under `name` for the analysis helpers below. */
async function keep(page, name, png) {
  await page.evaluate(async ([n, b64]) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
    c.drawImage(bmp, 0, 0);
    (window.__fxImgs ??= {})[n] = c.getImageData(0, 0, bmp.width, bmp.height);
  }, [name, png.toString('base64')]);
}

/** Mean |Laplacian| of luma inside rect [x0,y0,x1,y1] (a sharpness measure). */
const sharpness = (page, name, rect) => page.evaluate(([n, [x0, y0, x1, y1]]) => {
  const im = window.__fxImgs[n], W = im.width, d = im.data;
  const L = (x, y) => { const k = 4 * (y * W + x); return 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; };
  let s = 0, n2 = 0;
  for (let y = y0 + 1; y < y1 - 1; y++) for (let x = x0 + 1; x < x1 - 1; x++) {
    s += Math.abs(4 * L(x, y) - L(x - 1, y) - L(x + 1, y) - L(x, y - 1) - L(x, y + 1)); n2++;
  }
  return s / n2;
}, [name, rect]);

/** Fraction of pixels in rect identical between two kept images. */
const sameFraction = (page, a, b, rect) => page.evaluate(([na, nb, [x0, y0, x1, y1]]) => {
  const A = window.__fxImgs[na], B = window.__fxImgs[nb], W = A.width;
  let same = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const k = 4 * (y * W + x);
    if (A.data[k] === B.data[k] && A.data[k + 1] === B.data[k + 1] && A.data[k + 2] === B.data[k + 2]) same++;
    n++;
  }
  return same / n;
}, [a, b, rect]);

/** Changed pixels between two kept images, split by the current life mask (canopy G or water B, screen aligned). */
const lifeDiff = (page, a, b) => page.evaluate(([na, nb]) => {
  const A = window.__fxImgs[na], B = window.__fxImgs[nb], W = A.width, H = A.height;
  const lc = window.__tinyWaterloo.map.lifeCanvas;
  const m = lc.getContext('2d').getImageData(0, 0, lc.width, lc.height).data;
  const sx = lc.width / W, sy = lc.height / H;
  let inMask = 0, outside = 0, maskPx = 0, quietBlocks = 0;
  const blockDiff = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = 4 * (y * W + x);
    const mk = 4 * (Math.floor(y * sy) * lc.width + Math.floor(x * sx));
    const masked = m[mk + 1] > 127 || m[mk + 2] > 127;
    if (masked) maskPx++;
    const changed = A.data[k] !== B.data[k] || A.data[k + 1] !== B.data[k + 1] || A.data[k + 2] !== B.data[k + 2];
    // 32x32 blocks without any mask pixel (roads, walls, roofs, lawns) must be bit-identical
    const bk = `${x >> 5},${y >> 5}`;
    const e = blockDiff.get(bk) ?? { masked: false, changed: false };
    e.masked ||= masked; e.changed ||= changed;
    blockDiff.set(bk, e);
    if (changed) { if (masked) inMask++; else outside++; }
  }
  let quietChanged = 0;
  for (const e of blockDiff.values()) if (!e.masked) { quietBlocks++; if (e.changed) quietChanged++; }
  return { inMask, outside, maskPx, quietBlocks, quietChanged };
}, [a, b]);

/** Frames emitted by the map over `ms` (life animation requests one per tree / water step). */
const countFrames = (page, ms) => page.evaluate((t) => new Promise((res) => {
  let n = 0;
  const off = window.__tinyWaterloo.map.on('frame', () => n++);
  setTimeout(() => { off(); res(n); }, t);
}), ms);

/** GPU-inclusive cost of composing one frame: render() then a 1-pixel readPixels (waits for the GPU to finish the
 *  frame), with and without the base texture upload. The extra render() calls happen inside one task, so they never
 *  reach the screen. */
const renderCost = (page, n = 20) => page.evaluate(async (count) => {
  const { map, fx } = window.__tinyWaterloo;
  const gl = fx.canvas.getContext('webgl2');
  const px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const f = await new Promise((res) => { const off = map.on('frame', (x) => { off(); res(x); }); map.invalidate(); });
  // dirty: base redrawn (pan / zoom / tile arrival); moveFocus: focus easing (blur recomputed, no upload);
  // neither: a life step (the cached blur is reused)
  const run = (dirty, moveFocus = false) => {
    const ts = [];
    for (let k = 0; k < count; k++) {
      if (moveFocus) fx.setFocus(640, 200 + 20 * k);
      const t0 = performance.now();
      fx.render({ ...f, baseDirty: dirty, time: f.time + k * 125 });
      sync();
      ts.push(performance.now() - t0);
    }
    ts.sort((a, b) => a - b);
    return { median: ts[ts.length >> 1], p95: ts[Math.floor(ts.length * 0.95)] };
  };
  sync();
  const noUpload = run(false), upload = run(true), focus = run(false, true);
  fx.setFocus(null, null);
  return { noUpload, upload, focus, cpuSubmitMs: fx.debug.renderMs, blurScale: fx.debug.blurScale, base: [map.baseCanvas.width, map.baseCanvas.height] };
}, n);
const ms = (r) => `median ${r.median.toFixed(1)} / p95 ${r.p95.toFixed(1)} ms`;
const fmt = (c) => `step frame ${ms(c.noUpload)}; focus moving ${ms(c.focus)}; base redrawn (upload) ${ms(c.upload)}`;

const stopServer = await startServer();
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ args: GL_ARGS });
const numbers = {};

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = trackErrors(page);

  await check('campus loads with WebGL2 effects: fx canvas shown, base hidden, no console errors', async () => {
    await open(page);
    const d = await fxDebug(page);
    const vis = await page.evaluate(() => [document.getElementById('map-fx')?.style.visibility, window.__tinyWaterloo.map.baseCanvas.style.visibility,
      [...document.getElementById('stage').children].map((e) => e.id || e.tagName.toLowerCase()).join(' > ')]);
    assert(d.webgl2 && d.visible && d.life && d.tilt, `debug ${JSON.stringify(d)}`);
    assert(vis[0] === 'visible' && vis[1] === 'hidden', `visibility fx=${vis[0]} base=${vis[1]}`);
    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
    return `stage order: ${vis[2]}`;
  });

  await check('both effects off: fx canvas hidden, base canvas visible', async () => {
    await settings(page, { life: false, tiltShift: false });
    await page.waitForTimeout(300);
    const vis = await page.evaluate(() => [document.getElementById('map-fx').style.visibility, window.__tinyWaterloo.map.baseCanvas.style.visibility]);
    assert(vis[0] === 'hidden' && vis[1] === 'visible', `fx=${vis[0]} base=${vis[1]}`);
    await page.waitForTimeout(400);
    await mapOnly(page, false);
    await page.screenshot({ path: path.join(SHOTS, 'fx_tiltshift_off.png') });
    await mapOnly(page, true);
    await keep(page, 'off', await page.screenshot());
  });

  const bands = { top: [300, 40, 1240, 120], centre: [300, 370, 1240, 430], bottom: [300, 690, 1240, 770] };
  await check('tilt-shift (strength 40, centre focus): sharp at the focus row, blurred away from it', async () => {
    await settings(page, { tiltShift: true, tiltStrength: 40 });
    await settleFocus(page);
    await mapOnly(page, false);
    await page.screenshot({ path: path.join(SHOTS, 'fx_tiltshift_on.png') });
    await mapOnly(page, true);
    await keep(page, 'on', await page.screenshot());
    const r = {};
    for (const [k, rect] of Object.entries(bands)) r[k] = (await sharpness(page, 'on', rect)) / (await sharpness(page, 'off', rect));
    const same = await sameFraction(page, 'on', 'off', [300, 390, 1240, 410]);
    const d = await fxDebug(page);
    numbers.tilt = { ...r, sameAtFocus: same, cocMax: d.cocMax };
    assert(r.centre > 0.97 && same > 0.9, `centre sharpness ratio ${r.centre.toFixed(3)}, identical ${same.toFixed(3)}`);
    assert(r.top < 0.6 && r.bottom < 0.6, `top ${r.top.toFixed(3)} bottom ${r.bottom.toFixed(3)}`);
    return `sharpness on/off: top ${r.top.toFixed(2)}, centre ${r.centre.toFixed(2)}, bottom ${r.bottom.toFixed(2)}; ` +
      `${(same * 100).toFixed(1)}% of focus-row pixels identical to the base; cocMax ${d.cocMax.toFixed(1)} px`;
  });

  await check('focus follows the mouse (eased) and is depth aware', async () => {
    const before = await fxDebug(page);
    await page.mouse.move(700, 80);
    const t0 = Date.now();
    const immediately = await fxDebug(page);
    await settleFocus(page);
    const settleMs = Date.now() - t0;
    await keep(page, 'top', await page.screenshot());
    const top = (await sharpness(page, 'top', bands.top)) / (await sharpness(page, 'off', bands.top));
    const bottom = (await sharpness(page, 'top', bands.bottom)) / (await sharpness(page, 'off', bands.bottom));
    const after = await fxDebug(page);
    // the focus depth is the surface depth under the pointer (decoded height), not just the ground at that row
    const expect = await page.evaluate(() => {
      const { map } = window.__tinyWaterloo;
      const [cx, cy] = map.screenToCanvas(700, 80);
      return { surface: map.frame.depthAt(cx, cy, map.heightAt(cx, cy)), z: map.heightAt(cx, cy) };
    });
    assert(top > 0.95 && bottom < 0.5, `top ${top.toFixed(3)} bottom ${bottom.toFixed(3)}`);
    assert(Math.abs(after.lastFocusDepth - expect.surface) < 0.05, `focus ${after.lastFocusDepth} vs surface ${expect.surface}`);
    assert(!immediately.focusSettled || immediately.lastFocusDepth !== after.lastFocusDepth, 'focus jumped without easing');
    await page.evaluate(() => window.__tinyWaterloo.fx.setFocus(null, null));
    await settleFocus(page);
    return `focus depth ${before.lastFocusDepth.toFixed(1)} -> ${after.lastFocusDepth.toFixed(1)} m (surface z ${expect.z.toFixed(1)} m), ` +
      `settled in ~${settleMs} ms; top/bottom sharpness ${top.toFixed(2)}/${bottom.toFixed(2)}`;
  });

  await check('focus on a tall roof: the roof is sharp, the ground in the same row is not the focus', async () => {
    const pt = await page.evaluate(() => {
      const { map, landmarks } = window.__tinyWaterloo;
      const l = landmarks.find((x) => x.id === 'dana-porter');
      return { s: map.canvasToScreen(l.canvas[0], l.canvas[1]), c: l.canvas };
    });
    await page.mouse.move(pt.s[0], pt.s[1]);
    await settleFocus(page);
    const r = await page.evaluate(([cx, cy]) => {
      const { map, fx } = window.__tinyWaterloo;
      return { focus: fx.debug.lastFocusDepth, ground: map.frame.depthAt(cx, cy, 0), z: map.heightAt(cx, cy) };
    }, pt.c);
    await page.evaluate(() => window.__tinyWaterloo.fx.setFocus(null, null));
    await settleFocus(page);
    assert(r.z > 10 && r.focus - r.ground > 10, JSON.stringify(r));
    return `Dana Porter roof z ${r.z.toFixed(1)} m: focus depth ${(r.focus - r.ground).toFixed(1)} m in front of the ground at that pixel`;
  });

  await check('strength 100 blurs more than 40; strength 0 hides the fx canvas', async () => {
    await settings(page, { tiltStrength: 100 });
    await settleFocus(page);
    await keep(page, 'on100', await page.screenshot());
    const s100 = (await sharpness(page, 'on100', bands.top)) / (await sharpness(page, 'off', bands.top));
    const s40 = (await sharpness(page, 'on', bands.top)) / (await sharpness(page, 'off', bands.top));
    await settings(page, { tiltStrength: 0 });
    await page.waitForTimeout(300);
    const d = await fxDebug(page);
    await settings(page, { tiltStrength: 40 });
    assert(s100 < s40 && !d.visible, `top sharpness 100: ${s100.toFixed(3)} vs 40: ${s40.toFixed(3)}; visible at 0: ${d.visible}`);
    return `top-band sharpness ratio 40 -> ${s40.toFixed(2)}, 100 -> ${s100.toFixed(2)}`;
  });

  await check('tilt-shift render cost (1280x800 dsf 1, swiftshader)', async () => {
    await settleFocus(page);
    const c = await renderCost(page);
    numbers.tiltCost = c;
    return `${fmt(c)}; blur scale ${c.blurScale}`;
  });

  await check('life (campus home view): frames 250 ms apart differ only inside canopy / water masks', async () => {
    await settings(page, { tiltShift: false, life: true });
    await pairWithoutBaseRedraw(page, 'la', 'lb');
    const r = await lifeDiff(page, 'la', 'lb');
    numbers.lifeCampus = r;
    assert(r.inMask > 0 && r.outside === 0 && r.quietChanged === 0, JSON.stringify(r));
    return `${r.inMask} px changed inside the mask (${r.maskPx} mask px), ${r.outside} outside; ${r.quietBlocks} mask-free 32 px blocks all identical`;
  });

  await check('life (Waterloo Park, zoom 1): canopy sways and water shimmers, nothing else changes', async () => {
    await open(page, PARK);
    await settings(page, { tiltShift: false, life: true });
    await mapOnly(page, true);
    await pairWithoutBaseRedraw(page, 'pa', 'pb');
    const r = await lifeDiff(page, 'pa', 'pb');
    numbers.lifePark = r;
    assert(r.inMask > 1000 && r.outside === 0 && r.quietChanged === 0, JSON.stringify(r));
    return `${r.inMask} px changed inside the mask (${r.maskPx} mask px), ${r.outside} outside; ${r.quietBlocks} mask-free blocks identical`;
  });

  await check('life redraws only at the step rate (8 Hz trees + 6 Hz water)', async () => {
    const n = await countFrames(page, 2000);
    numbers.lifeFps = n / 2;
    assert(n >= 18 && n <= 30, `${n} frames in 2 s`);
    const c = await renderCost(page);
    numbers.lifeCost = c;
    return `${(n / 2).toFixed(1)} frames/s while idle; render ${fmt(c)}`;
  });

  await check('life + tilt-shift together render cost', async () => {
    await settings(page, { tiltShift: true });
    await settleFocus(page);
    const c = await renderCost(page);
    numbers.bothCost = c;
    await settings(page, { tiltShift: false });
    return fmt(c);
  });

  await check('prefers-reduced-motion freezes life (no frames, identical screenshots)', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(400);
    const n = await countFrames(page, 1200);
    await keep(page, 'ra', await page.screenshot());
    await page.waitForTimeout(300);
    await keep(page, 'rb', await page.screenshot());
    const same = await sameFraction(page, 'ra', 'rb', [0, 0, 1280, 800]);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert(n === 0 && same === 1, `${n} frames, identical ${same}`);
    return `${n} frames in 1.2 s, screenshots identical`;
  });

  await check('zoomed far out: blur auto-disables (>40 tiles), then fx hides below the aux zoom', async () => {
    await settings(page, { tiltShift: true, life: true });
    await zoomTo(page, 0.18);
    const mid = await fxDebug(page);
    await zoomTo(page, 0.12);
    const far = await fxDebug(page);
    await zoomTo(page, 0.08);
    await idle(page);
    await baseQuiet(page);
    const farther = await fxDebug(page);
    const base = await page.evaluate(() => window.__tinyWaterloo.map.baseCanvas.style.visibility);
    await keep(page, 'far', await page.screenshot());
    const sharp = await sharpness(page, 'far', [300, 200, 1000, 600]);
    assert(mid.tilt && mid.tiltFade > 0 && mid.tiltFade < 1, `zoom 0.18 ${JSON.stringify(mid)}`);
    assert(!far.tilt && far.life && far.visible, `zoom 0.12 ${JSON.stringify(far)}`);
    assert(!farther.visible && base === 'visible' && sharp > 1, `zoom 0.08 ${JSON.stringify(farther)} base ${base} sharpness ${sharp}`);
    return `zoom 0.18 blur fade ${mid.tiltFade.toFixed(2)}; zoom 0.12 blur off, life on; zoom 0.08 fx hidden, base shown (detail ${sharp.toFixed(1)})`;
  });

  await check('WebGL context loss falls back to the base canvas and recovers on restore', async () => {
    await open(page);
    const r = await page.evaluate(async () => {
      const fx = window.__tinyWaterloo.fx, map = window.__tinyWaterloo.map;
      const ext = fx.canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 300));
      const lost = { fx: fx.canvas.style.visibility, base: map.baseCanvas.style.visibility };
      ext.restoreContext();
      await new Promise((r) => setTimeout(r, 800));
      return { lost, restored: { fx: fx.canvas.style.visibility, base: map.baseCanvas.style.visibility, webgl2: fx.debug.webgl2 } };
    });
    assert(r.lost.fx === 'hidden' && r.lost.base === 'visible', `lost ${JSON.stringify(r.lost)}`);
    assert(r.restored.fx === 'visible' && r.restored.base === 'hidden' && r.restored.webgl2, `restored ${JSON.stringify(r.restored)}`);
    return `lost: fx ${r.lost.fx} / base ${r.lost.base}; restored: fx ${r.restored.fx}`;
  });

  await check('no console errors during the run', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
  await ctx.close();

  await check('devicePixelRatio 2: blur at half resolution, fx canvas matches the base canvas', async () => {
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const p2 = await c2.newPage();
    const errs = trackErrors(p2);
    await open(p2);
    await settleFocus(p2, 30000);
    const d = await fxDebug(p2);
    const sizes = await p2.evaluate(() => [window.__tinyWaterloo.fx.canvas.width, window.__tinyWaterloo.map.baseCanvas.width]);
    const c = await renderCost(p2, 10);
    numbers.dpr2Cost = c;
    await c2.close();
    assert(d.blurScale === 0.5 && sizes[0] === sizes[1] && errs.length === 0, `${JSON.stringify(d)} sizes ${sizes} ${errs}`);
    return `canvas ${c.base.join('x')}, ${fmt(c)}`;
  });

  await check('no WebGL2: fx canvas hidden, base visible, one toast', async () => {
    const c3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await c3.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === 'webgl2' ? null : orig.call(this, type, ...rest); };
      window.__toasts = [];
      new MutationObserver(() => {
        const t = document.getElementById('toast');
        if (t && t.textContent && t.textContent !== window.__toasts.at(-1)) window.__toasts.push(t.textContent);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    const p3 = await c3.newPage();
    const errs = trackErrors(p3);
    await open(p3);
    await p3.evaluate(() => window.__tinyWaterloo.map.updateSettings({ life: false }));
    await p3.evaluate(() => window.__tinyWaterloo.map.updateSettings({ life: true }));
    await p3.waitForTimeout(300);
    const r = await p3.evaluate(() => ({
      fx: window.__tinyWaterloo.fx.canvas.style.visibility, base: window.__tinyWaterloo.map.baseCanvas.style.visibility,
      toasts: window.__toasts.filter((t) => /WebGL2/.test(t)), webgl2: window.__tinyWaterloo.fx.debug.webgl2,
    }));
    await c3.close();
    assert(!r.webgl2 && r.fx === 'hidden' && r.base === 'visible' && r.toasts.length === 1 && errs.length === 0, `${JSON.stringify(r)} ${errs}`);
    return `toast: "${r.toasts[0]}"`;
  });
} finally {
  await browser.close();
  await stopServer?.();
}

console.log(`\nnumbers: ${JSON.stringify(numbers)}`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
