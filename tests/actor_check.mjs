// Browser checks for the goose actor (web/src/depth/Actor.ts): camera alignment, wall collision + slide, soft trees,
// terrain following, occlusion stipple, shadow placement, pickups and controls. Starts Vite on port 5183 (or reuses a
// server already there), drives Chromium (WebGL2 via SwiftShader) with Playwright and writes
// docs/screenshots/actor_{flight,occluded,shadow_roof}.png (1280 x 800).
// Run: node tests/actor_check.mjs
//
// Simulation checks use the deterministic hook actor.debug.step(dt, input) with the live loop's stepping disabled, so
// results do not depend on the (slow, software) frame rate. Test sites are searched in the collision data at run time
// (E5 facade, densest woodland, steepest flyable slope, open lawn) so the checks follow regenerated data.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5183;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const DANA_PORTER = [388.3, 409.0];   // landmarks.json canvas point (roof)
const E5 = [542.4, -513.4];
// goose collision sphere and land skim height, read from the sources (FLIGHT.radius / FLIGHT.clearance in flight.ts)
const DIMS = readFileSync(path.join(ROOT, 'web', 'src', 'depth', 'gooseDims.ts'), 'utf8');
const num = (re, src) => Number(src.match(re)[1]);
const RADIUS = num(/GOOSE_BODY_RADIUS_M = ([\d.]+)/, DIMS) * num(/GOOSE_DISPLAY_SCALE = ([\d.]+)/, DIMS);
const SKIM = RADIUS + num(/clearance: GOOSE_BODY_RADIUS_M \* GOOSE_SCALE \+ ([\d.]+)/,
  readFileSync(path.join(ROOT, 'web', 'src', 'depth', 'flight.ts'), 'utf8'));

