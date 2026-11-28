// Node check for web/src/fx/adaptive.ts (QualityGovernor), fed synthetic frame sequences (no browser needed).
// Run: node --experimental-strip-types tests/adaptive_check.mjs     (Node >= 23.6 strips types without the flag)
import assert from 'node:assert/strict';
// createAdaptiveQuality reads a few browser globals: stub them before the import
globalThis.location = { search: '' };
globalThis.document = { visibilityState: 'visible' };
const listeners = {};
globalThis.addEventListener = (type, f) => { listeners[type] = f; };
globalThis.removeEventListener = (type) => { delete listeners[type]; };
const { QualityGovernor, createAdaptiveQuality } = await import('../web/src/fx/adaptive.ts');

const results = [];
const check = (name, fn) => {
  try { const detail = fn(); results.push(true); console.log(`PASS ${name}${detail ? `  (${detail})` : ''}`); }
  catch (e) { results.push(false); console.log(`FAIL ${name}\n  ${e.message}`); }
};

/** Feed frames for `seconds`. interval(i, t, level) returns the next frame interval in ms, so a machine can get faster
 *  when the level goes up. Returns the end time and the level after each whole second. */
function fly(g, seconds, interval, t0 = 0) {
  let t = t0, i = 0;
  const perSecond = [];
  let nextMark = t0 + 1000;
  while (t < t0 + seconds * 1000) {
    t += interval(i++, t, g.level);
    g.frame(t);
    while (t >= nextMark) { perSecond.push(g.level); nextMark += 1000; }
  }
  return { t, perSecond };
}
const steady = (ms) => () => ms;
const HZ60 = 1000 / 60, HALF = 1000 / 30;
/** A GPU-bound machine on a 60 Hz screen: 30 fps at full effects, every other frame late at level 1, 60 fps at level 2. */
const gpuBound = (i, t, level) => (level >= 2 ? HZ60 : level === 1 ? (i % 2 ? HZ60 : HALF) : HALF);
const make = (o = {}) => new QualityGovernor({ maxLevel: 2, ...o });
const changes = (perSecond) => perSecond.filter((v, i) => i && v !== perSecond[i - 1]).length;

check('steady 60 fps: never steps down', () => {
  const g = make(); g.start(0);
  fly(g, 60, steady(HZ60));
  assert.equal(g.level, 0); assert.equal(g.state.stepsDown, 0);
});

check('high refresh rates: 120 fps, and 60 or 40 fps on a 120 Hz screen, never step down', () => {
  // real frames jitter around the refresh multiple: 40 fps on 120 Hz alternates a little either side of 25 ms
  for (const [ms, jitter] of [[1000 / 120, 0.4], [HZ60, 0.4], [25, 0.4]]) {
    const g = make(); g.start(0); fly(g, 30, (i) => ms + (i % 2 ? jitter : -jitter));
    assert.equal(g.state.stepsDown, 0, `${ms.toFixed(1)} ms frames stepped down`);
  }
});

check('a missed refresh at 60 Hz and 4-refresh frames at 144 Hz count as late', () => {
  for (const ms of [HALF, 4000 / 144]) {
    const g = make(); g.start(0); fly(g, 10, steady(ms));
    assert.ok(g.state.stepsDown >= 1, `${ms.toFixed(1)} ms frames never judged late`);
  }
});

check('a GPU-bound flight steps down after the warm-up, one level at a time, keeps both steps and holds at the floor', () => {
  const g = make(); g.start(0);
  const { perSecond } = fly(g, 30, gpuBound);
  assert.equal(perSecond[2], 0, 'no change during the 3 s warm-up');
  assert.equal(g.level, 2, `reaches the floor: ${perSecond.join(' ')}`);
  const first = perSecond.indexOf(1), second = perSecond.indexOf(2);
  assert.ok(first >= 5 && first <= 7, `first step at ${first + 1} s: ${perSecond.join(' ')}`);
  assert.ok(second - first >= 4 && second - first <= 5, `2 s settle, the test window, then two more bad windows: ${perSecond.join(' ')}`);
  assert.deepEqual([g.state.stepsDown, g.state.kept, g.state.undone], [2, 2, 0]);
  assert.ok(perSecond.every((l, i) => !i || l - perSecond[i - 1] === 0 || l - perSecond[i - 1] === 1), 'never up, never two at once');
  return `levels per second: ${perSecond.join(' ')}`;
});

