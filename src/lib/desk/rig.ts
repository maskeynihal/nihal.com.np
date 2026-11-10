/**
 * The developer's skeleton, in plain numbers (no three.js, no DOM), shared by the model generator
 * (`scripts/models`, which draws the rest pose into the GLB and the poster) and by the Scene (which
 * animates the same joints). One place for the dimensions means the poster pose and the live pose
 * can never drift apart.
 *
 * Frame: the chair's axis is the origin, y = 0 is the desk top (the floor is `FLOOR_Y` below it)
 * and the developer faces -z, towards the screen. The people here are drawn at about 0.7 of life
 * size so the desk (1.6 m wide) and the figure sit well together in one frame.
 */
export type V3 = [number, number, number];

export const FLOOR_Y = -0.5;
/** Top of the seat cushion. */
export const SEAT_TOP = -0.19;

/** Pelvis pivot: the torso turns and leans about this point. */
export const HIP: V3 = [0, -0.155, 0.04];
/** Forward lean of the torso at rest (typing), radians. */
export const LEAN = 0.2;
/** Hip pivot to the shoulder line, upright. */
export const TORSO_H = 0.35;
export const SHOULDER_HALF = 0.15;
/** Upright, hip pivot to the neck pivot. */
export const NECK_H = 0.385;
export const HEAD_R = 0.098;
export const UPPER = 0.215;
export const FORE = 0.2;

/** Where the chair stands on the desk, world metres. The developer is placed at the same point. */
export const CHAIR_AT = { x: 0.2, z: 0.79 } as const;

/** A point given upright (as if the torso did not lean) carried to the leaned rest pose. */
export function leaned(p: V3, lean: number = LEAN): V3 {
  const x = p[0] - HIP[0];
  const y = p[1] - HIP[1];
  const z = p[2] - HIP[2];
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  return [HIP[0] + x, HIP[1] + y * c + z * s, HIP[2] - y * s + z * c];
}

/** Shoulder pivot, side -1 (left of the figure, -x) or 1, at the rest lean. */
export function shoulderAt(side: -1 | 1, lean: number = LEAN): V3 {
  return leaned(
    [HIP[0] + side * SHOULDER_HALF, HIP[1] + TORSO_H, HIP[2]],
    lean,
  );
}

export function neckAt(lean: number = LEAN): V3 {
  return leaned([HIP[0], HIP[1] + NECK_H, HIP[2]], lean);
}

/** Head centre, relative to the neck pivot, at rest. */
export const HEAD_OFFSET: V3 = [0, HEAD_R + 0.012, -0.006];

/** Desk items the hands work with, in this frame. The keyboard centre is 0.33 m in front of the chair axis. */
export const KEYBOARD_AT: V3 = [0, 0, -0.33];
export const MOUSE_AT: V3 = [0.32, 0, -0.33];

/** Rest wrist targets: left hand on the keyboard, right hand on the mouse. */
export const WRIST_REST: Record<'l' | 'r', V3> = {
  l: [-0.09, 0.07, -0.28],
  r: [MOUSE_AT[0], 0.075, -0.29],
};

/** Hand centre relative to the wrist pivot (the hand hangs a little below and ahead of it). */
export const HAND_OFFSET: V3 = [0, -0.012, -0.036];
export const HAND_R = 0.03;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Two-bone solve: where the elbow and the wrist go when the shoulder is at `shoulder` and the
 * hand reaches for `target` (clamped to what the arm can reach). `pole` is a direction the elbow
 * leans towards (outwards and down for a person at a desk). Pure.
 */
export function solveArm(
  shoulder: V3,
  target: V3,
  pole: V3,
  l1: number = UPPER,
  l2: number = FORE,
): { elbow: V3; wrist: V3 } {
  const d = sub(target, shoulder);
  const raw = len(d);
  const dir = raw > 1e-6 ? norm(d) : ([0, -1, 0] as V3);
  const dist = Math.min(
    Math.max(raw, Math.abs(l1 - l2) + 1e-3),
    l1 + l2 - 1e-3,
  );
  const wrist: V3 = [
    shoulder[0] + dir[0] * dist,
    shoulder[1] + dir[1] * dist,
    shoulder[2] + dir[2] * dist,
  ];
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  // the pole direction with its component along the arm removed
  const along = dot(pole, dir);
  let perp = norm([
    pole[0] - dir[0] * along,
    pole[1] - dir[1] * along,
    pole[2] - dir[2] * along,
  ]);
  if (len(perp) < 0.5) perp = [0, -1, 0];
  const elbow: V3 = [
    shoulder[0] + dir[0] * a + perp[0] * h,
    shoulder[1] + dir[1] * a + perp[1] * h,
    shoulder[2] + dir[2] * a + perp[2] * h,
  ];
  return { elbow, wrist };
}

/** The elbow pole for each arm: out to the side, down and a little back. */
export const poleFor = (side: -1 | 1, up = 0): V3 => [
  side * 0.55,
  -1 + 1.4 * up,
  0.5,
];

/** The rest pose of both arms: shoulder, elbow and wrist in the dev frame. */
export function restArm(side: -1 | 1): { shoulder: V3; elbow: V3; wrist: V3 } {
  const shoulder = shoulderAt(side);
  const target = WRIST_REST[side < 0 ? 'l' : 'r'];
  const { elbow, wrist } = solveArm(shoulder, target, poleFor(side));
  return { shoulder, elbow, wrist };
}

// ---- legs, standing and the desk's height ---------------------------------------------------

/** Seated pose of each leg: hip, knee and ankle in the chair frame (the feet are flat on the floor). */
export const hipAt = (side: -1 | 1): V3 => [side * 0.07, -0.155, 0.04];
export const kneeAt = (side: -1 | 1): V3 => [side * 0.09, -0.115, -0.255];
export const ankleAt = (side: -1 | 1): V3 => [side * 0.09, -0.43, -0.215];
const dist3 = (a: V3, b: V3) => len(sub(a, b));
export const THIGH = dist3(hipAt(1), kneeAt(1));
export const SHIN = dist3(kneeAt(1), ankleAt(1));
/** The ankle is this high above the floor; the foot hangs below it. */
export const ANKLE_H = ankleAt(1)[1] - FLOOR_Y;
/** How far the hips rise when the sitter stands, metres (the legs end nearly straight). */
export const STAND_RISE = 0.29;
/** How far the desk top rises for standing work. */
export const DESK_RISE = 0.24;
/** The knee points forward (-z) and a little up. */
export const KNEE_POLE: V3 = [0, 0.25, -1];

/** Solves one leg for an ankle target given in the sitter's own frame. */
export function solveLeg(side: -1 | 1, ankle: V3): { knee: V3; ankle: V3 } {
  const s = solveArm(hipAt(side), ankle, KNEE_POLE, THIGH, SHIN);
  return { knee: s.elbow, ankle: s.wrist };
}
