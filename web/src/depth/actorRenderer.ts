// Actor canvas: the goose rendered with a three.js OrthographicCamera that reproduces the map's fixed oblique
// projection, into a small pixel-art render target, then blitted onto a screen-sized transparent canvas; its particles
// are drawn straight onto that canvas, behind the goose.
//
// Camera: right / up / back axes from manifest.camera, world units = local ENU metres (z up). For canvas px (cx, cy)
//   view-space x = cx * mpp and y = -cy * mpp, so an orthographic frustum over a canvas rectangle is that rectangle in
//   metres. The render target covers RT_TEXELS^2 texels of `artPerTexel` artwork px each (>= 1 artwork px and >= 1
//   device px) and is centred exactly on the goose, so the goose always rasterises at the same sub-texel phase (its
//   silhouette does not shimmer as it moves) and the sprite travels with the goose, not with a grid.
// Placement: the map pans in whole device pixels. The blit puts the target's corner on a whole device pixel of the
//   same view, so the sprite also moves in device-pixel steps (it used to sit on the artwork-pixel grid, 3.2 device px
//   at flight zoom on a retina screen, and hopped one or two of those per frame against the smoothly panning map).
// Occlusion: every goose fragment converts its world position to canvas px, reads the visible-surface height there from
//   the height window, reconstructs the surface depth (frame.depthAt) and flags itself hidden when it lies more than
//   OCCLUSION_BIAS_M behind it. The blit draws hidden texels as a stipple with a bright outline.
// Colour: shading is done directly in sRGB (the artwork's space) and written without conversion
//   (outputColorSpace = linear-sRGB = pass-through); three's global colour management is left untouched.
import * as THREE from 'three';
import type { Frame } from '../frame';
import type { ViewState } from '../types';
import { createGoose, type Goose } from './goose';
import type { HeightWindow } from './heightWindow';
import { Particles } from './particles';
import { FRAME_GLSL, frameUniforms, heightTexture, srgb, type FrameUniforms } from './shaders';

export const RT_TEXELS = 64;
export const OCCLUSION_BIAS_M = 0.3;
const CAMERA_STANDOFF_M = 150;           // eye distance in front of the goose along `back` (near 1 m, far 300 m)

// Blit palette (sRGB): stipple + outline for the hidden goose, soft dark rim for the visible one.
const HIDDEN_FILL = 0xf3a646;
const HIDDEN_OUTLINE = 0xfff4e0;
const RIM = 0x2a221c;
const RIM_ALPHA = 0.45;
const SIZE = new THREE.Vector2();        // scratch (canvas size checks, no per-frame allocation)

export interface GooseAttitude {
  x: number; y: number; z: number;
  heading: number; pitch: number; bank: number;
  flapPhase: number; flapAmount: number;
  legs: number;
}

export interface Viewport { view: ViewState; width: number; height: number; dpr: number }

