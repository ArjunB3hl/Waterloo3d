// Browser checks for the named-building label layer (web/src/map/buildingLabels.ts, data/labels.json).
// Serves the production build with `vite preview` on port 5183 (reuses a server already there; --build rebuilds first),
// drives Chromium via Playwright, and saves docs/screenshots/labels_campus_zoom06.png, labels_campus_zoom1.png,
// labels_uptown.png (1440x900, deviceScaleFactor 1, quantized to 256 colours with Pillow: under 1 MB each).
// Run: node tests/labels_check.mjs [--build]
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5183;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const LABELS = JSON.parse(readFileSync(path.join(ROOT, 'web', 'public', 'data', 'labels.json'), 'utf8')).labels;
const REQUIRED_CODES = ['MC', 'DC', 'DP', 'SLC', 'QNC', 'EIT', 'E5', 'E7', 'PHY', 'HH', 'ML', 'NH', 'STC'];
const HOME_ZOOM = 0.375;
const UPTOWN = [6328, 694];
const DRAW_BUDGET_MS = 2;

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

async function serverUp() { try { return (await fetch(BASE)).ok; } catch { return false; } }
async function startServer() {
  if (process.argv.includes('--build') || !existsSync(path.join(ROOT, 'web', 'dist', 'index.html'))) {
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (b.status !== 0) throw new Error('build failed');
  }
  if (await serverUp()) return null;
  const proc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  for (let k = 0; k < 80; k++) {
    if (await serverUp()) return proc;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite preview did not start');
}

const waitFor = (page, fn, arg, timeout = 20000) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
const booted = async (page) => {
  await waitFor(page, () => window.__tinyWaterloo?.map, null, 45000);
  await page.evaluate(() => window.__tinyWaterloo.map.labels.ready);
};
const idle = (page) => waitFor(page, () => { const p = window.__tinyWaterloo.map.perf(); return p.inflight === 0 && p.queued === 0 && p.bitmaps > 0; }, null, 45000);
/** Wait until the label layer has run a pass for the current view (and, optionally, with labels on / off). */
const labelPass = (page, enabled = null) => waitFor(page, (en) => {
  const m = window.__tinyWaterloo.map, v = m.getView(), s = m.labels.stats().view;
  return s.cx === v.cx && s.cy === v.cy && s.zoom === v.zoom && (en === null || m.labels.stats().enabled === en);
}, enabled);
/** Jump (no animation) and wait until tiles are in and a label pass for exactly this view has run. */
async function jump(page, cx, cy, zoom) {
  await page.evaluate(([cx, cy, zoom]) => window.__tinyWaterloo.map.setView({ cx, cy, zoom }), [cx, cy, zoom]);
  await labelPass(page);
  await idle(page);
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const m = window.__tinyWaterloo.map;
    return { view: m.getView(), stats: m.labels.stats(), drawn: m.labels.drawn() };
  });
}
/** Screen rects of visible landmark pills (DOM). */
const pillRects = (page) => page.evaluate(() => [...document.querySelectorAll('#labels:not(.hidden) .map-label:not([hidden])')]
  .map((el) => { const r = el.getBoundingClientRect(); return { text: el.textContent.trim(), x: r.left, y: r.top, w: r.width, h: r.height }; })
  .filter((r) => r.x + r.w > 0 && r.y + r.h > 0 && r.x < innerWidth && r.y < innerHeight));
