// Node self-check for web/src/depth/collision.ts (against the published chunks) and feathers.ts (no browser needed).
// Run: node tests/depth_selfcheck.mjs     (Node >= 22.18: loads the .ts module via built-in type stripping)
// Reference values come from tests/test_collision.py / scene.pkl (local metres, z rel. datum 330 m).
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { CollisionField, decodePng, KIND_BUILDING, KIND_TREE, KIND_VALID } from '../web/src/depth/collision.ts';
import { FeatherProgress, feathersNear, FEATHER_STORAGE_KEY } from '../web/src/depth/feathers.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = path.join(root, 'web', 'public');
// meta.json is addressed like the browser would ('data/collision/meta.json'); strip the ?v= cache buster for disk reads
const load = async (url) => readFile(path.join(dataDir, url.split('?')[0]));
const check = async (name, fn) => {
  try { await fn(); console.log('PASS', name); } catch (e) { console.error('FAIL', name, e); process.exitCode = 1; }
};

const field = await CollisionField.open('data/collision/meta.json', { load, maxChunks: 8 });

// Dana Porter Library tower: footprint centre (35.98, -236.50), roof z 39.923 (scene: z0 2.923 + top 37.0)
const DP = [35.98, -236.5];
const DP_ROOF = 39.923;
// OSM tree at (-39.63, -304.83): r 3.945, ground 0.9 -> crown top ~ 0.9 + 1.6 + 1.9 r = 10.0
const TREE = [-39.63, -304.83];
// open lawn (largest pitch / grass area): (2539.3, -739.3), ground 6.02
const LAWN = [2539.3, -739.3];

await check('fast reject above everything works without any chunk loaded', () => {
  const r = field.sweep([DP[0] - 300, DP[1], 120], [DP[0] + 300, DP[1], 120], 2);
  assert.equal(r.hit, 'none'); assert.equal(r.missing, false); assert.equal(field.stats().loaded, 0);
  const low = field.sweep([DP[0] - 300, DP[1], 20], [DP[0] + 300, DP[1], 20], 2);
  assert.equal(low.missing, true, 'unloaded data below zmax must be reported as missing');
});

await field.ensureAround(DP[0], DP[1], 400);
await field.ensureAround(LAWN[0], LAWN[1], 50);

await check('samplers', () => {
  assert.ok(Math.abs(field.solidTop(DP[0], DP[1]) - DP_ROOF) < 0.3, `roof ${field.solidTop(DP[0], DP[1])}`);
  assert.ok(field.kind(DP[0], DP[1]) & KIND_BUILDING);
  assert.ok(field.kind(TREE[0], TREE[1]) & KIND_TREE);
  assert.ok(Math.abs(field.canopyTop(TREE[0], TREE[1]) - 10.0) < 0.3, `canopy ${field.canopyTop(TREE[0], TREE[1])}`);
  const g = field.ground(LAWN[0], LAWN[1]);
  assert.ok(Math.abs(g - 6.02) < 0.05, `lawn ground ${g}`);
  assert.equal(field.solidTop(LAWN[0], LAWN[1]), g);
  assert.ok(Number.isNaN(field.canopyTop(LAWN[0], LAWN[1])));
  assert.equal(field.kind(LAWN[0], LAWN[1]), KIND_VALID);
  assert.ok(Number.isNaN(field.solidTop(50000, 50000)) && field.kind(50000, 50000) === 0, 'outside data -> NaN / 0');
});

await check('horizontal flight into the tower hits a wall with a westward normal', () => {
  const r = field.sweep([DP[0] - 60, DP[1], 30], [DP[0], DP[1], 30], 1.0);
  assert.equal(r.hit, 'building');
  assert.ok(r.normal[0] < -0.9 && r.normal[2] === 0, `normal ${r.normal}`);
  assert.ok(r.t > 0.5 && r.t < 1, `t ${r.t}`);
  assert.ok(field.solidTop(r.point[0] + 1.2, r.point[1]) > 30, 'wall just ahead of the contact point');
  console.log(`  wall contact at x=${r.point[0].toFixed(2)} (t=${r.t.toFixed(3)}), normal ${r.normal.map((v) => v.toFixed(2))}`);
});

await check('point-sized probe flying into the facade is a wall contact, not a roof', () => {
  const r = field.sweep([DP[0] - 60, DP[1], 30], [DP[0], DP[1], 30], 0);
  assert.equal(r.hit, 'building'); assert.equal(r.normal[2], 0);
  assert.ok(Math.abs(r.point[0] - 17.8) < 1.5, `contact x ${r.point[0]} (facade at x = 17.8)`);
});

await check('vertical drop lands on the roof with an up normal', () => {
  const r = field.sweep([DP[0], DP[1], 80], [DP[0], DP[1], 0], 0.5);
  assert.equal(r.hit, 'building'); assert.deepEqual(r.normal, [0, 0, 1]);
  assert.ok(Math.abs(r.point[2] - (DP_ROOF + 0.5)) < 0.1, `rest z ${r.point[2]}`);
  console.log(`  roof contact z=${r.point[2].toFixed(3)} (roof ${DP_ROOF} + radius 0.5)`);
});