export class ActorRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly goose: Goose;
  readonly particles: Particles;
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2 * CAMERA_STANDOFF_M);
  private readonly scene = new THREE.Scene();
  private readonly rt: THREE.WebGLRenderTarget;
  private readonly uniforms: FrameUniforms;
  private readonly materials = new Map<number, THREE.ShaderMaterial>();
  private readonly blitScene = new THREE.Scene();
  private readonly blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly blitMaterial: THREE.ShaderMaterial;
  /** Canvas-px rectangle covered by the render target in the last render: [x0, y0, size], plus texel size. */
  readonly rect = { x0: 0, y0: 0, size: 1, artPerTexel: 1 };
  /** Offset (canvas px, under half a device px) that puts the blitted rectangle's corner on a whole device pixel. */
  private readonly snap = new THREE.Vector2();
  /** That corner in whole device px from the canvas's top-left. */
  private readonly corner = new THREE.Vector2();
  private readonly particleScene = new THREE.Scene();
  /** Covers the whole viewport in the map's projection: particles are drawn through it at their true positions. */
  private readonly screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2 * CAMERA_STANDOFF_M);

  constructor(readonly canvas: HTMLCanvasElement, private readonly frame: Frame, private readonly heights: HeightWindow, scale: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    // Reading a program's info log makes its first use wait for the link (a long frame at take-off); keep it for development
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;

    this.rt = new THREE.WebGLRenderTarget(RT_TEXELS, RT_TEXELS, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true,
      type: THREE.UnsignedByteType, format: THREE.RGBAFormat, colorSpace: THREE.NoColorSpace,
    });
    this.uniforms = frameUniforms(frame, heights, heightTexture(heights, this.renderer));
    const sun = new THREE.Vector3(...frame.sun);

    // goose with flat sun-lit tones: swap each Lambert material for a shader material of the same plumage colour
    this.goose = createGoose();
    this.goose.group.scale.setScalar(scale);
    this.goose.group.rotation.order = 'ZYX';        // yaw (heading), then pitch, then roll (bank)
    this.goose.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const hex = (o.material as THREE.MeshLambertMaterial).color.getHex();
      let m = this.materials.get(hex);
      if (!m) { m = this.gooseMaterial(hex, sun); this.materials.set(hex, m); }
      o.material = m;
    });
    this.scene.add(this.goose.group);
    this.particles = new Particles(this.uniforms, RIM, RIM_ALPHA);
    this.particleScene.add(this.particles.points);

    this.blitMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uRT: { value: this.rt.texture },
        uRect: { value: new THREE.Vector4() },           // x0, y0 (canvas px), size (canvas px), artPerTexel
        uView: { value: new THREE.Vector4() },           // cx, cy, zoom, unused
        uViewport: { value: new THREE.Vector2() },       // CSS px
        uDev: { value: new THREE.Vector4() },            // rectangle corner (whole device px from the top-left), device px per texel, buffer height
        uFill: { value: srgb(HIDDEN_FILL) }, uOutline: { value: srgb(HIDDEN_OUTLINE) }, uRim: { value: srgb(RIM) },
      },
      depthTest: false, depthWrite: false, transparent: true,
      // premultiplied "over": the particles are already on the canvas, and the rim should darken them, not replace them
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      side: THREE.DoubleSide,                            // the quad's y flip (canvas y down) reverses its winding
      forceSinglePass: true,                             // one draw, one program (transparent + DoubleSide means two of each)
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D uRT;
        uniform vec4 uDev;
        uniform vec4 uRect;
        uniform vec3 uFill; uniform vec3 uOutline; uniform vec3 uRim;
        const int N = ${RT_TEXELS};
        // 0 = empty, 1 = hidden behind the city, 2 = visible
        int cls(ivec2 t) {
          if (t.x < 0 || t.y < 0 || t.x >= N || t.y >= N) return 0;
          float a = texelFetch(uRT, t, 0).a;
          return a > 0.75 ? 2 : a > 0.25 ? 1 : 0;
        }
        void main() {
          // Texel inside the target (row 0 = top; the lattice travels with the goose), worked out from this fragment's
          // own device pixel. A pixel centre that falls exactly on a texel boundary then resolves the same way every
          // frame; an interpolated quad coordinate would let it flip with rounding noise and the edge would flicker.
          vec2 dev = vec2(gl_FragCoord.x - 0.5 - uDev.x, uDev.w - gl_FragCoord.y - 0.5 - uDev.y);   // whole px from the corner
          vec2 l = clamp(floor((dev + 0.5) / uDev.z), 0.0, float(N - 1));
          ivec2 t = ivec2(int(l.x), N - 1 - int(l.y));          // render targets are bottom-up
          int c = cls(t);
          vec4 o = vec4(0.0);
          if (c == 2) {
            o = vec4(texelFetch(uRT, t, 0).rgb, 1.0);
          } else if (c == 1) {
            if (mod(l.x + l.y, 2.0) < 0.5) o = vec4(uFill, 1.0);   // 50% stipple
          } else {
            int n0 = cls(t + ivec2(1, 0)), n1 = cls(t - ivec2(1, 0)), n2 = cls(t + ivec2(0, 1)), n3 = cls(t - ivec2(0, 1));
            if (n0 == 1 || n1 == 1 || n2 == 1 || n3 == 1) o = vec4(uOutline, 1.0);
            else if (n0 == 2 || n1 == 2 || n2 == 2 || n3 == 2) o = vec4(uRim, ${RIM_ALPHA.toFixed(2)});
          }
          if (o.a <= 0.0) discard;
          gl_FragColor = vec4(o.rgb * o.a, o.a);                 // premultiplied
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), this.blitMaterial);
    quad.frustumCulled = false;
    this.blitScene.add(quad);
  }

  /** Render the goose at `a` for the given map viewport (the one the base canvas was drawn with). */
  render(a: GooseAttitude, vp: Viewport): void {
    this.layout(a, vp);
    this.uniforms.uWinOrigin.value.set(this.heights.originX, this.heights.originY);
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.clear(true, true, false);
    r.render(this.scene, this.camera);
    r.setRenderTarget(null);
    r.clear(true, true, false);
    // particles first, at their true positions; the goose blit then draws over them
    if (this.particles.alive) {
      this.particles.setTexelSize(this.rect.artPerTexel * vp.view.zoom * vp.dpr);
      r.render(this.particleScene, this.screenCamera);
    }
    const u = this.blitMaterial.uniforms;
    u.uRect.value.set(this.rect.x0 + this.snap.x, this.rect.y0 + this.snap.y, this.rect.size, this.rect.artPerTexel);
    u.uView.value.set(vp.view.cx, vp.view.cy, vp.view.zoom, 0);
    u.uViewport.value.set(vp.width, vp.height);
    u.uDev.value.set(this.corner.x, this.corner.y, this.rect.artPerTexel * vp.view.zoom * vp.dpr, Math.round(vp.height * vp.dpr));
    r.render(this.blitScene, this.blitCamera);
  }

  /**
   * Take-off warm-up: size the drawing buffer and link every shader program, so none of it lands in the first frames of
   * the flight. Resolves when the programs are ready (without blocking where the browser can compile in parallel).
   */
  prepare(vp: Viewport): Promise<unknown> {
    this.resize(vp);
    const r = this.renderer;
    return Promise.all([
      r.compileAsync(this.scene, this.camera), r.compileAsync(this.particleScene, this.screenCamera), r.compileAsync(this.blitScene, this.blitCamera),
    ]);
  }

  /** Upload the height window now. It is 9.4 MB; left alone, the first draw uploads it. */
  uploadHeights(): void { this.renderer.initTexture(this.uniforms.uHeights.value); }

  /** Clear the visible canvas (actor idle). */
  clear(): void {
    this.renderer.setRenderTarget(null);
    this.renderer.clear(true, true, false);
  }

  /** Project a world point through the actual render camera and blit mapping: canvas px. */
  projectToCanvas(x: number, y: number, z: number): [number, number] {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const half = this.rect.size / 2;
    return [this.rect.x0 + half + v.x * half, this.rect.y0 + half - v.y * half];
  }

  /**
   * Read back the render target (after render()): counts of visible and hidden goose texels.
   * Test / debug use only (synchronous GPU readback).
   */
  readCoverage(): { visible: number; hidden: number } {
    const px = new Uint8Array(RT_TEXELS * RT_TEXELS * 4);
    this.renderer.readRenderTargetPixels(this.rt, 0, 0, RT_TEXELS, RT_TEXELS, px);
    let visible = 0, hidden = 0;
    for (let k = 3; k < px.length; k += 4) {
      if (px[k] > 191) visible++;
      else if (px[k] > 64) hidden++;
    }
    return { visible, hidden };
  }

  /**
   * Classify the actor canvas pixels drawn in the last render (read back right after render(); test / debug only):
   * stipple fill and outline of the hidden goose, the rim, and normally shaded goose pixels.
   */
  readBlit(vp: Viewport): { fill: number; outline: number; rim: number; shaded: number } {
    const gl = this.renderer.getContext(), d = vp.dpr;
    const W = Math.round(vp.width * d), H = Math.round(vp.height * d);
    const sx = (this.rect.x0 - vp.view.cx) * vp.view.zoom + vp.width / 2, sy = (this.rect.y0 - vp.view.cy) * vp.view.zoom + vp.height / 2;
    const side = this.rect.size * vp.view.zoom;
    // one device px of margin: the blit is nudged onto whole device pixels (see layout)
    const x0 = Math.max(0, Math.floor(sx * d) - 1), x1 = Math.min(W, Math.ceil((sx + side) * d) + 1);
    const y0 = Math.max(0, Math.floor(sy * d) - 1), y1 = Math.min(H, Math.ceil((sy + side) * d) + 1);
    const out = { fill: 0, outline: 0, rim: 0, shaded: 0 };
    if (x1 <= x0 || y1 <= y0) return out;
    const px = new Uint8Array((x1 - x0) * (y1 - y0) * 4);
    gl.readPixels(x0, H - y1, x1 - x0, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const near = (k: number, hex: number) =>
      Math.abs(px[k] - ((hex >> 16) & 255)) < 3 && Math.abs(px[k + 1] - ((hex >> 8) & 255)) < 3 && Math.abs(px[k + 2] - (hex & 255)) < 3;
    for (let k = 0; k < px.length; k += 4) {
      const a = px[k + 3];
      if (!a) continue;
      if (a < 250) out.rim++;
      else if (near(k, HIDDEN_FILL)) out.fill++;
      else if (near(k, HIDDEN_OUTLINE)) out.outline++;
      else out.shaded++;
    }
    return out;
  }

  dispose(): void {
    this.goose.dispose();
    this.particles.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.blitMaterial.dispose();
    (this.blitScene.children[0] as THREE.Mesh).geometry.dispose();
    this.rt.dispose();
    this.uniforms.uHeights.value.dispose();
    this.renderer.dispose();
  }

  // ------------------------------------------------------------------ internals

  /**
   * Size the drawing buffer for the viewport, in device px rounded as MapView rounds its canvases (three.js floors
   * width * ratio, which is a pixel short at a fractional devicePixelRatio). One reallocation; setPixelRatio then
   * setSize would make two.
   */
  resize(vp: Viewport): void {
    const r = this.renderer, size = r.getSize(SIZE), w = Math.round(vp.width * vp.dpr), h = Math.round(vp.height * vp.dpr);
    if (r.getPixelRatio() !== 1 || size.x !== w || size.y !== h) r.setDrawingBufferSize(w, h, 1);
  }

  /** Size the canvas, pose the goose and fit the cameras: the target's around the goose, the particles' to the viewport. */
  private layout(a: GooseAttitude, vp: Viewport): void {
    this.resize(vp);

    const g = this.goose;
    g.group.position.set(a.x, a.y, a.z);
    g.group.rotation.set(a.bank, -a.pitch, a.heading);
    g.setFlap(a.flapPhase, a.flapAmount);
    if (g.pose.legs !== a.legs) g.setPose({ legs: a.legs });
    g.group.updateMatrixWorld(true);

    // texel = max(1 artwork px, 1 device px); the rectangle is centred on the goose itself (see the header)
    const z = vp.view.zoom, k = z * vp.dpr;                    // device px per canvas px
    const s = Math.max(1, 1 / k);
    const f = this.frame;
    const c = f.worldToCanvas(a.x, a.y, a.z);
    const size = RT_TEXELS * s;
    Object.assign(this.rect, { x0: c.cx - size / 2, y0: c.cy - size / 2, size, artPerTexel: s });
    // The blit is nudged so the rectangle's corner lands on a whole device pixel of this view, the grid the map tiles
    // are placed on (MapRenderer.drawBase rounds the same expression). `rect` itself stays exact: it is what the
    // camera, projectToCanvas and the shadow use.
    const devX = ((this.rect.x0 - vp.view.cx) * z + vp.width / 2) * vp.dpr, devY = ((this.rect.y0 - vp.view.cy) * z + vp.height / 2) * vp.dpr;
    this.corner.set(Math.round(devX), Math.round(devY));
    this.snap.set((this.corner.x - devX) / k, (this.corner.y - devY) / k);

    // cameras: view-space x / y are canvas px * mpp; the eye sits CAMERA_STANDOFF_M in front of the goose
    const [R, U, B] = [f.right, f.up, f.back];
    const D = c.depth + CAMERA_STANDOFF_M;
    const fit = (cam: THREE.OrthographicCamera, cx: number, cy: number, halfW: number, halfH: number) => {
      const X = cx * f.mpp, Y = -cy * f.mpp;
      cam.position.set(X * R[0] + Y * U[0] + D * B[0], X * R[1] + Y * U[1] + D * B[1], X * R[2] + Y * U[2] + D * B[2]);
      cam.up.set(U[0], U[1], U[2]);
      cam.lookAt(cam.position.x - B[0], cam.position.y - B[1], cam.position.z - B[2]);
      cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
    };
    fit(this.camera, c.cx, c.cy, (size * f.mpp) / 2, (size * f.mpp) / 2);                                     // the target, about the goose
    fit(this.screenCamera, vp.view.cx, vp.view.cy, (vp.width / 2 / z) * f.mpp, (vp.height / 2 / z) * f.mpp);  // the viewport
  }

  private gooseMaterial(hex: number, sun: THREE.Vector3): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uColor: { value: srgb(hex) }, uSun: { value: sun } },
      blending: THREE.NoBlending,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${FRAME_GLSL}
        uniform vec3 uColor; uniform vec3 uSun;
        varying vec3 vWorld;
        void main() {
          // flat facet normal from screen derivatives, turned toward the camera
          vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
          if (dot(n, uBack) < 0.0) n = -n;
          float ndl = dot(n, uSun);
          // three flat tones like the artwork's light / mid / shade, the shade side cooled slightly. Each step is spread
          // over a narrow band, so a flat wing panel banking through a threshold changes tone over a few frames, not in one.
          float lit = smoothstep(0.10, 0.20, ndl);
          float tone = mix(mix(0.7, 0.88, lit), 1.06, smoothstep(0.50, 0.60, ndl));
          vec3 col = uColor * tone * mix(vec3(0.9, 0.95, 1.08), vec3(1.0), lit);
          vec2 c = worldToCanvas(vWorld);
          float h = surfaceHeight(c);
          bool hidden = known(h) && depthOf(vWorld) < depthAt(c, h) - ${OCCLUSION_BIAS_M.toFixed(2)};
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), hidden ? 0.5 : 1.0);
        }`,
    });
  }
}

/** Vertex shader for a unit quad placed over a canvas-px rectangle (uRect.xy origin, uRect.z size) on the map viewport. */
export const QUAD_VERTEX = /* glsl */ `
  uniform vec4 uRect;
  uniform vec4 uView;
  uniform vec2 uViewport;
  varying vec2 vCanvas;
  void main() {
    vCanvas = uRect.xy + position.xy * uRect.z;
    vec2 s = (vCanvas - uView.xy) * uView.z;                 // CSS px from the screen centre
    gl_Position = vec4(s.x / (uViewport.x * 0.5), -s.y / (uViewport.y * 0.5), 0.0, 1.0);
  }`;
