// GLSL shared by the actor and shadow passes: map frame transforms and height-window sampling.
// Everything here mirrors web/src/frame.ts exactly (canvas px <-> local ENU metres, depth toward the camera).
import * as THREE from 'three';
import type { Frame } from '../frame';
import { HEIGHT_UNKNOWN, type HeightWindow } from './heightWindow';

/** Uniforms read by FRAME_GLSL. One object per renderer; `uHeights` must be that renderer's own texture. */
export interface FrameUniforms {
  [name: string]: THREE.IUniform;
  uRight: THREE.IUniform<THREE.Vector3>;
  uUp: THREE.IUniform<THREE.Vector3>;
  uBack: THREE.IUniform<THREE.Vector3>;
  uMpp: THREE.IUniform<number>;
  uHeights: THREE.IUniform<THREE.Texture>;
  uWinOrigin: THREE.IUniform<THREE.Vector2>;   // canvas px of the window's top-left corner
  uWinTexels: THREE.IUniform<number>;          // window side in height texels
}

export function frameUniforms(frame: Frame, win: HeightWindow, heights: THREE.Texture): FrameUniforms {
  return {
    uRight: { value: new THREE.Vector3(...frame.right) },
    uUp: { value: new THREE.Vector3(...frame.up) },
    uBack: { value: new THREE.Vector3(...frame.back) },
    uMpp: { value: frame.mpp },
    uHeights: { value: heights },
    uWinOrigin: { value: new THREE.Vector2(win.originX, win.originY) },
    uWinTexels: { value: win.texels },
  };
}

export const FRAME_GLSL = /* glsl */ `
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uBack;
uniform float uMpp;
uniform highp sampler2D uHeights;
uniform vec2 uWinOrigin;
uniform float uWinTexels;

const float HEIGHT_UNKNOWN = ${HEIGHT_UNKNOWN.toFixed(1)};

vec2 worldToCanvas(vec3 p) { return vec2(dot(p, uRight), -dot(p, uUp)) / uMpp; }
float depthOf(vec3 p) { return dot(p, uBack); }

/** Surface depth (toward the camera) seen at canvas px c when the visible surface there has height z (frame.depthAt). */
float depthAt(vec2 c, float z) { float Y = -c.y * uMpp; return (z - Y * uUp.z) / uBack.z; }

/** World point of the visible surface at canvas px c with height z (frame.canvasToWorld). */
vec3 canvasToWorld(vec2 c, float z) {
  float X = c.x * uMpp, Y = -c.y * uMpp;
  float t = (z - Y * uUp.z) / uBack.z;
  return X * uRight + Y * uUp + t * uBack;
}

/** Decoded visible-surface height at canvas px c (one texel per 2x2 artwork px); HEIGHT_UNKNOWN outside / missing. */
float surfaceHeight(vec2 c) {
  vec2 a = floor(c * 0.5);                 // texel on the whole-map grid
  vec2 t = a - uWinOrigin * 0.5;           // the same texel relative to the window (its origin is on an even px)
  if (t.x < 0.0 || t.y < 0.0 || t.x >= uWinTexels || t.y >= uWinTexels) return HEIGHT_UNKNOWN;
  // the window array is a ring (heightWindow.ts). Wrapped in integers: a float mod() may return the full size on a
  // multiple of it where division is not exactly rounded, and that texel is outside the texture.
  int W = int(uWinTexels);
  ivec2 r = ivec2(a) % W;
  r += W * ivec2(lessThan(r, ivec2(0)));
  return texelFetch(uHeights, r, 0).r;
}
bool known(float h) { return h > HEIGHT_UNKNOWN + 1.0; }
`;

const NO_IMAGE = { data: new Float32Array(1), width: 1, height: 1 };

/** A renderer's R32F texture over the height window (nearest, no mipmaps), registered for block uploads. */
export function heightTexture(win: HeightWindow, renderer: THREE.WebGLRenderer): THREE.DataTexture {
  const make = () => {
    const t = new THREE.DataTexture(win.array, win.texels, win.texels, THREE.RedFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.flipY = false;
    t.unpackAlignment = 4;
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  const tex = make();
  tex.needsUpdate = true;
  // A second texture object over the same array that is never rendered with, so it has no GL texture of its own:
  // copyTextureToTexture() then reads it from the CPU array and uploads only the requested block (texSubImage2D).
  const source = make();
  source.image = NO_IMAGE;                 // it points at the window array only during a copy, so release() really frees it
  const region = new THREE.Box2(), at = new THREE.Vector2();
  // copyTextureToTexture() saves and restores these unpack parameters; three.js only knows a value once it has set it
  // and otherwise asks the GPU process, a blocking round trip each. Setting the defaults here keeps that off the frame.
  const gl = renderer.getContext() as WebGL2RenderingContext;
  for (const name of [gl.UNPACK_ROW_LENGTH, gl.UNPACK_IMAGE_HEIGHT, gl.UNPACK_SKIP_PIXELS, gl.UNPACK_SKIP_ROWS, gl.UNPACK_SKIP_IMAGES]) {
    renderer.state.pixelStorei(name, 0);
  }
  win.register(tex, (x, y, size) => {
    source.image = tex.image;              // release() / a fresh array re-point tex.image
    region.min.set(x, y);
    region.max.set(x + size, y + size);
    renderer.copyTextureToTexture(source, tex, region, at.set(x, y));
    source.image = NO_IMAGE;
  });
  return tex;
}

/** sRGB hex -> components, untouched by three's colour management (we shade directly in the artwork's sRGB space). */
export function srgb(hex: number): THREE.Vector3 {
  return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}
