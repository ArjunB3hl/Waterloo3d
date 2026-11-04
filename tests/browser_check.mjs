// End-to-end browser check of the production build (vite preview on port 5190, or a server already running there).
// Part 1 drives the normal UI (mouse, wheel, keyboard, buttons) and only READS state via window.__tinyWaterloo.
// Part 2 measures load time, memory and frame times during 60 s of scripted panning / zooming over the stage-2 area,
// with effects on and off, at 1280x800 dpr 1 and 1440x900 dpr 2, and writes docs/perf_container.json.
//
// IMPORTANT: this runs headless Chromium with SwiftShader (a software GPU) in a container. The numbers describe that
// environment, NOT a MacBook Air M3 - see docs/PERF_ON_DEVICE.md for measuring on the real device.
//
// Run: node tests/browser_check.mjs [--functional | --perf] [--seconds=60] [--build]
//   --build  rebuild web/dist first (otherwise it is built only when missing)
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5190;
const BASE = `http://127.0.0.1:${PORT}/`;
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const args = process.argv.slice(2);
const RUN_FUNCTIONAL = !args.includes('--perf');
const RUN_PERF = !args.includes('--functional');
const SESSION_S = Number(args.find((a) => a.startsWith('--seconds='))?.split('=')[1] ?? 60);
const DATA = path.join(ROOT, 'web', 'public', 'data');
const manifest = JSON.parse(readFileSync(path.join(DATA, 'manifest.json'), 'utf8'));
const coverage = JSON.parse(readFileSync(path.join(DATA, 'coverage.json'), 'utf8'));
const landmarks = JSON.parse(readFileSync(path.join(DATA, 'landmarks.json'), 'utf8'));
const searchIndex = JSON.parse(readFileSync(path.join(DATA, 'search.json'), 'utf8'));

// ------------------------------------------------------------------------------------------------ harness

