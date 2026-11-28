// Browser check for adaptive quality (web/src/fx/adaptive.ts + fx/Effects.ts levels) against a running preview:
//   npm run build && npx vite preview --port 4173 &     then     node tests/adaptive_browser_check.cjs
// Headless Chromium renders with SwiftShader (a software GPU), so nearly every flight frame is late: that is the slow
// machine the governor is for. Levels are also forced through window.__tinyWaterloo.adaptive.debug.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.env.BASE || 'http://127.0.0.1:4173';
const SETTINGS_KEY = 'tinyWaterloo.settings.v1';
const res = [];
const check = async (name, fn) => {
  try { const d = await fn(); res.push(true); console.log(`PASS ${name}${d ? `  (${d})` : ''}`); }
  catch (e) { res.push(false); console.log(`FAIL ${name}\n  ${String(e.message).split('\n').slice(0, 4).join('\n  ')}`); }
};

async function flyingPage(b, query = '') {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => localStorage.setItem('arjunPortfolio.music.v1', 'off'));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base + '/portfolio.html' + query);
  await p.waitForSelector('.title-start:not([disabled])', { timeout: 60000 });
  await p.evaluate(() => document.querySelector('.title-start').click());
  await p.waitForFunction(() => window.__tinyWaterloo?.actor?.active && !document.querySelector('.title-screen'), null, { timeout: 60000 });
  // count the toasts themselves: the shared #toast element cannot show a repeat of the same text
  await p.evaluate(() => { const m = window.__tinyWaterloo.map; const orig = m.toast.bind(m); window.__toasts = []; m.toast = (s) => { window.__toasts.push(s); return orig(s); }; });
  return { ctx, p, errors };
}
const fxState = (p) => p.evaluate(() => {
  const { fx, map, adaptive } = window.__tinyWaterloo; const d = fx.debug;
  return { level: d.adaptiveLevel, gate: d.tiltGate, visible: d.visible, tilt: d.tilt, life: d.life, height: !!map.heightCanvas, lifeLayer: !!map.lifeCanvas,
    gov: adaptive.governor.state, quality: map.settings.quality, stored: localStorage.getItem('tinyWaterloo.settings.v1') };
});
const lowered = async (p) => (await p.evaluate(() => window.__toasts)).filter((t) => /Effects lowered/.test(t));
/** Run rAF frames in the page until cond(fx.debug) holds (or the deadline), recording [ms, tiltGate, adaptiveLevel]. */
const framesUntil = (p, cond, deadlineMs) => p.evaluate(async ([src, deadline]) => {
  const cond = new Function('d', `return (${src})`); const { fx } = window.__tinyWaterloo;
  const out = []; const t0 = performance.now();
  do { await new Promise((r) => requestAnimationFrame(r)); out.push([Math.round(performance.now() - t0), +fx.debug.tiltGate.toFixed(2), fx.debug.adaptiveLevel]); }
  while (!cond(fx.debug) && performance.now() - t0 < deadline);
  return out;
}, [cond, deadlineMs]);

