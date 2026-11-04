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
/** Wait for the camera to settle (no view change for 400 ms). */
async function settle(page) {
  let last = JSON.stringify(await view(page));
  for (let k = 0; k < 40; k++) {
    await page.waitForTimeout(400);
    const now = JSON.stringify(await view(page));
    if (now === last) return JSON.parse(now);
    last = now;
  }
  return JSON.parse(last);
}
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
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
    const after = await settle(page);
    assert(after.cx > before.cx + 50, `cx ${before.cx} -> ${after.cx}`);
    await page.keyboard.press('0');
    const home = await settle(page);
    assert(Math.abs(home.cx) < 1 && Math.abs(home.cy) < 1, `home ${JSON.stringify(home)}`);
    return `home ${JSON.stringify(home)}`;
  });

  await check('reload with hash restores the view', async () => {
    // same-document navigation: arrives as a hashchange (animated), so wait for the camera to settle
    await page.goto(`${BASE}#1500,-300,0.8`);
    await waitFor(page, () => window.__tinyWaterloo?.map);
    const v = await settle(page);
    assert(Math.abs(v.cx - 1500) < 0.5 && Math.abs(v.cy + 300) < 0.5 && Math.abs(v.zoom - 0.8) < 1e-6, JSON.stringify(v));
    await page.reload();
    await waitFor(page, () => window.__tinyWaterloo?.map);
    const v2 = await view(page);
    assert(Math.abs(v2.cx - 1500) < 0.5 && Math.abs(v2.zoom - 0.8) < 1e-6, `after reload ${JSON.stringify(v2)}`);
    return JSON.stringify(v2);
  });

  await check('editing the hash (hashchange) moves the view', async () => {
    await page.evaluate(() => { location.hash = '#3300,575,1'; });
    const v = await settle(page);
    assert(Math.abs(v.cx - 3300) < 1 && Math.abs(v.cy - 575) < 1 && Math.abs(v.zoom - 1) < 1e-3, JSON.stringify(v));
  });

  await check('minimap click jumps the view', async () => {
    const box = await page.locator('.minimap-canvas').boundingBox();
    const tx = box.x + box.width * 0.3, ty = box.y + box.height * 0.3;
    await page.mouse.click(tx, ty);
    const v = await settle(page);
    // expected canvas point under the click, from the same mapping the minimap uses (bounds of all tiles + 0.5 tile)
    const expect = await page.evaluate(() => {
      const m = window.__tinyWaterloo.map.manifest, F = m.frame_px;
      const t = [...Object.values(m.tiles).map((x) => [x.i, x.j]), ...m.coverage.city_tiles];
      const x0 = Math.min(...t.map((a) => a[0])) * F - F / 2, x1 = (Math.max(...t.map((a) => a[0])) + 1) * F + F / 2;
      const y0 = Math.min(...t.map((a) => a[1])) * F - F / 2, y1 = (Math.max(...t.map((a) => a[1])) + 1) * F + F / 2;
      return [x0 + 0.3 * (x1 - x0), y0 + 0.3 * (y1 - y0)];
    });
    const err = Math.hypot(v.cx - expect[0], v.cy - expect[1]);
    assert(err < 400, `view ${JSON.stringify(v)} expected ~${expect.map(Math.round)}`);
    return `view (${v.cx.toFixed(0)}, ${v.cy.toFixed(0)}) expected (${expect.map(Math.round)})`;
  });

  await check('landmark card selection animates there and opens the detail panel', async () => {
    await page.locator('.card', { hasText: 'Waterloo Park' }).click();
    const l = await page.evaluate(() => window.__tinyWaterloo.landmarks.find((x) => x.id === 'waterloo-park'));
    await waitFor(page, (c) => { const v = window.__tinyWaterloo.map.getView(); return Math.hypot(v.cx - c[0], v.cy - c[1]) < 1; }, l.canvas, 8000);
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
    await waitFor(page, (c) => { const v = window.__tinyWaterloo.map.getView(); return Math.hypot(v.cx - c[0], v.cy - c[1]) < 1; }, l.canvas, 8000);
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
  await check('phone width (390 px): controls usable, no horizontal overflow', async () => {
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
    assert(!errs.length, errs.join(' | '));
    await c3.close();
  });
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