check('frames capped at 30 fps (30 Hz screen, Low Power Mode): each run is undone; after a second failed flight nothing is tried again', () => {
  const g = make(); g.start(0);
  let { t, perSecond } = fly(g, 30, steady(HALF));
  // level 1 does not help, so level 2 is tried against the same baseline; it does not help either: the run is undone
  assert.deepEqual([g.level, g.state.stepsDown, g.state.undone, g.state.kept], [0, 2, 1, 0], perSecond.join(' '));
  const undoneAt = perSecond.findLastIndex((l) => l > 0) + 1, dip = undoneAt - perSecond.indexOf(1);
  assert.ok(perSecond.slice(undoneAt).every((l) => l === 0), `no more steps in that flight: ${perSecond.join(' ')}`);
  assert.equal(g.state.usefulMax, 2, 'one failed run is not enough to give up (the load may have drifted)');
  g.end(); g.start(t += 2000);
  ({ t } = fly(g, 30, steady(HALF), t));
  assert.deepEqual([g.level, g.state.undone, g.state.usefulMax], [0, 2, 0], 'the second failed flight gives up');
  g.end(); g.start(t += 2000);
  ({ perSecond } = fly(g, 30, steady(HALF), t));
  assert.ok(perSecond.every((l) => l === 0), `later flights never step: ${perSecond.join(' ')}`);
  assert.equal(g.state.stepsDown, 4);
  return `one dip of ${dip} s on each of the first two flights, then full effects`;
});

check('level 1 helps and level 2 does not: holds at 1, and later flights step to 1 again but never to 2', () => {
  const machine = (i, t, level) => (level === 0 ? HALF : i % 2 ? HZ60 : HALF);
  const g = make(); g.start(0);
  let { t, perSecond } = fly(g, 40, machine);
  assert.deepEqual([g.level, g.state.kept, g.state.undone], [1, 1, 1], perSecond.join(' '));
  assert.ok(changes(perSecond) <= 3, `no flapping after the undo: ${perSecond.join(' ')}`);
  for (let flight = 2; flight <= 3; flight++) {
    g.end(); g.start(t += 2000);
    assert.equal(g.level, 0, 'take-off one level up');
    ({ t, perSecond } = fly(g, 40, machine, t));
    assert.equal(g.level, 1, `flight ${flight}: ${perSecond.join(' ')}`);
  }
  assert.equal(g.state.usefulMax, 1, 'level 2 given up after failing on two flights');
  ({ perSecond } = fly(g, 1, machine, t)); g.end(); g.start(t += 2000);
  ({ perSecond } = fly(g, 40, machine, t));
  assert.ok(!perSecond.includes(2), `then never tried again: ${perSecond.join(' ')}`);
});

check('level 1 removes nothing (tilt-shift off in Settings) and level 2 helps: goes on to level 2 and keeps it', () => {
  const g = make(); g.start(0);
  const { perSecond } = fly(g, 30, (i, t, level) => (level >= 2 ? HZ60 : HALF));
  assert.deepEqual([g.level, g.state.kept, g.state.undone, g.state.usefulMax], [2, 1, 0, 2], perSecond.join(' '));
  return `levels per second: ${perSecond.join(' ')}`;
});

check('120 and 144 Hz screens: a step that removes every late frame is kept, though whole refreshes barely move the mean', () => {
  for (const [hz, every] of [[120, 5], [120, 4], [144, 5]]) {
    const on = 3000 / hz, late = 4000 / hz;
    const g = make(); g.start(0);
    fly(g, 20, (i, t, level) => (level === 0 && i % every === 0 ? late : on));
    assert.deepEqual([g.level, g.state.kept, g.state.undone], [1, 1, 0], `${hz} Hz, 1 in ${every} late`);
  }
});

check('a stall (550-900 ms) in the test window does not undo a step that helped', () => {
  for (const stall of [550, 700, 900]) {
    const g = make(); g.start(0);
    let { t } = fly(g, 5.5, steady(HALF));
    assert.equal(g.level, 0);
    ({ t } = fly(g, 0.8, steady(HALF), t));
    assert.equal(g.level, 1, 'stepped by 6.3 s');
    ({ t } = fly(g, 2.3, steady(HZ60), t));               // settle, then into the test window
    g.frame(t += stall);
    fly(g, 10, steady(HZ60), t);
    assert.deepEqual([g.level, g.state.kept, g.state.undone], [1, 1, 0], `${stall} ms stall`);
  }
});