(async () => {
  // SwiftShader, pinned like the other suites: the slow (software) GPU the natural step-down needs
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    // 1. natural step down on a slow (software) GPU
    {
      const { ctx, p, errors } = await flyingPage(b);
      const start = await fxState(p);
      await check('take-off: full effects at level 0 (tilt-shift and life drawn)', async () => {
        assert.equal(start.level, 0); assert.ok(start.tilt && start.life && start.visible, JSON.stringify(start));
      });
      // sample once a second until the floor is kept (a step only counts once the next window shows it helped)
      const timeline = [];
      for (let s = 0; s < 90; s++) {
        await p.waitForTimeout(1000);
        const st = await fxState(p); timeline.push(st.level);
        if (st.level === 2 && !st.gov.testing) break;
      }
      const end = await fxState(p);
      await check('a slow flight steps down after the warm-up, one level at a time, to the floor, and keeps it', async () => {
        const g = end.gov;
        assert.equal(timeline[1], 0, `no step in the warm-up: ${timeline.join(' ')}`);
        assert.equal(end.level, 2, `levels per second: ${timeline.join(' ')}; governor ${JSON.stringify(g)}`);
        // exact counts depend on SwiftShader's speed (level 1 alone may miss the 10% gain, then level 2 is tested in its
        // place); the unit tests pin them on synthetic machines
        assert.ok(g.kept >= 1 && g.undone === 0 && g.provenMax === 2 && !g.testing, JSON.stringify(g));
        const i1 = timeline.indexOf(1), i2 = timeline.indexOf(2);
        assert.ok(i1 > 0 && i2 - i1 >= 2, `settles between steps: ${timeline.join(' ')}`);
        assert.ok(timeline.every((l, i) => !i || l - timeline[i - 1] === 0 || l - timeline[i - 1] === 1), `one level at a time, never up: ${timeline.join(' ')}`);
        return `levels per second ${timeline.join(' ')}; late fraction ${g.lastLateFraction.toFixed(2)}`;
      });
      await check('at the floor the effects layer is hidden and neither aux layer is drawn', async () => {
        assert.equal(end.visible, false); assert.equal(end.height, false); assert.equal(end.lifeLayer, false);
      });
      await check('the visitor is told once, and the stored settings are untouched', async () => {
        const said = await lowered(p);
        assert.equal(said.length, 1, `toasts: ${JSON.stringify(await p.evaluate(() => window.__toasts))}`);
        assert.equal(end.stored, start.stored, 'localStorage settings changed');
        assert.equal(end.quality, 'auto');
        return said[0];
      });
      await check('landing holds the level; the next take-off starts one level higher', async () => {
        await p.keyboard.press('l');
        await p.waitForFunction(() => !window.__tinyWaterloo.actor.active);
        await p.waitForTimeout(500);
        const landed = await fxState(p);
        assert.equal(landed.level, 2);
        await p.evaluate(() => window.__tinyWaterloo.actor.start());
        await p.waitForFunction(() => window.__tinyWaterloo.actor.active);
        await p.waitForTimeout(300);
        const again = await fxState(p);
        assert.equal(again.level, 1, JSON.stringify(again));
        return `landed ${landed.level}, after take-off ${again.level}`;
      });
      await check('Quality High mid-flight restores the full effects at once; back on Auto the governor restarts one level up', async () => {
        await p.evaluate(() => window.__tinyWaterloo.map.updateSettings({ quality: 'high' }));
        await p.waitForFunction(() => { const d = window.__tinyWaterloo.fx.debug; return d.adaptiveLevel === 0 && d.visible && d.tilt; }, null, { timeout: 15000 });
        const high = await fxState(p);
        assert.equal(high.level, 0); assert.ok(high.visible && high.tilt, JSON.stringify(high));
        // switching back to Auto restarts judging like a take-off, one level up from where it was, and never shows the
        // old level on the way (not even for a frame)
        const frames = await p.evaluate(async () => {
          const { map, fx } = window.__tinyWaterloo; const out = [];
          map.updateSettings({ quality: 'auto' }); out.push(fx.debug.adaptiveLevel);
          for (let i = 0; i < 10; i++) { await new Promise((r) => requestAnimationFrame(r)); out.push(fx.debug.adaptiveLevel); }
          return out;
        });
        const auto = await fxState(p);
        const want = Math.max(0, high.gov.level - 1);
        assert.ok(frames.every((l) => l === want), `levels after Auto, per frame: ${frames.join(' ')} (want ${want})`);
        assert.equal(auto.gov.flying, true);
        assert.equal((await lowered(p)).length, 1, 'told only once per page');
        return `high -> level ${high.level}, auto -> level ${auto.level} from the first frame`;
      });
      await check('no page errors', async () => { assert.deepEqual(errors, []); });
      await ctx.close();
    }
    // 2. forced levels: the tilt-shift fades instead of popping, then the layer goes away
    {
      const { ctx, p, errors } = await flyingPage(b, '?adaptive=0');
      await check('?adaptive=0: a slow flight keeps the full effects', async () => {
        await p.waitForTimeout(9000);
        const st = await fxState(p);
        assert.equal(st.level, 0); assert.ok(st.visible && st.tilt && st.life, JSON.stringify(st));
      });
      await check('level 1: the tilt-shift fades out over about 0.4 s, life stays, the height layer is dropped', async () => {
        await p.evaluate(() => { const { adaptive } = window.__tinyWaterloo; adaptive.debug.setEnabled(true); adaptive.debug.force(1); });
        const gates = await framesUntil(p, 'd.tiltGate === 0', 15000);
        await p.waitForTimeout(300);
        const st = await fxState(p);
        const mid = gates.filter(([, g]) => g > 0 && g < 1);
        assert.ok(mid.length >= 2, `gate never between 0 and 1: ${JSON.stringify(gates.slice(0, 12))}`);
        assert.equal(st.gate, 0); assert.equal(st.tilt, false); assert.equal(st.life, true); assert.equal(st.visible, true); assert.equal(st.height, false);
        return `${mid.length} frames mid-fade, gate 0 at ${gates.at(-1)[0]} ms`;
      });
      await check('level 2: the effects layer is hidden and the base canvas shown', async () => {
        await p.evaluate(() => window.__tinyWaterloo.adaptive.debug.force(2));
        await framesUntil(p, '!d.visible', 15000); await p.waitForTimeout(300);
        const st = await fxState(p);
        const baseVisible = await p.evaluate(() => getComputedStyle(window.__tinyWaterloo.map.baseCanvas).visibility);
        assert.equal(st.visible, false); assert.equal(baseVisible, 'visible'); assert.equal(st.lifeLayer, false);
      });
      await check('back to level 0 (forced): tilt-shift fades back in, both layers return', async () => {
        await p.evaluate(() => window.__tinyWaterloo.adaptive.debug.force(0));
        const gates = await framesUntil(p, 'd.tiltGate === 1', 15000);
        await p.waitForTimeout(300);
        const st = await fxState(p);
        const mid = gates.filter(([, g]) => g > 0 && g < 1);
        assert.ok(mid.length >= 2, `fade-in popped: ${JSON.stringify(gates.slice(0, 12))}`);
        assert.equal(st.gate, 1); assert.ok(st.visible && st.tilt && st.life && st.height && st.lifeLayer, JSON.stringify(st));
        assert.deepEqual(await lowered(p), [], 'forced levels never toast');
        return `${mid.length} frames mid-fade`;
      });
      await check('no page errors (forced levels)', async () => { assert.deepEqual(errors, []); });
      await ctx.close();
    }
  } finally { await b.close(); }
  const failed = res.filter((x) => !x).length;
  console.log(failed ? `\n${failed} of ${res.length} checks FAILED` : `\n${res.length}/${res.length} adaptive checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
