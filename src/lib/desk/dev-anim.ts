import { clearArms, clearanceBack } from './body-collide';
import {
  HP_AUX_HOME,
  HP_LEAD_HOME,
  HP_OFF_END,
  HP_ON_END,
  HP_WORN,
  hpPlan,
} from './headphones-anim';
import {
  DESK_RISE,
  FLOOR_Y,
  STAND_RISE,
  HAND_OFFSET,
  HEAD_OFFSET,
  MOUSE_AT,
  WRIST_REST,
  neckAt,
  type V3,
} from './rig';

/**
 * The developer's animation, as a pure state machine: no three.js, no DOM, no clock of its own.
 * `update(dt, env)` returns the pose to draw (joint angles and where the hands go, in the chair
 * frame); the Scene turns that into rotations with the same two-bone solve the poster pose uses.
 *
 * Two layers. The idle loop sets what the developer is doing: typing, a stretch of mousing, a
 * sip from the mug, leaning back with hands behind the head. A tap on something sets a reaction
 * that takes over for a few seconds (wave, spin, type fast, put the headphones on, shrug), and
 * a glance at something on the desk can overlay either. Hands, torso and head are springs that
 * chase the targets, so nothing snaps. The random choices come from a seeded generator, so a run
 * is the same every time (and testable).
 */

export type ReactionKind =
  | 'wave'
  | 'spin'
  | 'fast'
  | 'mouse'
  | 'sip'
  | 'cans'
  | 'shrug'
  | 'nod'
  | 'walk'
  | 'reach'
  | 'tether';

type Kind =
  'type' | 'mouse' | 'lean' | 'sip' | 'startle' | 'think' | ReactionKind;

/** One shot of the reset: the way to turn to (a chair yaw) and the place to aim at (chair frame). */
export interface Shot {
  yaw: number;
  at: V3;
}

export interface Env {
  /** The chair yaw that turns the sitter to face the viewer. */
  viewYaw: number;
  /** The mug's base point in the chair frame, or null when it is not there to be reached. */
  mug: V3 | null;
  /** Things on the desk worth a glance (chair frame). */
  interest: readonly V3[];
  /** Where the left hand picks something up for a 'reach' (chair frame), or null. */
  reach?: V3 | null;
  /** Where the headphones are on the desk (their base, chair frame), or null when they cannot be picked up. */
  hp?: V3 | null;
  /** How the headphones lie on the desk: tipped about x (0 stood on their cups, a quarter turn flat). */
  hpPitch?: number;
  /** How far the drawer's tray is out, 0..1. */
  drawer?: number;
  /** The pointer, from -1 to 1 across and up the canvas (up is positive), and whether it moved lately. */
  gaze?: { x: number; y: number; fresh: boolean } | null;
}

export interface Pose {
  chairYaw: number;
  /** Forward lean beyond the rest pose, radians (negative leans back). */
  lean: number;
  torsoYaw: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  /** Wrist targets in the chair frame *before* the chair's swivel (the desk does not turn with it). */
  l: V3;
  r: V3;
  /** Key depress per row of the keyboard, 0..1. */
  keys: [number, number, number, number];
  /** Keystrokes so far (the screen scrolls with it). */
  typed: number;
  /** Mouse shell offset on the desk (m) and its click depress, 0..1. */
  mouse: { dx: number; dz: number; click: number };
  /** Mug moved by the hand: offset from where it stands (m) and tilt (rad), or null. */
  mug: { dx: number; dy: number; dz: number; tilt: number } | null;
  /** Headphones are on. */
  cans: boolean;
  /** 0 seated, 1 standing (eased). */
  stand: number;
  /** 0 desk at sitting height, 1 raised for standing work (eased). */
  desk: number;
  /** Where the sitter's hips are, relative to the seated pose: sideways, forwards and the rise (m). */
  pos: { x: number; z: number };
  rootY: number;
  /** The floor's height in the desk-top frame (the desk rises, so the floor drops). */
  floorY: number;
  /** Walking: the gait's phase (cycles) and how much of it there is, 0..1. */
  gait: { phase: number; amp: number };
  /** The chair rolled out of the way while the sitter stands: offset and turn. */
  chair: { x: number; z: number; turn: number };
  /** How far each elbow is raised (0 hanging, 1 out level), so the arm clears the desk edge. */
  elbow: [number, number];
  /**
   * The headphones. While `active` the Scene moves them (held, or worn): posed in the desk frame
   * (`desk`, `deskPitch`) and/or the head's frame (`head`, `headPitch`), blended by `k`, hoop
   * widened by `spread`. The hands go onto their grip points (weights `lead.w` and `aux.w`), the
   * lead being the hand `side` (the one nearer them); the wrist targets in `l` and `r` apply to the
   * rest of the time.
   */
  hp: {
    active: boolean;
    worn: boolean;
    k: number;
    desk: V3;
    deskPitch: number;
    head: V3;
    headPitch: number;
    spread: number;
    side: 'l' | 'r';
    lead: { w: number; reg: number };
    aux: { w: number };
  };
  /** The left hand holds something up (during a 'reach'): what it holds goes where the hand is. */
  carry: boolean;
  /** Breathing, -1..1 (the chest rises a little), and a slow shift of weight, radians. */
  breath: number;
  torsoRoll: number;
  /** Counts up each time the hand knocks the mug over (the Scene tips it, and the coffee runs out). */
  knocks: number;
  /** Counts up on every mouse click (the screen flashes the cursor). */
  clicks: number;
  /** What is going on now (tests, the screen). */
  kind: Kind;
}

