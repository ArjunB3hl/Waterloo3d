// OPTIONAL comparison source: Google Photorealistic 3D Tiles (Map Tiles API).
//
// Downloads the 3D Tiles content that covers the world region of the given map tiles into data_cache/google3d/
// (gitignored, never published). Used only to render *comparison* views with the shared camera
// (render/google3d_render.mjs) and to cross-check OSM-derived building heights. Nothing from Google enters
// web/public or art/ unless you deliberately decide that your use is permitted (see DATA_SOURCES.md).
//
// Requirements:
//   GOOGLE_MAPS_API_KEY in the environment (never commit it)
//   --i-reviewed-google-terms   explicit acknowledgement that you checked the Map Tiles API terms for this use
// Usage:
//   node render/google3d_fetch.mjs --i-reviewed-google-terms 0,0 -1,0 ...    (tiles need prepared jobs: data_cache/jobs/<i>_<j>/job.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecefFromLonLatH, makeLocalFrame } from './google3d_math.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data_cache', 'google3d');
const API = 'https://tile.googleapis.com';

const args = process.argv.slice(2);
const KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!KEY) { console.error('GOOGLE_MAPS_API_KEY is not set. Add it as an environment secret (not in source control).'); process.exit(2); }
if (!args.includes('--i-reviewed-google-terms')) {
  console.error('Refusing to download: pass --i-reviewed-google-terms after confirming the Map Tiles API terms permit this use (see DATA_SOURCES.md).');
  process.exit(2);
}
const tiles = args.filter((a) => /^-?\d+,-?\d+$/.test(a));
const TARGET_ERROR = Number((args.find((a) => a.startsWith('--target-error=')) || '--target-error=0.6').split('=')[1]);
const MAX_FILES = Number((args.find((a) => a.startsWith('--max-files=')) || '--max-files=4000').split('=')[1]);

const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'world.json'), 'utf8'));
const frame = makeLocalFrame(world.origin.lat, world.origin.lon);

// Region of interest: union of the prepared jobs' region bboxes (local metres) -> bounding sphere in ECEF.
function regionSphere() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of tiles) {
    const job = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_cache', 'jobs', t.replace(',', '_'), 'job.json'), 'utf8'));
    const b = job.ground_bbox; x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const centre = frame.localToEcef([cx, cy, world.projection.datum_m - 36]);  // ~geoid offset; only for culling
  const radius = Math.hypot(x1 - x0, y1 - y0) / 2 + 150;
  return { centre, radius, bbox: [x0, y0, x1, y1] };
}

function boxIntersectsSphere(box, s) {
  // 3D Tiles box: [cx,cy,cz, ax,ay,az, bx,by,bz, cx,cy,cz] (centre + three half-axis vectors, ECEF)
  const c = box.slice(0, 3), axes = [box.slice(3, 6), box.slice(6, 9), box.slice(9, 12)];
  const d = [s.centre[0] - c[0], s.centre[1] - c[1], s.centre[2] - c[2]];
  let dist2 = 0;
  for (const a of axes) {
    const len = Math.hypot(...a) || 1e-9;
    const proj = (d[0] * a[0] + d[1] * a[1] + d[2] * a[2]) / len;
    const excess = Math.abs(proj) - len;
    if (excess > 0) dist2 += excess * excess;
  }
  return dist2 <= s.radius * s.radius;
}

let session = null;
async function getJson(uri) {
  const u = new URL(uri, API); u.searchParams.set('key', KEY); if (session && !u.searchParams.get('session')) u.searchParams.set('session', session);
  const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${u.pathname}`);
  return r.json();
}

async function main() {
  if (!tiles.length) { console.error('Give at least one map tile, e.g. 0,0'); process.exit(2); }
  const sphere = regionSphere();
  fs.mkdirSync(path.join(OUT, 'glb'), { recursive: true });
  const list = []; let visited = 0;
  const queue = [{ uri: '/v1/3dtiles/root.json' }];
  while (queue.length) {
    const { uri } = queue.shift();
    const ts = await getJson(uri);
    const walk = (tile, base) => {
      visited++;
      if (tile.boundingVolume?.box && !boxIntersectsSphere(tile.boundingVolume.box, sphere)) return;
      const contentUri = tile.content?.uri || tile.content?.url;
      const refine = !tile.children?.length ? false : tile.geometricError > TARGET_ERROR;
      if (contentUri) {
        const abs = new URL(contentUri, new URL(base, API)).toString();
        const s = new URL(abs).searchParams.get('session'); if (s) session = s;
        if (abs.includes('.json')) queue.push({ uri: abs });
        else if (!refine) list.push({ uri: abs, geometricError: tile.geometricError, box: tile.boundingVolume?.box });
      }
      if (refine || !contentUri) for (const ch of tile.children || []) walk(ch, base);
    };
    walk(ts.root, uri);
    if (list.length > MAX_FILES) throw new Error(`more than ${MAX_FILES} content files selected - narrow the region or raise --target-error`);
  }
  console.log(`selected ${list.length} glb files (visited ${visited} tiles, target geometric error ${TARGET_ERROR} m)`);
  const index = [];
  let bytes = 0;
  for (const [k, it] of list.entries()) {
    const name = new URL(it.uri).pathname.split('/').pop().replace(/[^A-Za-z0-9_.-]/g, '_');
    const fp = path.join(OUT, 'glb', name);
    if (!fs.existsSync(fp)) {
      const u = new URL(it.uri); u.searchParams.set('key', KEY); if (session) u.searchParams.set('session', session);
      const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} for ${name}`);
      fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer()));
    }
    bytes += fs.statSync(fp).size; index.push({ file: `glb/${name}`, geometricError: it.geometricError, box: it.box });
    if (k % 50 === 0) console.log(`  ${k + 1}/${list.length}  ${(bytes / 1e6).toFixed(1)} MB`);
  }
  // copyright strings must accompany any display of renders; store them with the data
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ tiles, target_error_m: TARGET_ERROR, files: index,
    retrieved_utc: new Date().toISOString(), note: 'Google Photorealistic 3D Tiles - comparison use only; do not publish without confirming terms' }, null, 1));
  console.log(`done: ${index.length} files, ${(bytes / 1e6).toFixed(1)} MB -> data_cache/google3d/`);
}

main().catch((e) => { console.error(String(e.message || e).replace(KEY, '<key>')); process.exit(1); });