check('a stall in a test window that is still bad but clearly faster does not undo the step', () => {
  // level 1 takes a 30 fps machine to every other frame late (still a bad window, but a mean of 25 ms against 33)
  for (const stall of [500, 900]) {
    const g = make(); g.start(0);
    let { t } = fly(g, 6.3, (i, tt, level) => (level === 0 ? HALF : i % 2 ? HZ60 : HALF));
    assert.equal(g.level, 1);
    ({ t } = fly(g, 2.3, (i) => (i % 2 ? HZ60 : HALF), t));
    g.frame(t += stall);
    fly(g, 1.5, (i) => (i % 2 ? HZ60 : HALF), t);       // long enough to finish the test window, not for a new run
    // kept at level 1 itself: not failed and replaced by level 2 (the cascade would hide a lost step)
    assert.deepEqual([g.level, g.state.stepsDown, g.state.kept, g.state.undone], [1, 1, 1, 0], `${stall} ms stall: ${JSON.stringify(g.state)}`);
  }
});

check('a stall in the bad windows before a step does not let a 30 fps cap keep a step that did nothing', () => {
  for (const stall of [350, 600, 900]) for (const at of [3.5, 4.5, 5.2]) {
    const g = make(); g.start(0);
    let { t } = fly(g, at, steady(HALF));
    g.frame(t += stall);
    fly(g, 30, steady(HALF), t);
    assert.deepEqual([g.level, g.state.kept, g.state.undone], [0, 0, 1], `${stall} ms stall at ${at} s`);
  }
});

check('a level that helped before is not capped by one failed re-test, and the flight holds after the undo', () => {
  const g = make(); g.start(0);
  let { t } = fly(g, 30, gpuBound);                    // keeps 1 and 2
  for (let flight = 0; flight < 3; flight++) {         // now capped (Low Power Mode): each flight's run fails and is undone
    g.end(); g.start(t += 2000);
    const r = fly(g, 40, steady(HALF), t); t = r.t;
    assert.ok(changes(r.perSecond) <= 3, `one dip (down, maybe down again, back), no flapping: ${r.perSecond.join(' ')}`);
  }
  assert.ok(g.state.undone >= 2, `runs undone: ${g.state.undone}`);
  assert.equal(g.state.usefulMax, 2, 'levels proven earlier stay allowed, however many re-tests fail');
});

check('noisy, drifting load (400 seeded runs of three flights, vsync, stalls): useful levels are rarely given up', () => {
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const out = [];
  for (const gpu of [[30, 22, 14], [34, 23, 15], [24, 19, 12], [40, 30, 15]]) {   // GPU ms per frame by level (measured: 34/23/15)
    let wrong = 0, floor = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const r = rng(seed); let load = 1 + r() * 0.3, t = 0;
      const g = make();
      for (let flight = 0; flight < 3; flight++) {
        g.start(t);
        const end = t + 45000;
        while (t < end) {
          load = Math.min(1.5, Math.max(0.7, load + (r() - 0.5) * 0.02));
          let ms = gpu[g.level] * load * (0.9 + r() * 0.2);
          if (r() < 0.01) ms += 100 + r() * 400;
          t += Math.max(1, Math.ceil(ms / HZ60)) * HZ60;
          g.frame(t);
        }
        g.end(); t += 3000;
      }
      const u = g.state.usefulMax;
      // given up wrongly: the next level would still save a whole frame at the final load
      if (u < 2 && Math.ceil(gpu[u + 1] * load * 1.1 / HZ60) < Math.ceil(gpu[u] * load * 0.9 / HZ60)) wrong++;
      if (g.state.provenMax === 2) floor++;
    }
    assert.ok(wrong <= 8, `${gpu}: ${wrong} of 400 runs gave up a level that still helps`);
    out.push(`${gpu}: ${wrong} wrong, ${floor} proved level 2`);
  }
  return out.join('; ');
});

check('a very slow machine (13 fps, software GPU) is judged too and reaches the floor', () => {
  const g = make(); g.start(0);
  const { perSecond } = fly(g, 40, (i, t, level) => [75, 50, 30][level]);
  assert.equal(g.level, 2, `levels per second: ${perSecond.join(' ')}`);
  return `floor after ${perSecond.indexOf(2) + 1} s`;
});

