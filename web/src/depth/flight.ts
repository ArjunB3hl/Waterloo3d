// Goose flight model and collision response. Pure TypeScript over CollisionField (no three.js, no DOM), so the same
// deterministic step runs in the live loop and in tests (actor.debug.step).
//
// Response rules (docs/DEPTH.md has the full write-up):
//  - Buildings and terrain are solid. Each sub-step sweeps a sphere of FLIGHT.radius along the motion
//    (CollisionField.sweep with soft trees). Wall hit: keep the non-penetrating contact point, remove the velocity
//    and remaining-motion components into the wall (slide along it), add a small bounce, yaw the goose toward the
//    wall tangent, report a 'wall' event. Up-facing contact (rising ground, a roof step lower than the goose):
//    lift to the hard floor and continue the remaining motion.
//  - Altitude floor: hard floor = solidTop + sweep radius (never violated: the sphere never penetrates); soft floor =
//    solidTop + clearance, approached within ~0.1 s from below so the goose skims and follows slopes and roofs.
//    Over water the clearance and sweep radius shrink so it can skim low.
//  - Trees are soft: inside a crown the target speed drops to FLIGHT.canopySlow (40%) but nothing blocks.
//  - The published-artwork boundary is a fence: motion across it is projected onto the fence (slide) and reported.
//
// Speed as the player sees it: the map is an oblique view, so a metre flown toward the top or bottom of the screen
// covers fewer pixels than a metre flown across it (0.71 of them in this camera). With the screen axes given, the
// target speed is scaled by the direction of travel so the goose crosses the screen at the same rate on every heading
// (FLIGHT.cruise / FLIGHT.boost are the speeds in the fastest-looking direction, where the scale is 1). Turning keeps
// that speed, and the direction of travel follows the heading closely: see the velocity update in substep(). The turn
// rate is scaled the same way (turnScale), so the goose also turns at one rate on screen on every heading.
import type { Vec3 } from '../frame';
import { type CollisionField, KIND_BUILDING, KIND_WATER } from './collision';
import { GOOSE_BODY_RADIUS_M, GOOSE_DISPLAY_SCALE } from './gooseDims';

/** Display scale of the goose model: real size x 5 reads at map scale (~18 artwork px long). */
export const GOOSE_SCALE = GOOSE_DISPLAY_SCALE;

export const FLIGHT = {
  cruise: 14,                 // m/s
  boost: 24,                  // m/s
  canopySlow: 0.4,            // fraction of the target speed inside tree crowns
  turnRate: 1.5,              // rad/s at full input, as seen on screen (see Flight.turnScale)
  climbRate: 6,               // m/s (W / Up)
  diveRate: 9,                // m/s (S / Down)
  flapClimb: 9,               // m/s (Space)
  radius: GOOSE_BODY_RADIUS_M * GOOSE_SCALE,   // 2.8 m collision sphere around the scaled body (0.4 m x 7)
  clearance: GOOSE_BODY_RADIUS_M * GOOSE_SCALE + 0.3,   // soft floor above roofs / ground
  waterRadius: 0.8,           // smaller sphere while skimming water
  waterClearance: 1.0,
  bounce: 1.5,                // m/s pushed back out of a wall
  maxAltitude: 120,           // m above the surface below
  maxZ: 150,                  // m rel. datum (top of the collision data)
  startAltitude: 35,          // m above the surface at start
  maxSubstep: 1 / 60,         // s
} as const;

const SPEED_TAU = 0.6, CANOPY_TAU = 0.25, VZ_TAU = 0.3, TURN_TAU = 0.12, BANK_TAU = 0.2, FLOOR_TAU = 0.1;
const MAX_BANK = 0.6;           // rad at full turn input
const WALL_YAW_RATE = 3;        // rad/s the heading swings toward a wall's tangent while scraping it
const WALL_ROLL = 1.15;         // rad: roll the wall-side wing up while scraping (keeps the 3.9 m half-span out of the facade)
const WALL_ROLL_TAU = 0.35;
const SLIDE_ITERATIONS = 3;
const STEER_TAU = 0.15;         // s for the direction of travel to swing onto the heading (13 degrees behind at full turn rate)
const STEER_MIN_COS = 0.5;      // steering applies while travel is within 60 degrees of the heading ...
const CONTACT_MEMORY_S = 0.6;   // ... and not this soon after a wall or fence contact (see substep)
const MAX_SPEED_SCALE = 2;      // bound on the heading scale, for a camera much flatter than any we draw
const MAX_TURN_SCALE = 2;       // the same bound for the turn-rate scale (it and its inverse)