const overlap = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
function overlaps(rects, pills) {
  const bad = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) if (overlap(rects[i], rects[j])) bad.push(`${rects[i].text} / ${rects[j].text}`);
    for (const p of pills) if (overlap(rects[i], p)) bad.push(`${rects[i].text} / pill ${p.text}`);
  }
  return bad;
}
const onScreen = (r, w, h) => r.x + r.w > 0 && r.y + r.h > 0 && r.x < w && r.y < h;
const codeOf = (text) => text.split(' · ')[0];
/** Overlay canvas alpha at a CSS px point (proves the label was actually painted there). */
const overlayAlpha = (page, x, y) => page.evaluate(([x, y]) => {
  const c = document.getElementById('map-overlay'), d = c.width / c.clientWidth;
  const px = c.getContext('2d').getImageData(Math.round(x * d) - 2, Math.round(y * d) - 2, 4, 4).data;
  let a = 0; for (let k = 3; k < px.length; k += 4) a = Math.max(a, px[k]);
  return a;
}, [x, y]);
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b), q = (f) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
  return { n: s.length, median: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), max: +s[s.length - 1].toFixed(3) };
};

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ args: GL_ARGS });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}#0,0,${HOME_ZOOM}`);
  await booted(page);
  const W = 1440, H = 900;

  await check('labels.json: one entry per named building, codes curated, fields complete', async () => {
    const n = await page.evaluate(() => window.__tinyWaterloo.map.labels.all.length);
    assert(n === LABELS.length && n >= 380, `loaded ${n} of ${LABELS.length}`);
    const keys = ['id', 'name', 'short', 'cls', 'group', 'canvas', 'area_m2', 'height_m', 'priority', 'osm', 'source'];
    const bad = LABELS.filter((l) => keys.some((k) => !(k in l)) || !/^[nwr]\d+/.test(l.osm));
    assert(!bad.length, `incomplete: ${bad.slice(0, 3).map((l) => l.id)}`);
    assert(new Set(LABELS.map((l) => l.id)).size === LABELS.length, 'duplicate ids');
    for (const dup of ['Ron Eydt Village', 'Conrad Grebel University College', "St. Jerome's University", 'Mackenzie King Village'])
      assert(LABELS.filter((l) => l.name === dup).length === 1, `${dup} not deduplicated`);
    const codes = LABELS.filter((l) => l.short);
    for (const c of REQUIRED_CODES) assert(codes.some((l) => l.short === c), `code ${c} missing`);
    const campus = LABELS.filter((l) => l.group === 'campus').length;
    const lm = LABELS.filter((l) => l.landmark).map((l) => l.id);
    return `${n} labels, ${campus} campus, ${codes.length} UW codes, landmark ids merged: ${lm.join(' ')}`;
  });

  await check(`home view (zoom ${HOME_ZOOM}): labels drawn, no overlaps with each other or landmark pills`, async () => {
    const r = await jump(page, 0, 0, HOME_ZOOM);
    const vis = r.drawn.filter((d) => onScreen(d, W, H));
    const pills = await pillRects(page);
    const bad = overlaps(vis, pills);
    assert(!bad.length, `overlaps: ${bad.slice(0, 5).join(', ')}`);
    assert(vis.length >= 40, `only ${vis.length} labels visible`);
    const shown = vis.find((d) => !d.occluded);
    const a = await overlayAlpha(page, shown.x + shown.w / 2, shown.y + shown.h / 2);
    assert(a > 100, `overlay not painted under "${shown.text}" (alpha ${a})`);
    return `${vis.length} building labels + ${pills.length} landmark pills on screen; ${r.stats.considered} considered of ${r.stats.total}`;
  });

  await check('campus at zoom 0.8: MC DC DP SLC QNC EIT E5 E7 PHY HH ML NH STC all labelled, no overlaps', async () => {
    const seen = new Map();
    let bad = [];
    for (const [cx, cy] of [[40, -80], [40, 480]]) {
      const r = await jump(page, cx, cy, 0.8);
      const vis = r.drawn.filter((d) => onScreen(d, W, H));
      const pills = await pillRects(page);
      bad = bad.concat(overlaps(vis, pills));
      for (const d of vis) seen.set(codeOf(d.text), 'label');
      for (const p of pills) if (!seen.has(p.text)) seen.set(p.text, 'landmark pill');
    }
    const missing = REQUIRED_CODES.filter((c) => !seen.has(c));
    assert(!missing.length, `missing ${missing.join(' ')}`);
    assert(!bad.length, `overlaps: ${bad.slice(0, 5).join(', ')}`);
    return REQUIRED_CODES.map((c) => `${c}${seen.get(c) === 'landmark pill' ? '*' : ''}`).join(' ') + '  (* = landmark pill)';
  });

  await check('zoom >= 1: full names with codes, nearly every on-screen building labelled, no overlaps', async () => {
    const out = [];
    for (const [cx, cy, z] of [[100, -50, 1.0], [300, 500, 1.5], [UPTOWN[0], UPTOWN[1], 1.0]]) {
      const r = await jump(page, cx, cy, z);
      const vis = r.drawn.filter((d) => onScreen(d, W, H));
      const bad = overlaps(vis, await pillRects(page));
      assert(!bad.length, `overlaps at ${cx},${cy},${z}: ${bad.slice(0, 4).join(', ')}`);
      // anchors on screen (excluding landmark-pill buildings) vs labels drawn for them
      const anchors = await page.evaluate(([W, H]) => {
        const m = window.__tinyWaterloo.map, pills = new Set(window.__tinyWaterloo.landmarks.filter((l) => l.status === 'covered').map((l) => l.id));
        return m.labels.all.filter((l) => !(l.landmark_id && pills.has(l.landmark_id)) && m.getView().zoom >= l.min_zoom)
          .map((l) => [l.id, ...m.canvasToScreen(l.canvas[0], l.canvas[1])]).filter(([, x, y]) => x > 0 && y > 0 && x < W && y < H).map(([id]) => id);
      }, [W, H]);
      const drawnIds = new Set(r.drawn.map((d) => d.id));
      const covered = anchors.filter((id) => drawnIds.has(id)).length;
      out.push(`${cx},${cy} z${z}: ${covered}/${anchors.length}`);
      assert(covered / Math.max(1, anchors.length) >= 0.75, `only ${covered} of ${anchors.length} on-screen buildings labelled at ${cx},${cy},${z}`);
      if (z >= 1 && cx === 100) {
        const full = vis.filter((d) => d.text.includes(' · ')).length;
        assert(full >= 10, `only ${full} "CODE · name" labels at zoom 1`);
        out.push(`${full} "CODE · name"`);
      }
    }
    return out.join('; ');
  });

  await check('panning keeps the label set stable (no flicker)', async () => {
    const z = 0.6, steps = [[0, 0], [37, 11], [91, -23], [150, 40], [233, 77], [180, 120]];
    let flips = 0, compared = 0;
    let prev = null;
    for (const [dx, dy] of steps) {
      const r = await jump(page, -100 + dx / z, 100 + dy / z, z);
      // labels whose anchor sits in the inner 70% of the screen in this view
      const inner = new Set(r.drawn.filter((d) => d.x > W * 0.15 && d.x + d.w < W * 0.85 && d.y > H * 0.15 && d.y + d.h < H * 0.85).map((d) => d.id));
      const all = new Set(r.drawn.map((d) => d.id));
      if (prev) {
        for (const id of prev.inner) { compared++; if (!all.has(id)) flips++; }
        for (const id of inner) if (!prev.all.has(id)) flips++;
      }
      prev = { inner, all };
    }
    assert(flips === 0, `${flips} labels appeared/disappeared in the middle of the screen while panning`);
    return `${steps.length - 1} pans at zoom ${z}, ${compared} inner labels compared, 0 changes`;
  });

  await check('settings toggle hides / shows building labels (persisted), B shortcut, landmark setting unchanged', async () => {
    await jump(page, 0, 0, HOME_ZOOM);
    await page.click('button[aria-label="Settings"]');
    await page.locator('#settings-panel').waitFor({ state: 'visible' });
    await page.click('label[for="set-buildingLabels"]');
    await labelPass(page, false);
    const off = await page.evaluate(() => ({ n: window.__tinyWaterloo.map.labels.drawn().length, s: JSON.parse(localStorage.getItem('tinyWaterloo.settings.v1')), lm: window.__tinyWaterloo.map.settings.labels }));
    assert(off.n === 0 && off.s.buildingLabels === false && off.lm === true, `after toggle off: ${JSON.stringify(off)}`);
    await page.keyboard.press('Escape');
    await page.locator('#stage').focus();
    await page.keyboard.press('b');
    await labelPass(page, true);
    const on = await page.evaluate(() => ({ n: window.__tinyWaterloo.map.labels.drawn().length, s: window.__tinyWaterloo.map.settings.buildingLabels }));
    assert(on.n > 0 && on.s === true, `after B: ${JSON.stringify(on)}`);
    return `off -> 0 drawn (stored ${off.s.buildingLabels}); B -> ${on.n} drawn`;
  });

  await check('search "PHY" -> Physics: animated jump + building card with OSM link; Escape closes', async () => {
    const ph = LABELS.find((l) => l.short === 'PHY');
    await page.locator('#stage').focus();
    await page.keyboard.press('/');
    await waitFor(page, () => document.activeElement?.id === 'search-input');
    await page.keyboard.type('PHY', { delay: 30 });
    await page.locator('#search-opt-0').waitFor({ state: 'visible' });
    // results re-rank once the full index (search.json + labels) has loaded, which starts on first focus
    await waitFor(page, () => document.querySelector('#search-opt-0 .hit-name')?.textContent === 'Physics', null, 8000).catch(() => {});
    const first = await page.textContent('#search-opt-0 .hit-name');
    assert(first === 'Physics', `first result ${first}`);
    await page.keyboard.press('Enter');
    await page.locator('#building-panel').waitFor({ state: 'visible' });
    await waitFor(page, ([x, y]) => { const v = window.__tinyWaterloo.map.getView(); return Math.hypot(v.cx - x, v.cy - y) < 1 && v.zoom >= 1.19; }, ph.canvas, 30000);
    const title = await page.textContent('#building-panel-title');
    const href = await page.getAttribute('#building-panel a[href*="openstreetmap.org/way"]', 'href');
    assert(title === 'Physics' && href === 'https://www.openstreetmap.org/way/43250631', `title ${title}, link ${href}`);
    await page.keyboard.press('Escape');
    await page.locator('#building-panel').waitFor({ state: 'hidden' });
    return `jumped to (${ph.canvas}); card "${title}" links ${href}`;
  });

  await check('labels under fixed UI (search, controls, strip, minimap) are placed but not painted or picked', async () => {
    const out = [];
    let tested = 0;
    for (const [cx, cy, z] of [[100, -50, 1.2], [40, -80, 0.8], [0, 0, HOME_ZOOM]]) {
      await jump(page, cx, cy, z);
      // occlusion follows UI changes (the card closed by the previous check) within a frame or two; swiftshader
      // frames are slow, so wait for the label pass to settle
      await page.waitForTimeout(1200);
      const r = { drawn: await page.evaluate(() => window.__tinyWaterloo.map.labels.drawn()) };
      const ui = await page.evaluate(() => ['#ui .top .search', '#ui .controls', '#ui .fly-btn', '#ui .strip', '#ui .minimap', '#ui .perf-hud', '#ui .panel']
        .flatMap((s) => [...document.querySelectorAll(s)]).filter((e) => e.getClientRects().length)
        .map((e) => { const b = e.getBoundingClientRect(); return { c: e.className, x: b.left, y: b.top, w: b.width, h: b.height }; }));
      const under = r.drawn.filter((d) => ui.some((u) => overlap(d, u)));
      const wrong = under.filter((d) => !d.occluded);
      assert(!wrong.length, `painted under UI: ${wrong.map((d) => d.text).join(', ')}`);
      const falsely = r.drawn.filter((d) => d.occluded && !ui.some((u) => overlap(d, u)));
      assert(!falsely.length, `hidden but not under UI: ${JSON.stringify(falsely)}; UI ${JSON.stringify(ui)}`);
      for (const d of under.slice(0, 2)) {
        const hit = await page.evaluate(([x, y]) => window.__tinyWaterloo.map.labels.pick(x, y, 10)?.id ?? null, [d.x + d.w / 2, d.y + d.h / 2]);
        assert(hit !== d.id, `occluded ${d.text} is pickable`);
        tested++;
      }
      out.push(`z${z}: ${under.length} under UI`);
    }
    assert(tested > 0, 'no label under the UI to test');
    return out.join(', ');
  });

  await check('display names: long names shortened at every zoom, V1 houses prefixed, uncurated alts are not codes', async () => {
    const long = LABELS.filter((l) => l.name.length > 34);
    const bad = LABELS.filter((l) => (l.display ?? l.name).length > 34 || (l.display_short ?? l.display ?? l.name).length > 26);
    assert(!bad.length, `too long: ${bad.slice(0, 3).map((l) => l.display ?? l.name)}`);
    const v1 = LABELS.filter((l) => /^(North|South|East|West) \d$/.test(l.name));
    assert(v1.length >= 20 && v1.every((l) => l.display === `V1 ${l.name}`), `V1 houses: ${v1.map((l) => l.display).slice(0, 4)}`);
    const tc = LABELS.find((l) => l.short === 'TC'), mhr = LABELS.find((l) => l.name === 'Minota Hagey Residence');
    assert(tc.display === 'Tatham Centre' && mhr.short === 'MHR', `TC ${tc.display}, Minota Hagey ${mhr.short}`);
    // drawn texts at zoom 1.2 over campus stay within the cap
    const r = await jump(page, 100, -50, 1.2);
    const wide = r.drawn.filter((d) => d.text.replace(/^[A-Z0-9]{1,5} · /, '').length > 34);
    assert(!wide.length, `wide labels: ${wide.map((d) => d.text)}`);
    // search: 'MH' (an OSM alt of Minota Hagey) is not presented as a code
    await page.locator('#stage').focus();
    await page.keyboard.press('/');
    await waitFor(page, () => document.activeElement?.id === 'search-input');
    await page.keyboard.type('MH', { delay: 30 });
    await waitFor(page, () => [...document.querySelectorAll('#search-results .hit-name')].some((e) => e.textContent === 'Minota Hagey Residence'), null, 8000);
    const details = await page.$$eval('#search-results [role="option"]', (els) => els.map((e) => e.textContent));
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const mh = details.find((d) => d.startsWith('Minota Hagey Residence'));
    assert(/MHR/.test(mh) && !/\bMH ·/.test(mh), `Minota Hagey result: ${mh}`);
    return `${long.length} names > 34 chars shortened; widest drawn ${Math.max(...r.drawn.map((d) => d.text.length))} chars; ${v1.length} V1 houses; "${mh}"`;
  });

  await check('search "Hagey" -> J. G. Hagey Hall first, Enter opens its card', async () => {
    await page.locator('#stage').focus();
    await page.keyboard.press('/');
    await waitFor(page, () => document.activeElement?.id === 'search-input');
    await page.keyboard.type('Hagey', { delay: 30 });
    await page.locator('#search-opt-0').waitFor({ state: 'visible' });
    await waitFor(page, () => [...document.querySelectorAll('#search-results .hit-name')].some((e) => e.textContent.includes('Hagey Hall')), null, 8000).catch(() => {});
    const names = await page.$$eval('#search-results [role="option"] .hit-name', (els) => els.map((e) => e.textContent));
    const k = names.indexOf('J. G. Hagey Hall of the Humanities');
    const detail = k >= 0 ? await page.textContent(`#search-opt-${k} .hit-detail`) : '';
    assert(k === 0, `results ${names.join(' | ')}`);
    await page.keyboard.press('Enter');
    await page.locator('#building-panel').waitFor({ state: 'visible' });
    const title = await page.textContent('#building-panel-title');
    await page.keyboard.press('Escape');
    await page.locator('#building-panel').waitFor({ state: 'hidden' });
    assert(title === 'J. G. Hagey Hall of the Humanities', `card ${title}`);
    return `#1 of [${names.join(' | ')}] (${detail}); Enter -> card "${title}"`;
  });

  await check('click a building label -> card (name, code, type, height source, OSM link); Escape closes', async () => {
    const r = await jump(page, 500, 700, 0.8);
    const hh = r.drawn.find((d) => d.id === 'j-g-hagey-hall-of-the-humanities');
    assert(hh, `HH not drawn: ${r.drawn.map((d) => d.text).join(', ')}`);
    await page.mouse.move(hh.x + hh.w / 2, hh.y + hh.h / 2);
    const cursor = await page.evaluate(() => getComputedStyle(document.getElementById('stage')).cursor);
    await page.mouse.click(hh.x + hh.w / 2, hh.y + hh.h / 2);
    await page.locator('#building-panel').waitFor({ state: 'visible' });
    const body = await page.textContent('#building-panel');
    const href = await page.getAttribute('#building-panel a[href*="openstreetmap.org/way"]', 'href');
    assert(body.includes('J. G. Hagey Hall of the Humanities') && body.includes('HH') && body.includes('Campus building') && /Height/.test(body), `card: ${body.slice(0, 200)}`);
    assert(href === 'https://www.openstreetmap.org/way/43250624', `link ${href}`);
    assert(cursor === 'pointer', `cursor over label: ${cursor}`);
    await page.keyboard.press('Escape');
    await page.locator('#building-panel').waitFor({ state: 'hidden' });
    const focus = await page.evaluate(() => document.activeElement?.id);
    assert(focus === 'stage', `focus after Escape: ${focus}`);
    return `clicked "${hh.text}" -> card + ${href}; pointer cursor on hover; Escape -> focus #stage`;
  });

  await check('touch: a tap 8 px outside a code label opens it (mouse needs a direct hit)', async () => {
    const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const tp = await tctx.newPage();
    await tp.goto(`${BASE}#500,700,0.8`);
    await booted(tp);
    await jump(tp, 500, 700, 0.8);
    // a code label well inside the phone screen, away from the UI (wait for the pass with labels loaded)
    const pickTarget = () => window.__tinyWaterloo.map.labels.drawn()
      .find((d) => !d.occluded && /^[A-Z0-9]{1,5}$/.test(d.text) && d.y > 120 && d.y < 600 && d.x > 20 && d.x < 300) ?? null;
    await tp.waitForFunction(pickTarget, null, { timeout: 15000, polling: 100 }).catch(() => {});
    const target = await tp.evaluate(pickTarget);
    assert(target, 'no code label on the phone view');
    const mouseHit = await tp.evaluate(([x, y]) => window.__tinyWaterloo.map.labels.pick(x, y)?.id ?? null, [target.x + target.w / 2, target.y + target.h + 8]);
    await tp.touchscreen.tap(target.x + target.w / 2, target.y + target.h + 8);
    await waitFor(tp, () => !!document.querySelector('#building-panel:not([hidden]), #landmark-panel:not([hidden])'), null, 8000);
    const title = await tp.evaluate(() => [...document.querySelectorAll('.panel:not([hidden]) h2')].map((e) => e.textContent).join());
    await tctx.close();
    assert(mouseHit === null, `mouse slop picked ${mouseHit}`);
    return `tapped 8 px below "${target.text}" (${target.w}x${target.h}) -> "${title}"`;
  });

  await check(`label pass cost < ${DRAW_BUDGET_MS} ms (viewport culling; also with all ${LABELS.length} labels competing)`, async () => {
    const views = [[0, 0, HOME_ZOOM], [40, -80, 0.8], [100, -50, 1.0], [UPTOWN[0], UPTOWN[1], 0.6], [2500, 0, 0.2], [3000, 0, 0.12]];
    const times = [], considered = [];
    for (const [cx, cy, z] of views) {
      for (let k = 0; k < 4; k++) {
        const r = await jump(page, cx + k * 7, cy + k * 5, z);
        times.push(r.stats.drawMs); considered.push(r.stats.considered);
      }
    }
    // stress: every label in a whole-area view competes for space, ignoring min_zoom
    await page.evaluate(() => window.__tinyWaterloo.map.labels.setIgnoreMinZoom(true));
    const stress = [];
    let maxConsidered = 0;
    for (let k = 0; k < 8; k++) {
      const r = await jump(page, 3000 + k * 9, 0, 0.12);
      stress.push(r.stats.drawMs); maxConsidered = Math.max(maxConsidered, r.stats.considered);
    }
    await page.evaluate(() => window.__tinyWaterloo.map.labels.setIgnoreMinZoom(false));
    const a = stats(times), b = stats(stress);
    assert(a.p95 < DRAW_BUDGET_MS, `typical views p95 ${a.p95} ms`);
    assert(maxConsidered >= LABELS.length * 0.95, `stress considered only ${maxConsidered}`);
    assert(b.median < DRAW_BUDGET_MS, `stress median ${b.median} ms`);
    return `typical views (${Math.min(...considered)}-${Math.max(...considered)} considered): median ${a.median} p95 ${a.p95} max ${a.max} ms; ` +
      `stress ${maxConsidered} considered: median ${b.median} p95 ${b.p95} max ${b.max} ms (headless swiftshader)`;
  });

  await check('goose flight: only campus building codes stay on the map', async () => {
    await jump(page, 0, 0, 0.8);
    await page.evaluate(() => window.__tinyWaterloo.actor.start({ cx: 0, cy: 0 }));
    await waitFor(page, () => window.__tinyWaterloo.actor.active, null, 20000);
    await page.waitForTimeout(1500);
    const d = await page.evaluate(() => window.__tinyWaterloo.map.labels.drawn().map((x) => ({ id: x.id, text: x.text })));
    const labels = new Map(LABELS.map((l) => [l.id, l]));
    const bad = d.filter((x) => !(labels.get(x.id)?.short && labels.get(x.id).group === 'campus' && x.text === labels.get(x.id).short));
    await page.evaluate(() => window.__tinyWaterloo.actor.stop());
    await waitFor(page, () => !window.__tinyWaterloo.actor.active);
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => window.__tinyWaterloo.map.labels.drawn().filter((x) => !/^[A-Z0-9]{1,4}$/.test(x.text)).length);
    assert(!bad.length, `non-code labels in flight: ${bad.slice(0, 5).map((x) => x.text)}`);
    assert(d.length > 0, 'no labels in flight');
    assert(after > 0, 'names did not come back after landing');
    return `${d.length} codes in flight (${d.slice(0, 8).map((x) => x.text).join(' ')}...); ${after} names back after landing`;
  });

  await check('no console errors', async () => {
    assert(!errors.length, errors.slice(0, 3).join(' | '));
  });

  // ---------------------------------------------------------------- screenshots (1440x900 @1x)
  await check('screenshots: labels_campus_zoom06, labels_campus_zoom1, labels_uptown', async () => {
    const shot = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const p = await shot.newPage();
    await p.goto(`${BASE}#0,0,${HOME_ZOOM}`);
    await booted(p);
    // a collapsed landmark strip keeps the bottom of the map visible
    await p.evaluate(() => document.querySelector('.strip-toggle')?.click());
    const out = [];
    for (const [file, v] of [['labels_campus_zoom06.png', [60, 180, 0.6]], ['labels_campus_zoom1.png', [150, 120, 1.0]], ['labels_uptown.png', [UPTOWN[0] - 150, UPTOWN[1] - 60, 0.85]]]) {
      const r = await jump(p, ...v);
      await p.mouse.move(720, 450);
      await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(SHOTS, file) });
      out.push(`${file}: ${r.drawn.filter((d) => onScreen(d, W, H)).length} labels`);
    }
    await shot.close();
    // 256-colour palette PNGs (about 0.8 MB instead of 2 MB); skipped when Python / Pillow are unavailable
    const files = out.map((o) => path.join(SHOTS, o.split(':')[0]));
    const q = spawnSync('python3', ['-c', 'import sys\nfrom PIL import Image\nfor f in sys.argv[1:]:\n  Image.open(f).convert("RGB").quantize(256, method=Image.Quantize.MEDIANCUT).save(f, optimize=True)', ...files]);
    const kb = files.map((f) => Math.round(statSync(f).size / 1024));
    return `${out.join(', ')}; ${q.status === 0 ? 'quantized' : 'not quantized'} ${kb.join(' / ')} KB`;
  });

  await browser.close();
  if (server) try { process.kill(-server.pid); } catch { /* already gone */ }
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
