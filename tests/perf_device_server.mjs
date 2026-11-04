// Static server for measuring Tiny Waterloo on a real device: serves the production build (web/dist) at / and the
// benchmark harness tests/perf_device.html at /perf_device.html from the same origin (the harness drives the app in an
// iframe and reads window.__tinyWaterloo, which needs same-origin access). No dependencies beyond Node itself.
// Run: npm run perf:device   (builds first), then open http://127.0.0.1:4180/perf_device.html
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'web', 'dist');
const HARNESS = path.join(ROOT, 'tests', 'perf_device.html');
const PORT = Number(process.env.PORT || 4180);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
};

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('web/dist is missing: run `npm run build` first (or use `npm run perf:device`).');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let file = url.pathname === '/perf_device.html' ? HARNESS : path.join(DIST, decodeURIComponent(url.pathname));
  if (!file.startsWith(DIST) && file !== HARNESS) { res.writeHead(403).end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Tiny Waterloo:   http://127.0.0.1:${PORT}/`);
  console.log(`Benchmark page:  http://127.0.0.1:${PORT}/perf_device.html`);
});
