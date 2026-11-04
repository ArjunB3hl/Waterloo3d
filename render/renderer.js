// Reference renderer: builds a three.js scene from a prepared tile job and renders, from the shared fixed
// orthographic camera, (1) a lit colour reference at 2x, (2) encoded visible-surface heights, (3) surface class IDs.
// Runs inside headless Chromium (see render_refs.mjs). No antialiasing: every pass is pixel-aligned.
import * as THREE from '/node_modules/three/build/three.module.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function hash(x, y, k = 0) {
  let h = Math.imul((x * 100) | 0, 374761393) ^ Math.imul((y * 100) | 0, 668265263) ^ Math.imul(k + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const WALL = {
  residential: [[222, 206, 184], [196, 150, 120], [214, 196, 170], [178, 128, 104], [232, 222, 204], [170, 156, 140]],
  institutional: [[214, 208, 196], [196, 190, 178], [186, 160, 132], [174, 112, 92], [206, 198, 186]],
  commercial: [[218, 210, 196], [190, 176, 156], [166, 120, 98], [204, 200, 192]],
  industrial: [[200, 200, 196], [184, 186, 184], [170, 166, 160]],
};
const ROOF = {
  pitched: [[112, 104, 100], [130, 96, 82], [96, 98, 104], [140, 120, 102], [86, 80, 78]],
  flat: [[206, 202, 194], [190, 188, 184], [176, 172, 166], [214, 210, 202]],
};
const HOUSE = new Set(['house', 'detached', 'semidetached_house', 'residential', 'terrace', 'garage', 'garages', 'shed', 'bungalow', 'apartments', 'dormitory']);
const INST = new Set(['university', 'school', 'library', 'college', 'civic', 'government', 'hospital', 'public', 'church', 'religious', 'office']);

function palette(cls) {
  if (HOUSE.has(cls)) return 'residential';
  if (INST.has(cls)) return 'institutional';
  if (['industrial', 'warehouse', 'manufacture'].includes(cls)) return 'industrial';
  return 'commercial';
}

// OSM colour tags are often pure web colours ("red", "#ff0000"). Blend a tagged colour toward the palette tone and cap its
// saturation so it reads as a material hint (brick, render, glass) rather than paint.
function muteTag(tag, base, k = 0.45) {
  if (!tag) return base;
  const mix = tag.map((v, i) => base[i] * (1 - k) + v * k);
  const c = new THREE.Color(mix[0] / 255, mix[1] / 255, mix[2] / 255), hsl = {};
  c.getHSL(hsl); c.setHSL(hsl.h, Math.min(hsl.s, 0.38), Math.min(Math.max(hsl.l, 0.35), 0.82));
  return [c.r * 255, c.g * 255, c.b * 255];
}

function parseColor(s) {
  if (!s) return null;
  try { const c = new THREE.Color(s); return [c.r * 255, c.g * 255, c.b * 255]; } catch { return null; }
}

function windowTexture(kind) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = kind === 'residential' ? '#5d6b7a' : '#4d5f73';
  if (kind === 'residential') g.fillRect(10, 9, 12, 13);
  else { g.fillRect(4, 8, 24, 14); g.fillStyle = '#7d8fa3'; g.fillRect(4, 8, 24, 3); }
  g.fillStyle = '#d9d9d9'; g.fillRect(0, 30, 32, 2); // floor slab line
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- geometry builders ----------
function buildTerrain(job) {
  const d = job.dem, g = new THREE.BufferGeometry();
  const pos = new Float32Array(d.w * d.h * 3), uv = new Float32Array(d.w * d.h * 2);
  const [gx0, gy0, gx1, gy1] = job.ground_bbox;
  for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
    const k = j * d.w + i, x = d.x0 + i * d.step, y = d.y0 + j * d.step;
    pos.set([x, y, d.z[k]], k * 3);
    uv.set([(x - gx0) / (gx1 - gx0), (y - gy0) / (gy1 - gy0)], k * 2);
  }
  const idx = [];
  for (let j = 0; j < d.h - 1; j++) for (let i = 0; i < d.w - 1; i++) {
    const a = j * d.w + i, b = a + 1, c = a + d.w, e = c + 1;
    idx.push(a, b, e, a, e, c);
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function terrainZ(job, x, y) {
  const d = job.dem; const fx = (x - d.x0) / d.step, fy = (y - d.y0) / d.step;
  const i = Math.max(0, Math.min(d.w - 2, Math.floor(fx))), j = Math.max(0, Math.min(d.h - 2, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - i)), ty = Math.max(0, Math.min(1, fy - j));
  const z = d.z, w = d.w;
  return z[j * w + i] * (1 - tx) * (1 - ty) + z[j * w + i + 1] * tx * (1 - ty) + z[(j + 1) * w + i] * (1 - tx) * ty + z[(j + 1) * w + i + 1] * tx * ty;
}

// Accumulates wall + roof triangles for all buildings into two geometries (with per-vertex colour + class + uv).
class BuildingBatch {
  constructor() { this.w = { p: [], c: [], uv: [] }; this.r = { p: [], c: [] }; }
  wallQuad(a, b, z0, z1, col, u0, storey) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u1 = u0 + L / 3.2, v0 = z0 / storey, v1 = z1 / storey;
    const P = [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]];
    const UV = [[u0, v0], [u1, v0], [u1, v1], [u0, v0], [u1, v1], [u0, v1]];
    for (let k = 0; k < 6; k++) { this.w.p.push(...P[k]); this.w.c.push(...col); this.w.uv.push(...UV[k]); }
    return u1;
  }
  wallTri(a, b, c, col) { // gable ends (plain, no windows)
    for (const p of [a, b, c]) { this.w.p.push(...p); this.w.c.push(...col); this.w.uv.push(0.02, 0.02); }
  }
  roofTris(tris, col) { for (const p of tris) { this.r.p.push(...p); this.r.c.push(...col); } }
  geometries() {
    const mk = (o, uv) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3));
      if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
      g.computeVertexNormals();
      return g;
    };
    return { walls: mk(this.w, true), roofs: mk(this.r, false) };
  }
}

