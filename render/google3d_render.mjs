// Render Google Photorealistic 3D Tiles comparison views for prepared map tiles (OPTIONAL; see google3d_fetch.mjs).
// Usage: node render/google3d_render.mjs [--undulation=-35.5] 0,0 -1,0 ...
// Output: data_cache/google3d/views/<i>_<j>_{color,height}.png  (gitignored; comparison/QA only)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { makeLocalFrame } from './google3d_math.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = path.join(ROOT, 'data_cache', 'google3d');
const args = process.argv.slice(2);
const undulation = Number((args.find((a) => a.startsWith('--undulation=')) || '--undulation=-35.5').split('=')[1]);
const tiles = args.filter((a) => /^-?\d+,-?\d+$/.test(a)).map((a) => a.replace(',', '_'));
const index = JSON.parse(fs.readFileSync(path.join(G, 'index.json'), 'utf8'));
const frames = JSON.parse(fs.readFileSync(path.join(G, 'frames.json'), 'utf8'));
const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'world.json'), 'utf8'));
const lf = makeLocalFrame(world.origin.lat, world.origin.lon);

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.html': 'text/html', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/render/google3d.html`);
await page.waitForFunction(() => window.ready === true);
fs.mkdirSync(path.join(G, 'views'), { recursive: true });
const save = (fp, d) => fs.writeFileSync(fp, Buffer.from(d.split(',')[1], 'base64'));
for (const t of tiles) {
  const job = JSON.parse(fs.readFileSync(path.join(ROOT, 'data_cache', 'jobs', t, 'job.json'), 'utf8'));
  const [x0, y0, x1, y1] = job.region_bbox;
  const files = index.files.filter((f) => {
    if (!f.box) return true;
    const half = Math.hypot(...f.box.slice(3, 6)) + Math.hypot(...f.box.slice(6, 9));
    const [x, y] = lf.ecefToLocal(f.box.slice(0, 3));
    return x > x0 - half && x < x1 + half && y > y0 - half && y < y1 + half;
  }).map((f) => `/data_cache/google3d/${f.file}`);
  const t0 = Date.now();
  const out = await page.evaluate(([u, o]) => window.renderGoogle(u, o), [`/data_cache/jobs/${t}/job.json`,
    { files, origin: world.origin, datum: world.projection.datum_m, undulation, corr: frames[t] || { dx: 0, dy: 0 } }]);
  save(path.join(G, 'views', `${t}_color.png`), out.color); save(path.join(G, 'views', `${t}_height.png`), out.height);
  console.log(`google view ${t}: ${files.length} files, ${out.meshes} meshes in region, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close(); server.close();
