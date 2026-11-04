// Small world-space particle bursts around the goose: feather puffs on wall hits, leaves in tree crowns, spray when
// skimming water, a pale wake while boosting and a sparkle when a feather is collected. Simulated on the CPU (a fixed
// pool, no allocation per frame) and drawn as 1-2 texel points into the actor's pixel-art render target, with the
// same occlusion test as the goose. Fading is a stable dither (pixel art has no partial alpha).
import * as THREE from 'three';
import type { Vec3 } from '../frame';
import { FRAME_GLSL, srgb, type FrameUniforms } from './shaders';

export type ParticleKind = 'feather' | 'leaf' | 'spray' | 'wake' | 'sparkle';

interface KindSpec { colors: number[]; life: [number, number]; speed: number; gravity: number; drag: number; size: number; lift: number }

const SPECS: Record<ParticleKind, KindSpec> = {
  feather: { colors: [0xf2eee6, 0xd6c8b0, 0x8b7b67], life: [0.7, 1.3], speed: 4, gravity: 1.2, drag: 2.5, size: 2, lift: 1 },
  leaf: { colors: [0x6f9a3c, 0x557d2e, 0x9cbf52, 0x3f6526], life: [0.8, 1.6], speed: 3, gravity: 2.5, drag: 2, size: 2, lift: 0.5 },
  spray: { colors: [0xe8f4f8, 0xbfdbe6], life: [0.35, 0.7], speed: 3, gravity: 9, drag: 1, size: 1, lift: 3 },
  wake: { colors: [0xf5f1e8], life: [0.4, 0.8], speed: 0.4, gravity: 0, drag: 1, size: 1, lift: 0 },
  sparkle: { colors: [0xffe08a, 0xfff6d6, 0xf0a040], life: [0.6, 1.1], speed: 5, gravity: -1, drag: 3, size: 2, lift: 1 },
};

const MAX = 160;

export class Particles {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly size = new Float32Array(MAX);
  private readonly fade = new Float32Array(MAX);      // remaining life fraction (1 -> 0)
  private readonly life = new Float32Array(MAX);
  private readonly age = new Float32Array(MAX);
  private readonly gravity = new Float32Array(MAX);
  private readonly drag = new Float32Array(MAX);
  private count = 0;
  private seed = 1;
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.ShaderMaterial;

  constructor(uniforms: FrameUniforms) {
    const g = this.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aFade', new THREE.BufferAttribute(this.fade, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms,
      blending: THREE.NoBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; attribute float aFade;
        varying vec3 vColor; varying float vFade; varying vec3 vWorld;
        void main() {
          vColor = aColor; vFade = aFade; vWorld = position;
          gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize;
        }`,
      fragmentShader: /* glsl */ `
        ${FRAME_GLSL}
        varying vec3 vColor; varying float vFade; varying vec3 vWorld;
        void main() {
          // ordered 2x2 dither: a particle thins out over its last half of life instead of blending
          vec2 q = mod(floor(gl_FragCoord.xy), 2.0);
          float threshold = (q.x * 2.0 + q.y + 0.5) / 4.0;
          if (vFade * 2.0 < threshold) discard;
          vec2 c = worldToCanvas(vWorld);
          float h = surfaceHeight(c);
          bool hidden = known(h) && depthOf(vWorld) < depthAt(c, h) - 0.3;
          gl_FragColor = vec4(vColor, hidden ? 0.5 : 1.0);
        }`,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }

  /** Emit n particles of a kind at p, with an optional base velocity (e.g. the goose's). */
  emit(kind: ParticleKind, p: Vec3, n: number, base: Vec3 = [0, 0, 0], spread = 1): void {
    const s = SPECS[kind];
    for (let k = 0; k < n; k++) {
      const i = this.count < MAX ? this.count++ : Math.floor(this.rand() * MAX);   // full pool: recycle at random
      const a = this.rand() * Math.PI * 2, e = (this.rand() - 0.3) * Math.PI * 0.5, sp = s.speed * (0.4 + 0.6 * this.rand());
      this.pos.set([p[0] + (this.rand() - 0.5) * spread, p[1] + (this.rand() - 0.5) * spread, p[2] + (this.rand() - 0.5) * spread], i * 3);
      this.vel.set([base[0] + Math.cos(a) * Math.cos(e) * sp, base[1] + Math.sin(a) * Math.cos(e) * sp, base[2] + Math.sin(e) * sp + s.lift], i * 3);
      this.col.set(srgb(s.colors[Math.floor(this.rand() * s.colors.length)]).toArray(), i * 3);
      this.size[i] = s.size;
      this.life[i] = s.life[0] + (s.life[1] - s.life[0]) * this.rand();
      this.age[i] = 0;
      this.fade[i] = 1;
      this.gravity[i] = s.gravity;
      this.drag[i] = s.drag;
    }
  }

  /** Advance and compact the pool (swap-remove dead particles). */
  update(dt: number): void {
    let k = 0;
    while (k < this.count) {
      this.age[k] += dt;
      if (this.age[k] >= this.life[k]) { this.kill(k); continue; }
      const damp = Math.exp(-this.drag[k] * dt);
      const j = k * 3;
      this.vel[j] *= damp; this.vel[j + 1] *= damp;
      this.vel[j + 2] = this.vel[j + 2] * damp - this.gravity[k] * dt;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      this.fade[k] = 1 - this.age[k] / this.life[k];
      k++;
    }
    const g = this.geometry;
    g.setDrawRange(0, this.count);
    for (const name of ['position', 'aColor', 'aSize', 'aFade']) (g.getAttribute(name) as THREE.BufferAttribute).needsUpdate = true;
  }

  clear(): void { this.count = 0; this.geometry.setDrawRange(0, 0); }

  get alive(): number { return this.count; }

  dispose(): void { this.geometry.dispose(); this.material.dispose(); }

  private kill(k: number): void {
    const last = --this.count;
    if (k === last) return;
    for (const arr of [this.pos, this.vel, this.col]) arr.copyWithin(k * 3, last * 3, last * 3 + 3);
    for (const arr of [this.size, this.fade, this.life, this.age, this.gravity, this.drag]) arr[k] = arr[last];
  }

  /** Deterministic xorshift (visual only; keeps tests and screenshots reproducible). */
  private rand(): number {
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0 || 1;
    return this.seed / 4294967296;
  }
}