function lin(rgb) { const c = new THREE.Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace); return [c.r, c.g, c.b]; }

function ensureCCW(ring) {
  let a = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a < 0 ? ring.slice().reverse() : ring;
}

function addBuilding(batch, b, kinds) {
  const kind = palette(b.cls);
  const [cx, cy] = b.parts[0].ring[0];
  const base = WALL[kind][Math.floor(hash(cx, cy, 1) * WALL[kind].length)];
  const wall = lin(muteTag(parseColor(b.facade_color), base));
  for (const p of b.parts) {
    const storey = HOUSE.has(b.cls) ? 3.0 : 3.6;
    const ring = ensureCCW(p.ring);
    const z0 = b.z0 + p.bottom - (p.bottom === 0 ? 1.5 : 0); // sink 1.5 m so slopes never show a gap under walls
    const top = b.z0 + p.top;
    const eave = p.roof ? top - p.roof.rise : top;
    const rc = parseColor(p.roof_color);
    const pal = p.roof ? ROOF.pitched : ROOF.flat;
    const roofCol = lin(muteTag(rc, pal[Math.floor(hash(cx, cy, 2) * pal.length)], 0.6));
    let u = 0;
    for (let i = 0; i < ring.length; i++) u = batch.wallQuad(ring[i], ring[(i + 1) % ring.length], z0, eave, wall, u, storey);
    for (const h of p.holes || []) {
      const hr = ensureCCW(h).slice().reverse();
      for (let i = 0; i < hr.length; i++) batch.wallQuad(hr[i], hr[(i + 1) % hr.length], z0, eave, wall, 0, storey);
    }
    if (p.roof) {
      const c = ring; // 4 corners, c0->c1 long side
      const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const r0 = m(c[0], c[3]), r1 = m(c[1], c[2]);
      let R0 = [...r0, top], R1 = [...r1, top];
      if (p.roof.type === 'hipped') {
        const L = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]), W = Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1]);
        const t = Math.min(0.45, (W / 2) / Math.max(L, 1e-3));
        R0 = [r0[0] + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t, top];
        R1 = [r1[0] + (r0[0] - r1[0]) * t, r1[1] + (r0[1] - r1[1]) * t, top];
      }
      const E = c.map((q) => [q[0], q[1], eave]);
      batch.roofTris([E[0], E[1], R1, E[0], R1, R0, E[2], E[3], R0, E[2], R0, R1], roofCol);
      if (p.roof.type === 'hipped') batch.roofTris([E[1], E[2], R1, E[3], E[0], R0], roofCol);
      else { batch.wallTri(E[1], E[2], R1, wall); batch.wallTri(E[3], E[0], R0, wall); }
    } else {
      const contour = ring.map((q) => new THREE.Vector2(q[0], q[1]));
      const holes = (p.holes || []).map((h) => h.map((q) => new THREE.Vector2(q[0], q[1])));
      const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
      const all = contour.concat(...holes);
      const out = [];
      for (const t of tris) for (const k of t) out.push([all[k].x, all[k].y, top]);
      batch.roofTris(out, roofCol);
    }
  }
}

