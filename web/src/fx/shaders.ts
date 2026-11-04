// GLSL for the effects compositor. Three passes:
//   PREP  (blur resolution): downsampled base colour + circle of confusion (CoC) in alpha
//   BLUR  (blur resolution): golden-angle gather blur weighted by each tap's own CoC
//   FINAL (device resolution, to screen): base + life animation, mixed with the blur by the per-pixel CoC
// Conventions: `p` is a device-pixel centre in the base canvas with y pointing DOWN (row 0 = top of the screen).
// Uploaded canvases and offscreen targets both store row 0 at the top, so they are sampled with uv = p / size.

const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

/** Shared screen -> canvas mapping and the depth-aware CoC (prep + final). */
const COC = `
uniform vec2 uSize;          // base canvas size in device px
uniform sampler2D uHeight;   // packed heights (RGB bytes), screen aligned, any resolution
uniform vec2 uHeightDec;     // (1 / units_per_m, floor_m)
uniform vec3 uDepth;         // e_depth = |z*x + p.y*y + z|  (depth offset from focus / viewport height)
uniform vec2 uRow;           // (focus row in device px, row weight / viewport height in device px)
uniform vec3 uCoc;           // (max CoC device px, sharp band edge, full-blur edge)

// Decode the packed height at p with an exact texel fetch: interpolating packed bytes would corrupt them.
float surfaceZ(vec2 p) {
  ivec2 hs = textureSize(uHeight, 0);
  ivec2 t = clamp(ivec2(p / uSize * vec2(hs)), ivec2(0), hs - 1);
  vec3 b = floor(texelFetch(uHeight, t, 0).rgb * 255.0 + 0.5);
  return b.b > 127.5 ? (b.r * 256.0 + b.g) * uHeightDec.x + uHeightDec.y : 0.0;  // invalid / no data: datum ground
}

// Circle of confusion radius (device px): grows with the depth distance from the focus surface (expressed in
// screen px so the look is zoom independent) and mildly with the screen-row distance (miniature look).
float cocAt(vec2 p) {
  float e = abs(surfaceZ(p) * uDepth.x + p.y * uDepth.y + uDepth.z) + abs(p.y - uRow.x) * uRow.y;
  return uCoc.x * smoothstep(uCoc.y, uCoc.z, e);
}
`;

export const PREP_FS = `${HEADER}${COC}
uniform sampler2D uBase;
uniform vec2 uTargetSize;    // blur target size in px
uniform float uBlurScale;    // blur resolution / device resolution (1 or 0.5)
uniform float uCocLimit;     // CoC (blur px) stored as alpha = coc / limit
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / uTargetSize;
  vec3 col = textureLod(uBase, uv, 0.0).rgb;   // bilinear: at half resolution this is the mean of the 2x2 block
  float coc = cocAt(uv * uSize) * uBlurScale;
  outColor = vec4(col, clamp(coc / uCocLimit, 0.0, 1.0));
}`;

export const BLUR_FS = `${HEADER}
uniform sampler2D uPrep;
uniform float uCocLimit;
out vec4 outColor;

const int TAPS = 24;
const float GOLDEN_ANGLE = 2.39996323;

// Gather blur on a golden-angle spiral covering this pixel's CoC. A tap only contributes when its own CoC reaches
// back to this pixel, so a sharp foreground (small CoC) does not bleed into the blurred background around it.
// The spiral is rotated per pixel (interleaved gradient noise) so its sparse taps do not alias into streaks on
// regular artwork such as parking stripes; the residual fine noise is removed by the tent filter in FINAL.
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec2 texel = 1.0 / vec2(textureSize(uPrep, 0));
  vec4 c0 = texelFetch(uPrep, q, 0);
  float r0 = c0.a * uCocLimit;
  vec3 sum = c0.rgb;
  float wsum = 1.0;
  if (r0 >= 0.5) {
    float spin = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    for (int k = 0; k < TAPS; k++) {
      float fk = float(k) + 0.5;
      float r = r0 * sqrt(fk / float(TAPS));
      float a = fk * GOLDEN_ANGLE + spin;
      vec4 s = textureLod(uPrep, (gl_FragCoord.xy + r * vec2(cos(a), sin(a))) * texel, 0.0);
      float w = smoothstep(r - 1.0, r + 0.5, s.a * uCocLimit);
      sum += s.rgb * w;
      wsum += w;
    }
  }
  outColor = vec4(sum / wsum, c0.a);
}`;

