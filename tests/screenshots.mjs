// Final user-facing screenshots of the production build at 1440x900, deviceScaleFactor 2 (plus an iPhone 13 emulation),
// written to docs/screenshots/. Uses vite preview on port 5190 (or a server already running there; build first with
// `npm run build`). Rendering is headless Chromium + SwiftShader, so each shot waits until tiles and effects have settled.
// Run: node tests/screenshots.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5190;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}
async function startServer() {
  if (await serverUp()) return null;
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  for (let k = 0; k < 80; k++) {
    if (await serverUp()) return proc;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview did not start (run `npm run build` first)');
}

const waitFor = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });
/** Tiles loaded, camera at rest and the tilt-shift focus settled; then a short pause for fades and a life step. */
async function settled(page) {
  await waitFor(page, () => {
    const T = window.__tinyWaterloo, p = T?.map?.perf();
    return p && p.inflight === 0 && p.queued === 0 && p.bitmaps > 0 && T.fx.debug.focusSettled;
  });
  let last = '', quiet = 0;
  while (quiet < 2) {
    await page.waitForTimeout(500);
    const v = JSON.stringify(await page.evaluate(() => window.__tinyWaterloo.map.getView()));
    quiet = v === last ? quiet + 1 : 0;
    last = v;
  }
  await page.waitForTimeout(1200);
}

async function open(browser, url, options = DESKTOP) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await waitFor(page, () => window.__tinyWaterloo?.map && document.querySelector('.card'));
  await settled(page);
  return { ctx, page, errors };
}

async function shot(browser, name, url, act, options) {
  const t0 = Date.now();
  const { ctx, page, errors } = await open(browser, url, options);
  if (act) await act(page);
  await page.screenshot({ path: path.join(SHOTS, name) });
  await ctx.close();
  console.log(`${name}: ${Math.round((Date.now() - t0) / 1000)} s${errors.length ? `, errors: ${errors.join(' | ')}` : ''}`);
  if (errors.length) process.exitCode = 1;
}

const server = await startServer();
const browser = await chromium.launch({ args: GL_ARGS });
try {
  await shot(browser, 'overview_campus.png', BASE);
  await shot(browser, 'uptown.png', `${BASE}#6150,560,0.7`);
  await shot(browser, 'waterloo_park.png', `${BASE}#4460,470,0.8`);
  await shot(browser, 'landmark_card.png', BASE, async (page) => {
    await page.click('.card[aria-label^="Dana Porter Library,"]');
    await page.locator('#landmark-panel').waitFor({ state: 'visible' });
    await settled(page);
  });
  await shot(browser, 'settings.png', BASE, async (page) => {
    await page.click('button[aria-label="Settings"]');
    await page.locator('#settings-panel').waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
  });
  await shot(browser, 'goose_flight.png', BASE, async (page) => {
    await page.click('.fly-btn');
    await waitFor(page, () => window.__tinyWaterloo.actor.active);
    await page.locator('.goose-hud').waitFor({ state: 'visible' });
    // a banking turn reads better than straight flight
    await page.keyboard.down('a');
    await page.waitForTimeout(2500);
    await page.keyboard.up('a');
    await page.waitForTimeout(800);
  });
  await shot(browser, 'mobile.png', BASE, null, { ...devices['iPhone 13'] });
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
