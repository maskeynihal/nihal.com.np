/**
 * Putting the headphones on and taking them off, as pure numbers (no three.js, no DOM).
 *
 * The object is authoritative: this module says where the headphones are at each moment, and the
 * Scene puts the hands on the headphones' grip points, so a hand never lags the thing it holds.
 * Everything is given for a right-handed lead (the hand nearer the headphones); `dev-anim` mirrors
 * it for the left.
 *
 * On: the lead hand reaches over and closes on the band, lifts the headphones in front of the face
 * (turning them upright), the other hand takes the far cup, both slide to the cups and spread them,
 * up over the crown, back, and down until the cups sit on the ears; the hands let go, slide down
 * and go home, and the head nods to settle them.
 * Off is the same the other way round, a little quicker, ending with the headphones set down.
 *
 * Two frames: the desk frame (chair frame before the swivel) while the hand carries them from the
 * desk, and the head's frame for everything near the head, so the pass over the head never depends
 * on how the head is turned. `k` blends the two while the headphones are held in front of the face.
 */
import { HAND_OFFSET, HIP, LEAN, WRIST_REST, neckAt, type V3 } from './rig';

/** The headphones' own geometry (model frame: base origin, hoop in the xy plane, cups on x). */
export const HP_BAND_TOP = 0.184;
export const HP_CUP_X = 0.116;
export const HP_CUP_Y = 0.03805;
export const HP_CUP_R = 0.04;
export const HP_BAND_R = 0.012;
/** Extra width of the hoop when the cups are pulled apart (1 + this). */
export const HP_SPREAD = 0.12;
/** Where the base origin is when worn (head frame: its origin is the neck pivot). */
export const HP_WORN: V3 = [0, 0.066, 0.006];
/** Held up in front of the face, level with the eyes, clear of the face. */
export const HP_FRONT: V3 = [0, 0.08, -0.22];
/** The pass over the head: up in front, back over the crown, then straight down. */
export const HP_RISE: V3 = [0, 0.17, -0.2];
export const HP_ABOVE: V3 = [0, 0.17, 0.006];
/** How far the hoop is tipped back (top towards the back of the head) at the top of the pass. */
export const HP_TIP = 0.3;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const ease = (u: number) => u * u * (3 - 2 * u);
const sm = (x: number, a: number, b: number) =>
  ease(clamp((x - a) / (b - a), 0, 1));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/** Rotates about x: positive tips +y towards +z. */
export const rotX = (v: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
};
const rotY = (v: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};

/** A point of the headphones (model frame, right-handed lead: the lead's cup is at +x) and where a hand goes on them. */
export function gripLocal(
  kind: 'band' | 'cup',
  sign: 1 | -1,
  spread: number,
): V3 {
  if (kind === 'band') return [0, HP_BAND_TOP + 0.004, 0];
  const s = 1 + HP_SPREAD * spread;
  // the palm on the outside of the cup
  return [sign * (HP_CUP_X + 0.042 / s), HP_CUP_Y, 0];
}

/** Model-frame point to the frame the object is posed in: origin `b`, tipped by `pitch`, hoop widened by `spread`. */
export function objPoint(b: V3, pitch: number, spread: number, p: V3): V3 {
  const s = 1 + HP_SPREAD * spread;
  return add3(b, rotX([p[0] * s, p[1], p[2]], pitch));
}

/** Where the head is (enough to aim the hands before the Scene takes over exactly). */
export interface HeadCtx {
  /** Forward lean beyond the rest pose, and the head's own pitch (radians). */
  lean: number;
  pitch: number;
  /** Hips' offset and rise, in the right-handed (mirrored) desk frame. */
  pos: V3;
  yaw: number;
}

/** A point in the head's frame, in the desk frame. */
export function headToDesk(h: HeadCtx, p: V3): V3 {
  const rest = neckAt(LEAN);
  // the torso turns about the hip pivot; the head's own frame turns by the pitch alone
  const n = add3(HIP, rotX(sub3(rest, HIP), -h.lean));
  const q = rotX(p, h.pitch);
  const root: V3 = [n[0] + q[0], n[1] + q[1], n[2] + q[2]];
  return add3(rotY(root, h.yaw), h.pos);
}

/** A hand coming down from the head to the keys: it drops along the side of the head first, then sweeps in. */
function swoop(p0: V3, p2: V3, g: number): V3 {
  const c: V3 = [p0[0] * 0.75 + p2[0] * 0.25, p2[1] + 0.1, (p0[2] + p2[2]) / 2];
  const a = (1 - g) * (1 - g);
  const b = 2 * (1 - g) * g;
  const d = g * g;
  return [
    a * p0[0] + b * c[0] + d * p2[0],
    a * p0[1] + b * c[1] + d * p2[1],
    a * p0[2] + b * c[2] + d * p2[2],
  ];
}