function buildTrees(job) {
  const n = job.trees.length * 2;
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const mats = { color: new THREE.MeshLambertMaterial({ flatShading: true }) };
  const mesh = new THREE.InstancedMesh(geo, mats.color, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const greens = [[74, 128, 62], [88, 140, 66], [64, 112, 58], [104, 148, 72], [80, 120, 70]];
  let k = 0;
  for (const [x, y, r] of job.trees) {
    const z = terrainZ(job, x, y);
    const g = greens[Math.floor(hash(x, y, 7) * greens.length)];
    for (let s = 0; s < 2; s++) {
      const rr = s === 0 ? r : r * 0.7;
      const ox = s === 0 ? 0 : (hash(x, y, 8) - 0.5) * r, oy = s === 0 ? 0 : (hash(x, y, 9) - 0.5) * r;
      m.compose(new THREE.Vector3(x + ox, y + oy, z + r * 0.9 + 1.6 + (s ? r * 0.35 : 0)), q, new THREE.Vector3(rr, rr, rr * 0.85));
      mesh.setMatrixAt(k, m);
      col.setRGB(g[0] / 255 * (s ? 1.08 : 1), g[1] / 255 * (s ? 1.08 : 1), g[2] / 255, THREE.SRGBColorSpace);
      mesh.setColorAt(k, col); k++;
    }
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

// ---------- override materials for data passes ----------
const VS = `
  varying vec3 vW; varying vec2 vUv;
  #ifdef HAS_CLS
  attribute float cls; varying float vCls;
  #endif
  void main(){
    vec4 wp = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    wp = modelMatrix * wp; vW = wp.xyz;
    #ifdef USE_UV
    vUv = uv;
    #endif
    #ifdef HAS_CLS
    vCls = cls;
    #endif
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
function heightMaterial(job) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, // data passes must not depend on triangle winding
    uniforms: { floorM: { value: job.heights.floor_m }, units: { value: job.heights.units_per_m } },
    vertexShader: VS,
    fragmentShader: `uniform float floorM; uniform float units; varying vec3 vW;
      void main(){ float e = clamp(floor((vW.z - floorM) * units + 0.5), 0.0, 65535.0);
        float hi = floor(e / 256.0); float lo = e - hi * 256.0; gl_FragColor = vec4(hi / 255.0, lo / 255.0, 1.0, 1.0); }`,
  });
}
function classMaterial(id, tex) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, // data passes must not depend on triangle winding
    uniforms: { id: { value: id }, tex: { value: tex || null } },
    defines: tex ? { USE_UV: '' } : {},
    vertexShader: VS,
    fragmentShader: `uniform float id; uniform sampler2D tex; varying vec2 vUv;
      void main(){ float c = id;
        #ifdef USE_UV
          c = floor(texture2D(tex, vUv).r * 255.0 + 0.5);
        #endif
        gl_FragColor = vec4(c / 255.0, 0.0, 0.0, 1.0); }`,
  });
}

export async function renderJob(jobUrl, opts = {}) {
  const job = await (await fetch(jobUrl)).json();
  const base = jobUrl.replace(/job\.json$/, '');
  const F = job.frame_px, cam = job.camera, mpp = cam.meters_per_px, SS = opts.supersample || 2;
  const [i, j] = job.tile;
  const right = V(cam.right_enu), up = V(cam.up_enu), back = V(cam.back_enu);
  const X = (i + 0.5) * F * mpp, Y = -(j + 0.5) * F * mpp;
  const center = right.clone().multiplyScalar(X).add(up.clone().multiplyScalar(Y));
  const half = F * mpp / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, 6000);
  camera.position.copy(center).addScaledVector(back, 3000); camera.up.copy(up); camera.lookAt(center);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();

  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const loader = new THREE.TextureLoader();
  const groundTex = await loader.loadAsync(base + 'ground.png'); groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = 8; groundTex.minFilter = THREE.LinearMipmapLinearFilter;
  const clsTex = await loader.loadAsync(base + 'groundcls.png');
  clsTex.magFilter = clsTex.minFilter = THREE.NearestFilter; clsTex.generateMipmaps = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const terrainGeo = buildTerrain(job);
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ map: groundTex }));
  terrain.receiveShadow = true; scene.add(terrain);

  const batch = new BuildingBatch();
  for (const b of job.buildings) addBuilding(batch, b);
  const bg = batch.geometries();
  const tex = { residential: windowTexture('residential'), institutional: windowTexture('institutional') };
  const wallMesh = new THREE.Mesh(bg.walls, new THREE.MeshLambertMaterial({ vertexColors: true, map: tex.institutional, side: THREE.DoubleSide }));
  const roofMesh = new THREE.Mesh(bg.roofs, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  for (const m of [wallMesh, roofMesh]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  const trees = buildTrees(job); scene.add(trees);

  // lights
  const sun = V(cam.sun_enu).normalize();
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x8a7d62, 1.15));
  const dl = new THREE.DirectionalLight(0xfff1dc, 2.1);
  const [bx0, by0, bx1, by1] = job.region_bbox;
  const rc = new THREE.Vector3((bx0 + bx1) / 2, (by0 + by1) / 2, 0);
  dl.position.copy(rc).addScaledVector(sun, 2000); dl.target.position.copy(rc);
  const rad = Math.hypot(bx1 - bx0, by1 - by0) / 2 + 40;
  Object.assign(dl.shadow.camera, { left: -rad, right: rad, top: rad, bottom: -rad, near: 1500, far: 2600 });
  dl.shadow.mapSize.set(4096, 4096); dl.shadow.bias = -0.0004; dl.shadow.normalBias = 0.6;
  dl.castShadow = true; scene.add(dl, dl.target);

  const out = {};
  // pass 1: colour at SSx
  renderer.setSize(F * SS, F * SS, false);
  renderer.render(scene, camera);
  out.color = canvas.toDataURL('image/png');

  // data passes at 1x, no shadows, no colour management
  renderer.setSize(F, F, false);
  renderer.shadowMap.enabled = false;
  const hm = heightMaterial(job);
  scene.overrideMaterial = hm; scene.background = new THREE.Color(0, 0, 0);
  renderer.render(scene, camera);
  out.height = canvas.toDataURL('image/png');

  scene.overrideMaterial = null;
  terrain.material = classMaterial(0, clsTex);
  wallMesh.material = classMaterial(job.classes.wall); roofMesh.material = classMaterial(job.classes.roof);
  trees.material = classMaterial(job.classes.tree);
  renderer.render(scene, camera);
  out.cls = canvas.toDataURL('image/png');

  renderer.dispose(); groundTex.dispose(); clsTex.dispose();
  return out;
}