await check('drop onto lawn hits ground; drop onto the tree hits the canopy', () => {
  const g = field.sweep([LAWN[0], LAWN[1], 40], [LAWN[0], LAWN[1], -10], 0.4);
  assert.equal(g.hit, 'ground'); assert.ok(Math.abs(g.point[2] - (field.ground(LAWN[0], LAWN[1]) + 0.4)) < 0.1);
  const t = field.sweep([TREE[0], TREE[1], 40], [TREE[0], TREE[1], -10], 0.4);
  assert.equal(t.hit, 'tree'); assert.ok(Math.abs(t.point[2] - (field.canopyTop(TREE[0], TREE[1]) + 0.4)) < 0.1);
});

await check('starting inside an obstacle reports t = 0', () => {
  const r = field.sweep([DP[0], DP[1], 20], [DP[0] + 5, DP[1], 20], 0.5);
  assert.equal(r.hit, 'building'); assert.equal(r.t, 0);
});

await check('bounded cache evicts least recently used chunks', async () => {
  await field.ensure(-600, -1100, 2500, 600);   // 25 chunks requested with capacity 8
  const s = field.stats();
  assert.ok(s.loaded <= s.capacity, JSON.stringify(s));
});

await check('PNG decoder matches a known pixel', async () => {
  const png = await decodePng(new Uint8Array(await readFile(path.join(dataDir, 'data/collision/solid/0_-1.png'))));
  assert.equal(png.width, 256); assert.equal(png.channels, 4);
  // Dana Porter cell: global cell (17, -119) -> chunk col 17, row 255 - (-119 & 255) = 118
  const k = (118 * 256 + 17) * 4, z = ((png.data[k] << 8) | png.data[k + 1]) / 100 - 100;
  assert.ok(Math.abs(z - DP_ROOF) < 0.01, `decoded ${z}`);
  assert.ok(png.data[k + 3] & KIND_BUILDING);
});

await check('sweep cost', async () => {
  await field.ensureAround(DP[0], DP[1], 100);   // the eviction check above pushed these chunks out
  const t0 = performance.now();
  let hits = 0;
  for (let k = 0; k < 2000; k++) {
    // 15 m hops on a 30 m circle around the tower at 25 m altitude, half of them aimed inward
    const a = (k / 2000) * Math.PI * 2, x = DP[0] + Math.cos(a) * 30, y = DP[1] + Math.sin(a) * 30, s = k % 2 ? -15 : 15;
    const r = field.sweep([x, y, 25], [x + Math.cos(a) * s, y + Math.sin(a) * s, 24], 1.5);
    if (r.hit !== 'none') hits++;
  }
  const ms = (performance.now() - t0) / 2000;
  console.log(`  ${ms.toFixed(4)} ms per 15 m sweep (radius 1.5), ${hits} / 2000 hit something`);
  assert.ok(ms < 1);
});

await check('feathers: progress persists, ignores unknown ids, survives broken storage', async () => {
  const { feathers } = JSON.parse(await readFile(path.join(dataDir, 'data/feathers.json'), 'utf8'));
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  const a = new FeatherProgress(feathers, storage);
  assert.equal(a.total, feathers.length); assert.equal(a.count, 0);
  let events = 0; a.onChange(() => events++);
  assert.equal(a.collect(feathers[0].id), true); assert.equal(a.collect(feathers[0].id), false); assert.equal(a.collect('nope'), false);
  assert.equal(a.count, 1); assert.equal(events, 1); assert.ok(a.has(feathers[0].id));
  const b = new FeatherProgress(feathers, storage);   // reload from storage
  assert.equal(b.count, 1); assert.ok(b.has(feathers[0].id));
  mem.set(FEATHER_STORAGE_KEY, JSON.stringify([feathers[1].id, 'retired-feather']));
  assert.equal(new FeatherProgress(feathers, storage).count, 1, 'unknown ids are not counted');
  mem.set(FEATHER_STORAGE_KEY, '{corrupt');
  assert.equal(new FeatherProgress(feathers, storage).count, 0);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const c = new FeatherProgress(feathers, throwing);
  assert.equal(c.collect(feathers[2].id), true); assert.equal(c.count, 1);
  const noStore = new FeatherProgress(feathers);    // Node has no localStorage -> in-memory
  assert.equal(noStore.collect(feathers[3].id), true);
  const dp = feathers.find((f) => f.landmark_id === 'dana-porter');
  assert.equal(feathersNear(feathers, [dp.x + 3, dp.y, dp.z], 5)[0].id, dp.id);
  assert.equal(feathersNear(feathers, [dp.x, dp.y, dp.z + 50], 5).length, 0);
  console.log(`  ${feathers.length} feathers; Dana Porter feather at z=${dp.z} (${dp.label})`);
});
