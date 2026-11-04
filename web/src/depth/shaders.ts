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
  vec2 t = floor((c - uWinOrigin) * 0.5);
  if (t.x < 0.0 || t.y < 0.0 || t.x >= uWinTexels || t.y >= uWinTexels) return HEIGHT_UNKNOWN;
  return texelFetch(uHeights, ivec2(t), 0).r;
}
bool known(float h) { return h > HEIGHT_UNKNOWN + 1.0; }
`;

/** A renderer's R32F texture over the height window (nearest, no mipmaps), registered for uploads. */
export function heightTexture(win: HeightWindow): THREE.DataTexture {
  const tex = new THREE.DataTexture(win.array, win.texels, win.texels, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.unpackAlignment = 4;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  win.register(tex);
  return tex;
}

/** sRGB hex -> components, untouched by three's colour management (we shade directly in the artwork's sRGB space). */
export function srgb(hex: number): THREE.Vector3 {
  return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}