const wristOf = (c: V3): V3 => [
  c[0] - HAND_OFFSET[0],
  c[1] - HAND_OFFSET[1],
  c[2] - HAND_OFFSET[2],
];

export interface HpIn {
  /** Seconds into the segment. */
  t: number;
  on: boolean;
  /** Where the headphones rest (base origin, desk frame) and how they are tipped (about x) there. */
  rest: V3;
  restPitch: number;
  head: HeadCtx;
  /** Where each hand was when it started. */
  leadFrom: V3;
  auxFrom: V3;
  /** The lead's resting wrist and the aux's. */
  leadHome: V3;
  auxHome: V3;
}

export interface HpOut {
  /** The headphones are moved by the animation (held, or worn). */
  active: boolean;
  /** They are on the head now (hands off). */
  worn: boolean;
  /** The sitter's "headphones on" flag changes at this moment. */
  cans: boolean;
  /** 0 posed in the desk frame, 1 in the head's frame. */
  k: number;
  desk: V3;
  deskPitch: number;
  head: V3;
  headPitch: number;
  spread: number;
  /** How firmly each hand is on the headphones (0 free, 1 locked to the grip), and the lead's grip moving band to cup. */
  leadW: number;
  leadReg: number;
  auxW: number;
  /** Where the hands go when they are free of the grip (and the grips, approximately, when they are on). */
  lead: V3;
  aux: V3;
  /** The chair rolls up to the headphones and the sitter leans in: 0..1. */
  roll: number;
  /** Looks at the headphones' resting place. */
  look: boolean;
  /** Head nod to settle them (radians of pitch) and a little tilt. */
  nod: number;
  tilt: number;
  /** The segment is over (the sitter is back to typing). */
  end: number;
}

export const HP_ON_END = 2.85;
export const HP_OFF_END = 2.1;
/** When the hoop is on the ears / is set down on the desk. */
export const HP_SEATED = 2.05;
export const HP_SET_DOWN = 1.55;

