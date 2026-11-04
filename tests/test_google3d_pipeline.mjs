// Offline test of the Google 3D Tiles comparison path (no API key needed): writes a synthetic glTF tile in the
// 3D Tiles convention (y-up content, ECEF placement) for a 30 x 30 x 45 m box centred on the Dana Porter Library
// footprint, renders it with render/google3d_render.mjs for map tile 0_0, and checks that the decoded box-top height
// and its screen position match the map frame. Uses a temporary google3d directory (restores any real one).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ecefFromLonLatH, makeLocalFrame } from '../render/google3d_math.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = path.join(ROOT, 'data_cache', 'google3d');
const BAK = G + '.bak-test';
const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'world.json'), 'utf8'));
const lm = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'public', 'data', 'landmarks.json'), 'utf8')).find((l) => l.id === 'dana-porter');
const UND = -35.5, TOP_ELL = world.projection.datum_m + UND + 80.0; // box top at local z = 80 m

function glbBox(cornersEcefYUp) {
  // 8 corners -> 12 triangles; minimal glTF 2.0 binary with POSITION + indices.
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0];
  // RTC: store vertices relative to the first corner (float32 precision) and put the offset in the node translation.
  const o = cornersEcefYUp[0];
  const pos = new Float32Array(cornersEcefYUp.flatMap((c) => [c[0] - o[0], c[1] - o[1], c[2] - o[2]]));
  const ind = new Uint16Array(idx);
  const min = [0, 1, 2].map((k) => Math.min(...cornersEcefYUp.map((c) => c[k] - o[k])));
  const max = [0, 1, 2].map((k) => Math.max(...cornersEcefYUp.map((c) => c[k] - o[k])));
  const bin = Buffer.concat([Buffer.from(pos.buffer), Buffer.from(ind.buffer), Buffer.alloc((4 - (ind.byteLength % 4)) % 4)]);
  const json = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, translation: o }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.9, 0.3, 0.2, 1] } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: ind.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5123, count: ind.length, type: 'SCALAR' }] };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const total = 12 + 8 + js.length + 8 + bin.length;
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4e4f534a, 4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(bin.length, 0); c1.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, c0, js, c1, bin]);
}

const lf = makeLocalFrame(world.origin.lat, world.origin.lon);
// Place the box using geodetic coordinates around the landmark lon/lat (independent of the local frame code).
const [lon, lat] = lm.lonlat;
const dLat = 15 / 111132.9, dLon = 15 / (111319.5 * Math.cos(lat * Math.PI / 180));
const corners = [];
for (const h of [TOP_ELL - 45, TOP_ELL]) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) corners.push(ecefFromLonLatH(lon + a * dLon, lat + b * dLat, h));
// glTF content is y-up: inverse of the +90 deg X rotation the renderer applies -> (x, y, z)_ecef -> (x, z, -y)
const yUp = corners.map(([x, y, z]) => [x, z, -y]);

if (fs.existsSync(BAK)) throw new Error(`${BAK} exists from an interrupted run - restore it to ${G} first`);
const hadReal = fs.existsSync(G);
if (hadReal) fs.renameSync(G, BAK);
let ok = false;
try {
  fs.mkdirSync(path.join(G, 'glb'), { recursive: true });
  fs.writeFileSync(path.join(G, 'glb', 'synthetic_box.glb'), glbBox(yUp));
  fs.writeFileSync(path.join(G, 'index.json'), JSON.stringify({ files: [{ file: 'glb/synthetic_box.glb', geometricError: 0 }] }));
  execFileSync('python3', [path.join(ROOT, 'pipeline', 'google3d_frames.py')], { stdio: 'inherit' });
  execFileSync('node', [path.join(ROOT, 'render', 'google3d_render.mjs'), `--undulation=${UND}`, '0,0'], { stdio: 'inherit' });
  const out = execFileSync('python3', ['-c', `
import sys, json, numpy as np
from PIL import Image
sys.path.insert(0, '${ROOT}/pipeline')
from world import world_to_canvas, lonlat_to_local
h = np.asarray(Image.open('${G}/views/0_0_height.png').convert('RGB')).astype(float)
valid = h[...,2] > 127
z = (h[...,0]*256 + h[...,1])/100 - 100
x, y = lonlat_to_local(${lon}, ${lat})
(cx, cy), _ = world_to_canvas([x, y, 80.0])
px, py = int(cx) - 0*1024, int(cy) - 0*1024
ys, xs = np.nonzero(valid & (np.abs(z - 80.0) < 0.05))
print(json.dumps({'top_px': int(len(xs)), 'expected_px': [px, py], 'top_centroid': [float(xs.mean()), float(ys.mean())] if len(xs) else None,
                  'z_at_expected': float(z[py, px]) if valid[py, px] else None}))
`]).toString();
  const r = JSON.parse(out.trim().split('\n').pop());
  const err = r.top_centroid ? Math.hypot(r.top_centroid[0] - r.expected_px[0], r.top_centroid[1] - r.expected_px[1]) : Infinity;
  console.log('synthetic box:', r, `centroid error ${err.toFixed(2)} px`);
  ok = r.z_at_expected !== null && Math.abs(r.z_at_expected - 80.0) < 0.05 && err < 2.0;
} finally {
  fs.rmSync(G, { recursive: true, force: true });
  if (hadReal) fs.renameSync(BAK, G);
}
console.log(ok ? 'PASS google3d pipeline geometry' : 'FAIL google3d pipeline geometry');
process.exit(ok ? 0 : 1);