export interface FlightInput {
  turn: number;      // -1 right .. +1 left (counter-clockwise)
  climb: number;     // -1 dive .. +1 climb
  boost: boolean;
  flap: boolean;     // flap-climb (Space)
}

export const NO_INPUT: FlightInput = { turn: 0, climb: 0, boost: false, flap: false };

export type HitKindName = 'wall' | 'roof' | 'ground' | 'fence';

export interface HitInfo { kind: HitKindName; x: number; y: number; z: number; normal: Vec3; time: number }

export interface FlightState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  heading: number;        // facing, radians counter-clockwise from east
  turn: number;           // smoothed turn input
  bank: number;           // roll, radians (+ = right wing down)
  wallRoll: number;       // extra roll away from a wall being scraped (decays after contact)
  pitch: number;          // radians (+ = nose up)
  flapPhase: number;
  flapAmount: number;
  inCanopy: boolean;
  overWater: boolean;
  surface: number;        // solid top below the goose (NaN when unknown)
  time: number;           // simulated seconds since teleport
  lastHit: HitInfo | null;
  waiting: boolean;       // collision data under the goose not loaded yet: horizontal motion paused
}

/** Horizontal (east, north) parts of the map camera's right and up axes: ground vector -> screen vector. */
export type ScreenAxes = readonly [right: readonly [number, number], up: readonly [number, number]];

export interface StepEvents { wall: HitInfo | null; fence: boolean; canopy: boolean; water: boolean }