let failures = 0;
const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail: detail ?? '', s: (Date.now() - t0) / 1000 });
    console.log(`PASS ${name}${detail ? `  (${detail})` : ''}`);
  } catch (e) {
    failures++;
    results.push({ name, pass: false, detail: String(e?.message ?? e), s: (Date.now() - t0) / 1000 });
    console.log(`FAIL ${name}: ${e?.message ?? e}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const r1 = (x) => Math.round(x * 10) / 10;

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}
async function startServer() {
  if (await serverUp()) return null;
  if (args.includes('--build') || !existsSync(path.join(ROOT, 'web', 'dist', 'index.html'))) {
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (b.status !== 0) throw new Error('npm run build failed');
  }
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  for (let k = 0; k < 80; k++) {
    if (await serverUp()) return proc;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview did not start');
}

/** Installed before any page script: timestamps of first artwork tile and of "all visible tiles loaded" (polled per
 *  animation frame from map.perf()), plus frame / rAF timestamps collected while the test marks a drag as active. */
const INIT_SCRIPT = () => {
  const qa = { t: {}, dragging: false, frames: [], raf: [], subscribed: false };
  window.__qa = qa;
  const poll = () => {
    const T = window.__tinyWaterloo;
    if (T?.map) {
      if (!qa.t.hook) qa.t.hook = performance.now();
      if (!qa.subscribed) {
        qa.subscribed = true;
        T.map.on('frame', (f) => {
          if (qa.dragging) qa.frames.push(performance.now());
          if (!qa.t.firstTileDrawn && f.baseDirty && T.map.perf().bitmaps > 0) qa.t.firstTileDrawn = performance.now();
        });
      }
      const p = T.map.perf();
      if (!qa.t.firstBitmap && p.bitmaps > 0) qa.t.firstBitmap = performance.now();
      if (!qa.t.allVisible && p.bitmaps > 0 && p.inflight === 0 && p.queued === 0 && p.failed === 0) qa.t.allVisible = performance.now();
    }
    if (qa.dragging) qa.raf.push(performance.now());
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
};

async function newPage(browser, { width, height, dpr = 1, init = true, ...rest } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, ...rest });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(INIT_SCRIPT);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return { ctx, page, errors };
}

const waitFor = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
const view = (page) => page.evaluate(() => window.__tinyWaterloo.map.getView());
const perf = (page) => page.evaluate(() => window.__tinyWaterloo.map.perf());
const booted = (page) => waitFor(page, () => window.__tinyWaterloo?.map && window.__tinyWaterloo.perf && document.querySelector('.card'));
const idle = (page, timeout = 60000) => waitFor(page, () => {
  const p = window.__tinyWaterloo?.map?.perf();
  return p && p.inflight === 0 && p.queued === 0 && p.bitmaps > 0;
}, undefined, timeout);
/** No view change across two consecutive 400 ms windows (software GL can stall single frames). */
async function settle(page) {
  let last = JSON.stringify(await view(page)), quiet = 0;
  for (let k = 0; k < 60 && quiet < 2; k++) {
    await page.waitForTimeout(400);
    const now = JSON.stringify(await view(page));
    quiet = now === last ? quiet + 1 : 0;
    last = now;
  }
  return JSON.parse(last);
}
const reach = (page, [x, y, z = null], tol = 1, timeout = 20000) => waitFor(page, ([x, y, z, e]) => {
  const v = window.__tinyWaterloo.map.getView();
  return Math.hypot(v.cx - x, v.cy - y) < e && (z === null || Math.abs(v.zoom - z) < 1e-3);
}, [x, y, z, tol], timeout);

/** A stage point near (x, y) where a press reaches the map (not a label pill, control or panel). */
const freePoint = (page, x, y) => page.evaluate(([x0, y0]) => {
  const stage = document.getElementById('stage');
  const ok = (el) => el && (el === stage || el.id === 'labels' || (el.tagName === 'CANVAS' && stage.contains(el)));
  for (let r = 0; r < 300; r += 12) {
    for (let a = 0; a < 8; a++) {
      const x = x0 + r * Math.cos((a * Math.PI) / 4), y = y0 + r * Math.sin((a * Math.PI) / 4);
      if (ok(document.elementFromPoint(x, y))) return [x, y];
    }
  }
  return [x0, y0];
}, [x, y]);

/** Drag the map by (dx, dy) CSS px with the mouse, starting near (x, y). */
async function drag(page, x, y, dx, dy, steps = 24) {
  const [sx, sy] = await freePoint(page, x, y);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + dx, sy + dy, { steps });
  await page.mouse.up();
}

/** Mean luma of an 8x8 block of the base canvas at a screen point (CSS px). The base canvas is always drawn, even
 *  while the fx canvas is shown on top of it. */
const baseLuma = (page, sx, sy) => page.evaluate(([x, y]) => {
  const c = document.getElementById('map-base');
  const d = c.width / c.clientWidth;
  const px = c.getContext('2d').getImageData(Math.round(x * d) - 4, Math.round(y * d) - 4, 8, 8).data;
  let s = 0;
  for (let k = 0; k < px.length; k += 4) s += 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2];
  return s / (px.length / 4);
}, [sx, sy]);

/** Visible and not covered by another element at its centre. */
const unobstructed = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el || el.hidden) return { ok: false, why: 'missing or hidden' };
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return { ok: false, why: 'not rendered' };
  if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.top < -1 || r.left < -1) return { ok: false, why: `outside viewport ${JSON.stringify(r)}` };
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { ok: !!hit && el.contains(hit), why: `covered by ${hit?.tagName}.${hit?.className}` };
}, sel);

const openSettings = async (page) => {
  if (await page.locator('#settings-panel').isHidden()) await page.click('button[aria-label="Settings"]');
  await page.locator('#settings-panel').waitFor({ state: 'visible' });
};
const toggleSetting = (page, key) => page.click(`label[for="set-${key}"]`);
/** Wait until the effects compositor has drawn at least two more frames (so debug flags reflect current settings). */
const fxFrames = (page, n = 2) => page.evaluate((n) => new Promise((res) => {
  const fx = window.__tinyWaterloo.fx, start = fx.debug.frames;
  const t0 = performance.now();
  (function poll() { if (fx.debug.frames >= start + n || performance.now() - t0 > 15000) res(fx.debug.frames - start); else requestAnimationFrame(poll); })();
}), n);

// ------------------------------------------------------------------------------------------------ part 1: UI checks

async function functionalChecks(browser) {
  const { ctx, page, errors } = await newPage(browser, { width: 1280, height: 800 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });

  await check('load: production build boots, campus tiles draw, no console errors', async () => {
    await page.goto(BASE);
    await booted(page);
    await idle(page);
    await page.waitForTimeout(400);
    const p = await perf(page);
    const t = await page.evaluate(() => window.__qa.t);
    assert(p.bitmaps >= 4 && p.tilesDrawn >= 4, `perf ${JSON.stringify(p)}`);
    const dp = landmarks.find((l) => l.id === 'dana-porter').canvas;
    const [sx, sy] = await page.evaluate(([x, y]) => window.__tinyWaterloo.map.canvasToScreen(x, y), dp);
    const luma = await baseLuma(page, sx, sy);
    assert(luma > 60, `Dana Porter luma ${luma}`);
    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
    return `${p.bitmaps} bitmaps ${p.bitmapMB} MB, first tile drawn ${Math.round(t.firstTileDrawn)} ms, all visible ${Math.round(t.allVisible)} ms`;
  });

  await check('pan by mouse drag', async () => {
    const v0 = await settle(page);
    await drag(page, 640, 420, -360, -120);
    const v1 = await settle(page);
    const ex = 360 / v0.zoom, ey = 120 / v0.zoom;
    assert(v1.cx - v0.cx > 0.9 * ex && v1.cy - v0.cy > 0.9 * ey, `moved (${r1(v1.cx - v0.cx)}, ${r1(v1.cy - v0.cy)}) expected >= (${r1(ex)}, ${r1(ey)})`);
    return `moved (${r1(v1.cx - v0.cx)}, ${r1(v1.cy - v0.cy)}) canvas px for a (-360,-120) px drag at zoom ${v0.zoom.toFixed(3)}`;
  });

  await check('wheel zoom anchored at the cursor', async () => {
    const [x, y] = await freePoint(page, 880, 320);
    const v0 = await view(page);
    const a0 = await page.evaluate(([x, y]) => window.__tinyWaterloo.map.screenToCanvas(x, y), [x, y]);
    await page.mouse.move(x, y);
    for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30); }
    const v1 = await settle(page);
    const a1 = await page.evaluate(([x, y]) => window.__tinyWaterloo.map.screenToCanvas(x, y), [x, y]);
    const drift = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
    assert(v1.zoom > v0.zoom * 1.5, `zoom ${v0.zoom} -> ${v1.zoom}`);
    assert(drift < 3, `anchor drift ${drift}`);
    return `zoom ${v0.zoom.toFixed(3)} -> ${v1.zoom.toFixed(3)}, anchor drift ${drift.toFixed(2)} canvas px`;
  });

  await check('minimap click jumps there', async () => {
    // same mapping as widgets/minimap.ts: bounds of published + city tiles, padded by half a tile
    const F = manifest.frame_px;
    const all = [...Object.values(manifest.tiles).map((t) => [t.i, t.j]), ...coverage.city_tiles];
    const x0 = Math.min(...all.map((t) => t[0])) * F - F / 2, x1 = (Math.max(...all.map((t) => t[0])) + 1) * F + F / 2;
    const y0 = Math.min(...all.map((t) => t[1])) * F - F / 2, y1 = (Math.max(...all.map((t) => t[1])) + 1) * F + F / 2;
    const box = await page.locator('.minimap-canvas').boundingBox();
    const target = [4500, 300];   // Silver Lake area
    const mx = box.x + ((target[0] - x0) / (x1 - x0)) * box.width, my = box.y + ((target[1] - y0) / (y1 - y0)) * box.height;
    await page.mouse.click(mx, my);
    const v = await settle(page);
    const expect = [x0 + ((mx - box.x) / box.width) * (x1 - x0), y0 + ((my - box.y) / box.height) * (y1 - y0)];
    const err = Math.hypot(v.cx - expect[0], v.cy - expect[1]);
    assert(err < 5, `view (${r1(v.cx)}, ${r1(v.cy)}) expected (${r1(expect[0])}, ${r1(expect[1])})`);
    return `view (${r1(v.cx)}, ${r1(v.cy)}), expected (${r1(expect[0])}, ${r1(expect[1])}), error ${err.toFixed(2)} px`;
  });

  await check('landmark card -> animated jump + detail panel', async () => {
    const wp = landmarks.find((l) => l.id === 'public-square');
    await page.click(`.card[aria-label^="${wp.name},"]`);
    await page.locator('#landmark-panel').waitFor({ state: 'visible' });
    await reach(page, [wp.canvas[0], wp.canvas[1], wp.zoom], 1, 30000);
    const title = await page.textContent('#landmark-panel-title');
    assert(title === wp.name, `panel title ${title}`);
    const fly = await page.locator('#landmark-panel button', { hasText: 'Fly from here' }).count();
    assert(fly === 1, 'no Fly from here button');
    await page.keyboard.press('Escape');
    await page.locator('#landmark-panel').waitFor({ state: 'hidden' });
    return `${wp.name} at (${wp.canvas}) zoom ${wp.zoom}; panel opened and Escape closed it`;
  });

  await check('search a street name -> jump', async () => {
    const name = 'Albert Street';
    const entry = searchIndex.entries.find((e) => e.n === name);
    await page.locator('#stage').focus();
    await page.keyboard.press('/');
    await waitFor(page, () => document.activeElement?.id === 'search-input');
    await page.keyboard.type(name, { delay: 20 });
    await page.locator('#search-opt-0').waitFor({ state: 'visible' });
    const first = await page.textContent('#search-opt-0 .hit-name');
    assert(first === name, `first result ${first}`);
    await page.keyboard.press('Enter');
    await reach(page, entry.c, 1, 30000);
    const marker = await page.locator('.search-marker').isVisible();
    assert(marker, 'result marker not shown');
    return `"${name}" -> (${entry.c}) in tile ${entry.t}, marker shown`;
  });

  await check('share URL -> reload with that hash restores the view', async () => {
    await settle(page);
    const v0 = await view(page);
    await page.click('button[aria-label="Copy link to this view"]');
    await waitFor(page, () => document.getElementById('toast')?.textContent === 'Link to this view copied');
    const url = await page.evaluate(() => navigator.clipboard.readText());
    assert(url.startsWith(BASE) && /#-?\d+,-?\d+,[\d.]+$/.test(url), `clipboard ${url}`);
    const other = await newPage(browser, { width: 1280, height: 800 });
    try {
      await other.page.goto(url);
      await booted(other.page);
      const v1 = await view(other.page);
      assert(Math.abs(v1.cx - v0.cx) <= 0.5 && Math.abs(v1.cy - v0.cy) <= 0.5 && Math.abs(v1.zoom - v0.zoom) < 1e-4,
        `restored ${JSON.stringify(v1)} vs shared ${JSON.stringify(v0)}`);
      return `${url.slice(BASE.length)} -> view (${r1(v1.cx)}, ${r1(v1.cy)}, ${v1.zoom}) in a fresh tab`;
    } finally { await other.ctx.close(); }
  });

  await check('settings: life toggle switches the animation off and on', async () => {
    await page.keyboard.press('0');            // home view: canopy and water in view
    await reach(page, [0, 0], 1, 30000);
    await idle(page);
    await openSettings(page);
    await fxFrames(page);
    const on = await page.evaluate(() => window.__tinyWaterloo.fx.debug.life);
    await toggleSetting(page, 'life');
    await fxFrames(page);
    const off = await page.evaluate(() => ({ s: window.__tinyWaterloo.map.settings.life, d: window.__tinyWaterloo.fx.debug.life }));
    // life animation steps at 8 Hz; with it off (and tilt on) the composed output must stop changing
    const quiet = await page.evaluate(() => new Promise((res) => {
      const fx = window.__tinyWaterloo.fx, f0 = fx.debug.frames; setTimeout(() => res(fx.debug.frames - f0), 1500);
    }));
    await toggleSetting(page, 'life');
    await fxFrames(page);
    const back = await page.evaluate(() => window.__tinyWaterloo.fx.debug.life);
    assert(on && !off.s && !off.d && back, `on ${on}, off ${JSON.stringify(off)}, back ${back}`);
    assert(quiet <= 1, `${quiet} fx frames in 1.5 s with life off`);
    return `fx.debug.life ${on} -> ${off.d} -> ${back}; ${quiet} fx frames in 1.5 s idle with life off`;
  });

  await check('settings: tilt-shift toggle removes and restores the blur', async () => {
    const sharp = () => page.evaluate(() => window.__tinyWaterloo.fx.debug);
    // shot of the top band (blurred with tilt-shift on, sharp with it off)
    const band = async () => page.screenshot({ clip: { x: 0, y: 80, width: 1280, height: 100 } });
    const d0 = await sharp();
    const b0 = await band();
    await toggleSetting(page, 'tiltShift');
    await fxFrames(page);
    const d1 = await sharp();
    const b1 = await band();
    await toggleSetting(page, 'tiltShift');
    await fxFrames(page);
    await page.waitForTimeout(500);
    const d2 = await sharp();
    assert(d0.tilt && !d1.tilt && d2.tilt, `tilt ${d0.tilt} -> ${d1.tilt} -> ${d2.tilt}`);
    assert(!b0.equals(b1), 'top band identical with tilt-shift on and off');
    const disabled = await page.locator('#set-tiltStrength').isDisabled();
    return `fx.debug.tilt ${d0.tilt} -> ${d1.tilt} -> ${d2.tilt}, cocMax ${d0.cocMax.toFixed(1)} px, top band changed; strength slider re-enabled: ${!disabled}`;
  });

  await check('settings: coverage toggle hides and restores the pending-area hatch', async () => {
    // pending city tiles (-2,-1) and (-2,0) sit just west of campus
    await page.keyboard.press('Escape');
    await page.evaluate(() => { location.hash = '#-1536,-200,0.5'; });
    await reach(page, [-1536, -200, 0.5], 1, 30000);
    await idle(page);
    const sample = () => page.evaluate(() => {
      const c = document.getElementById('map-base'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sum = 0; for (let k = 0; k < d.length; k += 4 * 97) sum += d[k] + d[k + 1] + d[k + 2];
      return sum;
    });
    const s0 = await sample();
    await openSettings(page);
    await toggleSetting(page, 'coverage');
    await page.waitForTimeout(600);
    const s1 = await sample();
    const setting = await page.evaluate(() => window.__tinyWaterloo.map.settings.coverage);
    await toggleSetting(page, 'coverage');
    await page.waitForTimeout(600);
    const s2 = await sample();
    await page.keyboard.press('Escape');
    assert(!setting && s1 !== s0 && s2 === s0, `samples ${s0} -> ${s1} -> ${s2}, setting ${setting}`);
    return `base-canvas checksum ${s0} -> ${s1} (off) -> ${s2} (on again)`;
  });

  await check('settings persist across reload (localStorage)', async () => {
    await openSettings(page);
    await toggleSetting(page, 'labels');
    await page.reload();
    await booted(page);
    const s = await page.evaluate(() => window.__tinyWaterloo.map.settings.labels);
    const hidden = await page.evaluate(() => document.getElementById('labels').classList.contains('hidden'));
    await openSettings(page);
    await toggleSetting(page, 'labels');
    await page.keyboard.press('Escape');
    assert(s === false && hidden, `labels ${s}, hidden ${hidden}`);
    return 'labels off survived a reload, then restored';
  });

  await check('fly as a goose: starts, HUD visible, attribution visible, Land returns to the map', async () => {
    await page.keyboard.press('0');
    await reach(page, [0, 0], 1, 30000);
    await page.click('.fly-btn');
    await waitFor(page, () => window.__tinyWaterloo.actor.active && document.getElementById('app').classList.contains('actor-active'), undefined, 60000);
    await page.locator('.goose-hud').waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForTimeout(1500);
    const hud = await unobstructed(page, '.goose-hud .gh-land');
    const attribution = await unobstructed(page, '#attribution');
    const searchHidden = await page.locator('.search').isHidden();
    const z = (await view(page)).zoom;
    assert(hud.ok, `Land button: ${hud.why}`);
    assert(attribution.ok, `attribution: ${attribution.why}`);
    assert(searchHidden, 'search still visible during flight');
    await page.click('.goose-hud .gh-land');
    await waitFor(page, () => !window.__tinyWaterloo.actor.active && !document.getElementById('app').classList.contains('actor-active'), undefined, 30000);
    await page.locator('.fly-btn').waitFor({ state: 'visible' });
    const hudGone = await page.locator('.goose-hud').isHidden();
    const v0 = await settle(page);
    await drag(page, 640, 420, -200, 0);
    const v1 = await settle(page);
    assert(hudGone, 'goose HUD still visible after landing');
    assert(v1.cx > v0.cx + 100 / v0.zoom, `drag after landing moved ${v1.cx - v0.cx}`);
    return `flight at zoom ${z.toFixed(2)}, Land button + attribution unobstructed, search hidden; after Land the HUD hides and drag pans again`;
  });

  await check('no console or page errors during the UI checks', async () => {
    assert(errors.length === 0, errors.join(' | '));
    return '0 errors';
  });
  await ctx.close();

  // a tile request that fails once must recover by itself
  await check('failed tile request (forced once) recovers', async () => {
    const { ctx, page, errors } = await newPage(browser, { width: 1280, height: 800 });
    let aborted = 0, served = 0;
    await page.route(/\/tiles\/\d+\/0_0\.webp/, (route) => {
      if (!aborted) { aborted++; return route.abort('failed'); }
      served++;
      return route.continue();
    });
    await page.goto(BASE);
    await booted(page);
    await waitFor(page, () => window.__tinyWaterloo.map.perf().failed > 0, undefined, 20000);
    const sawFailed = await page.evaluate(() => window.__tinyWaterloo.map.perf().failed);
    const [sx, sy] = await page.evaluate(() => window.__tinyWaterloo.map.canvasToScreen(512, 512));
    const lumaFailed = await baseLuma(page, sx, sy);
    await waitFor(page, () => { const p = window.__tinyWaterloo.map.perf(); return p.failed === 0 && p.inflight === 0 && p.queued === 0; }, undefined, 30000);
    await page.waitForTimeout(400);
    const lumaOk = await baseLuma(page, sx, sy);
    await ctx.close();
    const real = errors.filter((e) => !/ERR_FAILED|Failed to load resource/.test(e));
    assert(aborted === 1 && served >= 1, `aborted ${aborted}, served ${served}`);
    assert(real.length === 0, real.join(' | '));
    return `aborted 1, then served ${served}; failed count seen ${sawFailed}; tile-centre luma ${lumaFailed.toFixed(0)} (placeholder) -> ${lumaOk.toFixed(0)} (recovered)`;
  });
}

// ------------------------------------------------------------------------------------------------ part 2: performance

/** Stage-2 tour: campus -> Laurier -> Waterloo Park -> Silver Lake -> Uptown -> King St N -> campus. */
const TOUR = [[0, 0], [3180, -1194], [3298, 575], [4521, 493], [6328, 694], [5249, -745], [1800, -700], [0, 0]];

async function cdpHeap(cdp, gc) {
  if (gc) await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { usedMB: r1(m.JSHeapUsedSize / 2 ** 20), totalMB: r1(m.JSHeapTotalSize / 2 ** 20) };
}

/** Decoded-memory estimate from the app's own counters plus canvas / GL surface sizes. */
const memoryEstimate = (page) => page.evaluate(() => {
  const T = window.__tinyWaterloo, map = T.map, p = map.perf(), MB = 2 ** 20;
  const px = (c) => (c ? c.width * c.height : 0);
  const canvases2d = [map.baseCanvas, map.heightCanvas, map.lifeCanvas, document.getElementById('map-overlay')];
  const fx = document.getElementById('map-fx');
  // fx: its drawing buffer + base/height/life textures + half/full-res blur targets (approximate upper bound)
  const fxBytes = T.fx.debug.webgl2 ? (px(fx) * 2 + px(map.baseCanvas) + px(map.heightCanvas) + px(map.lifeCanvas) + px(map.baseCanvas) * 2) * 4 : 0;
  return {
    tileBitmapsMB: p.bitmapMB, tileBitmaps: p.bitmaps, budgetMB: p.budgetMB,
    heightTilesMB: Math.round(p.heightTiles * 512 * 512 * 4 / MB * 10) / 10, heightTiles: p.heightTiles,
    canvases2dMB: Math.round(canvases2d.reduce((s, c) => s + px(c) * 4, 0) / MB * 10) / 10,
    fxGpuEstimateMB: Math.round(fxBytes / MB * 10) / 10,
  };
});

function stats(xs) {
  if (!xs.length) return { n: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const q = (f) => r1(s[Math.min(s.length - 1, Math.floor(s.length * f))]);
  return { n: s.length, median: q(0.5), p95: q(0.95), max: r1(s[s.length - 1]) };
}

async function perfRun(browser, { width, height, dpr, effects }) {
  const label = `${width}x${height} dpr ${dpr}, effects ${effects ? 'on' : 'off'}`;
  const { ctx, page, errors } = await newPage(browser, { width, height, dpr });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const t0 = Date.now();
  await page.goto(BASE);
  await booted(page);
  await idle(page, 120000);
  const load = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const tiles = performance.getEntriesByType('resource').filter((e) => /\/tiles\//.test(e.name));
    return { ...window.__qa.t, domContentLoaded: nav?.domContentLoadedEventEnd, tileRequests: tiles.length,
      tileKB: Math.round(tiles.reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) / 1024) };
  });
  if (!effects) {
    // effects off through the normal UI
    await openSettings(page);
    await toggleSetting(page, 'life');
    await toggleSetting(page, 'tiltShift');
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);
  const fxState = await page.evaluate(() => ({ ...window.__tinyWaterloo.fx.debug }));

  // ---- scripted session: drag toward each tour stop, zoom in and out at each stop
  const drags = [];
  let samples = [];
  const until = Date.now() + SESSION_S * 1000;
  const cx = width / 2, cy = height / 2;
  let stop = 1, moves = 0;
  while (Date.now() < until) {
    const v = await view(page);
    const [tx, ty] = TOUR[stop];
    const dx = (tx - v.cx) * v.zoom, dy = (ty - v.cy) * v.zoom;
    if (Math.hypot(dx, dy) < 120) {
      // at a stop: zoom in then out with the wheel (exercises LOD changes)
      const [wx, wy] = await freePoint(page, cx, cy);
      await page.mouse.move(wx, wy);
      for (let k = 0; k < 3; k++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60); }
      await page.waitForTimeout(700);
      for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, 200); await page.waitForTimeout(60); }
      await page.waitForTimeout(700);
      stop = (stop + 1) % TOUR.length;
      continue;
    }
    const k = Math.min(1, 420 / Math.hypot(dx, dy));
    const steps = 30;
    const [sx, sy] = await freePoint(page, cx + (dx * k) / 2, cy + (dy * k) / 2);
    await page.mouse.move(sx, sy);
    await page.evaluate(() => { window.__qa.dragging = true; window.__qa.frames = []; window.__qa.raf = []; });
    const d0 = Date.now();
    await page.mouse.down();
    await page.mouse.move(sx - dx * k, sy - dy * k, { steps });
    await page.mouse.up();
    const ms = Date.now() - d0;
    const d = await page.evaluate(() => { const q = window.__qa; q.dragging = false; return { frames: q.frames, raf: q.raf }; });
    moves += steps;
    drags.push({ ms, steps, frames: d.frames, raf: d.raf });
    samples.push(await perf(page));
    await page.waitForTimeout(150);
  }
  const sessionS = SESSION_S;
  await idle(page, 120000).catch(() => {});
  const after = await perf(page);
  const mem = await memoryEstimate(page);
  const heap = await cdpHeap(cdp, false);
  const heapGC = await cdpHeap(cdp, true);

  // frame intervals inside each drag (gaps between drags excluded)
  const intervals = (key) => drags.flatMap((d) => d[key].slice(1).map((t, i) => t - d[key][i]));
  const fi = intervals('frames'), ri = intervals('raf');
  const dragMs = drags.reduce((s, d) => s + d.ms, 0);
  const frameCount = drags.reduce((s, d) => s + d.frames.length, 0);
  const result = {
    config: { width, height, dpr, effects, fx: { webgl2: fxState.webgl2, life: fxState.life, tilt: fxState.tilt, blurScale: fxState.blurScale } },
    load_ms: {
      firstArtworkTileDrawn: r1(load.firstTileDrawn ?? NaN), firstBitmapDecoded: r1(load.firstBitmap ?? NaN),
      allVisibleTilesLoaded: r1(load.allVisible ?? NaN), appHookReady: r1(load.hook ?? NaN), domContentLoaded: r1(load.domContentLoaded ?? NaN),
      tileRequests: load.tileRequests, tileKB: load.tileKB,
    },
    panning: {
      drags: drags.length, dragSeconds: r1(dragMs / 1000), inputMovesPerS: r1(moves / (dragMs / 1000)),
      mapFramesPerS: r1(frameCount / (dragMs / 1000)), mapFrameIntervalMs: stats(fi), rafIntervalMs: stats(ri),
      appFrameP95Ms: stats(samples.map((s) => s.frameP95Ms).filter((x) => x > 0)),
      appDrawP95Ms: stats(samples.map((s) => s.drawP95Ms).filter((x) => x > 0)),
    },
    after_session: {
      seconds: sessionS, memory: mem, jsHeapMB: heap, jsHeapAfterGcMB: heapGC,
      peakTileBitmapsMB: Math.max(...samples.map((s) => s.bitmapMB), after.bitmapMB), failedRequests: after.failed,
    },
    console_errors: errors.length,
    wall_s: Math.round((Date.now() - t0) / 1000),
  };
  await ctx.close();
  console.log(`PERF ${label}: first tile ${result.load_ms.firstArtworkTileDrawn} ms, all visible ${result.load_ms.allVisibleTilesLoaded} ms, ` +
    `pan ${result.panning.mapFramesPerS} frames/s (p95 ${result.panning.mapFrameIntervalMs.p95} ms, rAF p95 ${result.panning.rafIntervalMs.p95} ms), ` +
    `tiles ${mem.tileBitmapsMB} MB, heap ${heap.usedMB} MB (${heapGC.usedMB} after GC)`);
  return result;
}

// ------------------------------------------------------------------------------------------------ main

const server = await startServer();
const browser = await chromium.launch({ args: GL_ARGS });
let exitCode = 0;
try {
  if (RUN_FUNCTIONAL) await functionalChecks(browser);
  if (RUN_PERF) {
    const runs = [];
    for (const vp of [{ width: 1280, height: 800, dpr: 1 }, { width: 1440, height: 900, dpr: 2 }]) {
      for (const effects of [true, false]) runs.push(await perfRun(browser, { ...vp, effects }));
    }
    const out = {
      WARNING: 'Measured in a headless Chromium with SwiftShader (software GPU emulation on the CPU) inside a Linux container. ' +
        'These numbers are NOT from a MacBook Air M3 and say little about real GPU frame rates - see docs/PERF_ON_DEVICE.md.',
      environment: {
        browser: `Chromium ${browser.version()} headless`, gl: 'ANGLE SwiftShader (software)', cpus: os.cpus().length,
        cpuModel: os.cpus()[0]?.model, memGB: Math.round(os.totalmem() / 2 ** 30), server: `vite preview (production build) on ${BASE}`,
        measured_utc: new Date().toISOString(), session_seconds: SESSION_S,
      },
      method: {
        load: 'Fresh browser context (cold HTTP cache) per run. firstArtworkTileDrawn = first map frame with a redrawn base canvas after the ' +
          'first tile bitmap decoded; allVisibleTilesLoaded = first animation frame with no request in flight or queued (visible tiles ' +
          'plus the prefetch ring), measured from navigation start.',
        panning: 'Mouse drags (30 move events each) toward successive stops across the stage-2 area with wheel zoom in/out at each stop, ' +
          `for ${SESSION_S} s. mapFrameIntervalMs = intervals between map frame events inside drags; rafIntervalMs = requestAnimationFrame ` +
          'intervals inside drags; appFrameP95Ms / appDrawP95Ms = the app\'s own perf() p95 over the last second, sampled after each drag. ' +
          'mapFramesPerS can be limited by the Playwright input rate (inputMovesPerS).',
        memory: 'tileBitmapsMB is the tile cache\'s own decoded-size count; heightTilesMB = Float32 height tiles; canvases2dMB = base, aux and ' +
          'overlay canvases; fxGpuEstimateMB is a rough upper bound for the effects canvas and textures. JS heap from CDP Performance.getMetrics.',
      },
      runs,
    };
    writeFileSync(path.join(ROOT, 'docs', 'perf_container.json'), JSON.stringify(out, null, 2) + '\n');
    console.log('wrote docs/perf_container.json');
  }
} catch (e) {
  console.error(e);
  exitCode = 2;
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
if (RUN_FUNCTIONAL) console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed`);
process.exit(exitCode || (failures ? 1 : 0));
