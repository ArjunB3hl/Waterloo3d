// Shadow canvas (CSS mix-blend-mode: multiply): the goose's sun shadow on the illustrated city.
//
// Pass 1: the goose's shadow proxy is rendered from the sun (orthographic light camera tightly around the goose) into
//   a depth texture.
// Pass 2: a quad over the shadow's possible footprint on the map. Each fragment snaps to the actor's pixel grid,
//   reconstructs the visible city surface point from the height window (so roofs, lawns and the facades seen in the
//   artwork all receive it correctly), projects that point into light space and compares with the goose depth.
//   Shadowed fragments output a cool tone; the canvas multiplies it over the map. Unknown heights -> no shadow.
import * as THREE from 'three';
import type { Frame } from '../frame';
import { QUAD_VERTEX, type Viewport } from './actorRenderer';
import type { Goose } from './goose';
import type { HeightWindow } from './heightWindow';
import { FRAME_GLSL, frameUniforms, srgb, type FrameUniforms } from './shaders';

const LIGHT_TEXELS = 128;
const LIGHT_STANDOFF_M = 60;
const SHADOW_TONE = 0x8c9ec7;            // multiplied over the artwork: a cool, translucent blue-grey
const SHADOW_BIAS_M = 0.15;

export class ShadowRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly lightCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2 * LIGHT_STANDOFF_M);
  private readonly lightScene = new THREE.Scene();
  private readonly depth: THREE.WebGLRenderTarget;
  private readonly uniforms: FrameUniforms;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly sun: THREE.Vector3;
  /** Canvas-px square drawn in the last render (x0, y0, size). */
  readonly rect = { x0: 0, y0: 0, size: 0 };

  /**
   * @param radius half extent of the light frustum in metres (encloses the scaled goose in any attitude)
   */
  constructor(canvas: HTMLCanvasElement, private readonly frame: Frame, private readonly heights: HeightWindow,
    private readonly goose: Goose, private readonly radius: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.sun = new THREE.Vector3(...frame.sun).normalize();

    const depthTexture = new THREE.DepthTexture(LIGHT_TEXELS, LIGHT_TEXELS);
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    this.depth = new THREE.WebGLRenderTarget(LIGHT_TEXELS, LIGHT_TEXELS, { depthBuffer: true, depthTexture, generateMipmaps: false });
    // the proxy follows the goose group's world matrix (set each frame); it keeps its own black material
    goose.shadow.matrixAutoUpdate = false;
    this.lightScene.add(goose.shadow);

    this.uniforms = frameUniforms(frame, heights, heights.createTexture());
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...this.uniforms,
        uRect: { value: new THREE.Vector4() }, uView: { value: new THREE.Vector4() }, uViewport: { value: new THREE.Vector2() },
        uLightDepth: { value: depthTexture },
        uLightVP: { value: new THREE.Matrix4() },
        uGoose: { value: new THREE.Vector3() },
        uSun: { value: this.sun },
        uTone: { value: srgb(SHADOW_TONE) },
        uBias: { value: SHADOW_BIAS_M / (2 * LIGHT_STANDOFF_M - 1) },
      },
      depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending,
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        ${FRAME_GLSL}
        uniform vec4 uRect;
        uniform sampler2D uLightDepth;
        uniform mat4 uLightVP;
        uniform vec3 uGoose;
        uniform vec3 uSun;
        uniform vec3 uTone;
        uniform float uBias;
        varying vec2 vCanvas;
        // 1 when the surface point p is behind the goose as seen from the sun
        float shadowed(vec3 p) {
          vec4 l = uLightVP * vec4(p, 1.0);
          vec3 q = l.xyz / l.w * 0.5 + 0.5;
          if (q.x <= 0.0 || q.y <= 0.0 || q.x >= 1.0 || q.y >= 1.0 || q.z >= 1.0) return 0.0;
          return q.z > texture(uLightDepth, q.xy).r + uBias ? 1.0 : 0.0;
        }
        void main() {
          float s = uRect.w;
          vec2 c = (floor(vCanvas / s) + 0.5) * s;              // centre of this actor pixel
          float h = surfaceHeight(c);
          if (!known(h)) discard;
          // four sub-samples inside the pixel -> 0, 1/2 or 1 coverage (a one-step pixel-art edge)
          float cov = 0.0;
          for (int k = 0; k < 4; k++) {
            vec2 o = (vec2(float(k & 1), float(k >> 1)) - 0.5) * 0.5 * s;
            cov += shadowed(canvasToWorld(c + o, h));
          }
          cov = floor(cov / 4.0 * 2.0 + 0.25) / 2.0;
          if (cov <= 0.0) discard;
          // a little lighter when the goose is high above the receiver (sky light fills a distant shadow)
          vec3 p = canvasToWorld(c, h);
          float far = smoothstep(30.0, 110.0, dot(uGoose - p, uSun));
          float a = cov * mix(1.0, 0.55, far);
          gl_FragColor = vec4(uTone * a, a);                     // premultiplied; multiply-blended by CSS
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /**
   * Render the shadow of the goose (its group's matrixWorld must be current) for the viewport.
   * @param surfaceBelow lowest plausible receiver height under the goose (sizes the quad along the sun ray)
   * @param artPerTexel actor pixel size in artwork px (shared grid with the goose)
   */
  render(vp: Viewport, surfaceBelow: number, artPerTexel: number): void {
    const r = this.renderer, f = this.frame, g = this.goose.group.position;
    if (r.getPixelRatio() !== vp.dpr) r.setPixelRatio(vp.dpr);
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== vp.width || size.y !== vp.height) r.setSize(vp.width, vp.height, false);

    // light camera: looks down the sun ray at the goose, frustum just around it
    const L = this.lightCamera, R = this.radius;
    L.up.set(0, 0, 1);
    L.position.copy(g).addScaledVector(this.sun, LIGHT_STANDOFF_M);
    L.lookAt(g);
    L.left = -R; L.right = R; L.top = R; L.bottom = -R;
    L.updateProjectionMatrix();
    L.updateMatrixWorld(true);
    this.goose.shadow.matrix.copy(this.goose.group.matrixWorld);
    this.goose.shadow.matrixWorldNeedsUpdate = true;
    r.setRenderTarget(this.depth);
    r.clear(true, true, false);
    r.render(this.lightScene, L);

    // receiver quad: bounding square of the goose's shadow ray from the goose down to the lowest receiver
    const t1 = Math.max(0, (g.z - surfaceBelow) / this.sun.z);
    const a = f.worldToCanvas(g.x, g.y, g.z);
    const b = f.worldToCanvas(g.x - this.sun.x * t1, g.y - this.sun.y * t1, g.z - this.sun.z * t1);
    const m = (R / f.mpp) * 1.2 + 2 * artPerTexel;
    const x0 = Math.min(a.cx, b.cx) - m, y0 = Math.min(a.cy, b.cy) - m;
    const side = Math.max(Math.abs(a.cx - b.cx), Math.abs(a.cy - b.cy)) + 2 * m;
    Object.assign(this.rect, { x0, y0, size: side });

    const u = this.material.uniforms;
    u.uRect.value.set(x0, y0, side, artPerTexel);
    u.uView.value.set(vp.view.cx, vp.view.cy, vp.view.zoom, 0);
    u.uViewport.value.set(vp.width, vp.height);
    u.uLightVP.value.multiplyMatrices(L.projectionMatrix, L.matrixWorldInverse);
    u.uGoose.value.copy(g);
    this.uniforms.uWinOrigin.value.set(this.heights.originX, this.heights.originY);
    r.setRenderTarget(null);
    r.clear(true, true, false);
    r.render(this.scene, this.camera);
  }

  clear(): void {
    this.renderer.setRenderTarget(null);
    this.renderer.clear(true, true, false);
  }

  /**
   * Alpha-weighted centroid of the shadow in CSS px, read back right after render() (test / debug only).
   * Returns null when no shadow pixel is on screen.
   */
  readCentroid(vp: Viewport): { x: number; y: number; pixels: number } | null {
    const gl = this.renderer.getContext();
    const d = vp.dpr, W = Math.round(vp.width * d), H = Math.round(vp.height * d);
    const [sx0, sy0] = [(this.rect.x0 - vp.view.cx) * vp.view.zoom + vp.width / 2, (this.rect.y0 - vp.view.cy) * vp.view.zoom + vp.height / 2];
    const side = this.rect.size * vp.view.zoom;
    const x0 = Math.max(0, Math.floor(sx0 * d)), x1 = Math.min(W, Math.ceil((sx0 + side) * d));
    const y0 = Math.max(0, Math.floor(sy0 * d)), y1 = Math.min(H, Math.ceil((sy0 + side) * d));
    if (x1 <= x0 || y1 <= y0) return null;
    const w = x1 - x0, h = y1 - y0, px = new Uint8Array(w * h * 4);
    gl.readPixels(x0, H - y1, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);   // GL rows are bottom-up
    let sum = 0, sx = 0, sy = 0, n = 0;
    for (let row = 0; row < h; row++)
      for (let col = 0; col < w; col++) {
        const a = px[(row * w + col) * 4 + 3];
        if (!a) continue;
        const X = x0 + col + 0.5, Y = H - (H - y1 + row) - 0.5;
        sum += a; sx += a * X; sy += a * Y; n++;
      }
    return n ? { x: sx / sum / d, y: sy / sum / d, pixels: n } : null;
  }

  dispose(): void {
    this.lightScene.remove(this.goose.shadow);
    this.material.dispose();
    (this.scene.children[0] as THREE.Mesh).geometry.dispose();
    this.depth.depthTexture?.dispose();
    this.depth.dispose();
    this.uniforms.uHeights.value.dispose();
    this.renderer.dispose();
  }
}