export interface DevAnim {
  update(dt: number, env: Env): Pose;
  /** A tap's reaction. For 'cans', `cans` is whether the headphones end up on or off. */
  trigger(
    kind: ReactionKind,
    opts?: { cans?: boolean; items?: number; shots?: Shot[] },
  ): void;
  /** The head follows a point (chair frame) for a moment. */
  glanceAt(p: V3): void;
  /** True while the headphones are on. */
  cansOn(): boolean;
  /** Raise the desk for standing work (the sitter stands) or lower it again. */
  setDeskUp(up: boolean): void;
  deskUp(): boolean;
  /** True while the sitter is on their feet (standing at the desk, or walking). */
  standing(): boolean;
  /**
   * Calm mode (reduced motion): no idle loop, no glances, no walk; the pose is the drawn one, and a
   * tap gives a short nod. Standing and sitting still happen, in about 160 ms.
   */
  setCalm(on: boolean): void;
  /** Back to the first idle segment, hands home. */
  reset(): void;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const ease = (u: number) => u * u * (3 - 2 * u);
const wrap = (a: number) => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};
const follow = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const rotY = (v: V3, a: number): V3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
};
/** 0 to 1 and back: up over the first `a`, flat, down over the last `b` of the unit interval. */
const envelope = (u: number, a: number, b: number) =>
  ease(clamp(u / a, 0, 1)) * ease(clamp((1 - u) / b, 0, 1));

