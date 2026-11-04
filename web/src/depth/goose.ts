// Original low-poly Canada goose, built procedurally from three.js primitives (no external assets).
//
// Model frame (metres, real-world size): +X forward (beak), +Y left wing, +Z up; origin at the body centre.
// Wingspan GOOSE_WINGSPAN_M (1.6 m), body length ~0.9 m beak to tail. At the map scale (0.29 m per artwork px) a real-size
// goose is ~5 px long, so the actor should scale the group by ~GOOSE_DISPLAY_SCALE (4-6x) to stay readable.
//
// Rig: body + neck chain (base -> mid -> head) + two wings (shoulder sweep -> arm flap/twist -> hand with lagged flap) + legs.
// setFlap(phase, amount) drives the wing beat; setPose() blends wings folded / legs down / neck upright for ground or water.
// `shadow` is a tiny proxy (one merged torso mesh + two flat wing panels per side) that follows the same wing pose, for a
// shadow / depth pass; give it the goose group's transform (e.g. shadow.matrix.copy(goose.group.matrixWorld)).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const GOOSE_WINGSPAN_M = 1.6;
/** Recommended uniform scale so the goose reads at map scale (actor may pick 4-6). */
export const GOOSE_DISPLAY_SCALE = 5;
/** Radius of a sphere around the origin that encloses the body (wings excluded), real size, for collision sweeps. */
export const GOOSE_BODY_RADIUS_M = 0.4;

export interface GoosePose {
  /** 0 = wings spread for flight, 1 = folded along the body (walking, swimming, perched). */
  fold: number;
  /** 0 = feet tucked back under the tail (flight), 1 = legs down (landing, walking). */
  legs: number;
  /** 0 = neck stretched forward (flight), 1 = upright S-neck (standing, swimming). */
  neck: number;
  /** Head turn left (+) / right (-), radians, applied at the upper neck. */
  headYaw: number;
}

export interface Goose {
  readonly group: THREE.Group;
  readonly shadow: THREE.Group;
  /** phase: radians of the wing-beat cycle (sin(phase) = 1 at the top of the upstroke); amount: 0 glide .. 1 full beat. */
  setFlap(phase: number, amount: number): void;
  setPose(p: Partial<GoosePose>): void;
  readonly pose: Readonly<GoosePose>;
  dispose(): void;
}

// Plumage tones (sRGB). A deliberately small palette: flat shading supplies the light / dark facets.
const TONE = {
  body: 0x8b7b67,      // brown-grey flanks and back
  wing: 0x6d5f50,      // coverts / secondaries
  primary: 0x3a322c,   // dark flight feathers
  breast: 0xd6c8b0,    // pale breast
  white: 0xf2eee6,     // chin strap, undertail
  black: 0x1e1b19,     // neck, head, beak, tail, feet
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ellipsoid from a low-detail icosahedron (faceted, ~80 faces). */
function ellipsoid(rx: number, ry: number, rz: number, detail = 1): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, detail).scale(rx, ry, rz);
}

/** Cylinder of `len` along +Z starting at the origin (for chained segments that rotate about their base). */
function segment(rBase: number, rTip: number, len: number, sides = 5): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rTip, rBase, len, sides, 1).rotateX(Math.PI / 2).translate(0, 0, len / 2);
}

/** Thin flat plate from an outline in (x forward, y span) coordinates, `t` thick, centred on z = 0. */
function plate(outline: [number, number][], t: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }).translate(0, 0, -t / 2);
}

// Wing outlines for the LEFT wing (+Y outward); the right wing mirrors y. Arm = coverts + secondaries, hand = primaries.
const ARM_SPAN = 0.3;
const SHOULDER_Y = 0.11;
const ARM: [number, number][] = [[0.09, 0], [0.075, ARM_SPAN], [-0.17, ARM_SPAN], [-0.2, 0.2], [-0.23, 0.08], [-0.21, 0]];
const HAND: [number, number][] = [
  [0.075, 0], [0.05, 0.14], [-0.01, 0.27], [-0.09, 0.37],      // leading edge to the tip
  [-0.12, 0.35], [-0.13, 0.3], [-0.16, 0.29], [-0.165, 0.22], // notched primary tips
  [-0.19, 0.2], [-0.18, 0.1], [-0.17, 0],
];
const mirror = (o: [number, number][]) => o.map(([x, y]) => [x, -y] as [number, number]);

interface WingRig { shoulder: THREE.Group; arm: THREE.Group; hand: THREE.Group; side: 1 | -1 }