check('an overloaded machine (frames of 150-450 ms) counts them as late, not as pauses, and reaches the floor', () => {
  const g = make(); g.start(0);
  const { perSecond } = fly(g, 90, (i, t, level) => [450, 300, 150][level]);
  assert.equal(g.level, 2, `levels per second: ${perSecond.join(' ')}`);
  return `floor after ${perSecond.indexOf(2) + 1} s`;
});

check('single hitches (one 50 ms frame every 2 s): no step', () => {
  const g = make(); g.start(0);
  fly(g, 60, (i) => (i % 120 === 119 ? 50 : HZ60));
  assert.equal(g.state.stepsDown, 0);
});

check('one slow second at any offset into the flight (30, 20 or 15 fps), then clean: no step', () => {
  let runs = 0;
  for (const fps of [30, 20, 15]) for (let lead = 3; lead < 9; lead += 0.05) {
    const g = make(); g.start(0);
    const a = fly(g, lead, steady(HZ60));
    const b = fly(g, 1, steady(1000 / fps), a.t);
    fly(g, 10, steady(HZ60), b.t);
    assert.equal(g.state.stepsDown, 0, `stepped down: ${fps} fps for 1 s starting ${lead.toFixed(2)} s into the flight`);
    runs++;
  }
  return `${runs} offsets`;
});

check('about 20% of frames late, sustained: steps down, and the step is kept because it helps', () => {
  const g = make(); g.start(0);
  fly(g, 20, (i, t, level) => (level === 0 && i % 5 === 0 ? HALF : HZ60));
  assert.equal(g.level, 1); assert.equal(g.state.kept, 1);
});

check('10% late (below the threshold): no step', () => {
  const g = make(); g.start(0);
  fly(g, 30, (i) => (i % 10 === 0 ? HALF : HZ60));
  assert.equal(g.state.stepsDown, 0);
});

check('pauses (tab hidden, debugger, 1.5 s) are not late frames and restart judging', () => {
  const seq = (i) => (i % 5 === 4 ? 1500 : HZ60);      // a fifth of the intervals are pauses
  const g = make(); g.start(0);
  fly(g, 60, seq);
  assert.equal(g.state.stepsDown, 0);
  assert.ok(Number.isNaN(g.state.lastLateFraction), 'each pause restarts judging, so no window completes');
  // control: with pause handling off the same sequence steps down, so the check above exercises the pause path
  const c = make({ gapMs: Infinity }); c.start(0); fly(c, 60, seq);
  assert.ok(c.state.stepsDown >= 1, 'control did not step down');
});

check('never steps up during a flight once a step is kept, even when frames recover', () => {
  const g = make(); g.start(0);
  const a = fly(g, 30, gpuBound);
  assert.equal(g.level, 2);
  const b = fly(g, 60, steady(1000 / 120), a.t);
  assert.ok(b.perSecond.every((l) => l === 2), b.perSecond.join(' '));
});

check('landing holds the level; each take-off starts one level higher, so a recovered machine climbs back a step per flight', () => {
  const g = make(); g.start(0);
  let { t } = fly(g, 30, gpuBound);
  assert.equal(g.level, 2);
  g.end();
  assert.equal(g.level, 2, 'held while landed');
  g.start(t + 5000); assert.equal(g.level, 1, 'next flight starts one higher');
  ({ t } = fly(g, 20, steady(HZ60), t + 5000)); g.end();
  g.start(t + 5000); assert.equal(g.level, 0, 'and the one after that at full quality');
});

check('a machine that is still slow steps straight back down after the warm-up (one change per flight)', () => {
  const g = make(); g.start(0);
  let { t } = fly(g, 30, gpuBound); g.end();
  g.start(t + 1000);
  const r = fly(g, 30, gpuBound, t + 1000);
  assert.equal(g.level, 2);
  assert.equal(changes(r.perSecond), 1, `levels ${r.perSecond.join(' ')}`);
});

check('frames while landed are ignored (life steps at 8 Hz look like a slow flight)', () => {
  const g = make();
  fly(g, 30, steady(125));
  assert.equal(g.level, 0); assert.equal(g.state.flying, false);
});

check('the settle time after a step is honoured (no judging during it)', () => {
  const g = make({ settleMs: 10000 }); g.start(0);
  const { perSecond } = fly(g, 40, gpuBound);
  const first = perSecond.indexOf(1);
  const gap = perSecond.indexOf(2) - first;
  assert.ok(first >= 0 && gap >= 12 && gap <= 13, `settle 10 s, the test window, then two more bad windows (${gap} s): ${perSecond.join(' ')}`);
});