export const FINAL_FS = `${HEADER}${COC}
uniform sampler2D uBase;
uniform sampler2D uLife;     // R sway weight, G canopy, B water; screen aligned, any resolution
uniform sampler2D uBlur;
uniform bool uLifeOn;
uniform bool uTiltOn;
uniform vec2 uOrigin;        // canvas px at the top-left device pixel
uniform vec2 uCanvasPerDev;  // canvas px per device px
uniform float uArtToDev;     // device px per artwork (canvas) px = zoom * dpr
uniform vec2 uTime;          // (tree time stepped at 8 Hz, water time stepped at 6 Hz), seconds
out vec4 outColor;

// pcg3d integer hash -> [0, 1)
float rnd(ivec3 c) {
  uvec3 v = uvec3(c) * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return float(v.x >> 8) * (1.0 / 16777216.0);
}

float valueNoise(vec2 x, int seed) {
  vec2 i = floor(x), f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  ivec2 c = ivec2(i);
  return mix(mix(rnd(ivec3(c, seed)), rnd(ivec3(c + ivec2(1, 0), seed)), f.x),
             mix(rnd(ivec3(c + ivec2(0, 1), seed)), rnd(ivec3(c + ivec2(1, 1), seed)), f.x), f.y);
}

vec4 lifeAt(vec2 p) {
  ivec2 ls = textureSize(uLife, 0);
  return texelFetch(uLife, clamp(ivec2(p / uSize * vec2(ls)), ivec2(0), ls - 1), 0);
}

// Wind displacement (artwork px, before the sway weight) at canvas px c: gust fronts drift across the map and
// modulate a slow back-and-forth sway whose phase varies smoothly from tree to tree.
vec2 sway(vec2 c, float t) {
  float gust = smoothstep(0.3, 0.8, valueNoise(c / 190.0 - vec2(0.55, 0.12) * t, 1));
  float phase = valueNoise(c / 36.0, 2) * 6.2832;
  return vec2(sin(t * 4.4 + phase) * (0.3 + 0.7 * gust), 0.35 * gust * sin(t * 3.1 + phase * 1.7));
}

// Water: gentle brightness ripples (horizontally stretched noise bands drifting with the current, quantised to
// three levels) and sparse short glints that appear on ripple crests. Colour only - pixels never move, so nothing
// outside the water mask can change.
vec3 water(vec3 col, vec2 c, float t) {
  vec2 a = floor(c);
  float n = valueNoise(vec2(a.x / 22.0 + t * 0.5, a.y / 5.0 - t * 0.15), 3);
  float level = n > 0.64 ? 1.0 : (n < 0.3 ? -1.0 : 0.0);
  col *= 1.0 + 0.035 * level;
  ivec2 cell = ivec2(floor((a.x + t * 3.0) / 3.0), int(a.y));
  if (level > 0.0 && rnd(ivec3(cell, int(floor(t * 2.0)))) > 0.985) col = mix(col, vec3(1.0, 0.98, 0.9), 0.55);
  return col;
}

vec3 animateLife(vec3 col, vec2 p) {
  vec4 L = lifeAt(p);
  vec2 c = uOrigin + p * uCanvasPerDev;
  if (L.g > 0.5) {
    vec2 d = 1.6 * L.r * sway(floor(c), uTime.x);
    // whole artwork pixels when zoomed in; whole device pixels (sub-artwork-pixel) when zoomed out
    vec2 off = uArtToDev >= 1.0 ? round(round(d) * uArtToDev) : round(d * uArtToDev);
    vec2 q = p - off;
    // only pull colour from another canopy pixel, so walls, roofs and roads never smear
    if (off != vec2(0.0) && all(greaterThanEqual(q, vec2(0.0))) && all(lessThan(q, uSize)) && lifeAt(q).g > 0.5) {
      col = texelFetch(uBase, ivec2(q), 0).rgb;
    }
  }
  if (L.b > 0.5) col = water(col, c, uTime.y);
  return col;
}

// Small tent filter over the (lower resolution) blur target to hide residual tap structure.
vec3 blurAt(vec2 uv) {
  vec2 t = 0.5 / vec2(textureSize(uBlur, 0));
  return 0.25 * (textureLod(uBlur, uv + vec2(-t.x, -t.y), 0.0).rgb + textureLod(uBlur, uv + vec2(t.x, -t.y), 0.0).rgb
               + textureLod(uBlur, uv + vec2(-t.x, t.y), 0.0).rgb + textureLod(uBlur, uv + vec2(t.x, t.y), 0.0).rgb);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y - gl_FragCoord.y);
  vec3 col = texelFetch(uBase, ivec2(p), 0).rgb;
  if (uLifeOn) col = animateLife(col, p);
  if (uTiltOn) {
    float k = smoothstep(0.5, 1.5, cocAt(p));
    if (k > 0.0) col = mix(col, blurAt(p / uSize), k);
  }
  outColor = vec4(col, 1.0);
}`;

export const PREP_UNIFORMS = ['uSize', 'uHeight', 'uHeightDec', 'uDepth', 'uRow', 'uCoc', 'uBase', 'uTargetSize', 'uBlurScale', 'uCocLimit'] as const;
export const BLUR_UNIFORMS = ['uPrep', 'uCocLimit'] as const;
export const FINAL_UNIFORMS = [
  'uSize', 'uHeight', 'uHeightDec', 'uDepth', 'uRow', 'uCoc', 'uBase', 'uLife', 'uBlur', 'uLifeOn', 'uTiltOn',
  'uOrigin', 'uCanvasPerDev', 'uArtToDev', 'uTime',
] as const;
