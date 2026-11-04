// Map frame math shared by every browser module. Mirrors pipeline/world.py exactly.
// Canvas px (cx, cy): global artwork pixel grid, y down. Tile (i, j) covers [i*F,(i+1)*F) x [j*F,(j+1)*F).
// World: local ENU metres (x east, y north, z up, z relative to manifest.datum_m).
import type { Manifest } from './types';

export type Vec3 = [number, number, number];

export class Frame {
  readonly F: number;
  readonly mpp: number;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly back: Vec3;
  readonly sun: Vec3;
  readonly floorM: number;
  readonly unitsPerM: number;
  readonly heightPx: number;

  constructor(readonly m: Manifest) {
    this.F = m.frame_px; this.mpp = m.camera.meters_per_px;
    this.right = m.camera.right_enu; this.up = m.camera.up_enu; this.back = m.camera.back_enu; this.sun = m.camera.sun_enu;
    this.floorM = m.heights.floor_m; this.unitsPerM = m.heights.units_per_m; this.heightPx = m.height_px;
  }

  /** world -> canvas px + depth (metres toward camera). */
  worldToCanvas(x: number, y: number, z: number): { cx: number; cy: number; depth: number } {
    const r = this.right, u = this.up, b = this.back;
    return {
      cx: (x * r[0] + y * r[1] + z * r[2]) / this.mpp,
      cy: -(x * u[0] + y * u[1] + z * u[2]) / this.mpp,
      depth: x * b[0] + y * b[1] + z * b[2],
    };
  }

  /** canvas px + surface height z -> world point. */
  canvasToWorld(cx: number, cy: number, z: number): Vec3 {
    const r = this.right, u = this.up, b = this.back;
    const X = cx * this.mpp, Y = -cy * this.mpp;
    const t = (z - Y * u[2]) / b[2];
    return [X * r[0] + Y * u[0] + t * b[0], X * r[1] + Y * u[1] + t * b[1], X * r[2] + Y * u[2] + t * b[2]];
  }

  /** depth (toward camera) of the surface seen at canvas px with height z. */
  depthAt(cx: number, cy: number, z: number): number {
    const Y = -cy * this.mpp;
    return (z - Y * this.up[2]) / this.back[2];
  }

  /** decode one packed height texel (R,G,B bytes). Returns NaN when invalid. */
  decodeHeight(r: number, g: number, b: number): number {
    if (b <= 127) return NaN;
    return (r * 256 + g) / this.unitsPerM + this.floorM;
  }

  tileOf(cx: number, cy: number): [number, number] {
    return [Math.floor(cx / this.F), Math.floor(cy / this.F)];
  }
}
