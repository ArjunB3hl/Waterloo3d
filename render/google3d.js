// Browser side of the OPTIONAL Google Photorealistic 3D Tiles comparison render (see google3d_fetch.mjs).
// Renders the downloaded glTF content from the SAME fixed orthographic camera as the reference tiles and outputs:
//   color  - unlit photogrammetry texture view (comparison/QA only, not published)
//   height - visible-surface heights in the map codec, using an ellipsoid->datum offset `undulation` (calibrated later)
import * as THREE from 'three';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from '/node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { makeLocalFrame } from './google3d_math.mjs';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

function heightMaterial(job, undulation) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide, // data passes must not depend on triangle winding
    uniforms: { floorM: { value: job.heights.floor_m }, units: { value: job.heights.units_per_m } },
    vertexShader: `varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float floorM; uniform float units; varying vec3 vW;
      void main(){ float e = clamp(floor((vW.z - floorM) * units + 0.5), 0.0, 65535.0);
        float hi = floor(e / 256.0); float lo = e - hi * 256.0; gl_FragColor = vec4(hi / 255.0, lo / 255.0, 1.0, 1.0); }`,
  });
}

/**
 * @param {string} jobUrl  /data_cache/jobs/<i>_<j>/job.json
 * @param {{files: string[], origin: {lat:number, lon:number}, datum: number, undulation: number, corr: {dx:number, dy:number}}} o
 */
export async function renderGoogle(jobUrl, o) {
  const job = await (await fetch(jobUrl)).json();
  const F = job.frame_px, cam = job.camera, mpp = cam.meters_per_px;
  const [i, j] = job.tile;
  const right = V(cam.right_enu), up = V(cam.up_enu), back = V(cam.back_enu);
  const center = right.clone().multiplyScalar((i + 0.5) * F * mpp).add(up.clone().multiplyScalar(-(j + 0.5) * F * mpp));
  const half = F * mpp / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 1, 6000);
  camera.position.copy(center).addScaledVector(back, 3000); camera.up.copy(up); camera.lookAt(center);
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();

  const frame = makeLocalFrame(o.origin.lat, o.origin.lon);
  const zOff = o.datum + o.undulation;           // local z = ellipsoidal h - (datum ASL + geoid undulation)
  const loader = new GLTFLoader();
  const draco = new DRACOLoader(); draco.setDecoderPath('/node_modules/three/examples/jsm/libs/draco/'); loader.setDRACOLoader(draco);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0, 0, 0);
  const [bx0, by0, bx1, by1] = job.region_bbox;
  const p = new THREE.Vector3(), m4 = new THREE.Matrix4();
  // 3D Tiles glTF content is y-up; the tileset frame is z-up ECEF (spec: rotate +90 deg about X).
  const yUpToZUp = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  let kept = 0;
  for (const f of o.files) {
    const gltf = await loader.loadAsync(f);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      m4.multiplyMatrices(yUpToZUp, obj.matrixWorld);
      const g = obj.geometry.clone(), pos = g.attributes.position;
      let inside = false;
      for (let k = 0; k < pos.count; k++) {
        p.fromBufferAttribute(pos, k).applyMatrix4(m4);                // ECEF (+ any RTC translation baked in node matrices)
        const l = frame.ecefToLocal([p.x, p.y, p.z]);
        const x = l[0] + o.corr.dx, y = l[1] + o.corr.dy, z = l[2] - zOff;
        pos.setXYZ(k, x, y, z);
        if (x > bx0 && x < bx1 && y > by0 && y < by1) inside = true;
      }
      if (!inside) { g.dispose(); return; }
      pos.needsUpdate = true; g.computeBoundingSphere();
      const mat = new THREE.MeshBasicMaterial({ map: obj.material.map || null, color: obj.material.map ? 0xffffff : obj.material.color, side: THREE.DoubleSide });
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      scene.add(new THREE.Mesh(g, mat)); kept++;
    });
  }
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setSize(F, F, false);
  renderer.render(scene, camera);
  const color = canvas.toDataURL('image/png');
  scene.overrideMaterial = heightMaterial(job, o.undulation);
  renderer.render(scene, camera);
  const height = canvas.toDataURL('image/png');
  renderer.dispose(); draco.dispose();
  return { color, height, meshes: kept };
}