/** A critically damped spring: eases in and out, never overshoots, and carries its speed over a change of target. */
interface Damp {
  x: number;
  v: number;
}
const damper = (x = 0): Damp => ({ x, v: 0 });
function damp(d: Damp, target: number, omega: number, dt: number): number {
  const e = Math.exp(-omega * dt);
  const delta = d.x - target;
  const temp = (d.v + omega * delta) * dt;
  d.v = (d.v - omega * temp) * e;
  d.x = target + (delta + temp) * e;
  return d.x;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The walk, in the chair frame: out round the right end of the desk and back, with a look at the
 * plant on the way. The chair has rolled to the left; the sitter never goes near the desk.
 */
const WALK_PTS: [number, number][] = [
  [0, 0],
  [0.7, 0.19],
  [1.02, -0.17],
  [1.02, -0.74],
];
const WALK_SPEED = 0.42;
const WALK_LEN = WALK_PTS.slice(1).reduce((n, p, i) => {
  const q = WALK_PTS[i]!;
  return n + Math.hypot(p[0] - q[0], p[1] - q[1]);
}, 0);
const T_UP = 1.6;
const T_STRETCH = 1.7;
const T_OUT = T_UP + T_STRETCH;
const T_PAUSE = T_OUT + WALK_LEN / WALK_SPEED;
const T_BACK = T_PAUSE + 1.8;
const T_SIT = T_BACK + WALK_LEN / WALK_SPEED;
export const WALK_DUR = T_SIT + 2.2;
/** Strides per second of one leg when walking at WALK_SPEED with a 0.2 m stride. */
export const GAIT_RATE = WALK_SPEED / 0.4;
const PLANT_LOOK: V3 = [0.68, 0.1, -1.19];
/** Torso lean taken out when standing (the sitter leans over the keys; the stander does not). */
const STAND_LEAN = -0.15;

/** The point `d` metres along the walk, and the way it is heading there (outbound direction). */
function walkAt(d: number): { x: number; z: number; dx: number; dz: number } {
  let left = Math.min(Math.max(d, 0), WALK_LEN);
  for (let i = 1; i < WALK_PTS.length; i++) {
    const a = WALK_PTS[i - 1]!;
    const b = WALK_PTS[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= l || i === WALK_PTS.length - 1) {
      const u = l > 0 ? Math.min(left / l, 1) : 0;
      return {
        x: a[0] + (b[0] - a[0]) * u,
        z: a[1] + (b[1] - a[1]) * u,
        dx: (b[0] - a[0]) / l,
        dz: (b[1] - a[1]) / l,
      };
    }
    left -= l;
  }
  return { x: 0, z: 0, dx: 0, dz: -1 };
}

/** The reset: the seconds before the first shot, and each shot's slot (turn, aim, throw, pull). */
export const TETHER_START = 0.3;
export const TETHER_SLOT = 1.2;

const KB_RIGHT: V3 = [0.09, 0.07, -0.28];
const MOUSE_WRIST: V3 = [MOUSE_AT[0], 0.075, -0.29];
const DURATION: Record<Kind, number> = {
  type: 6,
  mouse: 3.4,
  lean: 5.2,
  sip: 3.6,
  wave: 4.4,
  spin: 1.9,
  fast: 3.4,
  cans: HP_ON_END,
  shrug: 1.7,
  nod: 1.2,
  walk: WALK_DUR,
  reach: 3.4,
  startle: 3.0,
  think: 3.4,
  tether: 3.2,
};
/** The sitter's mouth, and the wrist that holds the mug there. */
const MOUTH_HAND: V3 = [0.0, 0.3, -0.19];
const MOUTH_WRIST: V3 = [
  MOUTH_HAND[0] - HAND_OFFSET[0],
  MOUTH_HAND[1] - HAND_OFFSET[1],
  MOUTH_HAND[2] - HAND_OFFSET[2],
];
const MUG_GRIP = 0.045;

const headAt = (): V3 => {
  const n = neckAt();
  return [n[0] + HEAD_OFFSET[0], n[1] + HEAD_OFFSET[1], n[2] + HEAD_OFFSET[2]];
};

/** Yaw (relative to the chair) and pitch to look at `p`, both in radians. */
export function lookAngles(
  p: V3,
  chairYaw: number,
): { yaw: number; pitch: number } {
  const h = headAt();
  const dx = p[0] - h[0];
  const dy = p[1] - h[1];
  const dz = p[2] - h[2];
  return {
    yaw: wrap(Math.atan2(-dx, -dz) - chairYaw),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
  };
}

interface Seg {
  kind: Kind;
  t: number;
  dur: number;
  /** Click times (s) inside a mouse segment, already fired. */
  fired: number;
  /** When (s into a mouse segment) the hand knocks the mug, or -1. */
  knock: number;
}

export function createDevAnim(
  seed = 7,
  opts: { solid?: boolean } = {},
): DevAnim {
  const solid = opts.solid ?? true;
  const rand = rng(seed);
  // its own stream, so the knocks do not change anything else that is random
  const knockRand = rng(seed + 991);
  const between = (a: number, b: number) => a + (b - a) * rand();

  const idlePlan: Kind[] = [
    'type',
    'mouse',
    'type',
    'think',
    'type',
    'lean',
    'type',
    'mouse',
    'type',
    'sip',
  ];
  let planAt = 0;
  let calm = false;
  let knocks = 0;
  let lastKnock = -1000;
  let knockM: V3 | null = null;
  let deskWanted = false;
  let standCh = 0;
  let deskCh = 0;
  let gaitPhase = 0;
  let gaitAmp = 0;
  let walkLooked = false;
  const pos = { x: 0, z: 0 };
  let seg: Seg = { kind: 'type', t: 0, dur: 6, fired: 0, knock: -1 };
  let reacting = false;

  let yaw = 0;
  const dYaw = damper();
  const dLean = damper();
  const dTorso = damper();
  const dHeadYaw = damper();
  const dHeadPitch = damper();
  const dHeadRoll = damper();
  const dL = [
    damper(WRIST_REST.l[0]),
    damper(WRIST_REST.l[1]),
    damper(WRIST_REST.l[2]),
  ];
  const dR = [
    damper(WRIST_REST.r[0]),
    damper(WRIST_REST.r[1]),
    damper(WRIST_REST.r[2]),
  ];
  let gazeW = 0;
  let tapSide = false;
  let shots: Shot[] = [];
  let yawStart = 0;
  let lean = 0;
  let torsoYaw = 0;
  let headYaw = 0;
  let headPitch = 0;
  let headRoll = 0;
  let l: V3 = [...WRIST_REST.l];
  let r: V3 = [...WRIST_REST.r];
  let typed = 0;
  let clicks = 0;
  let cans = false;
  let strokeClock = 0;
  const keys: [number, number, number, number] = [0, 0, 0, 0];
  const tap = { l: 0, r: 0 };
  let mouseOff = { dx: 0, dz: 0 };
  let mouseClick = 0;
  let mugOff: Pose['mug'] = null;
  let clock = 0;
  let look: { p: V3; t: number; dur: number; viewer: boolean } | null = null;
  let cansWanted = false;
  /** How far the body and the chair are held back from the desk (m), so nothing goes in. */
  const held = { body: 0, chair: 0, elbow: [0, 0] as [number, number] };
  /** Where the hands were when the headphones were tapped. */
  let cansFrom: { l: V3; r: V3 } | null = null;
  let nextGlance = between(5, 9);

  const startSeg = (kind: Kind) => {
    seg = {
      kind,
      t: 0,
      dur: calm && kind === 'nod' ? 0.6 : DURATION[kind],
      fired: 0,
      knock: -1,
    };
    if (kind === 'spin') yawStart = yaw;
    if (
      kind === 'type' ||
      kind === 'mouse' ||
      kind === 'lean' ||
      kind === 'sip'
    )
      seg.dur = DURATION[kind] * between(0.85, 1.25);
  };

  const nextIdle = (env: Env) => {
    reacting = false;
    if (calm) {
      startSeg('type');
      return;
    }
    for (let i = 0; i < idlePlan.length; i++) {
      const k = idlePlan[planAt % idlePlan.length]!;
      planAt += 1;
      if (k === 'sip' && !env.mug) continue;
      // a stander does not lean back with hands behind the head
      if (k === 'lean' && (deskWanted || standCh > 0.5)) continue;
      startSeg(k);
      // now and then (about one mouse stretch in six, never twice in a minute) the hand knocks the mug
      if (
        k === 'mouse' &&
        env.mug &&
        knockRand() < 1 / 6 &&
        clock - lastKnock > 60
      ) {
        seg.knock = 1.9;
        lastKnock = clock;
        knockM = env.mug;
      }
      return;
    }
    startSeg('type');
  };

  return {
    cansOn: () => cans,
    setDeskUp(up) {
      deskWanted = up;
    },
    deskUp: () => deskWanted,
    standing: () => standCh > 0.5,
    setCalm(on) {
      calm = on;
      if (on) {
        look = null;
        reacting = false;
        startSeg('type');
      }
    },
    trigger(kind, opts) {
      if (calm) {
        // gentle: the headphones go on or off at once, everything else is a nod
        if (kind === 'cans') cans = opts?.cans ?? !cans;
        if (kind === 'reach') return;
        reacting = true;
        startSeg('nod');
        return;
      }
      reacting = true;
      if (kind === 'cans') {
        cansWanted = opts?.cans ?? !cans;
        cansFrom = { l: [...l], r: [...r] };
      }
      startSeg(kind);
      // the tether lasts as long as the last object takes to come home
      if (kind === 'tether') {
        shots = opts?.shots ?? [];
        seg.dur = TETHER_START + Math.max(1, shots.length) * TETHER_SLOT + 1.4;
      }
      if (kind === 'cans') seg.dur = cansWanted ? HP_ON_END : HP_OFF_END;
    },
    glanceAt(p) {
      look = { p, t: 0, dur: 1.7, viewer: false };
    },
    reset() {
      seg = { kind: 'type', t: 0, dur: 6, fired: 0, knock: -1 };
      reacting = false;
      look = null;
      cans = false;
      mugOff = null;
      yaw = 0;
      for (const d of [dYaw, dLean, dTorso, dHeadYaw, dHeadPitch, dHeadRoll]) {
        d.x = 0;
        d.v = 0;
      }
      lean = 0;
      torsoYaw = 0;
      headYaw = 0;
      headPitch = 0;
      headRoll = 0;
      l = [...WRIST_REST.l];
      r = [...WRIST_REST.r];
      for (let i = 0; i < 3; i++) {
        dL[i]!.x = WRIST_REST.l[i]!;
        dL[i]!.v = 0;
        dR[i]!.x = WRIST_REST.r[i]!;
        dR[i]!.v = 0;
      }
      mouseOff = { dx: 0, dz: 0 };
      deskWanted = false;
      pos.x = 0;
      pos.z = 0;
    },
    update(rawDt, env) {
      const dt = clamp(rawDt, 0, 0.1);
      clock += dt;
      seg.t += dt;
      if (seg.t >= seg.dur) {
        if (seg.kind === 'spin') {
          yaw = yawStart;
          dYaw.x = yawStart;
          dYaw.v = 0;
        }
        nextIdle(env);
      }
      const u = clamp(seg.t / seg.dur, 0, 1);

      // ---- targets for this segment ---------------------------------------------------
      let tl: V3 = [...WRIST_REST.l];
      let tr: V3 = [...KB_RIGHT];
      let yawT = 0;
      let leanT = 0;
      let pitchT = 0.03;
      let rollT = 0;
      let typingRate = 0;
      const addL: V3 = [0, 0, 0];
      const addR: V3 = [0, 0, 0];
      let mouseT = { dx: 0, dz: 0 };
      let mugHeld: { base: V3; tilt: number } | null = null;
      let lookT: { yaw: number; pitch: number } | null = null;
      // looks at a point whatever else is going on (the reset aims at each thing; the headphones)
      let forcedLook: V3 | null = null;
      let posTx = 0;
      let posTz = 0;
      const hp: Pose['hp'] = {
        active: cans,
        worn: cans,
        k: 1,
        desk: [0, 0, 0],
        deskPitch: 0,
        head: [...HP_WORN],
        headPitch: 0,
        spread: 0,
        side: 'r',
        lead: { w: 0, reg: 1 },
        aux: { w: 0 },
      };
      let spring = true;
      // where the hips are now: lifted by standing, dropped by the desk's rise (the floor goes down)
      const standE = ease(standCh);
      const deskE = ease(deskCh);
      // (the hips dip at each footfall and rise as the leg passes)
      const bobY =
        gaitAmp * 0.012 * (0.5 - 0.5 * Math.cos(gaitPhase * Math.PI * 4));
      const rootY = -DESK_RISE * deskE + STAND_RISE * standE + bobY;
      const body = (v: V3): V3 => add3(rotY(v, yaw), [pos.x, rootY, pos.z]);
      let standWant = deskWanted ? 1 : 0;
      let walking = false;

      switch (seg.kind) {
        case 'type':
          // calm: the hands stay where the poster has them
          if (calm) tr = [...WRIST_REST.r];
          else typingRate = 7;
          break;
        case 'fast': {
          typingRate = 19;
          leanT = 0.05 * envelope(u, 0.1, 0.2);
          pitchT = -0.08;
          break;
        }
        case 'mouse': {
          const m = {
            dx: 0.028 * Math.sin(seg.t * 1.5) + 0.012 * Math.sin(seg.t * 3.1),
            dz: 0.022 * Math.cos(seg.t * 1.2),
          };
          mouseT = m;
          tr = [MOUSE_WRIST[0] + m.dx, MOUSE_WRIST[1], MOUSE_WRIST[2] + m.dz];
          if (seg.knock >= 0 && seg.t >= seg.knock) {
            seg.knock = -1;
            knocks += 1;
            reacting = true;
            startSeg('startle');
            break;
          }
          for (const at of [0.7, 1.7, 2.6]) {
            if (seg.fired < at && seg.t >= at) {
              seg.fired = at;
              mouseClick = 1;
              clicks += 1;
            }
          }
          break;
        }
        case 'think': {
          // a pause: the right hand goes to the chin, the head tilts, the typing stops
          const e = envelope(u, 0.25, 0.25);
          tr = lerp3(KB_RIGHT, body([0.02, 0.262, -0.084]), e);
          rollT = 0.07 * e;
          pitchT = 0.03 - 0.05 * e;
          leanT = -0.03 * e;
          break;
        }
        case 'tether': {
          // faces each thing that is out of place in turn (the chair swivels and the head leads),
          // aims the wrist at it, throws the line and pulls it in, then the next; last it turns
          // back to the screen
          const t = seg.t;
          standWant = standCh > 0.5 || deskWanted ? 1 : 0;
          const n = shots.length;
          const end = TETHER_START + n * TETHER_SLOT;
          const back = body([0.2, 0.3, -0.13]);
          let ext = 0;
          let aim: V3 = back;
          let pull = 0;
          if (n > 0 && t >= TETHER_START && t < end + 0.4) {
            const j = Math.min(
              n - 1,
              Math.floor((t - TETHER_START) / TETHER_SLOT),
            );
            const sh = shots[j]!;
            const w = t - TETHER_START - j * TETHER_SLOT;
            yawT = clamp(sh.yaw * 0.7, -2.4, 2.4);
            forcedLook = sh.at;
            // the arm comes up once the turn is under way, flicks, then pulls
            ext = ease(clamp((w - 0.3) / 0.3, 0, 1));
            if (t > end) ext *= 1 - ease(clamp((t - end) / 0.4, 0, 1));
            const dx = sh.at[0] - pos.x;
            const dz = sh.at[2] - pos.z;
            const l = Math.hypot(dx, dz) || 1;
            aim = [pos.x + (dx / l) * 0.32, 0.34, pos.z + (dz / l) * 0.32];
            pull =
              w > 0.8
                ? 0.5 - 0.5 * Math.cos(((w - 0.8) / 0.4) * Math.PI * 2)
                : 0;
            addR[1] +=
              0.03 * Math.sin(clamp((w - 0.55) / 0.25, 0, 1) * Math.PI);
          }
          tr = lerp3(KB_RIGHT, lerp3(aim, back, pull), ext);
          leanT = -0.05 * ext;
          pitchT = 0.06;
          tl = [...WRIST_REST.l];
          break;
        }
        case 'startle': {
          const up = ease(clamp(u / 0.12, 0, 1));
          const down = 1 - ease(clamp((u - 0.55) / 0.15, 0, 1));
          const back = 1 - ease(clamp((u - 0.88) / 0.12, 0, 1));
          leanT = -0.25 * up * back;
          pitchT = 0.1 - 0.25 * up * back;
          tl = lerp3(WRIST_REST.l, body([-0.2, 0.22, -0.1]), up * down);
          const M = knockM;
          if (u < 0.5 || !M || u > 0.9) {
            tr = lerp3(KB_RIGHT, body([0.22, 0.22, -0.1]), up * down);
          } else {
            // wipes the desk where the cup was
            tr = [
              M[0] + 0.035 * Math.sin(seg.t * 15),
              0.085,
              M[2] + 0.02 + 0.02 * Math.cos(seg.t * 11),
            ];
          }
          break;
        }
        case 'lean': {
          const e = envelope(u, 0.22, 0.22);
          leanT = -0.4 * e;
          pitchT = 0.03 + 0.2 * e;
          const behind: V3 = [0.1, 0.41, 0.05];
          if (e > 0.15) {
            tl = body([-behind[0], behind[1], behind[2]]);
            tr = body(behind);
          }
          break;
        }
        case 'sip': {
          const M = env.mug;
          if (!M) break;
          const grip: V3 = [
            M[0] - HAND_OFFSET[0],
            M[1] + MUG_GRIP - HAND_OFFSET[1],
            M[2] - HAND_OFFSET[2],
          ];
          let w: V3;
          let tilt = 0;
          if (u < 0.28) w = grip;
          else if (u < 0.5)
            w = lerp3(grip, MOUTH_WRIST, ease((u - 0.28) / 0.22));
          else if (u < 0.68) {
            w = MOUTH_WRIST;
            tilt = 0.55 * Math.sin(((u - 0.5) / 0.18) * Math.PI);
          } else if (u < 0.88)
            w = lerp3(MOUTH_WRIST, grip, ease((u - 0.68) / 0.2));
          else w = grip;
          tr = w;
          // the cup goes where the hand really is (the hand is a spring, the target is not)
          if (u >= 0.2 && u < 0.92) mugHeld = { base: M, tilt };
          // the head follows the cup, then tips back a little
          pitchT =
            u < 0.28
              ? -0.18
              : 0.12 * Math.sin(clamp((u - 0.28) / 0.5, 0, 1) * Math.PI);
          typingRate = 0;
          break;
        }
        case 'wave': {
          const turn = u < 0.82 ? env.viewYaw : 0;
          yawT = turn;
          leanT = -0.1 * envelope(u, 0.15, 0.15);
          pitchT = 0.08;
          const e = envelope(u, 0.2, 0.2);
          tr = lerp3(KB_RIGHT, body([0.3, 0.4, -0.08]), e);
          addR[0] = Math.sin(seg.t * 9) * 0.075 * e;
          addR[1] = Math.abs(Math.sin(seg.t * 4.5)) * 0.015 * e;
          tl = body([-0.08, -0.04, -0.1]);
          rollT = 0.06 * Math.sin(seg.t * 2) * e;
          break;
        }
        case 'spin': {
          yaw = yawStart + TAU * ease(u);
          tl = body([-0.19, -0.015, -0.08]);
          tr = body([0.19, -0.015, -0.08]);
          leanT = -0.1;
          pitchT = 0.12;
          break;
        }
        case 'cans': {
          // the hand nearer the headphones leads (it is all worked out for the right hand and
          // mirrored at the end); see headphones-anim for the choreography
          const H0 = env.hp ?? ([0.3, 0, -0.3] as V3);
          const left = H0[0] < 0.05;
          const sg = left ? -1 : 1;
          const mx = (q: V3): V3 => [-q[0], q[1], q[2]];
          const H = left ? mx(H0) : H0;
          const t = seg.t;
          const from = cansFrom ?? { l: [...l] as V3, r: [...r] as V3 };
          const plan = hpPlan({
            t,
            on: cansWanted,
            rest: H,
            restPitch: env.hpPitch ?? 0,
            head: {
              lean,
              pitch: headPitch,
              pos: [sg * pos.x, rootY, pos.z + held.body],
              yaw: sg * yaw,
            },
            // (the right-handed lead is the left hand when the headphones are on the left)
            leadFrom: left ? mx(from.l) : from.r,
            auxFrom: left ? mx(from.r) : from.l,
            leadHome: HP_LEAD_HOME,
            auxHome: HP_AUX_HOME,
          });
          // out of reach: the chair rolls towards them and the sitter leans in, only as far as it takes
          const shoulderX = 0.15;
          // (the hand goes to the band's top: the far end of the hoop when it lies flat)
          const pitch0 = env.hpPitch ?? 0;
          const gx = H[0] - shoulderX;
          const gz = H[2] + 0.188 * Math.sin(pitch0);
          const dx = gx;
          const dz = gz + 0.04;
          const dd = Math.hypot(dx, dz);
          const need = clamp(dd - 0.33, 0, 0.55);
          // roll along the desk first (the desk's edge is in the way forwards), then forwards
          // only as far as it takes
          const tx = Math.sign(dx) * clamp(Math.abs(dx) - 0.12, 0, 0.55);
          const hx = dx - tx;
          const allow = Math.sqrt(Math.max(0.33 * 0.33 - hx * hx, 0));
          const tz = dz < 0 ? Math.min(0, dz + allow) : Math.max(0, dz - allow);
          posTx = tx * plan.roll;
          posTz = tz * plan.roll;
          leanT = Math.min(0.2, need * 0.45) * plan.roll;
          forcedLook = plan.look ? [H[0], 0.12, H[2]] : null;
          cans = plan.cans;
          spring = false;
          hp.active = plan.active;
          hp.worn = plan.worn;
          hp.k = plan.k;
          hp.desk = plan.desk;
          hp.deskPitch = plan.deskPitch;
          hp.head = plan.head;
          hp.headPitch = plan.headPitch;
          hp.spread = plan.spread;
          hp.lead = { w: plan.leadW, reg: plan.leadReg };
          hp.aux = { w: plan.auxW };
          tr = plan.lead;
          tl = plan.aux;
          pitchT = 0.03 + plan.nod;
          rollT = plan.tilt;
          if (left) {
            const a = tl;
            tl = mx(tr);
            tr = mx(a);
            posTx = -posTx;
            hp.desk = mx(hp.desk);
            if (forcedLook) forcedLook = mx(forcedLook);
            hp.side = 'l';
          }
          pitchT = Math.max(pitchT, 0.03);
          break;
        }
        case 'shrug': {
          const e = envelope(u, 0.25, 0.3);
          tl = lerp3(WRIST_REST.l, body([-0.3, 0.13, -0.12]), e);
          tr = lerp3(KB_RIGHT, body([0.3, 0.13, -0.12]), e);
          rollT = -0.16 * e;
          leanT = -0.05 * e;
          break;
        }
        case 'walk': {
          const t = seg.t;
          standWant = t < T_SIT ? 1 : 0;
          let d = 0;
          let back = false;
          if (t >= T_OUT && t < T_PAUSE) {
            d = (t - T_OUT) * WALK_SPEED;
            walking = true;
          } else if (t >= T_PAUSE && t < T_BACK) {
            d = WALK_LEN;
          } else if (t >= T_BACK && t < T_SIT) {
            d = WALK_LEN - (t - T_BACK) * WALK_SPEED;
            back = true;
            walking = true;
          }
          const w = walkAt(d);
          pos.x = w.x;
          pos.z = w.z;
          if (t >= T_OUT && t < T_SIT) {
            const dir = back ? -1 : 1;
            yawT = Math.atan2(-dir * w.dx, -dir * w.dz);
          }
          pitchT = 0;
          if (t >= T_UP && t < T_OUT) {
            // a stretch: both arms up and back
            const e = envelope((t - T_UP) / T_STRETCH, 0.3, 0.3);
            tl = body([-0.12, 0.6, 0.0]);
            tr = body([0.12, 0.6, 0.0]);
            leanT = -0.2 * e;
            pitchT = 0.25 * e;
          } else {
            // the arms swing against the legs: the left arm goes back as the left leg goes forward
            const swing = walking ? Math.cos(gaitPhase * Math.PI * 2) * 0.1 : 0;
            tl = body([-0.17, -0.12, -0.02 + swing]);
            tr = body([0.17, -0.12, -0.02 - swing]);
          }
          if (t >= T_PAUSE && t < T_BACK && !walkLooked) {
            walkLooked = true;
            look = { p: PLANT_LOOK, t: 0, dur: 1.6, viewer: false };
          }
          typingRate = 0;
          break;
        }
        case 'reach': {
          const R = env.reach;
          if (R) {
            const e = envelope(u, 0.3, 0.3);
            tl = lerp3(
              WRIST_REST.l,
              [
                R[0] - HAND_OFFSET[0],
                R[1] - HAND_OFFSET[1],
                R[2] - HAND_OFFSET[2],
              ],
              e,
            );
            pitchT = 0.03 - 0.1 * e;
            leanT = 0.03 * e;
          }
          break;
        }
        case 'nod': {
          pitchT = 0.03 - 0.18 * Math.sin(u * Math.PI * 2) * (1 - u);
          typingRate = 3;
          break;
        }
        default:
          break;
      }

      if (seg.kind !== 'walk' && !(seg.kind === 'tether' && standCh > 0.5)) {
        walkLooked = false;
        // back at the chair after a walk (or never left it): the hips are over the seat
        const posRate = seg.kind === 'cans' ? 6 : 4;
        pos.x = follow(pos.x, posTx, posRate, dt);
        pos.z = follow(pos.z, posTz, posRate, dt);
      }
      leanT += STAND_LEAN * standE;
      const standTime = calm ? 0.16 : 1.5;
      const deskTime = calm ? 0.16 : 1.7;
      standCh += clamp(standWant - standCh, -dt / standTime, dt / standTime);
      deskCh += clamp(
        (deskWanted ? 1 : 0) - deskCh,
        -dt / deskTime,
        dt / deskTime,
      );
      gaitAmp = follow(gaitAmp, walking ? 1 : 0, 8, dt);
      if (walking) gaitPhase = (gaitPhase + dt * GAIT_RATE) % 1;

      // ---- glances (overlay) ----------------------------------------------------------
      if (
        !calm &&
        !reacting &&
        !look &&
        seg.kind !== 'lean' &&
        seg.kind !== 'sip'
      ) {
        nextGlance -= dt;
        if (nextGlance <= 0) {
          nextGlance = between(6, 12);
          const roll = rand();
          const pts = env.interest;
          if (roll < 0.5 || pts.length === 0) {
            // towards the viewer
            const h = headAt();
            look = {
              p: [
                h[0] - Math.sin(env.viewYaw),
                h[1],
                h[2] - Math.cos(env.viewYaw),
              ],
              t: 0,
              dur: 2.4,
              viewer: true,
            };
          } else {
            const p = pts[Math.floor(rand() * pts.length)];
            if (p) look = { p, t: 0, dur: 1.7, viewer: false };
          }
        }
      }
      if (look) {
        look.t += dt;
        if (look.t >= look.dur) look = null;
        else {
          const k = envelope(look.t / look.dur, 0.2, 0.3);
          // looking at the viewer turns the chair part of the way as well
          if (look.viewer) yawT = env.viewYaw * 0.55 * k;
          // a small turn the other way first (anticipation), then the glance, slowly in and out
          const ant =
            look.t < 0.2 ? -0.12 * Math.sin((look.t / 0.2) * Math.PI) : 0;
          const a = lookAngles(look.p, yaw);
          lookT = { yaw: a.yaw * (k + ant), pitch: a.pitch * k };
        }
      }

      if (forcedLook) {
        const a = lookAngles(forcedLook, yaw);
        lookT = { yaw: a.yaw, pitch: a.pitch };
      }

      // ---- springs ----------------------------------------------------------------------
      // Critically damped: every channel eases in and out. The head leads and the torso follows a
      // beat later (overlapping action); the hands lag the body a little.
      if (seg.kind === 'spin') {
        dYaw.x = yaw;
        dYaw.v = 0;
      } else yaw = damp(dYaw, yawT, seg.kind === 'tether' ? 3.2 : 6, dt);
      lean = damp(dLean, leanT, 7, dt);
      const handRate = seg.kind === 'wave' || seg.kind === 'cans' ? 13 : 11;
      if (spring) {
        l = [
          damp(dL[0]!, tl[0], handRate, dt),
          damp(dL[1]!, tl[1], handRate, dt),
          damp(dL[2]!, tl[2], handRate, dt),
        ];
        r = [
          damp(dR[0]!, tr[0], handRate, dt),
          damp(dR[1]!, tr[1], handRate, dt),
          damp(dR[2]!, tr[2], handRate, dt),
        ];
      } else {
        // the headphones' choreography moves the hands itself (on its own easing): no lag, so a
        // hand is where the plan says, and the springs just follow along for the way out
        l = [...tl];
        r = [...tr];
        for (let i = 0; i < 3; i++) {
          dL[i]!.x = tl[i]!;
          dL[i]!.v = 0;
          dR[i]!.x = tr[i]!;
          dR[i]!.v = 0;
        }
      }
      const lk = lookT;
      const wantYaw = lk ? lk.yaw : 0;
      // the pointer: a gentle follow of the head (never more than about 12, 6 and 3 degrees),
      // only while working, and gone again when it has not moved for a while
      const gz = env.gaze;
      const gazeOk =
        !calm &&
        !look &&
        (seg.kind === 'type' ||
          seg.kind === 'mouse' ||
          seg.kind === 'fast' ||
          seg.kind === 'think' ||
          seg.kind === 'nod');
      gazeW = follow(gazeW, gz?.fresh && gazeOk ? 1 : 0, 2.5, dt);
      const gx = gz ? clamp(gz.x, -1, 1) : 0;
      const gy = gz ? clamp(gz.y, -1, 1) : 0;
      const wantPitch = (lk ? pitchT + lk.pitch : pitchT) + gy * 0.1 * gazeW;
      // the torso takes a quarter of a turn, the head the rest
      torsoYaw = damp(dTorso, wantYaw * 0.25, 4.5, dt);
      headYaw = damp(
        dHeadYaw,
        clamp(wantYaw * 0.75 - gx * 0.21 * gazeW, -1.2, 1.2),
        8,
        dt,
      );
      let bob = 0;
      let sway = 0;
      if (cans) {
        bob = Math.sin(clock * 10.5) * 0.035;
        sway = Math.sin(clock * 5.2) * 0.04;
      }
      headPitch = damp(dHeadPitch, wantPitch, 8, dt) + bob;
      headRoll = damp(dHeadRoll, rollT - gx * 0.05 * gazeW, 7, dt) + sway;

      // ---- typing ----------------------------------------------------------------------
      if (typingRate > 0) {
        strokeClock += dt * typingRate;
        while (strokeClock >= 1) {
          strokeClock -= 1;
          typed += 1;
          const row = Math.floor(rand() * 3) as 0 | 1 | 2;
          keys[row] = 1;
          // hands take turns, now and then one twice
          if (rand() > 0.25) tapSide = !tapSide;
          if (tapSide) tap.l = 1;
          else tap.r = 1;
        }
      }
      for (let i = 0; i < 4; i++) keys[i] = Math.max(0, keys[i]! - dt * 9);
      tap.l = Math.max(0, tap.l - dt * 9);
      tap.r = Math.max(0, tap.r - dt * 9);
      mouseClick = Math.max(0, mouseClick - dt * 8);
      mouseOff = {
        dx: follow(mouseOff.dx, mouseT.dx, 12, dt),
        dz: follow(mouseOff.dz, mouseT.dz, 12, dt),
      };
      mugOff = mugHeld
        ? {
            dx: r[0] + HAND_OFFSET[0] - mugHeld.base[0],
            dy: r[1] + HAND_OFFSET[1] - MUG_GRIP - mugHeld.base[1],
            dz: r[2] + HAND_OFFSET[2] - mugHeld.base[2],
            tilt: mugHeld.tilt,
          }
        : null;

      const drift = calm || seg.kind === 'cans' ? 0 : typingRate > 0 ? 1 : 0.3;
      const outL = add3(add3(l, addL), [
        Math.sin(clock * 3.1) * 0.006 * drift,
        -0.009 * tap.l,
        Math.sin(clock * 2.3) * 0.005 * drift,
      ]);
      const outR = add3(add3(r, addR), [
        Math.sin(clock * 2.7) * 0.006 * drift * (seg.kind === 'mouse' ? 0 : 1),
        -0.009 * tap.r,
        0,
      ]);
      const pose: Pose = {
        chairYaw: yaw,
        lean,
        torsoYaw,
        headYaw,
        headPitch,
        headRoll,
        l: outL,
        r: outR,
        keys: [keys[0]!, keys[1]!, keys[2]!, keys[3]!],
        typed,
        mouse: { dx: mouseOff.dx, dz: mouseOff.dz, click: mouseClick },
        mug: mugOff,
        cans,
        clicks,
        breath: Math.sin(clock * 1.5),
        torsoRoll: Math.sin(clock * 0.45) * 0.012 * (1 - standE * 0.5),
        knocks,
        hp,
        elbow: [0, 0],
        carry: seg.kind === 'reach' && u > 0.3 && u < 0.7,
        stand: standE,
        desk: deskE,
        pos: { x: pos.x, z: pos.z },
        rootY,
        floorY: FLOOR_Y - DESK_RISE * deskE,
        gait: { phase: gaitPhase, amp: gaitAmp },
        // (seated, the chair rolls with the sitter when they lean over to reach something)
        chair: {
          // (it rolls straight back from under the sitter first, then aside)
          x:
            -0.62 * ease(clamp((standE - 0.7) / 0.3, 0, 1)) +
            pos.x * (1 - standE),
          z:
            0.32 * ease(clamp((standE - 0.4) / 0.4, 0, 1)) +
            pos.z * (1 - standE),
          turn: 0.6 * standE,
        },
        kind: seg.kind,
      };
      // the furniture is solid: hold the body and the chair back from the desk, and the hands
      // and arms above it
      if (!solid) return pose;
      const holdE: [number, number] = [
        Math.max(0, held.elbow[0] - 1.2 * dt),
        Math.max(0, held.elbow[1] - 1.2 * dt),
      ];
      held.elbow = clearArms(pose, holdE, env.drawer ?? 0);
      const need = clearanceBack(pose, env.drawer ?? 0);
      const seated = 1 - standE;
      // (seated, the body and the chair go back together)
      const nb = Math.max(need.body, seated > 0.5 ? need.chair : 0);
      const nc = seated > 0.5 ? nb : need.chair;
      held.body = Math.max(nb, held.body - 0.6 * dt);
      held.chair = Math.max(nc, held.chair - 0.6 * dt);
      pose.pos.z += held.body;
      pose.chair.z += held.chair * (standE > 0.5 ? 1 : seated);
      held.elbow = clearArms(pose, held.elbow, env.drawer ?? 0);
      return pose;
    },
  };
}
