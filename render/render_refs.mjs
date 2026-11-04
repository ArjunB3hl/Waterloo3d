// Drive headless Chromium to render prepared tile jobs (data_cache/jobs/<i>_<j>/job.json).
// Usage: node render/render_refs.mjs [i,j ...]   (default: every job lacking outputs; --force re-renders)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright is resolved from the project or from NODE_PATH (global install). See README for setup.
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JOBS = path.join(ROOT, 'data_cache', 'jobs');
const args = process.argv.slice(2);
const force = args.includes('--force');
let tiles = args.filter((a) => /^-?\d+,-?\d+$/.test(a)).map((a) => a.replace(',', '_'));
if (!tiles.length) tiles = fs.readdirSync(JOBS).filter((d) => fs.existsSync(path.join(JOBS, d, 'job.json')));
if (!force) tiles = tiles.filter((t) => !fs.existsSync(path.join(JOBS, t, 'height.png')) ||
  fs.statSync(path.join(JOBS, t, 'height.png')).mtimeMs < fs.statSync(path.join(JOBS, t, 'job.json')).mtimeMs);

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/render/renderer.html`);
await page.waitForFunction(() => window.ready === true);
const save = (fp, dataUrl) => fs.writeFileSync(fp, Buffer.from(dataUrl.split(',')[1], 'base64'));
for (const t of tiles) {
  const t0 = Date.now();
  const out = await page.evaluate((u) => window.renderJob(u), `/data_cache/jobs/${t}/job.json`);
  save(path.join(JOBS, t, 'color2x.png'), out.color);
  save(path.join(JOBS, t, 'height.png'), out.height);
  save(path.join(JOBS, t, 'cls.png'), out.cls);
  console.log(`rendered ${t} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await browser.close(); server.close();