let failures = 0;
let occlusionPoint = null;   // found by the occlusion check, reused at dpr 2
async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS ${name}${detail ? `  (${detail})` : ''}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}: ${e?.message ?? e}`);
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const f2 = (v) => Number(v).toFixed(2);

async function serverUp() {
  try { return (await fetch(BASE)).ok; } catch { return false; }
}
async function startServer() {
  if (await serverUp()) return null;
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
  for (let k = 0; k < 80; k++) {
    if (await serverUp()) return proc;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('vite did not start');
}

/** Install page-side helpers (window.__at) once the app has booted. */
async function installHelpers(page) {
  await page.evaluate(() => {
    const T = window.__tinyWaterloo, map = T.map, A = T.actor, D = A.debug, F = map.frame;
    const sun = F.sun;
    const at = {
      /** World point of the visible surface at a canvas px (loads the height tile first). */
      async surfaceWorld(cx, cy) {
        const [i, j] = F.tileOf(cx, cy);
        const t = await map.getHeightTile(i, j);
        if (!t) return null;
        const n = F.heightPx, k = n / F.F;
        const z = t[Math.floor((cy - j * F.F) * k) * n + Math.floor((cx - i * F.F) * k)];
        return z === z ? F.canvasToWorld(cx, cy, z) : null;
      },
      /** Run n steps of dt with an input, recording the state after each. */
      run(n, dt, input) {
        const out = [];
        for (let k = 0; k < n; k++) { const ev = D.step(dt, input); out.push({ ...D.getState(), wall: !!ev.wall }); }
        return out;
      },
      /** Horizontal distance (<= r, 5 cm steps, 64 directions) to the nearest building column taller than s.z. */
      clearance(s, r) {
        const col = D.collision;
        let best = r;
        for (let a = 0; a < 64; a++) {
          const dx = Math.cos((a * Math.PI) / 32), dy = Math.sin((a * Math.PI) / 32);
          for (let d = 0; d < best; d += 0.05)
            if (col.kind(s.x + dx * d, s.y + dy * d) & 1 && col.solidTop(s.x + dx * d, s.y + dy * d) > s.z) { best = d; break; }
        }
        return best;
      },
      /** Screen px of a world point through the map's own transform (frame + view), for comparisons. */
      mapScreen(x, y, z) { const c = F.worldToCanvas(x, y, z); return map.canvasToScreen(c.cx, c.cy); },
      sun,
    };
    window.__at = at;
  });
}

async function startFlight(page, at) {
  await page.evaluate((at) => window.__tinyWaterloo.actor.start(at ? { cx: at[0], cy: at[1] } : undefined), at);
  // the intro camera flight ends when the view settles; then the simulation clock starts
  await page.waitForFunction(() => window.__tinyWaterloo.actor.debug.getState().time > 0, null, { timeout: 30000, polling: 100 });
  await page.evaluate(() => window.__tinyWaterloo.actor.debug.setAutoStep(false));
}

/** Let a couple of real frames render (follow camera, DOM HUD) before a screenshot. */
async function frames(page, n = 3) {
  await page.evaluate((n) => new Promise((res) => {
    const m = window.__tinyWaterloo.map; let k = 0;
    const off = m.on('frame', () => { if (++k >= n) { off(); res(); } });
    m.invalidate();
  }), n);
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ args: GL_ARGS });
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    await page.goto(`${BASE}#${DANA_PORTER[0]},${DANA_PORTER[1]},1.6`);
    await page.waitForFunction(() => window.__tinyWaterloo?.actor?.debug, null, { timeout: 30000 });
    await installHelpers(page);

    await check('start: flight becomes active, HUD shown, map UI hidden and pan locked', async () => {
      await startFlight(page, DANA_PORTER);
      await page.waitForFunction(() => document.getElementById('app').classList.contains('actor-active'), null, { timeout: 3000 });
      const r = await page.evaluate(() => ({
        active: window.__tinyWaterloo.actor.active,
        hud: !document.querySelector('.goose-hud').hidden,
        land: !!document.querySelector('.goose-hud .gh-land'),
        feathers: document.querySelector('.gh-feathers .gh-val').textContent,
        canvases: [...window.__tinyWaterloo.actor.element.querySelectorAll('canvas')].map((c) => `${c.className}:${getComputedStyle(c).mixBlendMode}`),
      }));
      assert(r.active && r.hud && r.land, JSON.stringify(r));
      assert(r.canvases.join() === 'actor-shadow:multiply,actor-goose:normal', r.canvases.join());
      return `HUD feathers ${r.feathers}; ${r.canvases.join(', ')}`;
    });

    await check('alignment: three.js camera projects 3 known surface points onto map.canvasToScreen (< 0.5 px) at 3 zooms', async () => {
      const r = await page.evaluate(async ([dp, e5]) => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at;
        const pts = [['Dana Porter roof', dp], ['E5 roof', e5], ['SLC ground/roof', [-665.7, 97.4]]];
        let worst = 0; const rows = [];
        for (const zoom of [0.7, 1.6, 2.5]) {
          T.map.setView({ zoom });
          for (const [name, c] of pts) {
            const w = await at.surfaceWorld(c[0], c[1]);
            await D.teleport(w[0] + 12, w[1] - 7, w[2] + 30, 0.3);     // camera centred near (not on) the point
            const p = D.projectToScreen(w[0], w[1], w[2]);
            const q = T.map.canvasToScreen(c[0], c[1]);
            const e = Math.hypot(p[0] - q[0], p[1] - q[1]);
            worst = Math.max(worst, e);
            rows.push(`${name}@${zoom}: z=${w[2].toFixed(2)} err=${e.toExponential(1)}`);
          }
        }
        return { worst, rows };
      }, [DANA_PORTER, E5]);
      assert(r.worst < 0.5, r.rows.join('; '));
      return `max error ${r.worst.toExponential(2)} px over ${r.rows.length} projections`;
    });

    await check('collision: flying into the Engineering 5 wall stops at it and slides along it (no penetration)', async () => {
      const r = await page.evaluate(async ([e5, R]) => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at, col = D.collision, F = T.map.frame;
        const roof = await at.surfaceWorld(e5[0], e5[1]);
        await col.ensureAround(roof[0], roof[1], 200);
        // find a straight facade: march out from the roof point until the building ends; the wall must run straight for
        // 60 m in the slide direction with open, flyable, tree-free ground 24 m deep in front of it
        let site = null;
        const building = (x, y) => col.kind(x, y) & 1 && col.solidTop(x, y) > col.ground(x, y) + 14;
        for (let a = 0; a < 32 && !site; a++) {
          const dx = Math.cos((a * Math.PI) / 16), dy = Math.sin((a * Math.PI) / 16);
          let d = 0;
          while (d < 120 && col.kind(roof[0] + dx * d, roof[1] + dy * d) & 1) d += 0.25;
          if (d >= 120) continue;
          const wall = [roof[0] + dx * d, roof[1] + dy * d];
          for (const sign of [1, -1]) {
            const sl = [dy * sign, -dx * sign];   // slide direction along the facade
            let ok = true;
            for (let e = -5; e <= 55 && ok; e += 1) {
              const wx = wall[0] + sl[0] * e, wy = wall[1] + sl[1] * e;
              // facade continues (within a few metres: a diagonal wall is a staircase of 2 m cells)
              if (![1, 2, 3, 4, 5].some((q) => building(wx - dx * q, wy - dy * q))) ok = false;
              for (let q = 4; q <= 24 && ok; q += 1.5) {
                const fx = wx + dx * q, fy = wy + dy * q;
                if (col.kind(fx, fy) & 1 || col.canopyTop(fx, fy) === col.canopyTop(fx, fy) || !D.inside(fx, fy, col.ground(fx, fy) + 9)) ok = false;
              }
            }
            if (ok) { site = { dir: [dx, dy], wall, sign, g: col.ground(wall[0] + dx * 20, wall[1] + dy * 20) }; break; }
          }
        }
        if (!site) return { error: 'no straight open facade found around E5' };
        const { dir, wall, g, sign } = site;
        const start = [wall[0] + dir[0] * 22, wall[1] + dir[1] * 22, g + 9];
        // into the wall, 35 degrees oblique, toward the slide direction
        const heading = Math.atan2(-dir[1], -dir[0]) + sign * (35 * Math.PI) / 180;
        await D.teleport(start[0], start[1], start[2], heading);
        const states = at.run(240, 1 / 60, {});
        const first = states.findIndex((s) => s.wall);
        if (first < 0) return { error: 'no wall hit' };
        const hit = states[first].lastHit, n = hit.normal, t = [-n[1], n[0]];
        let maxAboveZ = -Infinity, clear = Infinity;
        for (const s of states) {
          maxAboveZ = Math.max(maxAboveZ, col.solidTop(s.x, s.y) - s.z);
          clear = Math.min(clear, at.clearance(s, R + 0.5));
        }
        // velocity into the facade (along -dir) before and after the first contact
        const intoSpeed = (list) => list.reduce((a, s) => a - (s.vx * dir[0] + s.vy * dir[1]), 0) / list.length;
        const before = intoSpeed(states.slice(0, first)), after = intoSpeed(states.slice(first + 30));
        const last = states[states.length - 1];
        const slide = Math.abs((last.x - hit.x) * t[0] + (last.y - hit.y) * t[1]);
        const roofZ = col.solidTop(wall[0] - dir[0] * 3, wall[1] - dir[1] * 3);
        return { hitAt: first / 60, normal: n, dir, maxAboveZ, clear, before, after, slide, z: last.z, roofZ, speed: last.speed, hitKind: hit.kind };
      }, [E5, RADIUS]);
      assert(!r.error, r.error);
      assert(r.hitKind === 'wall', `hit kind ${r.hitKind}`);
      assert(r.maxAboveZ < 0, `solidTop rose ${f2(r.maxAboveZ)} m above the goose`);
      // the sweep tests 8 ring points on the sphere: between them a straight facade can come to R cos(22.5 deg) = 0.92 R
      assert(r.clear >= RADIUS * 0.875, `came within ${f2(r.clear)} m of the facade (sphere radius ${f2(RADIUS)} m)`);
      assert(r.after < 0.5, `still moving ${f2(r.after)} m/s into the facade after contact (was ${f2(r.before)})`);
      assert(r.slide > 8, `slid only ${f2(r.slide)} m along the wall`);
      assert(r.z < r.roofZ - 5, 'goose climbed over the building instead of hitting the facade');
      return `hit after ${f2(r.hitAt)} s, normal (${f2(r.normal[0])}, ${f2(r.normal[1])}) vs approach dir (${f2(r.dir[0])}, ${f2(r.dir[1])}); ` +
        `speed into the facade ${f2(r.before)} -> ${f2(r.after)} m/s, slid ${f2(r.slide)} m at ${f2(r.speed)} m/s, max solidTop-z ${f2(r.maxAboveZ)} m, ` +
        `closest building column ${f2(r.clear)} m (sphere ${f2(RADIUS)} m)`;
    });

    await check('trees: inside a crown the goose slows to ~40% but is not blocked', async () => {
      const r = await page.evaluate(async () => {
        const D = window.__tinyWaterloo.actor.debug, at = window.__at, col = D.collision;
        await col.ensure(-900, -900, 1500, 400);
        // densest canopy (>= 7 m crowns) without buildings, then the direction with the longest canopy run through it
        let best = null;
        for (let x = -900; x < 1500; x += 6)
          for (let y = -900; y < 400; y += 6) {
            const g = col.ground(x, y);
            if (g !== g || !D.inside(x, y, g + 5)) continue;
            let n = 0, bld = 0;
            for (let dx = -14; dx <= 14; dx += 2) for (let dy = -14; dy <= 14; dy += 2) {
              if (col.canopyTop(x + dx, y + dy) - col.ground(x + dx, y + dy) >= 7) n++;
              if (col.kind(x + dx, y + dy) & 1) bld++;
            }
            if (!bld && (!best || n > best.n)) best = { x, y, n };
          }
        let line = null;
        for (let a = 0; a < 16; a++) {
          const dx = Math.cos((a * Math.PI) / 8), dy = Math.sin((a * Math.PI) / 8);
          let run = 0, ok = true;
          for (let e = -45; e <= 60; e += 1) {
            const qx = best.x + dx * e, qy = best.y + dy * e;
            if (col.kind(qx, qy) & 1 || !D.inside(qx, qy, col.ground(qx, qy) + 5)) ok = false;
            if (e >= 0 && e <= 30 && col.canopyTop(qx, qy) > col.ground(qx, qy) + 6) run++;
          }
          if (ok && (!line || run > line.run)) line = { dir: [dx, dy], run };
        }
        const { dir } = line;
        const s0 = [best.x - dir[0] * 40, best.y - dir[1] * 40];
        await D.teleport(s0[0], s0[1], col.ground(s0[0], s0[1]) + 5, Math.atan2(dir[1], dir[0]));
        const states = at.run(900, 1 / 60, {});
        const inside = states.filter((s) => s.inCanopy);
        const minSpeed = Math.min(...inside.map((s) => s.speed));
        const last = states[states.length - 1];
        const progress = (last.x - best.x) * dir[0] + (last.y - best.y) * dir[1];
        let monotonic = true;
        for (let k = 1; k < states.length; k++)
          if ((states[k].x - states[k - 1].x) * dir[0] + (states[k].y - states[k - 1].y) * dir[1] < 0) monotonic = false;
        return { site: best, run: line.run, canopySteps: inside.length, minSpeed, walls: states.filter((s) => s.wall).length,
          progress, monotonic, hit: last.lastHit?.kind ?? null };
      });
      assert(r.canopySteps > 60, `only ${r.canopySteps} steps inside canopy`);
      assert(r.minSpeed < 0.5 * 14 && r.minSpeed > 0.3 * 14, `min speed in canopy ${f2(r.minSpeed)} m/s`);
      assert(r.walls === 0 && r.monotonic, `blocked: walls ${r.walls}, monotonic ${r.monotonic}`);
      assert(r.progress > 30, `ended only ${f2(r.progress)} m past the wood centre`);
      return `woods at (${r.site.x}, ${r.site.y}) ${r.run} m canopy run; ${f2(r.canopySteps / 60)} s in crowns, min speed ${f2(r.minSpeed)} m/s ` +
        `(${f2((r.minSpeed / 14) * 100)}% of cruise), passed ${f2(r.progress)} m beyond the centre, no blocking contacts`;
    });

    await check('terrain: on the steepest flyable slope the altitude floor follows the ground (skims, never penetrates)', async () => {
      const r = await page.evaluate(async (SKIM) => {
        const D = window.__tinyWaterloo.actor.debug, at = window.__at, col = D.collision;
        await col.ensure(-1200, -1500, 3500, 1200);
        const clearAlong = (x, y, ux, uy) => {
          for (let e = -40; e <= 40; e += 2) {
            const qx = x + ux * e, qy = y + uy * e;
            for (const off of [-3, 0, 3]) {
              const px = qx - uy * off, py = qy + ux * off;
              if (col.kind(px, py) & 1 || col.canopyTop(px, py) === col.canopyTop(px, py)) return false;
            }
            if (!D.inside(qx, qy, col.ground(qx, qy) + 3)) return false;
          }
          return true;
        };
        let best = null;
        for (let x = -1200; x < 3500; x += 4)
          for (let y = -1500; y < 1200; y += 4) {
            const g = col.ground(x, y);
            if (g !== g) continue;
            const gx = (col.ground(x + 5, y) - col.ground(x - 5, y)) / 10, gy = (col.ground(x, y + 5) - col.ground(x, y - 5)) / 10;
            const sl = Math.hypot(gx, gy);
            if (!(sl > (best?.sl ?? 0))) continue;
            const ux = gx / sl, uy = gy / sl;
            if (clearAlong(x, y, ux, uy)) best = { x, y, sl, u: [ux, uy] };
          }
        const { u } = best;
        const s0 = [best.x - u[0] * 32, best.y - u[1] * 32];
        await D.teleport(s0[0], s0[1], col.ground(s0[0], s0[1]) + SKIM, Math.atan2(u[1], u[0]));
        const states = at.run(270, 1 / 60, { climb: -1 });   // dive: press against the floor while climbing the slope
        const gaps = states.map((s) => s.z - col.solidTop(s.x, s.y));
        const settled = gaps.slice(30);
        const first = states[30], last = states[states.length - 1];
        return {
          site: best, minGap: Math.min(...gaps), maxDev: Math.max(...settled.map((g) => Math.abs(g - SKIM))),
          meanDev: settled.reduce((a, g) => a + Math.abs(g - SKIM), 0) / settled.length,
          rise: last.z - first.z, groundRise: col.solidTop(last.x, last.y) - col.solidTop(first.x, first.y),
          dist: Math.hypot(last.x - first.x, last.y - first.y),
        };
      }, SKIM);
      const deg = (Math.atan(r.site.sl) * 180) / Math.PI;
      assert(r.minGap >= RADIUS, `sphere (r ${f2(RADIUS)} m) dipped to ${f2(r.minGap)} m above the ground`);
      assert(r.maxDev < 0.5 && r.meanDev < 0.25, `floor tracking deviation max ${f2(r.maxDev)} mean ${f2(r.meanDev)} m`);
      assert(Math.abs(r.rise - r.groundRise) < 0.5 && r.groundRise > 2, `rise ${f2(r.rise)} vs ground ${f2(r.groundRise)}`);
      return `slope ${f2(deg)} deg at (${r.site.x}, ${r.site.y}); over ${f2(r.dist)} m the goose rose ${f2(r.rise)} m vs ground ${f2(r.groundRise)} m; ` +
        `height above ground min ${f2(r.minGap)} m, deviation from ${f2(SKIM)} m skim max ${f2(r.maxDev)} / mean ${f2(r.meanDev)} m`;
    });

    await check('occlusion: behind the Dana Porter tower the goose is mostly hidden and drawn as a stipple + outline', async () => {
      const r = await page.evaluate(async (dp) => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at, col = D.collision, F = T.map.frame;
        const roof = await at.surfaceWorld(dp[0], dp[1]);
        await D.teleport(roof[0], roof[1], roof[2] + 30, 0.4);   // centres the height window on the tower
        // behind the tower (farther from the camera) and below its roof: a free point whose whole body neighbourhood is
        // covered by the tower in the decoded heights (visible surface nearer the camera by > 1 m everywhere)
        const hiddenBy = (x, y, z) => {
          for (const [ox, oy, oz] of [[0, 0, 0], [3, 0, 0], [-3, 0, 0], [0, 3, 0], [0, -3, 0], [0, 0, 1], [0, 0, -1]]) {
            const c = F.worldToCanvas(x + ox, y + oy, z + oz), h = D.windowHeight(c.cx, c.cy);
            if (!(h > z + 5 && F.depthAt(c.cx, c.cy, h) - c.depth > 1)) return false;
          }
          return true;
        };
        let p = null;
        for (let z = roof[2] - 4; z > 6 && !p; z -= 1)
          for (let dx = -45; dx <= 45 && !p; dx += 1.5)
            for (let dy = -45; dy <= 45 && !p; dy += 1.5) {
              const x = roof[0] + dx, y = roof[1] + dy;
              if (col.solidTop(x, y) < z - 2.5 && at.clearance({ x, y, z }, 2.5) >= 2.5 && D.inside(x, y, z) && hiddenBy(x, y, z)) p = [x, y, z];
            }
        if (!p) return { error: 'no free point behind the tower' };
        T.map.setView({ zoom: 2.5 });
        await D.teleport(p[0], p[1], p[2], 0.4);
        const hidden = D.occludedFraction();
        const depthBehind = (() => { const c = F.worldToCanvas(...p); return F.depthAt(c.cx, c.cy, D.windowHeight(c.cx, c.cy)) - c.depth; })();
        const stipple = D.stippleStats();
        // control: the same spot raised above the roof is not occluded
        await D.teleport(p[0], p[1], roof[2] + 20, 0.4);
        const open = D.occludedFraction();
        await D.teleport(p[0], p[1], p[2], 0.4);
        return { p, roofZ: roof[2], hidden, stipple, open, behind: roof[2] - p[2], depthBehind };
      }, DANA_PORTER);
      assert(!r.error, r.error);
      occlusionPoint = r.p;
      assert(r.hidden > 0.5, `occluded fraction ${f2(r.hidden)}`);
      assert(r.stipple.fill > 20 && r.stipple.outline > 10, `stipple ${JSON.stringify(r.stipple)}`);
      assert(r.open < 0.05, `above the roof the goose is still ${f2(r.open)} occluded`);
      await frames(page);
      await page.screenshot({ path: path.join(SHOTS, 'actor_occluded.png') });
      return `goose at (${r.p.map((v) => v.toFixed(1)).join(', ')}), ${f2(r.behind)} m below the roof and ${f2(r.depthBehind)} m behind the tower's visible surface: occluded ${f2(r.hidden * 100)}%, ` +
        `screen px stipple ${r.stipple.fill} / outline ${r.stipple.outline} / shaded ${r.stipple.shaded}; above the roof ${f2(r.open * 100)}%`;
    });

    await check('shadow: lands on a lawn, a roof and a tower facade where the sun ray through the goose meets the surface', async () => {
      const r = await page.evaluate(async (dp) => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at, col = D.collision, F = T.map.frame, sun = at.sun;
        await col.ensure(-700, -800, 1300, 400);
        const flatOpen = (x, y, r, top) => {
          for (let dx = -r; dx <= r; dx += 2) for (let dy = -r; dy <= r; dy += 2) {
            const s = col.solidTop(x + dx, y + dy);
            if (!(Math.abs(s - top) < 0.3) || col.canopyTop(x + dx, y + dy) === col.canopyTop(x + dx, y + dy)) return false;
          }
          return true;
        };
        // sun ray from the receiver up to the goose must be clear (no other caster in between)
        const rayClear = (S, h) => { for (let t = 1; t < h / sun[2]; t += 0.5) { const q = [S[0] + sun[0] * t, S[1] + sun[1] * t, S[2] + sun[2] * t]; if (col.obstacleTop(q[0], q[1]) > q[2]) return false; } return true; };
        // expected centre: where the sun ray through the goose's silhouette centroid (read from the light pass, so the
        // wing pose does not matter) first meets the solid surface, marched in the collision field
        const rayHit = (o) => {
          for (let t = 0; t < 200; t += 0.02) {
            const q = [o[0] - sun[0] * t, o[1] - sun[1] * t, o[2] - sun[2] * t];
            if (col.solidTop(q[0], q[1]) >= q[2]) return q;
          }
          return null;
        };
        const measure = async (S, h, zoom) => {
          T.map.setView({ zoom });
          const t = h / sun[2];
          await D.teleport(S[0] + sun[0] * t, S[1] + sun[1] * t, S[2] + h, 1.0);
          const c = D.shadowCentreScreen();
          const hit = rayHit(D.shadowRay());
          const e = at.mapScreen(hit[0], hit[1], hit[2]);
          const v = T.map.getView();
          const cc = [v.cx + (c.x - innerWidth / 2) / v.zoom, v.cy + (c.y - innerHeight / 2) / v.zoom];   // centroid back to canvas px
          return { err: Math.hypot(c.x - e[0], c.y - e[1]), errArtPx: Math.hypot(c.x - e[0], c.y - e[1]) / zoom, pixels: c.pixels,
            receiverZ: D.windowHeight(cc[0], cc[1]), S, hitZ: hit[2] };
        };
        // lawn: open, flat ground with nothing within 16 m, visible from the camera at its own canvas point
        let lawn = null;
        for (let x = -600; x < 1200 && !lawn; x += 8)
          for (let y = -700; y < 300 && !lawn; y += 8) {
            const g = col.ground(x, y);
            if (g !== g || col.kind(x, y) & 5 || !D.inside(x, y, g + 20) || !flatOpen(x, y, 16, g) || !rayClear([x, y, g], 20)) continue;
            const c = F.worldToCanvas(x, y, g);
            const w = await at.surfaceWorld(c.cx, c.cy);
            if (w && Math.abs(w[2] - g) < 0.3) lawn = [x, y, g];
          }
        const roof = await at.surfaceWorld(dp[0], dp[1]);
        // the roof receiver: the flat roof centre (shrink toward the footprint centre found by marching)
        let rc = [roof[0], roof[1]];
        const edge = (dx, dy) => { let d = 0; while (d < 80 && Math.abs(col.solidTop(rc[0] + dx * d, rc[1] + dy * d) - roof[2]) < 0.3) d += 0.5; return d; };
        rc = [rc[0] + (edge(1, 0) - edge(-1, 0)) / 2, rc[1] + (edge(0, 1) - edge(0, -1)) / 2];
        const roofOk = flatOpen(rc[0], rc[1], 6, roof[2]);
        const a = await measure(lawn, 20, 2);
        // facade: the tower's south-west face (lit by the afternoon sun and seen by the camera), at mid height
        const sw = [-Math.SQRT1_2, -Math.SQRT1_2];
        let d = 0;
        while (d < 80 && col.solidTop(rc[0] + sw[0] * d, rc[1] + sw[1] * d) > roof[2] - 1) d += 0.25;
        const fz = (roof[2] + col.solidTop(rc[0] + sw[0] * (d + 3), rc[1] + sw[1] * (d + 3))) / 2 + 2;
        const facade = await measure([rc[0] + sw[0] * (d + 0.3), rc[1] + sw[1] * (d + 0.3), fz], 8, 2);
        const b = await measure([rc[0], rc[1], roof[2]], 15, 2);
        return { lawn: a, roof: b, facade, roofOk, roofZ: roof[2] };
      }, DANA_PORTER);
      assert(r.roofOk, 'Dana Porter roof centre is not flat within 6 m');
      for (const [name, m, z] of [['lawn', r.lawn, r.lawn.S[2]], ['roof', r.roof, r.roofZ], ['facade', r.facade, r.facade.S[2]]]) {
        assert(m.pixels > 40, `${name}: only ${m.pixels} shadow px`);
        assert(m.errArtPx < 0.75, `${name}: centroid ${f2(m.err)} screen px (${f2(m.errArtPx)} artwork px) from the sun-ray point`);
        // on a facade the visible surface height changes ~0.4 m per artwork px, so allow one more pixel there
        assert(Math.abs(m.receiverZ - z) < (name === 'facade' ? 1.0 : 0.5), `${name}: shadow centre lies on z=${f2(m.receiverZ)}, expected ${f2(z)}`);
      }
      await frames(page);
      await page.screenshot({ path: path.join(SHOTS, 'actor_shadow_roof.png') });
      return `lawn at (${r.lawn.S.map((v) => v.toFixed(0)).join(', ')}): ${f2(r.lawn.errArtPx)} art px off, receiver z ${f2(r.lawn.receiverZ)}; ` +
        `roof z ${f2(r.roofZ)}: ${f2(r.roof.errArtPx)} art px off, receiver z ${f2(r.roof.receiverZ)} (${r.roof.pixels} px); ` +
        `tower facade at z ${f2(r.facade.S[2])}: ${f2(r.facade.errArtPx)} art px off, receiver z ${f2(r.facade.receiverZ)}`;
    });

    await check('feathers: flying through one collects it once, persists it and announces it', async () => {
      const r = await page.evaluate(async () => {
        const T = window.__tinyWaterloo, D = T.actor.debug;
        const list = await (await fetch('data/feathers.json')).json();
        const f = list.feathers.find((q) => q.id === 'feather-dana-porter');
        await D.teleport(f.x - 12, f.y, f.z, 0);
        const before = JSON.parse(localStorage.getItem('tinywaterloo.feathers.v1') || '[]').length;
        window.__at.run(30, 1 / 60, {});
        const toast = document.getElementById('toast').textContent;
        window.__at.run(30, 1 / 60, {});
        const saved = JSON.parse(localStorage.getItem('tinywaterloo.feathers.v1') || '[]');
        return { before, saved, toast };
      });
      assert(r.saved.includes('feather-dana-porter'), `saved ${JSON.stringify(r.saved)}`);
      assert(r.saved.length === r.before + 1, 'collected more than once');
      assert(/Feather found: Dana Porter/.test(r.toast), `toast "${r.toast}"`);
      await frames(page, 2);
      const hud = await page.evaluate(() => document.querySelector('.gh-feathers .gh-val').textContent);
      assert(hud === `${r.before + 1}/24`, `HUD shows ${hud}`);
      return `toast "${r.toast}", HUD ${hud}`;
    });

    await check('artwork edge: the goose slides along the published-area fence instead of leaving it', async () => {
      const r = await page.evaluate(async () => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at, F = T.map.frame;
        // 80 px inside the west edge of the published tiles, flying toward it (canvas -x) at 30 degrees
        const xs = Object.values(T.map.manifest.tiles).map((t) => t.i);
        const cx0 = Math.min(...xs) * F.F + 48 + 80;
        const w = await at.surfaceWorld(cx0, 300);
        const r = F.right, heading = Math.atan2(-r[1], -r[0]) + 0.5;
        await D.teleport(w[0], w[1], w[2] + 30, heading);
        const states = at.run(360, 1 / 60, {});
        const outside = states.filter((s) => !D.inside(s.x, s.y, s.z)).length;
        const fenced = states.filter((s) => s.lastHit && s.lastHit.kind === 'fence').length;
        const a = states[0], b = states[states.length - 1];
        const cxs = states.map((s) => F.worldToCanvas(s.x, s.y, s.z).cx);
        return { outside, fenced, minCx: Math.min(...cxs), edge: Math.min(...xs) * F.F, travelled: Math.hypot(b.x - a.x, b.y - a.y), toast: document.getElementById('toast').textContent };
      });
      assert(r.outside === 0, `${r.outside} steps outside the flyable area`);
      assert(r.fenced > 0, 'never touched the fence');
      assert(r.travelled > 30, `stuck at the fence (travelled ${f2(r.travelled)} m)`);
      assert(/map ends here/.test(r.toast), `toast "${r.toast}"`);
      return `closest approach ${f2(r.minCx - r.edge)} canvas px from the edge (margin 48), slid ${f2(r.travelled)} m in 6 s; "${r.toast}"`;
    });

    await check('water: the goose can skim lower over water than over land', async () => {
      const r = await page.evaluate(async () => {
        const D = window.__tinyWaterloo.actor.debug, at = window.__at, col = D.collision;
        await col.ensure(-1200, -1500, 3500, 1200);
        // a straight 50 m water run (no buildings / trees) inside the flyable area
        let site = null;
        for (let x = -1200; x < 3500 && !site; x += 6)
          for (let y = -1500; y < 1200 && !site; y += 6) {
            if ((col.kind(x, y) & 7) !== 4) continue;
            for (let a = 0; a < 8 && !site; a++) {
              const dx = Math.cos((a * Math.PI) / 4), dy = Math.sin((a * Math.PI) / 4);
              let ok = true;
              for (let e = 0; e <= 50 && ok; e += 2) {
                const qx = x + dx * e, qy = y + dy * e;
                if ((col.kind(qx, qy) & 7) !== 4 || col.canopyTop(qx, qy) === col.canopyTop(qx, qy) || !D.inside(qx, qy, col.ground(qx, qy) + 1)) ok = false;
              }
              if (ok) site = { x, y, dir: [dx, dy] };
            }
          }
        if (!site) return { error: 'no 50 m water run in the published area' };
        await D.teleport(site.x, site.y, col.ground(site.x, site.y) + 4, Math.atan2(site.dir[1], site.dir[0]));
        const states = at.run(150, 1 / 60, { climb: -1 });
        const tail = states.slice(90).filter((s) => s.overWater);
        const gaps = tail.map((s) => s.z - s.surface);
        return { site, n: tail.length, min: Math.min(...gaps), max: Math.max(...gaps), walls: states.filter((s) => s.wall).length };
      });
      assert(!r.error, r.error);
      assert(r.n > 20, `only ${r.n} settled steps over water`);
      assert(r.min >= 0.85 && r.max < 1.3, `skim height over water ${f2(r.min)}..${f2(r.max)} m`);
      assert(r.walls === 0, 'water surface reported as a wall');
      return `water at (${r.site.x}, ${r.site.y}): skims ${f2(r.min)}..${f2(r.max)} m above the surface (land: ${f2(SKIM)} m)`;
    });

    await check('flight screenshot over campus (banking turn, shadow, HUD)', async () => {
      await page.evaluate(async () => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at;
        T.map.setView({ zoom: 1.6 });
        const w = await at.surfaceWorld(560, 330);
        await D.teleport(w[0] - 30, w[1] - 20, w[2] + 28, 0.9);
        at.run(40, 1 / 60, { turn: 1, boost: true });
      });
      await frames(page, 4);
      await page.screenshot({ path: path.join(SHOTS, 'actor_flight.png') });
      const s = await page.evaluate(() => window.__tinyWaterloo.actor.debug.getState());
      return `bank into left turn, heading ${f2(s.heading)} rad, speed ${f2(s.speed)} m/s`;
    });

    await check('keyboard: A turns left in the live loop, L lands and restores the map UI', async () => {
      const r0 = await page.evaluate(() => { const D = window.__tinyWaterloo.actor.debug; D.setAutoStep(true); return D.getState().heading; });
      await page.keyboard.down('a');
      await page.waitForFunction((h0) => {
        const h = window.__tinyWaterloo.actor.debug.getState().heading;
        return Math.atan2(Math.sin(h - h0), Math.cos(h - h0)) > 0.1;
      }, r0, { timeout: 20000, polling: 100 });
      await page.keyboard.up('a');
      await page.keyboard.press('l');
      await page.waitForFunction(() => !document.getElementById('app').classList.contains('actor-active'), null, { timeout: 3000 });
      const r = await page.evaluate(() => ({ active: window.__tinyWaterloo.actor.active, hud: document.querySelector('.goose-hud').hidden, toast: document.getElementById('toast').textContent }));
      assert(!r.active && r.hud, JSON.stringify(r));
      assert(/^Landed/.test(r.toast), `toast "${r.toast}"`);
      return `heading increased; "${r.toast}"`;
    });

    await check('UI: the "Fly as a goose" button starts the real actor', async () => {
      await page.click('.fly-btn');
      await page.waitForFunction(() => window.__tinyWaterloo.actor.active, null, { timeout: 30000 });
      await page.waitForFunction(() => window.__tinyWaterloo.actor.debug.getState().time > 0, null, { timeout: 30000, polling: 100 });
      const r = await page.evaluate(() => ({ zoom: window.__tinyWaterloo.map.getView().zoom, ui: document.getElementById('app').classList.contains('actor-active') }));
      await page.keyboard.press('l');
      assert(r.ui && r.zoom >= 1, JSON.stringify(r));
      return `flying at zoom ${f2(r.zoom)} after the intro camera flight`;
    });

    await check('Land button and Escape both end the flight; restart works', async () => {
      await startFlight(page);
      await page.click('.goose-hud .gh-land');
      const a = await page.evaluate(() => window.__tinyWaterloo.actor.active);
      await startFlight(page);
      const drawn = await page.evaluate(() => window.__tinyWaterloo.actor.debug.stippleStats());
      await page.keyboard.press('Escape');
      const b = await page.evaluate(() => window.__tinyWaterloo.actor.active);
      assert(!a && !b, `active after Land ${a}, after Escape ${b}`);
      assert(drawn.shaded > 20, `goose not drawn after a restart: ${JSON.stringify(drawn)}`);
      return `both stop the flight; after the restart the goose draws ${drawn.shaded} shaded px`;
    });

    await check('no page errors or console errors', async () => {
      assert(errors.length === 0, errors.join(' | '));
    });
    await ctx.close();

    // devicePixelRatio 2 (MacBook Air): the render camera still lines up with the map
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page2 = await ctx2.newPage();
    await page2.goto(`${BASE}#${DANA_PORTER[0]},${DANA_PORTER[1]},1.6`);
    await page2.waitForFunction(() => window.__tinyWaterloo?.actor?.debug, null, { timeout: 30000 });
    await installHelpers(page2);
    await check('dpr 2: alignment < 0.5 px and occlusion / shadow still work', async () => {
      await startFlight(page2, DANA_PORTER);
      assert(occlusionPoint, 'needs the occlusion check point');
      const r = await page2.evaluate(async ([dp, behind]) => {
        const T = window.__tinyWaterloo, D = T.actor.debug, at = window.__at;
        const w = await at.surfaceWorld(dp[0], dp[1]);
        await D.teleport(w[0] + 5, w[1] + 5, w[2] + 25, 0);
        const p = D.projectToScreen(w[0], w[1], w[2]), q = T.map.canvasToScreen(dp[0], dp[1]);
        const shadow = D.shadowCentreScreen();
        await D.teleport(behind[0], behind[1], behind[2], 0.4);
        return { err: Math.hypot(p[0] - q[0], p[1] - q[1]), shadow, occ: D.occludedFraction(), dpr: devicePixelRatio };
      }, [DANA_PORTER, occlusionPoint]);
      assert(r.dpr === 2 && r.err < 0.5 && r.shadow && r.shadow.pixels > 40 && r.occ > 0.5, JSON.stringify(r));
      return `error ${r.err.toExponential(2)} px, shadow ${r.shadow.pixels} device px, occluded ${f2(r.occ * 100)}%`;
    });
    await ctx2.close();
  } finally {
    await browser.close();
    if (server) process.kill(-server.pid);
  }
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall actor checks passed');
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