export function createGoose(): Goose {
  const geos: THREE.BufferGeometry[] = [];
  const mats = Object.fromEntries(
    Object.entries(TONE).map(([k, c]) => [k, new THREE.MeshLambertMaterial({ color: c, flatShading: true })]),
  ) as Record<keyof typeof TONE, THREE.MeshLambertMaterial>;
  const mesh = (g: THREE.BufferGeometry, tone: keyof typeof TONE, parent: THREE.Object3D, at?: [number, number, number]) => {
    geos.push(g);
    const m = new THREE.Mesh(g, mats[tone]);
    if (at) m.position.set(...at);
    parent.add(m);
    return m;
  };

  const group = new THREE.Group();
  group.name = 'goose';

  // ---- body: flanks, pale breast pushing out front-below, white vent, dark tail wedge
  const body = new THREE.Group();
  group.add(body);
  mesh(ellipsoid(0.28, 0.145, 0.125), 'body', body);
  mesh(ellipsoid(0.16, 0.12, 0.11), 'breast', body, [0.13, 0, -0.025]);
  mesh(ellipsoid(0.09, 0.08, 0.055), 'white', body, [-0.22, 0, -0.045]);
  const tail = mesh(new THREE.ConeGeometry(0.075, 0.16, 4).rotateZ(Math.PI / 2).scale(1, 1, 0.45), 'black', body, [-0.33, 0, 0.02]);
  tail.rotation.y = 0.1;   // tip slightly raised

  // ---- neck chain: base (at the breast) -> mid -> head; segments run along local +Z and are aimed by their group rotation
  const NECK_LOW = 0.16, NECK_HIGH = 0.14;
  const neckBase = new THREE.Group(); neckBase.position.set(0.22, 0, 0.04); body.add(neckBase);
  mesh(segment(0.058, 0.045, NECK_LOW), 'black', neckBase);
  const neckMid = new THREE.Group(); neckMid.position.set(0, 0, NECK_LOW); neckBase.add(neckMid);
  mesh(ellipsoid(0.046, 0.046, 0.046, 0), 'black', neckMid);
  mesh(segment(0.045, 0.04, NECK_HIGH), 'black', neckMid);
  const head = new THREE.Group(); head.position.set(0, 0, NECK_HIGH); head.rotation.order = 'YZX'; neckMid.add(head);
  // the head's own frame keeps +X forward whatever the neck pitch (re-levelled in applyPose), so yaw is a true head turn
  mesh(ellipsoid(0.075, 0.042, 0.047), 'black', head, [0.03, 0, 0.01]);
  mesh(ellipsoid(0.045, 0.047, 0.03), 'white', head, [0.015, 0, -0.016]);           // chin strap: cheeks + throat
  mesh(new THREE.ConeGeometry(0.02, 0.06, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.7), 'black', head, [0.125, 0, 0.0]);

  // ---- wings
  const makeWing = (side: 1 | -1): WingRig => {
    const shoulder = new THREE.Group(); body.add(shoulder);   // placed by applyWings
    const arm = new THREE.Group(); arm.rotation.order = 'XYZ'; shoulder.add(arm);
    mesh(plate(side > 0 ? ARM : mirror(ARM), 0.024), 'wing', arm);
    const hand = new THREE.Group(); hand.position.set(0, ARM_SPAN * side, 0); arm.add(hand);
    mesh(plate(side > 0 ? HAND : mirror(HAND), 0.018), 'primary', hand);
    return { shoulder, arm, hand, side };
  };
  const wings = [makeWing(1), makeWing(-1)];

  // ---- legs: hip pivots; tarsus hangs along -Z, webbed foot points forward
  const legs: THREE.Group[] = [];
  for (const side of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(-0.03, 0.055 * side, -0.09); body.add(hip);
    mesh(segment(0.014, 0.012, 0.13).rotateX(Math.PI), 'black', hip);
    mesh(new THREE.ConeGeometry(0.045, 0.08, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.2), 'black', hip, [0.03, 0, -0.13]);
    legs.push(hip);
  }

  // ---- shadow proxy: merged static torso (flight neck) + one flat panel per wing segment
  const shadow = new THREE.Group();
  shadow.name = 'goose-shadow';
  // flat wing panels must cast from both faces
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  // (the proxy keeps the flight neck: the neck pose barely changes a shadow a few pixels long)
  const torsoParts = [
    ellipsoid(0.28, 0.145, 0.125, 0),
    new THREE.CylinderGeometry(0.045, 0.05, 0.3, 4).rotateZ(-Math.PI / 2).translate(0.37, 0, 0.07),
    ellipsoid(0.08, 0.045, 0.05, 0).translate(0.57, 0, 0.09),
    new THREE.ConeGeometry(0.075, 0.16, 3).rotateZ(Math.PI / 2).translate(-0.33, 0, 0.02),
  ].map((g) => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g.index ? g.toNonIndexed() : g; });
  const torso = mergeGeometries(torsoParts);
  for (const g of torsoParts) g.dispose();
  if (!torso) throw new Error('goose: shadow torso merge failed');
  geos.push(torso);
  shadow.add(new THREE.Mesh(torso, shadowMat));
  const panel = (outline: [number, number][]) => {
    const g = new THREE.ShapeGeometry(new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))));
    geos.push(g);
    return g;
  };
  const shadowWings: WingRig[] = ([1, -1] as const).map((side) => {
    const shoulder = new THREE.Group(); shadow.add(shoulder);
    const arm = new THREE.Group(); arm.rotation.order = 'XYZ'; shoulder.add(arm);
    arm.add(new THREE.Mesh(panel(side > 0 ? ARM : mirror(ARM)), shadowMat));
    const hand = new THREE.Group(); hand.position.set(0, ARM_SPAN * side, 0); arm.add(hand);
    hand.add(new THREE.Mesh(panel(side > 0 ? HAND : mirror(HAND)), shadowMat));
    return { shoulder, arm, hand, side };
  });

  // ---- pose state
  const pose: GoosePose = { fold: 0, legs: 0, neck: 0, headYaw: 0 };
  let flapPhase = 0, flapAmount = 0;

  const applyWings = (rig: WingRig) => {
    const f = clamp01(pose.fold), s = rig.side;
    const beat = flapAmount * (1 - f);
    const sw = Math.sin(flapPhase);
    // Spread: slight dihedral + beat (rotation.x lifts the tip), small sweep (rotation.z), feathering twist (rotation.y,
    // negative = leading edge up). Folded: swept back along the flank, trailing edge raised over the back, tip lowered.
    rig.shoulder.rotation.z = s * lerp(0.08 - 0.06 * beat * Math.cos(flapPhase), 1.5, f);
    rig.shoulder.position.set(0.08, s * lerp(SHOULDER_Y, 0.05, f), lerp(0.06, 0.07, f));   // folded wings close over the back
    rig.arm.rotation.x = s * lerp(0.1 + 0.75 * beat * sw, -0.32, f);
    rig.arm.rotation.y = lerp(-0.12 * beat * Math.cos(flapPhase), 0.35, f);
    // The hand lags the arm and bends further on the downstroke; folded, it slides back over the arm (no scaling,
    // which would shear the rotated child) so the primaries end near the tail tip, lifted a little to avoid z-fighting.
    rig.hand.rotation.x = s * lerp(0.55 * beat * Math.sin(flapPhase - 0.9), -0.04, f);
    rig.hand.rotation.z = s * lerp(0.12 + 0.1 * beat * Math.max(0, -sw), 0.1, f);
    rig.hand.position.set(0, s * lerp(ARM_SPAN, 0.06, f), lerp(0, 0.018, f));
  };

  const applyPose = () => {
    for (const w of wings) applyWings(w);
    for (const w of shadowWings) applyWings(w);
    // neck: flight = stretched forward and slightly up; upright = tall S with the head held level
    const n = clamp01(pose.neck);
    neckBase.rotation.y = lerp(1.35, 0.35, n);    // rotation about Y tips the +Z segment toward +X
    neckMid.rotation.y = lerp(0.1, -0.15, n);
    head.rotation.set(0, -(neckBase.rotation.y + neckMid.rotation.y), pose.headYaw);   // bill level, then turn
    // legs: tucked back flat under the tail in flight, hanging down when landing / walking
    const l = clamp01(pose.legs);
    for (const hip of legs) hip.rotation.y = lerp(1.4, 0, l);
  };

  applyPose();

  return {
    group,
    shadow,
    setFlap(phase: number, amount: number) {
      flapPhase = phase; flapAmount = clamp01(amount);
      for (const w of wings) applyWings(w);
      for (const w of shadowWings) applyWings(w);
    },
    setPose(p: Partial<GoosePose>) {
      Object.assign(pose, p);
      applyPose();
    },
    get pose() { return pose; },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
      shadowMat.dispose();
    },
  };
}