check('landing while a step is under test withdraws it, without counting it as kept or undone', () => {
  const g = make(); g.start(0);
  const { t } = fly(g, 6.5, gpuBound);
  assert.equal(g.level, 1, 'stepped by 6.5 s');
  assert.equal(g.state.testing, true);
  g.end();
  assert.equal(g.level, 0, 'the untested step is withdrawn: the landed map is back at the tested level');
  g.start(t + 1000);
  const r = fly(g, 5, steady(HALF), t + 1000);         // past the warm-up: two windows judged, no new step yet
  assert.ok(!Number.isNaN(g.state.lastLateFraction), 'a window completed after take-off');
  assert.deepEqual([g.level, g.state.kept, g.state.undone, g.state.usefulMax], [0, 0, 0, 2], r.perSecond.join(' '));
});

check('a resize while a step is under test withdraws it and restarts judging', () => {
  const g = make(); g.start(0);
  const { t } = fly(g, 6.5, gpuBound);
  assert.deepEqual([g.level, g.state.testing], [1, true]);
  g.resized(t);
  assert.deepEqual([g.level, g.state.testing], [0, false]);
});

check('force() sets a level in range and restarts judging', () => {
  const g = make(); g.start(0);
  g.force(5, 0); assert.equal(g.level, 2);
  g.force(-1, 0); assert.equal(g.level, 0);
  let { t } = fly(g, 4.5, steady(HALF));                // judged from 2 s (the force's settle time): two bad windows, no step yet
  assert.equal(g.level, 0);
  g.force(0, t);                                       // clears the run of bad windows and holds for the settle time
  ({ t } = fly(g, 4.5, steady(HALF), t));               // settle 2 s + two windows: still no step
  assert.equal(g.level, 0, 'judging did not restart after force()');
  fly(g, 2, steady(HALF), t);                          // the third bad window after the restart steps down
  assert.equal(g.level, 1);
});

check('wiring: toast only after a kept step, Auto again mid-flight never shows the old level, landing and resizes apply', () => {
  let frameCb, settingsCb; const toasts = [], applied = [];
  const map = { settings: { quality: 'auto' }, on: (e, f) => { frameCb = f; return () => {}; }, onSettings: (f) => { settingsCb = f; return () => {}; }, toast: (m) => toasts.push(m) };
  let flying = true;
  const a = createAdaptiveQuality(map, { setAdaptiveLevel: (l) => applied.push(l) }, () => flying, 2);
  let t = 0;
  const run = (secs, interval) => { const end = t + secs * 1000; let i = 0; while (t < end) { t += interval(i++, t, a.governor.level); frameCb({ time: t }); } };
  run(6.5, steady(HALF));
  assert.equal(applied.at(-1), 1, 'stepped'); assert.equal(toasts.length, 0, 'no toast for an untested step');
  run(4, steady(HZ60));
  assert.equal(toasts.length, 1, 'toast once the step is kept');
  // High mid-flight: level 0 at once; back to Auto: one level up from the governor's level, never the old one
  map.settings.quality = 'high'; settingsCb(); assert.equal(applied.at(-1), 0);
  run(1, steady(HZ60));
  map.settings.quality = 'auto'; const before = applied.length; settingsCb();
  assert.ok(applied.slice(before).every((l) => l === 0), `pushed ${applied.slice(before)} after Auto`);
  run(1, steady(HZ60));
  // a step under test, then landing: the landed map gets the tested level
  run(7, steady(HALF)); assert.ok(applied.at(-1) > 0); assert.equal(a.governor.state.testing, true);   // 30 fps at any level: testing 1, then 2
  flying = false; run(0.1, steady(HZ60)); assert.equal(applied.at(-1), 0, 'landing withdrew the untested step');
  // resize while testing
  flying = true; run(7, steady(HALF)); assert.equal(a.governor.state.testing, true);
  listeners.resize(); assert.equal(applied.at(-1), a.governor.level); assert.equal(a.governor.state.testing, false);
  assert.equal(toasts.length, 1, 'still told only once');
  a.dispose(); assert.equal(listeners.resize, undefined);
});

const failed = results.filter((x) => !x).length;
console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} governor checks passed`);
process.exit(failed ? 1 : 0);