const relax = (cur: number, target: number, dt: number, tau: number) => cur + (target - cur) * (1 - Math.exp(-dt / tau));
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class Flight {
  readonly state: FlightState = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, turn: 0, bank: 0, wallRoll: 0, pitch: 0, flapPhase: 0, flapAmount: 0.6,
    inCanopy: false, overWater: false, surface: NaN, time: 0, lastHit: null, waiting: false,
  };

  private readonly axes: ScreenAxes | null;
  private readonly fastest: number;   // on-screen length of a unit ground vector in the fastest-looking direction
  private readonly area: number;      // on-screen area of a unit ground square (|det| of the ground -> screen map)
  /** state.time of the last wall or fence contact (state.lastHit is overwritten by roof and ground contacts too). */
  private lastDeflect = -Infinity;

  /**
   * @param col collision field (chunks around the goose must be loaded; unloaded data pauses horizontal motion)
   * @param fenceNormals horizontal unit vectors of the possible fence orientations (canvas x and y axes on the ground)
   * @param inside true where the goose may fly (published artwork with collision data)
   * @param screenAxes horizontal (east, north) parts of the map camera's right and up axes; when given, speed is
   *   scaled by direction so on-screen speed is the same on every heading. Omitted: ground speed is the same instead.
   */
  constructor(
    private readonly col: CollisionField,
    private readonly fenceNormals: readonly [number, number][],
    private readonly inside: (x: number, y: number, z: number) => boolean,
    screenAxes: ScreenAxes | null = null,
  ) {
    this.axes = screenAxes;
    this.fastest = 1;
    this.area = 1;
    if (screenAxes) {
      // largest stretch of the 2 x 2 ground -> screen map [right; up] (square root of the top eigenvalue of M^T M)
      const [[r0, r1], [u0, u1]] = screenAxes;
      const a = r0 * r0 + u0 * u0, b = r0 * r1 + u0 * u1, c = r1 * r1 + u1 * u1;
      this.fastest = Math.sqrt((a + c) / 2 + Math.hypot((a - c) / 2, b));
      this.area = Math.abs(r0 * u1 - r1 * u0) || 1;
    }
  }

  /**
   * Ground turn rate per unit of FLIGHT.turnRate when facing the unit ground direction (hx, hy). The oblique view also
   * distorts angles: a heading turning at a constant rate over the ground sweeps the screen twice as fast while it
   * points up or down the screen as while it points across it (in this camera), so a steady turn used to hesitate at
   * the sideways headings. With this scale the goose turns at FLIGHT.turnRate on screen on every heading; a full
   * circle still takes the same time (the scale averages to 1 over a revolution).
   */
  turnScale(hx: number, hy: number): number {
    if (!this.axes) return 1;
    const [[r0, r1], [u0, u1]] = this.axes;
    const sx = hx * r0 + hy * r1, sy = hx * u0 + hy * u1;
    return clamp((sx * sx + sy * sy) / this.area, 1 / MAX_TURN_SCALE, MAX_TURN_SCALE);
  }

  /** Ground speed per unit of FLIGHT speed when travelling along the unit ground direction (dx, dy): 1 or more. */
  speedScale(dx: number, dy: number): number {
    if (!this.axes) return 1;
    const [[r0, r1], [u0, u1]] = this.axes;
    const onScreen = Math.hypot(dx * r0 + dy * r1, dx * u0 + dy * u1);
    return onScreen > 0 ? Math.min(MAX_SPEED_SCALE, this.fastest / onScreen) : MAX_SPEED_SCALE;
  }

  /** Horizontal speed with the direction scale taken out: what FLIGHT.cruise / boost mean, and what the HUD shows. */
  nominalSpeed(): number {
    const s = this.state, v = Math.hypot(s.vx, s.vy);
    return v > 1e-6 ? v / this.speedScale(s.vx / v, s.vy / v) : 0;
  }

  /** @param speed in FLIGHT units (cruise / boost): the direction scale is applied, like everywhere else */
  teleport(x: number, y: number, z: number, heading: number, speed: number = FLIGHT.cruise): void {
    const s = this.state, hx = Math.cos(heading), hy = Math.sin(heading), v = speed * this.speedScale(hx, hy);
    this.lastDeflect = -Infinity;
    Object.assign(s, {
      x, y, z, heading, vx: hx * v, vy: hy * v, vz: 0,
      turn: 0, bank: 0, wallRoll: 0, pitch: 0, time: 0, lastHit: null, waiting: false,
    });
    this.updateSurface();
  }

  /** Advance by dt seconds (split into <= 1/60 s sub-steps). Deterministic for a given state, input and field. */
  step(dt: number, input: FlightInput): StepEvents {
    const ev: StepEvents = { wall: null, fence: false, canopy: false, water: false };
    const n = Math.max(1, Math.ceil(dt / FLIGHT.maxSubstep - 1e-9));
    for (let k = 0; k < n; k++) this.substep(dt / n, input, ev);
    return ev;
  }

  /** Wing beat and attitude only (hovering while the camera flies in); position is unchanged. */
  idle(dt: number): void { this.animate(dt, NO_INPUT); }

  // ------------------------------------------------------------------ internals

  private substep(dt: number, input: FlightInput, ev: StepEvents): void {
    const s = this.state, col = this.col;
    s.time += dt;

    // steering: smoothed turn input -> yaw rate and a visual bank into the turn
    s.turn = relax(s.turn, clamp(input.turn, -1, 1), dt, TURN_TAU);
    s.heading = wrapAngle(s.heading + s.turn * FLIGHT.turnRate * this.turnScale(Math.cos(s.heading), Math.sin(s.heading)) * dt);
    s.wallRoll = relax(s.wallRoll, 0, dt, WALL_ROLL_TAU);
    s.bank = relax(s.bank, -s.turn * MAX_BANK + s.wallRoll, dt, BANK_TAU);

    // soft trees: a crown around the body slows the goose
    const canopy = col.canopyTop(s.x, s.y);
    s.inCanopy = canopy > s.z - FLIGHT.radius * 0.5;
    if (s.inCanopy) ev.canopy = true;

    // Horizontal velocity, worked on with the direction scale taken out; the scale for the new direction of travel is
    // put back afterwards, so it follows the direction at once (a turn sweeps through every direction, and a lagging
    // scale would pulse the speed).
    const hx = Math.cos(s.heading), hy = Math.sin(s.heading);
    const v = Math.hypot(s.vx, s.vy);
    const dx = v > 0.01 ? s.vx / v : hx, dy = v > 0.01 ? s.vy / v : hy;
    const scale = this.speedScale(dx, dy);
    const target = (input.boost ? FLIGHT.boost : FLIGHT.cruise) * (s.inCanopy ? FLIGHT.canopySlow : 1);
    const tau = s.inCanopy ? CANOPY_TAU : SPEED_TAU;
    const deflected = s.time - this.lastDeflect < CONTACT_MEMORY_S;
    let wx: number, wy: number;
    if (dx * hx + dy * hy > STEER_MIN_COS && !deflected) {
      // Steering: speed and direction are handled separately. The speed relaxes toward the target as in straight
      // flight, so a turn costs none of it; the direction of travel swings onto the heading within STEER_TAU, so the
      // goose goes where it points instead of sliding on along its old course. (Relaxing the whole vector toward the
      // heading, as below, does both at the slow speed rate: the direction trails a full-rate turn by 41 degrees and
      // the speed settles a quarter lower.)
      const speed = relax(v / scale, target, dt, tau);
      const dir = Math.atan2(dy, dx);
      const to = dir + wrapAngle(s.heading - dir) * (1 - Math.exp(-dt / STEER_TAU));
      wx = Math.cos(to) * speed;
      wy = Math.sin(to) * speed;
    } else {
      // Deflected by a wall or fence, or travelling far off the heading: ease the whole vector back toward the heading,
      // which slows the goose down, stops it and brings it round (walls should cost speed).
      wx = relax(s.vx / scale, hx * target, dt, tau);
      wy = relax(s.vy / scale, hy * target, dt, tau);
    }
    const w = Math.hypot(wx, wy);
    const rescale = w > 1e-6 ? this.speedScale(wx / w, wy / w) : 1;
    s.vx = wx * rescale;
    s.vy = wy * rescale;

    // vertical: climb / dive / flap-climb, otherwise hold altitude
    const climb = clamp(input.climb, -1, 1);
    const vzTarget = input.flap ? FLIGHT.flapClimb : climb > 0 ? climb * FLIGHT.climbRate : climb * FLIGHT.diveRate;
    s.vz = relax(s.vz, vzTarget, dt, VZ_TAU);

    if (!col.isLoaded(s.x, s.y)) { s.waiting = true; this.animate(dt, input); return; }
    s.waiting = false;

    // collide and slide
    let from: Vec3 = [s.x, s.y, s.z];
    let to: Vec3 = [s.x + s.vx * dt, s.y + s.vy * dt, s.z + s.vz * dt];
    const ceiling = this.solid(to[0], to[1]);
    to[2] = Math.min(to[2], FLIGHT.maxZ, (ceiling === -Infinity ? s.surface : ceiling) + FLIGHT.maxAltitude);
    for (let it = 0; it < SLIDE_ITERATIONS; it++) {
      const r = this.radiusAt(from[0], from[1], from[2]);
      const hit = col.sweep(from, to, r, 1, { trees: false });
      if (hit.hit === 'none') { from = to; break; }
      const [nx, ny, nz] = hit.normal;
      const p = hit.point;
      if (nz > 0.5) {
        // rising ground or a low roof step: lift to the hard floor ahead and carry on with the rest of the motion
        s.lastHit = { kind: hit.hit === 'building' ? 'roof' : 'ground', x: p[0], y: p[1], z: p[2], normal: [nx, ny, nz], time: s.time };
        const mid: Vec3 = [(p[0] + to[0]) / 2, (p[1] + to[1]) / 2, 0];
        const lift = Math.max(this.solid(p[0], p[1]), this.solid(mid[0], mid[1]), this.solid(to[0], to[1])) + r + 0.05;
        if (lift === -Infinity) { from = p; break; }        // unknown surface ahead: stop at the contact
        if (s.vz < 0) s.vz = 0;
        from = [p[0], p[1], Math.max(p[2], lift)];          // moving straight up is always free in the column model
        to = [to[0], to[1], Math.max(to[2], lift)];
        continue;
      }
      // wall: slide along it (remove the into-wall component of velocity and remaining motion), bounce a little
      const vn = s.vx * nx + s.vy * ny;
      if (vn < 0) { s.vx -= vn * nx; s.vy -= vn * ny; }
      s.vx += nx * FLIGHT.bounce; s.vy += ny * FLIGHT.bounce;
      const push = hit.t === 0 ? 0.25 : 0.02;                 // started touching: step out of the wall
      from = [p[0] + nx * push, p[1] + ny * push, p[2]];
      const rx = to[0] - p[0], ry = to[1] - p[1], rn = rx * nx + ry * ny;
      to = [from[0] + rx - Math.min(0, rn) * nx, from[1] + ry - Math.min(0, rn) * ny, to[2]];
      // yaw toward the tangent nearest the current heading, so a scrape turns into flying along the wall
      const t1 = Math.atan2(nx, -ny), t2 = wrapAngle(t1 + Math.PI);
      const tangent = Math.abs(wrapAngle(t1 - s.heading)) < Math.abs(wrapAngle(t2 - s.heading)) ? t1 : t2;
      const diff = wrapAngle(tangent - s.heading);
      if (Math.abs(diff) < (75 * Math.PI) / 180) s.heading = wrapAngle(s.heading + clamp(diff, -WALL_YAW_RATE * dt, WALL_YAW_RATE * dt));
      // n points from the wall to the goose; along the goose's right vector > 0 means the wall is on its left
      const side = nx * Math.sin(s.heading) - ny * Math.cos(s.heading);
      if (Math.abs(side * WALL_ROLL) > Math.abs(s.wallRoll)) s.wallRoll = side * WALL_ROLL;
      const info: HitInfo = { kind: 'wall', x: p[0], y: p[1], z: p[2], normal: [nx, ny, 0], time: s.time };
      s.lastHit = info;
      this.lastDeflect = s.time;
      ev.wall ??= info;
      if (it === SLIDE_ITERATIONS - 1) to = from;   // out of iterations: stay at the last safe point
    }

    // the artwork boundary: project motion onto the fence instead of crossing it
    let [x, y, z] = from;
    if (!this.inside(x, y, z)) {
      const dx = x - s.x, dy = y - s.y;
      let moved = false;
      // The edge test depends on altitude too (a higher goose is drawn further up the screen, a lower one further down),
      // so a climb or a dive alone can take it out. Then keep the horizontal move and cancel the vertical one; treating
      // it as a fence would stop the goose dead every step for as long as the key is held. This is not a fence contact.
      let verticalOnly = false;
      if (z !== s.z && this.inside(x, y, s.z) && col.sweep([s.x, s.y, s.z], [x, y, s.z], FLIGHT.radius, 1, { trees: false }).hit === 'none') {
        if ((z - s.z) * s.vz > 0) s.vz = 0;
        z = s.z;
        moved = verticalOnly = true;
      }
      if (!moved) for (const [fx, fy] of this.fenceNormals) {
        const d = dx * fx + dy * fy;
        const cx = s.x + dx - d * fx, cy = s.y + dy - d * fy;
        // the projected point was not part of the sweep above: only take it when it is free as well
        if (this.inside(cx, cy, z) && col.sweep([s.x, s.y, s.z], [cx, cy, z], FLIGHT.radius, 1, { trees: false }).hit === 'none') {
          x = cx; y = cy; moved = true;
          const v = s.vx * fx + s.vy * fy;
          s.vx -= v * fx; s.vy -= v * fy;
          break;
        }
      }
      if (!moved) { x = s.x; y = s.y; z = s.z; s.vx *= -0.3; s.vy *= -0.3; }
      if (!verticalOnly) {
        ev.fence = true;
        s.lastHit = { kind: 'fence', x, y, z, normal: [0, 0, 0], time: s.time };
        this.lastDeflect = s.time;
      }
    }
    s.x = x; s.y = y; s.z = z;

    // altitude floor: hard (sphere never penetrates) and soft (skimming height, approached quickly from below)
    this.updateSurface();
    if (s.surface === s.surface) {
      const water = s.overWater;
      const hard = s.surface + (water ? FLIGHT.waterRadius : FLIGHT.radius) + 0.05;
      const soft = s.surface + (water ? FLIGHT.waterClearance : FLIGHT.clearance);
      if (s.z < soft) {
        s.z = Math.max(hard, relax(s.z, soft, dt, FLOOR_TAU));
        if (s.vz < 0) s.vz = 0;
      }
      if (water && s.z - s.surface < FLIGHT.clearance) ev.water = true;
    }
    this.animate(dt, input);
  }

  /** Visual attitude and wing beat (no effect on the physics). */
  private animate(dt: number, input: FlightInput): void {
    const s = this.state;
    const h = Math.hypot(s.vx, s.vy);
    s.pitch = relax(s.pitch, Math.atan2(s.vz, Math.max(4, h)) * 0.8, dt, 0.25);
    const low = s.surface === s.surface && s.z - s.surface < FLIGHT.clearance + 1.5;
    const amount = input.flap || input.climb > 0.2 ? 1 : input.climb < -0.2 ? 0.12 : low ? 0.3 : input.boost ? 0.9 : 0.6;
    s.flapAmount = relax(s.flapAmount, amount, dt, 0.3);
    const hz = 2.3 + (input.flap || input.boost ? 1.1 : 0) + (s.inCanopy ? 0.8 : 0);
    s.flapPhase = (s.flapPhase + 2 * Math.PI * hz * dt) % (2 * Math.PI);
  }

  private updateSurface(): void {
    const s = this.state;
    s.surface = this.col.solidTop(s.x, s.y);
    s.overWater = (this.col.kind(s.x, s.y) & (KIND_WATER | KIND_BUILDING)) === KIND_WATER;
  }

  /** Smaller sweep sphere while skimming water (so the low skim does not register as ground contact). */
  private radiusAt(x: number, y: number, z: number): number {
    const top = this.col.solidTop(x, y);
    const water = (this.col.kind(x, y) & (KIND_WATER | KIND_BUILDING)) === KIND_WATER;
    return water && z - top < FLIGHT.radius + 0.05 ? FLIGHT.waterRadius : FLIGHT.radius;
  }

  /** solidTop, with -Infinity for unknown data (so Math.max ignores it). */
  private solid(x: number, y: number): number {
    const v = this.col.solidTop(x, y);
    return v === v ? v : -Infinity;
  }
}

function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