export function hpPlan(i: HpIn): HpOut {
  const t = i.t;
  const { rest, restPitch: rp, head } = i;
  const F = HP_FRONT;
  const Fd = headToDesk(head, F);
  let a: number;
  let b: number;
  let c: number;
  let k: number;
  let u: number;
  let pd: number;
  let spread: number;
  let leadW: number;
  let leadReg: number;
  let auxW: number;
  let roll: number;
  let look: boolean;
  let nod = 0;
  let tilt = 0;
  let cans: boolean;
  let end: number;
  let worn = false;
  let active = true;
  if (i.on) {
    // lifted from the desk to the front of the face, then over the head and down
    u = sm(t, 0.68, 1.28);
    pd = rp * (1 - sm(t, 0.68, 1.15));
    k = sm(t, 1.2, 1.36);
    a = sm(t, 1.36, 1.6);
    b = sm(t, 1.54, 1.78);
    c = sm(t, 1.78, HP_SEATED);
    spread = sm(t, 1.26, 1.5) * (1 - sm(t, HP_SEATED, HP_SEATED + 0.25));
    leadW = sm(t, 0.5, 0.65) * (1 - sm(t, HP_SEATED, HP_SEATED + 0.15));
    leadReg = sm(t, 1.26, 1.48);
    auxW = sm(t, 1.16, 1.3) * (1 - sm(t, HP_SEATED, HP_SEATED + 0.15));
    roll = sm(t, 0, 0.6) * (1 - sm(t, 1.4, 2.2));
    look = t < 0.95;
    cans = t >= HP_SEATED;
    worn = t >= HP_SEATED + 0.15;
    nod = 0.1 * Math.sin(Math.PI * sm(t, HP_SEATED, HP_SEATED + 0.5));
    tilt =
      0.05 * Math.sin(2 * Math.PI * sm(t, HP_SEATED + 0.05, HP_SEATED + 0.6));
    end = HP_ON_END;
  } else {
    c = 1 - sm(t, 0.5, 0.7);
    b = 1 - sm(t, 0.66, 0.84);
    a = 1 - sm(t, 0.8, 0.98);
    k = 1 - sm(t, 0.95, 1.1);
    u = sm(t, 1.05, HP_SET_DOWN);
    pd = rp * u;
    spread = sm(t, 0.36, 0.52) * (1 - sm(t, 1.1, 1.45));
    leadW = sm(t, 0.26, 0.38) * (1 - sm(t, HP_SET_DOWN, HP_SET_DOWN + 0.12));
    leadReg = 1 - sm(t, 0.98, 1.15);
    auxW = sm(t, 0.26, 0.38) * (1 - sm(t, 0.98, 1.1));
    roll = sm(t, 0.9, 1.3) * (1 - sm(t, 1.65, 2.05));
    look = t > 0.9;
    cans = t < 0.5;
    active = t < HP_SET_DOWN;
    end = HP_OFF_END;
  }
  const bh = add3(
    add3(
      add3(F, [
        (HP_RISE[0] - F[0]) * a,
        (HP_RISE[1] - F[1]) * a,
        (HP_RISE[2] - F[2]) * a,
      ]),
      [
        (HP_ABOVE[0] - HP_RISE[0]) * b,
        (HP_ABOVE[1] - HP_RISE[1]) * b,
        (HP_ABOVE[2] - HP_RISE[2]) * b,
      ],
    ),
    [
      (HP_WORN[0] - HP_ABOVE[0]) * c,
      (HP_WORN[1] - HP_ABOVE[1]) * c,
      (HP_WORN[2] - HP_ABOVE[2]) * c,
    ],
  );
  const ph = HP_TIP * b * (1 - c);
  // the carry between the desk and the front of the face (a small hump so the hoop clears the desk)
  const deskB = add3(i.on ? lerp3(rest, Fd, u) : lerp3(Fd, rest, u), [
    0,
    (i.on ? 0.05 : 0.03) * Math.sin(Math.PI * u),
    0,
  ]);
  const deskP = pd;
  const bAt = lerp3(deskB, headToDesk(head, bh), k);
  const pAt = lerp(deskP, ph, k);
  const gLead = (reg: number): V3 =>
    objPoint(
      bAt,
      pAt,
      spread,
      lerp3(gripLocal('band', 1, spread), gripLocal('cup', 1, spread), reg),
    );
  const gAux = objPoint(bAt, pAt, spread, gripLocal('cup', -1, spread));
  // where the headphones are, and the hands, when they are on the ears (the point the hands leave from)
  const seatB = headToDesk(head, HP_WORN);
  const seatLead = objPoint(seatB, 0, spread, gripLocal('cup', 1, spread));
  const seatAux = objPoint(seatB, 0, spread, gripLocal('cup', -1, spread));
  let lead: V3;
  let aux: V3;
  if (i.on) {
    const reach = sm(t, 0, 0.6);
    lead = lerp3(i.leadFrom, wristOf(gLead(leadReg)), reach);
    lead[1] += 0.05 * Math.sin(Math.PI * reach);
    aux = lerp3(i.auxFrom, wristOf(gAux), sm(t, 0.84, 1.26));
    if (t >= HP_SEATED) {
      const g = sm(t, HP_SEATED, HP_SEATED + 0.6);
      const out = (h: V3, home: V3): V3 => swoop(wristOf(h), home, g);
      lead = out(seatLead, i.leadHome);
      aux = out(seatAux, i.auxHome);
    }
  } else {
    const reach = sm(t, 0, 0.34);
    lead = lerp3(i.leadFrom, wristOf(gLead(leadReg)), reach);
    aux = lerp3(i.auxFrom, wristOf(gAux), reach);
    lead[1] += 0.04 * Math.sin(Math.PI * reach);
    aux[1] += 0.04 * Math.sin(Math.PI * reach);
    if (t >= 0.98) {
      const g = sm(t, 0.98, 1.5);
      // (it leaves from where it let go, not from the cup, which is on its way)
      aux = swoop(hpPlan({ ...i, t: 0.979 }).aux, i.auxHome, g);
    }
    if (t >= HP_SET_DOWN) {
      const g = sm(t, HP_SET_DOWN + 0.02, HP_OFF_END);
      const q = lerp3(
        wristOf(objPoint(rest, rp, 0, gripLocal('band', 1, 0))),
        i.leadHome,
        g,
      );
      q[1] += 0.05 * Math.sin(Math.PI * g);
      lead = q;
    }
  }
  return {
    active,
    worn,
    cans,
    k,
    desk: deskB,
    deskPitch: deskP,
    head: bh,
    headPitch: ph,
    spread,
    leadW,
    leadReg,
    auxW,
    lead,
    aux,
    roll,
    look,
    nod,
    tilt,
    end,
  };
}

/** Rest wrists (right-handed lead). */
export const HP_LEAD_HOME: V3 = [
  -WRIST_REST.l[0],
  WRIST_REST.l[1],
  WRIST_REST.l[2],
];
export const HP_AUX_HOME: V3 = [...WRIST_REST.l];
