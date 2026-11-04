// Browser smoke test for the map core (MapView + UI). Starts Vite on port 5181 (or reuses a server already there),
// drives Chromium via Playwright and saves screenshots to docs/screenshots/map_*.png.
// Run: node tests/map_smoke.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5181;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

let failures = 0;
const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(`PASS ${name}${detail ? `  (${detail})` : ''}`);
  } catch (e) {
    failures++;
    results.push(`FAIL ${name}: ${e?.message ?? e}`);
  }
  console.log(results[results.length - 1]);
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}

async function startServer() {
  if (await serverUp()) return null;
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  for (let k = 0; k < 60; k++) {
    if (await serverUp()) return proc;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite did not start');
}

/** Poll fn in the page until it returns truthy (or time out). */
async function waitFor(page, fn, arg, timeout = 15000) {
  return page.waitForFunction(fn, arg, { timeout, polling: 100 });
}
const view = (page) => page.evaluate(() => window.__tinyWaterloo.map.getView());
/** Wait for the camera to settle: no view change across two consecutive 400 ms windows (software GL in headless
 *  Chromium can stall single frames for a few hundred ms, so one quiet window is not proof the motion ended). */
async function settle(page) {
  let last = JSON.stringify(await view(page)), quiet = 0;
  for (let k = 0; k < 50 && quiet < 2; k++) {
    await page.waitForTimeout(400);
    const now = JSON.stringify(await view(page));
    quiet = now === last ? quiet + 1 : 0;
    last = now;
  }
  return JSON.parse(last);
}
/** Wait until the view reaches a known target [cx, cy, zoom?] (canvas px tolerance). */
const reach = (page, t, tol = 1) => waitFor(page, ([x, y, z, e]) => {
  const v = window.__tinyWaterloo.map.getView();
  return Math.hypot(v.cx - x, v.cy - y) < e && (z === null || Math.abs(v.zoom - z) < 1e-3);
}, [t[0], t[1], t[2] ?? null, tol], 10000);
const idle = (page) => waitFor(page, () => { const p = window.__tinyWaterloo?.map?.perf(); return p && p.inflight === 0 && p.queued === 0 && p.bitmaps > 0; });

/** Mean luminance of a block of the base canvas around a screen point (CSS px). */
const baseLuma = (page, sx, sy) => page.evaluate(([x, y]) => {
  const c = document.getElementById('map-base');
  const d = c.width / c.clientWidth;
  const px = c.getContext('2d').getImageData(Math.round(x * d) - 4, Math.round(y * d) - 4, 8, 8).data;
  let s = 0;
  for (let k = 0; k < px.length; k += 4) s += 0.2126 * px[k] + 0.7152 * px[k + 1] + 0.0722 * px[k + 2];
  return s / (px.length / 4);
}, [sx, sy]);

function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const server = await startServer();
await mkdir(SHOTS, { recursive: true });
const browser = await chromium.launch({ args: GL_ARGS });

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = trackErrors(page);

  await check('page loads, tiles decode, no console errors', async () => {
    await page.goto(BASE);
    await waitFor(page, () => window.__tinyWaterloo?.map && document.querySelector('.card'));
    await idle(page);
    await page.waitForTimeout(400);   // fade-ins
    assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
    const p = await page.evaluate(() => window.__tinyWaterloo.perf());
    assert(p.bitmaps >= 4 && p.tilesDrawn >= 4, `perf ${JSON.stringify(p)}`);
    return `${p.bitmaps} bitmaps, ${p.bitmapMB} MB, ${p.tilesDrawn} tiles drawn`;
  });

  await check('campus tiles render (base canvas not dark at campus points)', async () => {
    const pts = await page.evaluate(() => ['dana-porter', 'mc', 'eit'].map((id) => {
      const l = window.__tinyWaterloo.landmarks.find((x) => x.id === id);
      return window.__tinyWaterloo.map.canvasToScreen(l.canvas[0], l.canvas[1]);
    }));
    const lumas = [];
    for (const [x, y] of pts) lumas.push(await baseLuma(page, x, y));
    assert(lumas.every((l) => l > 60), `luma ${lumas.map((l) => l.toFixed(0))}`);
    await page.screenshot({ path: path.join(SHOTS, 'map_home.png') });
    return `luma ${lumas.map((l) => l.toFixed(0)).join(', ')}`;
  });

  await check('drag pans the map and updates the URL hash', async () => {
    const before = await view(page);
    await page.mouse.move(700, 420);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) { await page.mouse.move(700 - 22 * k, 420 - 8 * k); await page.waitForTimeout(16); }
    await page.mouse.up();
    const after = await settle(page);
    await page.waitForTimeout(400);
    const hash = await page.evaluate(() => location.hash);
    assert(after.cx > before.cx + 150 / before.zoom * 0.9, `cx ${before.cx} -> ${after.cx}`);
    assert(/^#-?\d+,-?\d+,[\d.]+$/.test(hash), `hash ${hash}`);
    const [hx, hy] = hash.slice(1).split(',').map(Number);
    assert(Math.abs(hx - after.cx) < 1 && Math.abs(hy - after.cy) < 1, `hash ${hash} vs view ${JSON.stringify(after)}`);
    return `cx ${before.cx.toFixed(0)} -> ${after.cx.toFixed(0)}, hash ${hash}`;
  });

  await check('wheel zooms around the cursor', async () => {
    const before = await view(page);
    const anchor = await page.evaluate(() => window.__tinyWaterloo.map.screenToCanvas(900, 300));
    await page.mouse.move(900, 300);
    for (let k = 0; k < 4; k++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(30); }
    const after = await settle(page);
    const anchorAfter = await page.evaluate(() => window.__tinyWaterloo.map.screenToCanvas(900, 300));
    assert(after.zoom > before.zoom * 1.5, `zoom ${before.zoom} -> ${after.zoom}`);
    const drift = Math.hypot(anchorAfter[0] - anchor[0], anchorAfter[1] - anchor[1]);
    assert(drift < 3, `canvas point under cursor drifted ${drift.toFixed(1)} px`);
    return `zoom ${before.zoom.toFixed(3)} -> ${after.zoom.toFixed(3)}, anchor drift ${drift.toFixed(2)} px`;
  });

  await check('keyboard: arrows pan, 0 returns home', async () => {
    await page.focus('#stage');
    const before = await view(page);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowRight');
    const after = await settle(page);
    // distance depends on the frame rate (software GL here), so only the direction is asserted
    assert(after.cx > before.cx + 20 && Math.abs(after.cy - before.cy) < 1, `cx ${before.cx} -> ${after.cx}`);
    await page.keyboard.press('0');
    await reach(page, [0, 0]);
    const home = await view(page);
    assert(Math.abs(home.cx) < 1 && Math.abs(home.cy) < 1, `home ${JSON.stringify(home)}`);
    return `home ${JSON.stringify(home)}`;
  });

  await check('reload with hash restores the view', async () => {
    // same-document navigation: arrives as a hashchange (animated), so wait for the camera to settle
    await page.goto(`${BASE}#1500,-300,0.8`);
    await waitFor(page, () => window.__tinyWaterloo?.map);
    await reach(page, [1500, -300, 0.8], 0.5);
    await waitFor(page, () => location.hash === '#1500,-300,0.8');
    await page.waitForTimeout(500);   // past the debounced hash write: the URL must still name the target view
    assert(await page.evaluate(() => location.hash) === '#1500,-300,0.8', 'hash rewritten');
    await page.reload();
    await waitFor(page, () => window.__tinyWaterloo?.map);
    const v2 = await view(page);
    assert(Math.abs(v2.cx - 1500) < 0.5 && Math.abs(v2.zoom - 0.8) < 1e-6, `after reload ${JSON.stringify(v2)}`);
    return JSON.stringify(v2);
  });

  await check('editing the hash (hashchange) moves the view', async () => {
    await page.evaluate(() => { location.hash = '#3300,575,1'; });
    await reach(page, [3300, 575, 1]);
    const v = await view(page);
    assert(Math.abs(v.cx - 3300) < 1 && Math.abs(v.cy - 575) < 1 && Math.abs(v.zoom - 1) < 1e-3, JSON.stringify(v));
  });

  await check('minimap click jumps the view', async () => {
    const box = await page.locator('.minimap-canvas').boundingBox();
    const tx = box.x + box.width * 0.3, ty = box.y + box.height * 0.3;
    await page.mouse.click(tx, ty);
    // expected canvas point under the click, from the same mapping the minimap uses (bounds of all tiles + 0.5 tile)
    const expect = await page.evaluate(() => {
      const m = window.__tinyWaterloo.map.manifest, F = m.frame_px;
      const t = [...Object.values(m.tiles).map((x) => [x.i, x.j]), ...m.coverage.city_tiles];
      const x0 = Math.min(...t.map((a) => a[0])) * F - F / 2, x1 = (Math.max(...t.map((a) => a[0])) + 1) * F + F / 2;
      const y0 = Math.min(...t.map((a) => a[1])) * F - F / 2, y1 = (Math.max(...t.map((a) => a[1])) + 1) * F + F / 2;
      return [x0 + 0.3 * (x1 - x0), y0 + 0.3 * (y1 - y0)];
    });
    // the jump is animated and software-GL frames can stall, so wait for arrival (the assert below reports a miss)
    await reach(page, expect, 400).catch(() => {});
    const v = await settle(page);
    const err = Math.hypot(v.cx - expect[0], v.cy - expect[1]);
    assert(err < 400, `view ${JSON.stringify(v)} expected ~${expect.map(Math.round)}`);
    return `view (${v.cx.toFixed(0)}, ${v.cy.toFixed(0)}) expected (${expect.map(Math.round)})`;
  });

  await check('landmark card selection animates there and opens the detail panel', async () => {
    await page.locator('.card', { hasText: 'Waterloo Park' }).click();
    const l = await page.evaluate(() => window.__tinyWaterloo.landmarks.find((x) => x.id === 'waterloo-park'));
    await reach(page, [...l.canvas, l.zoom]);
    const v = await view(page);
    assert(Math.hypot(v.cx - l.canvas[0], v.cy - l.canvas[1]) < 1 && Math.abs(v.zoom - l.zoom) < 1e-3, `view ${JSON.stringify(v)} vs ${l.canvas}`);
    const title = await page.locator('#landmark-panel h2').textContent();
    assert(title === 'Waterloo Park' && await page.locator('#landmark-panel').isVisible(), `panel title ${title}`);
    assert(await page.locator('#landmark-panel button', { hasText: 'Fly from here' }).isVisible(), 'no Fly from here button');
    await idle(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'map_landmark.png') });
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#landmark-panel').isVisible()), 'Escape did not close the panel');
  });

  await check('pending landmark jumps to the pending area and says coming soon', async () => {
    await page.locator('.strip-list').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await page.locator('.card', { hasText: 'Laurel Creek' }).click();
    const l = await page.evaluate(() => window.__tinyWaterloo.landmarks.find((x) => x.id === 'laurel-creek'));
    await reach(page, [...l.canvas, 0.3]);
    const v = await view(page);
    const toast = await page.locator('#toast').textContent();
    assert(/coming soon/i.test(toast), `toast ${toast}`);
    assert(v.zoom < 0.5, `zoom ${v.zoom}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'map_pending.png') });
    await page.keyboard.press('Escape');
  });

  await check('search: street name via keyboard jumps there', async () => {
    await page.keyboard.press('Escape');
    await page.focus('#stage');
    await page.keyboard.press('/');
    assert(await page.evaluate(() => document.activeElement?.id === 'search-input'), '/ did not focus search');
    await page.keyboard.type('albert st');
    await waitFor(page, () => document.querySelectorAll('#search-results [role=option]').length > 0);
    const first = await page.locator('#search-results [role=option]').first().textContent();
    assert(/Albert Street/.test(first), `first result ${first}`);
    await page.keyboard.press('Enter');
    const v = await settle(page);
    const target = await page.evaluate(() => fetch('data/search.json').then((r) => r.json()).then((d) => d.entries.find((e) => e.n === 'Albert Street').c));
    assert(Math.hypot(v.cx - target[0], v.cy - target[1]) < 1, `view ${JSON.stringify(v)} vs ${target}`);
    return `"${first}" -> (${v.cx.toFixed(0)}, ${v.cy.toFixed(0)})`;
  });

  await check('settings panel toggles persist (labels off hides labels)', async () => {
    await page.click('button[aria-label="Settings"]');
    assert(await page.locator('#settings-panel').isVisible(), 'settings not visible');
    await page.screenshot({ path: path.join(SHOTS, 'map_settings.png') });
    await page.click('label[for="set-labels"]');
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('tinyWaterloo.settings.v1')));
    assert(s.labels === false, `stored ${JSON.stringify(s)}`);
    assert(await page.evaluate(() => document.getElementById('labels').classList.contains('hidden')), 'labels still shown');
    await page.click('label[for="set-labels"]');
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#settings-panel').isVisible()), 'Escape did not close settings');
  });

  await check('performance HUD via ?perf=1 and window.__tinyWaterloo.perf()', async () => {
    await page.goto(`${BASE}?perf=1#0,0,0.5`);
    await waitFor(page, () => window.__tinyWaterloo?.perf);
    await idle(page);
    assert(await page.locator('.perf-hud').isVisible(), 'HUD hidden');
    const p = await page.evaluate(() => window.__tinyWaterloo.perf());
    for (const k of ['fps', 'frameP95Ms', 'bitmaps', 'bitmapMB', 'inflight', 'tilesDrawn', 'dpr', 'viewport']) assert(k in p, `missing ${k}`);
    return JSON.stringify(p);
  });

  await check('LOD choice: 256 px tiles when zoomed out, 1024 px when zoomed in, overview only below 0.07', async () => {
    const seen = [];
    const onReq = (r) => { const m = r.url().match(/\/data\/tiles\/(\d+)\//); if (m) seen.push(+m[1]); };
    page.on('request', onReq);
    const at = async (cx, cy, zoom) => {
      seen.length = 0;
      await page.evaluate((v) => new Promise((res) => {
        window.__tinyWaterloo.map.setView(v);
        requestAnimationFrame(() => requestAnimationFrame(res));
      }), { cx, cy, zoom });
      await idle(page);
      await page.waitForTimeout(200);
      return [...new Set(seen)];
    };
    const far = await at(3000, -600, 0.05);
    const mid = await at(3000, -600, 0.2);
    const near = await at(5200, -200, 0.9);
    page.off('request', onReq);
    assert(far.length === 0, `tile requests at zoom 0.05: ${far}`);
    assert(mid.length && mid.every((l) => l === 256), `zoom 0.2 requested ${mid}`);
    assert(near.length && near.every((l) => l === 1024), `zoom 0.9 requested ${near}`);
    return `0.05: none, 0.2: ${mid}, 0.9: ${near}`;
  });

  await check('about panel opens from the attribution footer; whole-city overview view', async () => {
    await page.evaluate(() => window.__tinyWaterloo.map.setView({ cx: -4500, cy: -3500, zoom: 0.045 }));
    await idle(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'map_city.png') });
    await page.click('#attribution button');
    assert(await page.locator('#about-panel').isVisible(), 'about hidden');
    const text = await page.locator('#about-panel').textContent();
    for (const s of ['reference render', 'OpenStreetMap', 'Overture', 'Mapzen', 'OGL-Canada']) assert(text.toLowerCase().includes(s.toLowerCase()), `about lacks ${s}`);
    await page.screenshot({ path: path.join(SHOTS, 'map_about.png') });
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#about-panel').isVisible()), 'Escape did not close about');
  });

  await check('aux layers: packed heights + life drawn screen aligned; heightAt/getHeightTile/getLifeTile agree', async () => {
    await page.evaluate(() => { window.__tinyWaterloo.map.setView({ cx: 300, cy: 200, zoom: 0.8 }); window.__tinyWaterloo.map.requestAuxLayers({ height: true, life: true }); });
    await idle(page);
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const map = window.__tinyWaterloo.map;
      const hc = map.heightCanvas, lc = map.lifeCanvas, base = map.baseCanvas;
      const hctx = hc.getContext('2d'), lctx = lc.getContext('2d');
      const w = base.clientWidth, h = base.clientHeight;
      const [ax, ay] = map.screenToCanvas(0, 0), [bx, by] = map.screenToCanvas(w, h), F = map.frame.F, loads = [];
      for (let j = Math.floor(ay / F); j <= Math.floor(by / F); j++) for (let i = Math.floor(ax / F); i <= Math.floor(bx / F); i++) loads.push(map.getHeightTile(i, j));
      await Promise.all(loads);
      const life = await map.getLifeTile(0, 0);
      // exact = same texel; edge = equals the texel one aux pixel away (tile edges are snapped to whole device px,
      // so texel boundaries may shift by < 1 aux pixel); anything else is a misalignment
      const eq = (a, b) => (Number.isNaN(a) && Number.isNaN(b)) || Math.abs(a - b) < 0.02;
      const d = w / hc.width / map.getView().zoom;
      let n = 0, match = 0, edge = 0, valid = 0, lifeNonZero = 0;
      for (let y = 40; y < h - 40; y += 37) for (let x = 40; x < w - 40; x += 41) {
        const hx = Math.floor((x / w) * hc.width), hy = Math.floor((y / h) * hc.height);
        const px = hctx.getImageData(hx, hy, 1, 1).data;
        const z = map.frame.decodeHeight(px[0], px[1], px[2]);
        // sample heightAt at the centre of that aux pixel
        const [cx, cy] = map.screenToCanvas((hx + 0.5) * w / hc.width, (hy + 0.5) * h / hc.height);
        const z2 = map.heightAt(cx, cy);
        const lp = lctx.getImageData(Math.floor((x / w) * lc.width), Math.floor((y / h) * lc.height), 1, 1).data;
        if (lp[0] || lp[1] || lp[2]) lifeNonZero++;
        n++;
        if (!Number.isNaN(z)) valid++;
        if (eq(z, z2)) match++;
        else if ([[-d, 0], [d, 0], [0, -d], [0, d]].some(([ox, oy]) => eq(z, map.heightAt(cx + ox, cy + oy)))) edge++;
      }
      return { n, match, edge, valid, lifeNonZero, life: life && [life.width, life.height], sizes: [hc.width, hc.height, base.width, base.height] };
    });
    assert(r.valid > r.n * 0.8, `valid height texels ${r.valid}/${r.n}`);
    assert(r.match >= r.n * 0.95 && r.match + r.edge === r.n, `heightCanvas vs heightAt: ${r.match} exact + ${r.edge} edge of ${r.n}`);
    assert(r.lifeNonZero > 0, 'life canvas empty');
    assert(r.life && r.life[0] === 1024, `life tile ${r.life}`);
    await page.evaluate(() => window.__tinyWaterloo.map.requestAuxLayers({ height: false, life: false }));
    return `heights ${r.match} exact + ${r.edge} at texel edges of ${r.n}, life px ${r.lifeNonZero}, canvases ${r.sizes}`;
  });

  await check('settings drive fx.setEnabled; desktop pointer drives fx.setFocus; M toggles minimap', async () => {
    await page.evaluate(() => {
      const fx = window.__tinyWaterloo.fx;
      window.__fxCalls = { enabled: [], focus: [] };
      fx.setEnabled = (e) => window.__fxCalls.enabled.push(e);
      fx.setFocus = (x, y) => window.__fxCalls.focus.push([x, y]);
    });
    await page.click('button[aria-label="Settings"]');
    await page.click('label[for="set-tiltShift"]');
    await page.keyboard.press('Escape');
    await page.mouse.move(400, 300);
    await page.mouse.move(420, 310);
    await page.focus('#stage');
    await page.keyboard.press('m');
    const r = await page.evaluate(() => ({ calls: window.__fxCalls, minimapHidden: document.querySelector('.minimap').hidden }));
    await page.keyboard.press('m');
    await page.click('button[aria-label="Settings"]');
    await page.click('label[for="set-tiltShift"]');
    await page.keyboard.press('Escape');
    const off = r.calls.enabled.find((e) => e.tiltShift === false);
    assert(off && off.life === true && typeof off.strength === 'number', `setEnabled calls ${JSON.stringify(r.calls.enabled)}`);
    assert(r.calls.focus.some(([x, y]) => x === 420 && y === 310), `setFocus calls ${JSON.stringify(r.calls.focus)}`);
    assert(r.minimapHidden, 'M did not hide the minimap');
  });

  await check('share copies the view URL and shows a toast', async () => {
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await page.click('button[aria-label="Copy link to this view"]');
    await waitFor(page, () => document.getElementById('toast').classList.contains('show'));
    const [clip, hash, toast] = await page.evaluate(async () => [await navigator.clipboard.readText(), location.hash, document.getElementById('toast').textContent]);
    assert(clip.endsWith(hash) && /^#-?\d+,-?\d+,/.test(hash), `clipboard ${clip} hash ${hash}`);
    return `${toast}: ${clip}`;
  });

  await check('goose mode: Fly buttons call actor.start; map-only UI hidden and drag locked while active', async () => {
    await page.evaluate(() => {
      const a = window.__tinyWaterloo.actor;
      window.__starts = [];
      let on = false;
      Object.defineProperty(a, 'active', { configurable: true, get: () => on });
      a.start = async (at) => { window.__starts.push(at ?? null); on = true; };
      a.stop = () => { on = false; };
    });
    await page.click('.fly-btn');
    await waitFor(page, () => document.getElementById('app').classList.contains('actor-active'));
    assert(!(await page.locator('.fly-btn').isVisible()) && !(await page.locator('.strip').isVisible()), 'map-only UI still visible');
    assert(await page.locator('#attribution').isVisible(), 'attribution hidden during gameplay');
    const before = await view(page);
    await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(400, 300, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(300);
    const after = await view(page);
    assert(after.cx === before.cx && after.cy === before.cy, 'drag panned while the actor was active');
    await page.evaluate(() => window.__tinyWaterloo.actor.stop());
    await waitFor(page, () => !document.getElementById('app').classList.contains('actor-active'));
    await page.locator('.card', { hasText: 'Dana Porter' }).click();
    await page.locator('#landmark-panel button', { hasText: 'Fly from here' }).click();
    const starts = await page.evaluate(() => window.__starts);
    const dp = await page.evaluate(() => window.__tinyWaterloo.landmarks.find((x) => x.id === 'dana-porter').canvas);
    assert(starts[0] === null && starts[1]?.cx === dp[0] && starts[1]?.cy === dp[1], `start calls ${JSON.stringify(starts)}`);
    await page.evaluate(() => window.__tinyWaterloo.actor.stop());
    await waitFor(page, () => !document.getElementById('app').classList.contains('actor-active'));
    await page.evaluate(() => { const a = window.__tinyWaterloo.actor; delete a.active; delete a.start; delete a.stop; });
    return JSON.stringify(starts);
  });

  await check('reduced motion: camera jumps instead of animating', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => window.__tinyWaterloo.map.setView({ cx: -500, cy: 300, zoom: 1.2 }, { animate: true }));
    const v = await view(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert(v.cx === -500 && v.cy === 300 && v.zoom === 1.2, JSON.stringify(v));
  });

  await check('loader: LRU closes bitmaps beyond the byte budget; requests that leave the view are aborted', async () => {
    // slow down 1024 px tiles so a request is still in flight when the "view" moves on
    await page.route(/\/data\/tiles\/1024\/[0-9-]+_-2\.webp/, async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue().catch(() => {}); });
    const aborted = [];
    const onFail = (r) => { if (/_-2\.webp/.test(r.url())) aborted.push(r.failure()?.errorText); };
    page.on('requestfailed', onFail);
    const r = await page.evaluate(async () => {
      const { ResourceLoader } = await import('/src/map/loader.ts');
      const m = window.__tinyWaterloo.map.manifest;
      const url = (i, j) => `data/tiles/1024/${i}_${j}.webp?v=${m.tiles[`${i}_${j}`].v}&test=1`;
      const L = new ResourceLoader(2, 9 * 1024 * 1024, () => {});    // room for two 4 MB bitmaps
      const frame = async (keys) => {
        L.beginFrame();
        const rs = keys.map(([i, j]) => L.want(`${i}_${j}`, url(i, j), 0));
        L.endFrame();
        for (let k = 0; k < 100 && rs.some((x) => x.state !== 'ready'); k++) await new Promise((res) => setTimeout(res, 30));
        L.beginFrame(); for (const x of rs) if (x.state === 'ready') L.use(x); L.endFrame();
        return rs;
      };
      const first = await frame([[0, 0], [1, 0]]);
      const second = await frame([[2, 0], [3, 0]]);   // over budget: first frame's bitmaps are least recently used
      const s1 = L.stats();
      const closed = first.map((x) => x.bitmap.width === 0);   // ImageBitmap.close() zeroes width
      const kept = second.map((x) => x.bitmap.width);
      // cancellation: ask for a slow tile, then move on before it arrives
      L.beginFrame(); const slow = L.want('slow', url(0, -2), 0); L.endFrame();
      await new Promise((res) => setTimeout(res, 200));
      const wasLoading = slow.state === 'loading';
      L.beginFrame(); L.want('other', url(1, -1), 0); L.endFrame();
      await new Promise((res) => setTimeout(res, 300));
      return { s1, closed, kept, wasLoading, slowGone: !L.peek('slow') && slow.state !== 'ready' };
    });
    await page.waitForTimeout(200);
    page.off('requestfailed', onFail);
    await page.unroute(/\/data\/tiles\/1024\/[0-9-]+_-2\.webp/);
    assert(r.s1.bitmaps === 2 && r.s1.bytes <= 9 * 1024 * 1024, `after eviction ${JSON.stringify(r.s1)}`);
    assert(r.closed.every(Boolean) && r.kept.every((w) => w === 1024), `closed ${r.closed} kept ${r.kept}`);
    assert(r.wasLoading && r.slowGone, `slow request ${JSON.stringify(r)}`);
    assert(aborted.length >= 1, 'no aborted request observed');
    return `kept 2 bitmaps ${(r.s1.bytes / 1048576).toFixed(0)} MB, evicted+closed 2, aborted: ${aborted[0]}`;
  });

  await check('frame loop: idle when nothing changes; invalidate() emits frames with baseDirty=false', async () => {
    await idle(page);
    const r = await page.evaluate(async () => {
      const map = window.__tinyWaterloo.map, frames = [];
      // effects animate by design (life steps at 8 Hz, tilt-shift eases / retries its focus), so measure with them off
      const { life, tiltShift } = map.settings;
      map.updateSettings({ life: false, tiltShift: false });
      // let the frames caused by the change itself drain (slow under software GL): wait for 600 ms without a frame
      await new Promise((res) => {
        let last = performance.now();
        const offQuiet = map.on('frame', () => { last = performance.now(); });
        (function poll() { if (performance.now() - last > 600) { offQuiet(); res(); } else setTimeout(poll, 100); })();
      });
      const off = map.on('frame', (f) => frames.push(f.baseDirty));
      await new Promise((res) => setTimeout(res, 1500));
      const idleFrames = frames.length;
      // an animating module keeps calling invalidate() from its frame callback
      let n = 0;
      const off2 = map.on('frame', () => { if (++n < 10) map.invalidate(); });
      frames.length = 0;
      map.invalidate();
      await new Promise((res) => setTimeout(res, 800));
      off(); off2();
      map.updateSettings({ life, tiltShift });
      return { idleFrames, frames };
    });
    assert(r.idleFrames === 0, `${r.idleFrames} frames while idle`);
    assert(r.frames.length >= 10 && r.frames.every((d) => d === false), `invalidate frames ${JSON.stringify(r.frames)}`);
    return `idle 0 frames; ${r.frames.length} invalidated frames, none redrew the base`;
  });

  await check('no console errors during the session', async () => {
    assert(errors.length === 0, errors.join(' | '));
  });
  await ctx.close();

  // ------------------------------------------------------------------ failure + recovery (fresh context, no cache)
  await check('tile request failed once shows placeholder, then recovers automatically', async () => {
    const c2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const p2 = await c2.newPage();
    const errs = trackErrors(p2);
    let hits = 0;
    await p2.route(/\/data\/tiles\/\d+\/0_0\.webp/, async (route) => {
      hits++;
      if (hits === 1) await route.abort('failed'); else await route.continue();
    });
    await p2.goto(`${BASE}#512,512,0.6`);
    await waitFor(p2, () => window.__tinyWaterloo?.map?.perf().failed > 0, undefined, 8000);
    await p2.waitForTimeout(250);
    await p2.screenshot({ path: path.join(SHOTS, 'map_failed_tile.png') });
    await waitFor(p2, () => { const p = window.__tinyWaterloo.map.perf(); return p.failed === 0 && p.inflight === 0 && p.queued === 0; }, undefined, 10000);
    await p2.waitForTimeout(400);
    const luma = await baseLuma(p2, 640, 400);
    assert(hits >= 2, `0_0 requested ${hits} times`);
    assert(luma > 60, `tile 0_0 still dark (luma ${luma.toFixed(0)})`);
    // the aborted request logs a net::ERR_FAILED console error in Chromium; anything else is a real error
    const unexpected = errs.filter((e) => !/ERR_FAILED|Failed to load resource|Failed to fetch/i.test(e));
    assert(!unexpected.length, unexpected.join(' | '));
    await c2.close();
    return `0_0 requested ${hits}x, recovered luma ${luma.toFixed(0)}`;
  });

  // ------------------------------------------------------------------ phone layout
  await check('phone width (390 px): controls usable, no horizontal overflow, bottom sheet, pinch zoom', async () => {
    const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const p3 = await c3.newPage();
    const errs = trackErrors(p3);
    await p3.goto(BASE);
    await waitFor(p3, () => window.__tinyWaterloo?.map && document.querySelector('.card'));
    await idle(p3);
    await p3.waitForTimeout(300);
    const overflow = await p3.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert(!overflow, 'horizontal overflow');
    for (const sel of ['#search-input', 'button[aria-label="Zoom in"]', 'button[aria-label="Settings"]', '.fly-btn', '.card']) {
      const b = await p3.locator(sel).first().boundingBox();
      assert(b && b.x >= 0 && b.x + b.width <= 390 + 1 && b.width >= 30, `${sel} box ${JSON.stringify(b)}`);
    }
    await p3.screenshot({ path: path.join(SHOTS, 'map_phone.png') });
    await p3.locator('.card').first().tap();
    await settle(p3);
    const sheet = await p3.locator('#landmark-panel').boundingBox();
    assert(sheet && Math.abs(sheet.y + sheet.height - 844) < 2 && sheet.width >= 389, `sheet ${JSON.stringify(sheet)}`);
    await p3.screenshot({ path: path.join(SHOTS, 'map_phone_sheet.png') });
    // two-finger pinch (real touch events through CDP): spreading fingers zooms in about their midpoint
    await p3.keyboard.press('Escape');
    const cdp = await c3.newCDPSession(p3);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const z0 = (await view(p3)).zoom;
    const mid = await p3.evaluate(() => window.__tinyWaterloo.map.screenToCanvas(195, 300));
    await touch('touchStart', [[165, 300], [225, 300]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[165 - 10 * k, 300], [225 + 10 * k, 300]]); await p3.waitForTimeout(16); }
    await touch('touchEnd', []);
    const z1 = (await settle(p3)).zoom;
    const midAfter = await p3.evaluate(() => window.__tinyWaterloo.map.screenToCanvas(195, 300));
    assert(z1 > z0 * 2, `pinch zoom ${z0} -> ${z1}`);
    assert(Math.hypot(midAfter[0] - mid[0], midAfter[1] - mid[1]) < 3, `pinch midpoint drifted ${midAfter} vs ${mid}`);
    assert(!errs.length, errs.join(' | '));
    await c3.close();
  });
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
