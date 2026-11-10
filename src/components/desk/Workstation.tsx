import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import {
  getLamp,
  getMotion,
  setLamp,
  subscribeMotion,
  type Lamp,
} from '../../lib/prefs';
import { playClunk, playSqueak } from '../../lib/squeak';
import { setCameraDrop, applyHeroCamera } from '../../lib/desk/camera';
import { EGGS, KONAMI, feedCode } from '../../lib/desk/eggs';
import {
  DURATION_FAST,
  DURATION_SLOW,
  THEME_EVENT,
  readToken,
} from '../../lib/desk/tokens';
import { markPulseSeen, pulseSeen } from '../../lib/desk/hint';
import {
  DESK_ACT_EVENT,
  DESK_RESET_EVENT,
  DESK_SAY_EVENT,
} from '../../lib/desk/bus';
import { bump, clearBumps, reactions } from '../../lib/desk/reactions';
import {
  createDevAnim,
  type DevAnim,
  type Env,
  type Pose,
  type Shot,
  TETHER_SLOT,
  TETHER_START,
} from '../../lib/desk/dev-anim';
import {
  ANKLE_H,
  CHAIR_AT,
  FLOOR_Y,
  HAND_OFFSET,
  HIP,
  KNEE_POLE,
  SHIN,
  THIGH,
  UPPER,
  FORE,
  ankleAt,
  hipAt,
  kneeAt,
  poleFor,
  restArm,
  solveArm,
  type V3,
} from '../../lib/desk/rig';
import { armSound } from '../../lib/sound';
import { fallBridge, physicsBridge } from './physics-bridge';
import { coffee } from '../../lib/desk/coffee';
import { HP_SPREAD, gripLocal } from '../../lib/desk/headphones-anim';
import { buildCable, cableSegments } from './cable';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { buildLiquid, refill, stepLiquid, type Liquid } from './liquid';
import {
  createTether,
  endTether,
  stepTether,
  type Tether,
  type TetherItem,
} from './tether';
import { registry, type RegistryEntry } from './registry';
import {
  COOKIE_SPOT,
  DUCK_LAND,
  FLOPPY_HOVER,
  FLOPPY_REST,
  FLOPPY_WAIT,
  HOP_END,
  poseGlint,
  STICKY_SPOT,
  TRAY_AT,
  applyTf,
  buildFinds,
  cardTf,
  cookieTf,
  duckTf,
  floppyTf,
  poseCookie,
  setShown,
  startBurst,
  stepBurst,
  stickyTf,
  type Finds,
} from './finds';
import { useActive, useLineArt } from './scene-context';
import { isQuiet } from './scene-hooks';
import { table } from './table';
import {
  SCREEN_MODES,
  createCardTexture,
  createScreenTexture,
  type CardTexture,
  type ScreenTexture,
} from './textures';

/**
 * The workstation: the developer at the desk, and every object's reaction to a tap.
 *
 * The idle loop and the reactions live in `lib/desk/dev-anim.ts` (pure, tested); this file turns
 * the pose it returns into rotations on the drawn models, with the same two-bone solve the
 * poster pose is built with (`lib/desk/rig.ts`). The sitter's pivots come flat from the GLB and are
 * chained here (torso > head, torso > upper arm > forearm) keeping each pivot where it was drawn.
 *
 * Frames are only requested while the desk is on screen, the tab shows and motion is allowed, at
 * 30 a second (`frameloop="demand"` stays: nothing draws while the desk is off screen or the page
 * asks for reduced motion, and the Scene is not mounted at all under it).
 */

const FRAME_MS = 33;
/** The animation sleeps this long after the last touch (or look) at the desk; under reduced motion it only wakes for a tap's short change. */
const IDLE_MS = 20_000;
const CALM_MS = 2_500;
const KEY_Y = 0.014;
const KEY_TRAVEL = 0.004;
/** Height of the desk's legs, floor to the underside of the top (the model's `legs` node). */
const LEGS_H = 0.43;

const v = (a: readonly number[]) =>
  new Vector3(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);

// ---- the screen -----------------------------------------------------------------------------

const screenState: {
  mode: number;
  typed: number;
  click: number;
  note: { text: string; t: number } | null;
} = { mode: 0, typed: 0, click: 0, note: null };
let screenTexture: ScreenTexture | null = null;
let screenDirty = true;

/** The monitor's glass material (a canvas texture), redrawn by the workstation. */
export function useScreenMaterial(): Material {
  const screen = useMemo(
    () =>
      createScreenTexture({
        background: readToken('--blue-ink'),
        ink: readToken('--white'),
      }),
    [],
  );
  const { invalidate } = useThree();
  useEffect(() => {
    screenTexture = screen;
    screenDirty = true;
    screen.draw(screenState);
    invalidate();
    const recolor = () => {
      screen.setPalette({
        background: readToken('--blue-ink'),
        ink: readToken('--white'),
      });
      screen.draw(screenState);
      invalidate();
    };
    window.addEventListener(THEME_EVENT, recolor);
    return () => {
      window.removeEventListener(THEME_EVENT, recolor);
      if (screenTexture === screen) screenTexture = null;
      screen.dispose();
    };
  }, [screen, invalidate]);
  return screen.material;
}

/** The desk's moving parts that live in a model the Scene draws without registering (the table). */
export const deskParts = { legs: null as Object3D | null };

let cardTexture: CardTexture | null = null;

/** The card in the drawer: a canvas texture the workstation redraws for each easter egg. */
export function useCardMaterial(): Material {
  const card = useMemo(
    () => createCardTexture(readToken('--paper'), readToken('--blue-ink')),
    [],
  );
  useEffect(() => {
    cardTexture = card;
    card.draw(EGGS[0]?.lines ?? [], 'paper');
    return () => {
      if (cardTexture === card) cardTexture = null;
      card.dispose();
    };
  }, [card]);
  return card.material;
}

// ---- the sitter's rig ---------------------------------------------------------------------------

interface Arm {
  upper: Object3D;
  fore: Object3D;
  shoulder: Vector3;
  d1: Vector3;
  d2: Vector3;
  /** The hand's centre in the forearm's own frame (where the web leaves the hand). */
  tip: Vector3;
}

interface Leg {
  thigh: Object3D;
  shin: Object3D;
  hip: Vector3;
  d1: Vector3;
  d2: Vector3;
  side: -1 | 1;
}

interface DevRig {
  root: Object3D;
  legs: [Leg, Leg];
  torso: Object3D;
  head: Object3D;
  arms: [Arm, Arm];
  swivel: Object3D | null;
}

const _qT = new Quaternion();
const _qTi = new Quaternion();
const _qU = new Quaternion();
const _qP = new Quaternion();
const _qPi = new Quaternion();
const _a = new Vector3();
const _b = new Vector3();
const _s = new Vector3();
const _arc = new Quaternion();

/** Chains the flat pivots of the developer model; null while it has not loaded. */
function rigDev(
  root: Object3D,
  chairRoot: Object3D | undefined,
): DevRig | null {
  const cached = root.userData['rig'] as DevRig | undefined;
  if (cached) return cached;
  const get = (n: string) => root.getObjectByName(n);
  const torso = get('torso');
  const head = get('head');
  const parts = (['l', 'r'] as const).map((s) => ({
    upper: get(`upper-${s}`),
    fore: get(`fore-${s}`),
  }));
  const legNodes = (['l', 'r'] as const).map((s) => ({
    thigh: get(`thigh-${s}`),
    shin: get(`shin-${s}`),
  }));
  const [ll, lr] = legNodes;
  if (!ll?.thigh || !ll.shin || !lr?.thigh || !lr.shin) return null;
  const [pl, pr] = parts;
  if (!torso || !head || !pl?.upper || !pl.fore || !pr?.upper || !pr.fore)
    return null;
  // where each pivot was drawn, before anything is moved
  const at = new Map<Object3D, Vector3>();
  for (const o of [torso, head, pl.upper, pl.fore, pr.upper, pr.fore])
    at.set(o, o.position.clone());
  const chain = (child: Object3D, parent: Object3D) => {
    parent.add(child);
    child.position.sub(at.get(parent) ?? new Vector3());
  };
  chain(pl.fore, pl.upper);
  chain(pr.fore, pr.upper);
  chain(pl.upper, torso);
  chain(pr.upper, torso);
  chain(head, torso);
  at.set(ll.thigh, ll.thigh.position.clone());
  at.set(lr.thigh, lr.thigh.position.clone());
  ll.thigh.add(ll.shin);
  ll.shin.position.sub(at.get(ll.thigh) ?? new Vector3());
  lr.thigh.add(lr.shin);
  lr.shin.position.sub(at.get(lr.thigh) ?? new Vector3());
  const leg = (side: -1 | 1, thigh: Object3D, shin: Object3D): Leg => ({
    thigh,
    shin,
    side,
    hip: v(hipAt(side)),
    d1: v(kneeAt(side))
      .sub(v(hipAt(side)))
      .normalize(),
    d2: v(ankleAt(side))
      .sub(v(kneeAt(side)))
      .normalize(),
  });
  const arm = (side: -1 | 1, upper: Object3D, fore: Object3D): Arm => {
    const rest = restArm(side);
    return {
      upper,
      fore,
      shoulder: v(rest.shoulder),
      d1: v(rest.elbow).sub(v(rest.shoulder)).normalize(),
      d2: v(rest.elbow).negate().add(v(rest.wrist)).normalize(),
      tip: v(rest.wrist).add(v(HAND_OFFSET)).sub(v(rest.elbow)),
    };
  };
  const rig: DevRig = {
    root,
    legs: [leg(-1, ll.thigh, ll.shin), leg(1, lr.thigh, lr.shin)],
    torso,
    head,
    arms: [arm(-1, pl.upper, pl.fore), arm(1, pr.upper, pr.fore)],
    swivel: chairRoot?.getObjectByName('swivel') ?? null,
  };
  root.userData['rig'] = rig;
  return rig;
}

const HIPV = v(HIP);

const _qF = new Quaternion();
const _tip = new Vector3();
const _tipE = new Vector3();
const _goal = new Vector3();
const _hpRootInv = new Matrix4();
const _hpHeadM = new Matrix4();
const _hpHeadP = new Vector3();
const _hpHeadQ = new Quaternion();
const _hpHeadS = new Vector3();
const _hpDeskQ = new Quaternion();
const _hpPitchQ = new Quaternion();
const _hpV = new Vector3();
const _hpYAxis = new Vector3(0, 1, 0);
const _hpXAxis = new Vector3(1, 0, 0);

/**
 * Where the headphones are while the animation moves them (held or worn), in the developer's frame
 * (`root`-local), and where each hand's centre goes on them. Needs the body and head already turned.
 */
const hpDrive = {
  on: false,
  pos: new Vector3(),
  quat: new Quaternion(),
  sx: 1,
};
const _hpGrip: [Vector3, Vector3] = [new Vector3(), new Vector3()];

function placeHeadphones(
  rig: DevRig,
  pose: Pose,
  px: number,
  py: number,
  pz: number,
  c: number,
  s: number,
): { grips: [Vector3 | null, Vector3 | null]; weights: [number, number] } {
  const hp = pose.hp;
  hpDrive.on = hp.active;
  if (!hp.active) return { grips: [null, null], weights: [0, 0] };
  rig.head.updateWorldMatrix(true, false);
  _hpRootInv.copy(rig.root.matrixWorld).invert();
  _hpHeadM.multiplyMatrices(_hpRootInv, rig.head.matrixWorld);
  _hpHeadM.decompose(_hpHeadP, _hpHeadQ, _hpHeadS);
  // in the head's frame (the cups ride the ears whatever the head does)
  _hpPitchQ.setFromAxisAngle(_hpXAxis, hp.headPitch);
  const headQ = _hpHeadQ.clone().multiply(_hpPitchQ);
  const headP = _hpV
    .set(hp.head[0], hp.head[1], hp.head[2])
    .applyMatrix4(_hpHeadM)
    .clone();
  hpDrive.pos.copy(headP);
  hpDrive.quat.copy(headQ);
  if (hp.k < 1) {
    // in the desk frame (which does not turn with the chair or move with the hips)
    const rx = hp.desk[0] - px;
    const rz = hp.desk[2] - pz;
    const deskP = _hpV.set(rx * c + rz * s, hp.desk[1] - py, -rx * s + rz * c);
    _hpPitchQ.setFromAxisAngle(_hpXAxis, hp.deskPitch);
    _hpDeskQ.setFromAxisAngle(_hpYAxis, -pose.chairYaw).multiply(_hpPitchQ);
    hpDrive.pos.lerpVectors(deskP, headP, hp.k);
    hpDrive.quat.copy(_hpDeskQ).slerp(headQ, hp.k);
  }
  hpDrive.sx = 1 + HP_SPREAD * hp.spread;
  // the hands: the lead has the band, then its own cup; the other has the far cup
  const leadSide = hp.side === 'l' ? 0 : 1;
  const sign: 1 | -1 = hp.side === 'l' ? -1 : 1;
  const grips: [Vector3 | null, Vector3 | null] = [null, null];
  const weights: [number, number] = [0, 0];
  const put = (arm: number, local: V3, w: number) => {
    const g = _hpGrip[arm]!;
    g.set(local[0] * hpDrive.sx, local[1], local[2])
      .applyQuaternion(hpDrive.quat)
      .add(hpDrive.pos);
    grips[arm] = g;
    weights[arm] = w;
  };
  const band = gripLocal('band', 1, hp.spread);
  const cup = gripLocal('cup', sign, hp.spread);
  put(
    leadSide,
    [
      band[0] + (cup[0] - band[0]) * hp.lead.reg,
      band[1] + (cup[1] - band[1]) * hp.lead.reg,
      band[2] + (cup[2] - band[2]) * hp.lead.reg,
    ],
    hp.lead.w,
  );
  put(1 - leadSide, gripLocal('cup', -sign as 1 | -1, hp.spread), hp.aux.w);
  return { grips, weights };
}

/** Turns the pose into rotations: chair and body, then each arm by the two-bone solve. */
function applyPose(rig: DevRig, pose: Pose): void {
  const c = Math.cos(-pose.chairYaw);
  const s = Math.sin(-pose.chairYaw);
  const px = pose.pos.x;
  const py = pose.rootY;
  const pz = pose.pos.z;
  rig.root.rotation.y = pose.chairYaw;
  rig.root.position.set(px, py, pz);
  // the chair turns with the sitter only while they sit in it
  if (rig.swivel)
    rig.swivel.rotation.y = pose.chairYaw * (1 - pose.stand) + swivelSpin.angle;
  // breathing lifts the chest a hair; a slow shift of weight rolls the shoulders
  rig.torso.rotation.set(
    -pose.lean - 0.012 * pose.breath,
    pose.torsoYaw,
    pose.torsoRoll,
    'YXZ',
  );
  // the torso carries the head with it; the neck gives that back so the head stays level
  rig.head.rotation.set(
    pose.headPitch + pose.lean,
    pose.headYaw,
    pose.headRoll,
    'YXZ',
  );
  _qT.setFromEuler(rig.torso.rotation);
  _qTi.copy(_qT).invert();
  const targets: [V3, V3] = [pose.l, pose.r];
  // the headphones, when the animation moves them: their pose in this frame, and where each hand goes on them
  const hpg = placeHeadphones(rig, pose, px, py, pz, c, s);
  rig.arms.forEach((arm, i) => {
    const side: -1 | 1 = i === 0 ? -1 : 1;
    const w = targets[i]!;
    // the hands work on the desk, which does not turn with the chair
    // (and not with the hips either: take the hips' offset off first)
    const rx = w[0] - px;
    const rz = w[2] - pz;
    const target: V3 = [rx * c + rz * s, w[1] - py, -rx * s + rz * c];
    _s.copy(arm.shoulder).sub(HIPV).applyQuaternion(_qT).add(HIPV);
    const solveTo = (wrist: V3): Vector3 => {
      const sol = solveArm(
        [_s.x, _s.y, _s.z],
        wrist,
        poleFor(side, pose.elbow[i]),
        UPPER,
        FORE,
      );
      // upper arm: the turn that takes its drawn direction to the solved one (in the torso's frame)
      _a.set(sol.elbow[0] - _s.x, sol.elbow[1] - _s.y, sol.elbow[2] - _s.z)
        .normalize()
        .applyQuaternion(_qTi);
      _qU.copy(_arc.setFromUnitVectors(arm.d1, _a));
      arm.upper.quaternion.copy(_qU);
      // forearm: the same, in the upper arm's frame
      _qP.copy(_qT).multiply(_qU);
      _qPi.copy(_qP).invert();
      _b.set(
        sol.wrist[0] - sol.elbow[0],
        sol.wrist[1] - sol.elbow[1],
        sol.wrist[2] - sol.elbow[2],
      )
        .normalize()
        .applyQuaternion(_qPi);
      arm.fore.quaternion.copy(_arc.setFromUnitVectors(arm.d2, _b));
      // where the hand (its centre) is now, in this frame
      _qF.copy(_qP).multiply(arm.fore.quaternion);
      return _tip
        .copy(arm.tip)
        .applyQuaternion(_qF)
        .add(_tipE.set(sol.elbow[0], sol.elbow[1], sol.elbow[2]));
    };
    const grip = hpg.grips[i];
    const gw = hpg.weights[i]!;
    if (!grip || gw <= 0) {
      solveTo(target);
      return;
    }
    // on the headphones: the hand's centre goes to the grip point exactly (the wrist is moved by
    // the error in turn, since the hand turns with the forearm)
    _goal.set(
      target[0] + HAND_OFFSET[0],
      target[1] + HAND_OFFSET[1],
      target[2] + HAND_OFFSET[2],
    );
    _goal.lerp(grip, gw);
    const wrist: V3 = [
      _goal.x - HAND_OFFSET[0],
      _goal.y - HAND_OFFSET[1],
      _goal.z - HAND_OFFSET[2],
    ];
    for (let n = 0; n < 4; n++) {
      const tip = solveTo(wrist);
      wrist[0] += _goal.x - tip.x;
      wrist[1] += _goal.y - tip.y;
      wrist[2] += _goal.z - tip.z;
    }
    solveTo(wrist);
  });

  // legs: the feet are on the floor (which drops when the desk rises); while walking they step
  rig.legs.forEach((leg, i) => {
    const phase = pose.gait.phase + (i === 0 ? 0 : 0.5);
    const ang = phase * Math.PI * 2;
    const fwd = 0.1 * pose.gait.amp * Math.cos(ang);
    const lift = 0.05 * pose.gait.amp * Math.max(0, -Math.sin(ang));
    const ankle: V3 = [
      leg.side * 0.09,
      pose.floorY + ANKLE_H + lift - py,
      -0.215 + 0.215 * pose.stand - fwd,
    ];
    const sol = solveArm(
      [leg.hip.x, leg.hip.y, leg.hip.z],
      ankle,
      KNEE_POLE,
      THIGH,
      SHIN,
    );
    _a.set(
      sol.elbow[0] - leg.hip.x,
      sol.elbow[1] - leg.hip.y,
      sol.elbow[2] - leg.hip.z,
    ).normalize();
    leg.thigh.quaternion.copy(_arc.setFromUnitVectors(leg.d1, _a));
    _qPi.copy(leg.thigh.quaternion).invert();
    _b.set(
      sol.wrist[0] - sol.elbow[0],
      sol.wrist[1] - sol.elbow[1],
      sol.wrist[2] - sol.elbow[2],
    )
      .normalize()
      .applyQuaternion(_qPi);
    leg.shin.quaternion.copy(_arc.setFromUnitVectors(leg.d2, _b));
  });
}

/** The chair's own spin when it is tapped while nobody sits in it. */
const swivelSpin = { angle: 0, v: 0 };

// ---- reactions of the loose and fixed things ------------------------------------------------

const SAY: Record<string, string> = {
  keyboard: 'The developer types faster.',
  mouse: 'The developer clicks around.',
  mug: 'The developer takes a sip of coffee.',
  chair: 'The chair spins round.',
  dev: 'The developer waves.',
  lamp: 'The lamp is switched.',
  monitor: 'The screen shows something else.',
  headphones: 'The developer puts the headphones on.',
  plant: 'The plant leaves sway.',
  phone: 'The phone buzzes.',
};

/**
 * A message from the drawer: typed out in a window on the monitor (the laptop's screen is not
 * drawn), and read out through the status line for a screen reader. `calm`: shown at once.
 */
const toast = (text: string, calm = false) => {
  screenState.note = { text, t: calm ? 4 : 0 };
  screenDirty = true;
  window.dispatchEvent(new CustomEvent(DESK_SAY_EVENT, { detail: text }));
};

const say = (text: string) =>
  window.dispatchEvent(new CustomEvent(DESK_SAY_EVENT, { detail: text }));

/**
 * The reset's shots: everything out of place, ordered so the turns sweep smoothly (from the side
 * nearest the screen outwards), and things in nearly the same direction batched into one shot
 * (four shots at most, so it all takes about six seconds). Sets each item's delay.
 */
export function planShots(items: TetherItem[]): Shot[] {
  const pts = items.map((it) => {
    const x = it.entry.def.p[0] + it.from.x - CHAIR_AT.x;
    const z = it.entry.def.p[2] + it.from.z - CHAIR_AT.z;
    return { it, x, z, th: Math.atan2(-x, -z) };
  });
  pts.sort((a, b) => a.th - b.th);
  const first = pts[0];
  const last = pts[pts.length - 1];
  // start at the end nearer the screen, so the first turn is the shorter one
  if (first && last && Math.abs(first.th) > Math.abs(last.th)) pts.reverse();
  const groups: (typeof pts)[] = [];
  for (const p of pts) {
    const g = groups[groups.length - 1];
    const anchor = g?.[0];
    if (
      g &&
      anchor &&
      (Math.abs(p.th - anchor.th) < 0.55 || groups.length >= 4)
    )
      g.push(p);
    else groups.push([p]);
  }
  return groups.map((g, j) => {
    let x = 0;
    let z = 0;
    let th = 0;
    g.forEach((p, i) => {
      x += p.x / g.length;
      z += p.z / g.length;
      th += p.th / g.length;
      p.it.delay = TETHER_START + j * TETHER_SLOT + 0.55 + i * 0.1;
    });
    return { yaw: th, at: [x, 0.05, z] as V3 };
  });
}

/** A point in the chair frame (what the animation works in) from a world point. */
const inChairFrame = (p: Vector3): V3 => [
  p.x - CHAIR_AT.x,
  p.y,
  p.z - CHAIR_AT.z,
];

const _w = new Vector3();
const worldOf = (e: RegistryEntry): Vector3 =>
  e.obj.getWorldPosition(_w).clone();

/** True when a loose entry is on the desk, at rest and upright: something the sitter can reach for. */
function standing(e: RegistryEntry | undefined): e is RegistryEntry {
  if (!e || e.free || !e.obj.visible) return false;
  if (physicsBridge.api()?.awake(e.id)) return false;
  const w = worldOf(e);
  if (Math.abs(w.y) > 0.02) return false;
  return true;
}

const _wq = new Quaternion();
/** True when the object stands as it was drawn (a mug that landed tipped or turned is not reached for). */
function asDrawn(e: RegistryEntry): boolean {
  e.obj.getWorldQuaternion(_wq);
  return Math.abs(_wq.w) > 0.997;
}

/** Things the sitter may glance at, by id. */
const INTEREST = [
  'laptop',
  'clock-ktm',
  'plant',
  'phone',
  'arduino',
  'calendar',
  'ghost',
  'ball-l',
  'headphones',
  'lamp',
];

const SHOULDER_R = v(restArm(1).shoulder);
const _grip = new Vector3();
/** Height of the grip on a mug, above its base (the same number the animation uses). */
const MUG_GRIP = 0.045;
const _idQ = new Quaternion();
const _small = new Vector3(0.3, 0.3, 0.3);
const _hand = new Vector3();
const _mugBase = new Vector3();
const _hpPos = new Vector3();
const _hpQ = new Quaternion();
const _hpParentQ = new Quaternion();
const _cableA = new Vector3();
const _cableB = new Vector3();
const _headP = new Vector3();
const _mugRim = new Vector3();
const _mugLow = new Vector3();
const _mugUp = new Vector3();
const _mugQ = new Quaternion();
/** A world point in the chair frame, a little above (where the sitter looks). */
const cf = (p: readonly number[]): V3 => [
  (p[0] ?? 0) - CHAIR_AT.x,
  (p[1] ?? 0) + 0.04,
  (p[2] ?? 0) - CHAIR_AT.z,
];

export function Workstation() {
  const { invalidate, camera, size } = useThree();
  const active = useActive();
  const motion = useRef(getMotion() === 'full');
  const anim = useRef<DevAnim | null>(null);
  const hpDriven = useRef(false);
  const art = useLineArt();
  const awake = useRef(0);
  const liq = useRef<Liquid | null>(null);
  const knock = useRef({ t: -1, seen: 0 });
  const mugAt = useRef({ p: new Vector3(), free: false, ready: false });
  const tether = useRef<Tether | null>(null);
  const cable = useRef<LineSegments2 | null>(null);
  const cableAt = useRef(new Vector3(1e9, 0, 0));
  const pointer = useRef({ x: 0, y: 0, at: -1e9, ok: false });
  const headNdc = useRef({ x: 0, y: 0 });
  const pulse = useRef({ t: -1, cancelled: false });
  const finds = useRef<Finds | null>(null);
  const drawer = useRef({
    open: 0,
    target: 0,
    egg: -1,
    /** Seconds since the drawer opened (-1 while closed) and since it began to close (-1 while open). */
    openT: -1,
    closeT: -1,
    snapped: false,
    reached: false,
    carried: false,
    landed: false,
    clunked: false,
    /** Seconds since the drawer reached the end of its slide (-1 before). */
    settleT: -1,
    endAt: 0,
    lastHand: new Vector3(),
    snap: new Map<Object3D, { p: Vector3; q: Quaternion; s: Vector3 }>(),
  });
  const stickyTex = useMemo(
    () => createCardTexture(readToken('--paper'), readToken('--blue-ink')),
    [],
  );
  const slipTex = useMemo(
    () => createCardTexture(readToken('--paper'), readToken('--blue-ink'), 88),
    [],
  );
  useEffect(() => {
    stickyTex.draw(EGGS[2]?.lines ?? [], 'sticky');
    slipTex.draw(['it works on my machine'], 'paper');
    return () => {
      stickyTex.dispose();
      slipTex.dispose();
    };
  }, [stickyTex, slipTex]);
  const taps = useRef({ dev: 0, code: 0, disco: false, drop: 0 });
  const extra = useRef({
    shake: 0,
    lampSwing: 0,
    lampV: 0,
    leaves: 0,
    leavesV: 0,
    mouseClickSeen: 0,
    typedSeen: -1,
    screenAt: 0,
  });

  /** Wakes the animation: it draws frames for a while, then sleeps again until the next touch. */
  const wake = useCallback(() => {
    const now = performance.now();
    const asleep = now >= awake.current;
    awake.current = now + (motion.current ? IDLE_MS : CALM_MS);
    if (asleep) invalidate();
  }, [invalidate]);

  useEffect(() => {
    anim.current = createDevAnim();
    anim.current.setCalm(!motion.current);
    return () => {
      anim.current = null;
      clearBumps();
    };
  }, []);

  useEffect(
    () =>
      subscribeMotion((m) => {
        motion.current = m === 'full';
        anim.current?.setCalm(m !== 'full');
        wake();
        invalidate();
      }),
    [invalidate, wake],
  );

  // A capped frame rate for the animation, only while it is worth drawing: the desk is on screen,
  // the tab shows and somebody touched or looked at it in the last 20 s.
  useEffect(() => {
    if (!active) return;
    wake();
    const id = setInterval(() => {
      if (!isQuiet() && performance.now() < awake.current) invalidate();
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [active, invalidate, wake]);

  // Anything that says someone is there wakes it: a press, a key, the wheel, focus, the pointer
  // moving over the canvas. Scrolling the desk into view wakes it through `active`.
  useEffect(() => {
    const over = (e: PointerEvent) => {
      const r = table.canvas?.getBoundingClientRect();
      if (r && r.width > 0) {
        pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        pointer.current.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
        pointer.current.at = performance.now();
        pointer.current.ok = true;
      }
      if (
        r &&
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom
      )
        wake();
    };
    const any = () => wake();
    window.addEventListener('pointermove', over, { passive: true });
    for (const t of ['pointerdown', 'keydown', 'wheel', 'scroll', 'focusin'])
      window.addEventListener(t, any, { passive: true });
    return () => {
      window.removeEventListener('pointermove', over);
      for (const t of ['pointerdown', 'keydown', 'wheel', 'scroll', 'focusin'])
        window.removeEventListener(t, any);
    };
  }, [wake]);

  // First visit only: after 4 s without a touch, the drawer and the handset give one soft pulse.
  useEffect(() => {
    if (pulseSeen()) return;
    const id = window.setTimeout(() => {
      if (pulse.current.cancelled) return;
      pulse.current.t = 0;
      markPulseSeen();
      wake();
    }, 4000);
    return () => window.clearTimeout(id);
  }, [wake]);

  /**
   * Every loose object that is not at home, with the exact pose it has now (position and rotation,
   * world): a table body's drawn pose, and a fall-layer object's drawn pose mapped back through
   * the table camera, so the reel starts from the very picture on screen.
   */
  const displaced = (): TetherItem[] => {
    const out = new Map<string, TetherItem>();
    const fapi = fallBridge.api();
    for (const b of fapi?.bodies() ?? []) {
      const e = registry.get(b.id);
      if (!e || e.fixed) continue;
      const c = fapi?.capture(b.id);
      if (!c) continue;
      out.set(b.id, {
        entry: e,
        from: new Vector3(
          c.p[0] - e.def.p[0],
          c.p[1] - e.def.p[1],
          c.p[2] - e.def.p[2],
        ),
        q: new Quaternion(...c.q),
        fall: true,
      });
    }
    for (const b of physicsBridge.api()?.bodies() ?? []) {
      const e = registry.get(b.id);
      if (!e || e.fixed || out.has(b.id)) continue;
      e.obj.updateWorldMatrix(true, false);
      const wp = e.obj.getWorldPosition(new Vector3());
      const wq = e.obj.getWorldQuaternion(new Quaternion());
      const from = wp.sub(new Vector3(...e.def.p));
      const turned = wq.angleTo(new Quaternion(...e.def.q));
      if (from.length() > 0.04 || turned > 0.12)
        out.set(b.id, { entry: e, from, q: wq });
    }
    return [...out.values()];
  };

  const startTether = (items: TetherItem[]) => {
    if (tether.current) endTether(tether.current);
    // the wrist (moved every frame from the arm while the lines are out)
    const anchor = new Vector3(0.35, 0.2, 0.5);
    const t = createTether(items, anchor, new Color(readToken('--stroke')), 0);
    table.group?.add(t.group);
    tether.current = t;
    // everything is drawn at its starting pose before the next frame
    stepTether(t, 0);
  };

  /** Puts the find back: it flies back into the tray as the drawer slides shut. */
  const closeDrawer = () => {
    const d = drawer.current;
    d.target = 0;
    d.closeT = 0;
    d.snapped = false;
  };

  // ---- reactions ----------------------------------------------------------------------------
  useEffect(() => {
    const act = (id: string) => {
      const a = anim.current;
      if (!a) return;
      pulse.current.cancelled = true;
      wake();
      const now = performance.now();
      const entry = registry.get(id);
      let said = SAY[id] ?? '';
      const env = envNow();
      const d0 = drawer.current;
      if (id.startsWith('find:')) {
        // a tap on what came out of the drawer
        const kind = id.slice(5);
        const egg = EGGS[d0.egg];
        const F = finds.current;
        if (kind === 'card') {
          closeDrawer();
          say('The drawer closes.');
        } else if (kind === 'duck') {
          if (F) F.squash = 1;
          playSqueak();
          a.trigger('shrug');
          if (egg?.tap) say(egg.tap);
        } else if (kind === 'note') {
          a.glanceAt(cf(STICKY_SPOT));
          if (egg) toast(egg.say, !motion.current);
        } else if (kind === 'floppy') {
          if (egg?.href) {
            toast(
              `${egg.tap ?? egg.say} Opening ${egg.linkLabel ?? 'the link'}.`,
              !motion.current,
            );
            window.open(egg.href, '_blank', 'noopener,noreferrer');
          }
        } else if (kind === 'cookie' && F && F.crack.target === 0) {
          F.crack.target = 1;
          a.glanceAt(cf(COOKIE_SPOT));
          if (egg?.tap) toast(egg.tap, !motion.current);
        }
        invalidate();
        return;
      }
      switch (id) {
        case 'keyboard':
          a.trigger('fast');
          break;
        case 'mouse':
          a.trigger('mouse');
          break;
        case 'chair':
          if (a.standing()) swivelSpin.v += 16;
          else a.trigger('spin');
          break;
        case 'handset': {
          const up = !a.deskUp();
          a.setDeskUp(up);
          said = up
            ? 'The desk rises and the developer stands up.'
            : 'The desk comes down and the developer sits.';
          break;
        }
        case 'drawer': {
          const d = drawer.current;
          if (d.target === 1) {
            closeDrawer();
            said = 'The drawer closes.';
          } else {
            d.target = 1;
            d.egg = (d.egg + 1) % EGGS.length;
            d.openT = 0;
            d.closeT = -1;
            d.snapped = false;
            d.reached = false;
            d.carried = false;
            d.landed = false;
            d.settleT = -1;
            const F = finds.current;
            if (F) {
              F.crack.value = 0;
              F.crack.target = 0;
              F.squash = 0;
            }
            const egg = EGGS[d.egg];
            if (egg) {
              if (egg.item === 'card') cardTexture?.draw(egg.lines, 'paper');
              toast(egg.say, !motion.current);
              said = '';
              // the sitter notices what came out
              if (egg.item === 'card') a.trigger('nod');
              else if (egg.item === 'duck') a.glanceAt(cf(DUCK_LAND));
              else if (egg.item === 'note') a.glanceAt(cf(STICKY_SPOT));
              else if (egg.item === 'cookie') a.glanceAt(cf(COOKIE_SPOT));
            }
          }
          break;
        }
        case 'monitor':
          screenState.mode = (screenState.mode + 1) % SCREEN_MODES;
          screenDirty = true;
          a.trigger('nod');
          break;
        case 'mug':
          if (env.mug) a.trigger('sip');
          else {
            a.trigger('shrug');
            said =
              (liq.current?.amount ?? 1) < 0.25
                ? 'The mug is empty.'
                : 'The mug is out of reach.';
          }
          break;
        case 'dev':
          if (a.cansOn()) {
            a.trigger('cans', { cans: false });
            said = 'The developer takes the headphones off.';
          } else if (a.deskUp()) {
            a.trigger('wave');
          } else {
            // wave, then a walk round the desk, then a wave again
            taps.current.dev += 1;
            if (taps.current.dev % 2 === 0) {
              a.trigger('walk');
              said = 'The developer stands up, stretches and goes for a walk.';
            } else a.trigger('wave');
          }
          break;
        case 'headphones': {
          const hp = registry.get('headphones');
          if (a.cansOn()) {
            a.trigger('cans', { cans: false });
            said = 'The developer takes the headphones off.';
          } else if (hp && hp.obj.visible && !hp.free && !tether.current) {
            a.trigger('cans', { cans: true });
          } else {
            a.trigger('shrug');
            said = 'The headphones are out of reach.';
          }
          break;
        }
        case 'lamp': {
          const on = getLamp() > 1;
          setLamp(on ? 0 : 4);
          extra.current.lampV += 9;
          said = on ? 'The lamp goes off.' : 'The lamp comes on.';
          break;
        }
        case 'plant':
          extra.current.leavesV += 5;
          if (entry) a.glanceAt(inChairFrame(worldOf(entry)));
          break;
        case 'phone':
          bump(id, now, 'buzz');
          if (entry) a.glanceAt(inChairFrame(worldOf(entry)));
          break;
        default:
          // furniture (the docked laptop) cannot hop: the sitter nods at it instead
          if (entry?.fixed) a.trigger('nod');
          else bump(id, now, 'hop');
          if (entry && !entry.free) a.glanceAt(inChairFrame(worldOf(entry)));
          said = entry ? `Bounce: ${entry.def.id.replace(/-/g, ' ')}.` : '';
      }
      if (said) say(said);
      invalidate();
    };
    const off = reactions.subscribe(act);
    const onAct = (e: Event) => {
      const id = (e as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id === 'string') {
        armSound();
        reactions.fire(id);
      }
    };
    const onReset = () => {
      const a = anim.current;
      closeDrawer();
      screenState.mode = 0;
      screenState.note = null;
      screenDirty = true;
      wake();
      // what is out of place now (before the physics layer puts it all home at once)
      const out = motion.current && a ? displaced() : [];
      // what is in the fall layer stays there, held still, for the tether to reel home
      const keep: string[] = [];
      for (const it of out)
        if (it.fall && fallBridge.api()?.freeze(it.entry.id))
          keep.push(it.entry.id);
      for (const it of out)
        if (it.fall && !keep.includes(it.entry.id)) it.fall = false;
      physicsBridge.api()?.reset(keep);
      coffee.amount = 1;
      if (liq.current) refill(liq.current);
      knock.current.t = -1;
      if (motion.current && a) {
        // the sitter does it: turns to the scene, throws an arm out and pulls everything home
        a.setDeskUp(false);
        if (out.length > 0) {
          const shots = planShots(out);
          a.trigger('tether', { items: out.length, shots });
          startTether(out);
        }
      } else a?.reset();
      invalidate();
    };
    window.addEventListener(DESK_ACT_EVENT, onAct);
    window.addEventListener(DESK_RESET_EVENT, onReset);
    return () => {
      off();
      window.removeEventListener(DESK_ACT_EVENT, onAct);
      window.removeEventListener(DESK_RESET_EVENT, onReset);
    };
    // `envNow` reads refs and the registry only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate, wake]);

  // The sticky note's code, typed anywhere on the page: the lamp goes disco for a few seconds.
  useEffect(() => {
    let progress = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
      )
        return;
      const r = feedCode(KONAMI, progress, e.key);
      progress = r.progress;
      if (!r.done || taps.current.disco) return;
      if (!motion.current) {
        toast(
          'Konami code. Reduced motion is on, so the lamp stays still.',
          true,
        );
        return;
      }
      taps.current.disco = true;
      const back = getLamp();
      const seq: Lamp[] = [0, 4, 1, 3, 2, 4, 0, 3];
      let i = 0;
      const id = window.setInterval(() => {
        setLamp(seq[i++ % seq.length] ?? 4);
      }, 220);
      window.setTimeout(() => {
        window.clearInterval(id);
        setLamp(back);
        taps.current.disco = false;
      }, 3600);
      anim.current?.trigger('nod');
      if (finds.current) startBurst(finds.current, [0.2, 0.56, -0.1]);
      toast('Konami code. The lamp goes disco.');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** What the animation needs to know about the desk right now. */
  function envNow(): Env {
    const cam = camera.position;
    const viewYaw = Math.atan2(-(cam.x - CHAIR_AT.x), -(cam.z - CHAIR_AT.z));
    let mug: V3 | null = null;
    const m = registry.get('mug');
    if (standing(m) && asDrawn(m) && (liq.current?.amount ?? 1) >= 0.25) {
      const w = inChairFrame(worldOf(m));
      // the hand reaches for the grip on the mug: it must be within the arm's reach
      const grip = _grip.set(
        w[0] - HAND_OFFSET[0],
        w[1] + MUG_GRIP - HAND_OFFSET[1],
        w[2] - HAND_OFFSET[2],
      );
      if (grip.sub(SHOULDER_R).length() < UPPER + FORE - 0.03) mug = w;
    }
    const interest: V3[] = [];
    for (const id of INTEREST) {
      const e = registry.get(id);
      if (!e || e.free || !e.obj.visible) continue;
      const w = inChairFrame(worldOf(e));
      interest.push([w[0], w[1] + 0.04, w[2]]);
    }
    // the floppy hangs in the air for the left hand to take
    const dd = drawer.current;
    const reach: V3 | null =
      EGGS[dd.egg]?.item === 'floppy' && dd.openT >= 0 && dd.target === 1
        ? cf(FLOPPY_HOVER)
        : null;
    // the headphones, where they are on the desk (they may be on the head: then where they go back to)
    let hpAt: V3 | null = null;
    const hpE = registry.get('headphones');
    let hpPitch = 0;
    if (hpE && !hpE.free && hpE.obj.visible) {
      hpAt = inChairFrame(worldOf(hpE));
      // lying how: stood on its cups (0) or on its side (a quarter turn about x)
      const hq = hpE.obj.quaternion;
      hpPitch = 2 * Math.atan2(hq.x, hq.w);
    }
    // the pointer, measured from the head: a gentle follow, only while it is lively and near the canvas
    const pt = pointer.current;
    const near = Math.max(Math.abs(pt.x), Math.abs(pt.y));
    const near01 = 1 - Math.min(Math.max((near - 1) / 0.6, 0), 1);
    const gaze = pt.ok
      ? {
          x: (pt.x - headNdc.current.x) * 1.1 * near01,
          y: (pt.y - headNdc.current.y) * 1.1 * near01,
          fresh: performance.now() - pt.at < 2000 && near01 > 0,
        }
      : null;
    // how far the tray is out (the slide's own easing)
    const drawerOut = dd.target === 1 ? 1 - (1 - dd.open) ** 3 : dd.open ** 3;
    return {
      viewYaw,
      mug,
      interest,
      reach,
      gaze,
      hp: hpAt,
      hpPitch,
      drawer: drawerOut,
    };
  }

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const a = anim.current;
    if (!a) return;
    const devEntry = registry.get('dev');
    const chair = registry.get('chair');
    if (!devEntry) return;
    const rig = rigDev(devEntry.lift, chair?.lift);
    if (!rig) return;
    // asleep (nobody there for 20 s) or off screen: nothing moves, and it picks up where it was
    if (!active || performance.now() >= awake.current) return;
    const calm = !motion.current;

    const pose = a.update(delta, envNow());
    applyPose(rig, pose);
    const x = extra.current;

    // where the head is on the canvas (the pointer is measured from it)
    rig.head.getWorldPosition(_headP).project(camera);
    headNdc.current.x = _headP.x;
    headNdc.current.y = _headP.y;

    // the tether: its lines leave the right hand and follow it as it throws and pulls
    if (tether.current) {
      const hand = rig.arms[1];
      hand.fore.updateWorldMatrix(true, false);
      tether.current.anchor.copy(hand.tip).applyMatrix4(hand.fore.matrixWorld);
      if (!stepTether(tether.current, delta)) {
        endTether(tether.current);
        tether.current = null;
      }
    }

    // the chair rolls out of the way and stays on the floor; the desk's legs stretch with the top
    const f = FLOOR_Y - pose.floorY;
    if (chair) {
      chair.obj.position.set(
        chair.def.p[0] + pose.chair.x,
        chair.def.p[1] - f,
        chair.def.p[2] + pose.chair.z,
      );
      chair.obj.rotation.y = pose.chair.turn;
    }
    swivelSpin.v *= Math.exp(-2.2 * delta);
    swivelSpin.angle += swivelSpin.v * delta;
    // back to square once somebody sits in it again
    if (pose.stand < 0.05) swivelSpin.angle *= Math.exp(-4 * delta);
    const legs = deskParts.legs;
    if (legs) {
      legs.position.y = FLOOR_Y - f;
      legs.scale.y = (LEGS_H + f) / LEGS_H;
    }
    // the camera follows the floor down, so the desk top seems to rise with everything on it
    if (Math.abs(f - taps.current.drop) > 1e-4) {
      taps.current.drop = f;
      setCameraDrop(f);
      applyHeroCamera(camera as PerspectiveCamera, size.width / size.height);
    }

    // the drawer: slides out, and its find comes out of it (and goes back in when it closes)
    const dr = registry.get('drawer');
    if (dr) {
      const d = drawer.current;
      // calm: the drawer and what is in it change in about 160 ms instead of playing out
      const slideTime = calm
        ? DURATION_FAST / 1000
        : d.target === 1
          ? 0.28
          : 0.22;
      const speed = calm ? 8 : 1;
      d.open += Math.max(
        -delta / slideTime,
        Math.min(delta / slideTime, d.target - d.open),
      );
      // on rails: out fast and easing to the stop, where it bounces back a hair and settles;
      // in with an accelerating push that ends on a snap
      const out3 = 1 - (1 - d.open) ** 3;
      const bounce =
        d.target === 1 && d.settleT >= 0 && !calm
          ? 0.06 *
            Math.exp(-d.settleT * 11) *
            Math.abs(Math.cos(d.settleT * 26))
          : 0;
      const slide = (d.target === 1 ? out3 - bounce : d.open ** 3) * 0.3;
      // the wood: a knock as it reaches the end of its travel, in either direction
      if (d.target === 1 && d.open >= 0.98 && !d.clunked) {
        d.clunked = true;
        d.settleT = 0;
        playClunk();
        // the desk jars: the monitor, the lamp and the plant shiver
        extra.current.shake = 1;
        extra.current.lampV += 3;
        extra.current.leavesV += 1.5;
      } else if (d.target === 0 && d.open <= 0.02 && d.clunked) {
        d.clunked = false;
        playClunk();
        extra.current.shake = 0.7;
        extra.current.lampV += 2;
      }
      if (d.settleT >= 0) d.settleT += delta;
      if (!finds.current) {
        finds.current = buildFinds(
          art,
          stickyTex.material,
          slipTex.material,
          new Color(readToken('--stroke')),
        );
        dr.lift.add(finds.current.group);
      }
      const F = finds.current;
      const egg = EGGS[Math.max(d.egg, 0)];
      const items: Record<string, Object3D | undefined> = {
        card: dr.lift.getObjectByName('card'),
        duck: dr.lift.getObjectByName('duck'),
        note: F.sticky,
        floppy: F.floppy,
        cookie: F.cookie,
      };
      for (const name of ['tray', 'card', 'duck']) {
        const n = dr.lift.getObjectByName(name);
        if (!n) continue;
        const z0 = (n.userData['z0'] ??= n.position.z) as number;
        n.position.z = z0 + slide;
      }
      if (d.openT >= 0) {
        if (d.target === 1) d.openT += delta * speed;
        else if (d.closeT >= 0) d.closeT += delta * speed;
        if (d.closeT > 0.55) {
          d.openT = -1;
          d.closeT = -1;
        }
      }
      const closing = d.target === 0 && d.openT >= 0;
      const home = new Vector3(TRAY_AT[0], TRAY_AT[1], TRAY_AT[2] + slide);
      for (const [name, obj] of Object.entries(items)) {
        if (!obj) continue;
        obj.userData['find'] ??= name;
        if (!egg || egg.item !== name || d.openT < 0) {
          setShown(obj, false);
          continue;
        }
        if (closing) {
          // back into the tray, from wherever it got to
          let snap = d.snap.get(obj);
          if (!d.snapped || !snap) {
            snap = {
              p: obj.position.clone(),
              q: obj.quaternion.clone(),
              s: obj.scale.clone(),
            };
            d.snap.set(obj, snap);
            d.snapped = true;
          }
          const e = Math.min(d.closeT / 0.45, 1);
          const k = e * e * (3 - 2 * e);
          obj.position.lerpVectors(snap.p, home, k);
          obj.quaternion.slerpQuaternions(snap.q, _idQ, k);
          obj.scale.lerpVectors(snap.s, _small, k);
          // it hops back in
          obj.position.y += 0.16 * Math.sin(Math.PI * k);
          setShown(obj, e < 1);
          continue;
        }
        // calm: hold the settled frame (no waddle, no flutter, no float)
        const t = calm ? Math.min(d.openT, 1.6) : d.openT;
        switch (name) {
          case 'card':
            applyTf(obj, cardTf(t, slide));
            break;
          case 'duck': {
            const tf = duckTf(t, slide);
            if (!d.landed && t >= HOP_END) {
              d.landed = true;
              F.squash = 1;
            }
            const q = F.squash * Math.abs(Math.cos(t * 16));
            tf.s = [1 + 0.25 * q, 1 - 0.4 * q, 1 + 0.25 * q];
            tf.p[1] += 0.03 * F.squash * Math.abs(Math.sin(t * 9));
            F.squash = Math.max(0, F.squash - delta * 1.8);
            applyTf(obj, tf);
            break;
          }
          case 'note':
            applyTf(obj, stickyTf(t, slide));
            break;
          case 'cookie': {
            const ctf = cookieTf(t, slide);
            if (!d.landed && t >= HOP_END) {
              d.landed = true;
              F.squash = 1;
            }
            const cq = F.squash * Math.abs(Math.cos(t * 14));
            ctf.s = [1 + 0.2 * cq, 1 - 0.3 * cq, 1 + 0.2 * cq];
            F.squash = Math.max(0, F.squash - delta * 2);
            applyTf(obj, ctf);
            const crackRate = calm ? 12 : 1.8;
            F.crack.value += Math.max(
              -delta * crackRate,
              Math.min(delta * crackRate, F.crack.target - F.crack.value),
            );
            poseCookie(F);
            break;
          }
          default: {
            // the floppy: slides out and spins, then the sitter takes it and sets it down by the laptop
            if (calm) {
              // no reach: the disk is simply on the desk by the keyboard
              obj.position.set(...FLOPPY_REST);
              obj.rotation.set(0, 0, 0);
              obj.scale.set(1, 1, 1);
              break;
            }
            if (t < FLOPPY_WAIT) {
              applyTf(obj, floppyTf(t, slide));
              break;
            }
            if (!d.reached) {
              d.reached = true;
              a.trigger('reach');
            }
            const hand = _hand.set(
              pose.l[0] + HAND_OFFSET[0] + CHAIR_AT.x,
              pose.l[1] + HAND_OFFSET[1] + 0.012,
              pose.l[2] + HAND_OFFSET[2] + CHAIR_AT.z - 0.02,
            );
            if (pose.carry) {
              d.carried = true;
              d.lastHand.copy(hand);
              d.endAt = t;
              obj.position.copy(hand);
              obj.rotation.set(0.25, t * 2, 0);
            } else if (d.carried || t > 4.2) {
              if (!d.carried) {
                d.carried = true;
                d.lastHand.set(...FLOPPY_HOVER);
                d.endAt = t;
              }
              const e = Math.min((t - d.endAt) / 0.7, 1);
              const k = e * e * (3 - 2 * e);
              obj.position.set(
                d.lastHand.x + (FLOPPY_REST[0] - d.lastHand.x) * k,
                d.lastHand.y + (FLOPPY_REST[1] - d.lastHand.y) * k,
                d.lastHand.z + (FLOPPY_REST[2] - d.lastHand.z) * k,
              );
              obj.rotation.set(0.25 * (1 - k), t * 2 * (1 - k), 0);
            } else {
              obj.position.set(...FLOPPY_HOVER);
              obj.rotation.set(0, 0, 0);
            }
            obj.scale.set(1, 1, 1);
          }
        }
        // the contents jostle as the drawer runs out and as it hits the stop
        if (!calm) {
          const run =
            d.open < 0.98 ? Math.sin(d.openT * 42) * 0.004 * (1 - d.open) : 0;
          const hit =
            d.settleT >= 0 && d.settleT < 0.4
              ? Math.sin(d.settleT * 55) * 0.005 * (1 - d.settleT / 0.4)
              : 0;
          obj.position.y += run + hit;
        }
        setShown(obj, d.open > 0.02);
      }
      stepBurst(F, delta);
      poseGlint(F, d.target === 1 && d.settleT >= 0 ? d.settleT : -1, slide);
      // the first-visit pulse on the drawer and the handset (they are one model)
      const pl = pulse.current;
      if (pl.t >= 0) {
        if (calm) pl.t = -1;
        else {
          pl.t += delta;
          const u = pl.t / ((DURATION_SLOW * 2) / 1000);
          dr.lift.scale.setScalar(
            u >= 1 ? 1 : 1 + 0.035 * Math.sin(u * Math.PI),
          );
          if (u >= 1) pl.t = -1;
        }
      }
    }

    // the desk shivers after the drawer hits its stop
    x.shake = Math.max(0, x.shake - delta * 3.2);
    const mon = registry.get('monitor');
    if (mon)
      mon.lift.rotation.z = calm
        ? 0
        : x.shake * 0.005 * Math.sin(performance.now() * 0.07);

    // keyboard: the rows press one by one
    const kb = registry.get('keyboard');
    if (kb)
      for (let i = 0; i < 3; i++) {
        const row = kb.lift.getObjectByName(`row-${i}`);
        if (row) row.position.y = KEY_Y - KEY_TRAVEL * pose.keys[i]!;
      }

    // mouse: follows the hand, and clicks
    const mouse = registry.get('mouse');
    if (mouse) {
      mouse.fx.position.set(
        pose.mouse.dx,
        -0.0015 * pose.mouse.click,
        pose.mouse.dz,
      );
    }

    // mug: carried to the mouth while a sip is going on, or knocked over by a hand on the mouse
    const mug = registry.get('mug');
    if (mug) {
      const kn = knock.current;
      if (pose.knocks !== kn.seen) {
        kn.seen = pose.knocks;
        kn.t = 0;
      }
      const mugTethered = tether.current?.strands.some(
        (t) => t.item.entry === mug,
      );
      if (mugTethered) {
        // the tether has it: its own offset and swing, upright at the end
        kn.t = -1;
      } else if (kn.t >= 0) {
        kn.t += delta;
        const t = kn.t;
        const ease3 = (u: number) => u * u * (3 - 2 * u);
        const tip =
          t < 0.45
            ? ease3(t / 0.45)
            : t < 2.5
              ? 1
              : t < 3
                ? 1 - ease3((t - 2.5) / 0.5)
                : 0;
        const wobble =
          t > 2.5 && t < 3.1 ? Math.sin((t - 2.5) * 30) * 0.08 * (3.1 - t) : 0;
        mug.fx.position.set(0.035 * tip, 0.036 * tip, 0);
        mug.fx.rotation.set(0, 0, -1.55 * tip + wobble);
        if (t >= 3.1) kn.t = -1;
      } else if (pose.mug) {
        mug.fx.position.set(pose.mug.dx, pose.mug.dy, pose.mug.dz);
        mug.fx.rotation.set(pose.mug.tilt, 0, 0);
      } else {
        mug.fx.position.set(0, 0, 0);
        mug.fx.rotation.set(0, 0, 0);
      }
      // the coffee in it
      if (!liq.current && table.group) {
        liq.current = buildLiquid(art, new Color(readToken('--stroke')));
        mug.lift.add(liq.current.disc);
        table.group.add(liq.current.world);
      }
      const L = liq.current;
      if (L) {
        const m = mugAt.current;
        if (!mug.free) {
          m.free = false;
          mug.lift.getWorldPosition(_mugBase);
          m.p.copy(_mugBase);
          m.ready = true;
          mug.lift.getWorldQuaternion(_mugQ);
          _mugUp.set(0, 1, 0).applyQuaternion(_mugQ);
          // the lowest point of the rim: where it pours from
          let low = Infinity;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            _mugRim.set(Math.cos(a) * 0.034, 0.085, Math.sin(a) * 0.034);
            mug.lift.localToWorld(_mugRim);
            if (_mugRim.y < low) {
              low = _mugRim.y;
              _mugLow.copy(_mugRim);
            }
          }
          stepLiquid(
            L,
            delta,
            { base: _mugBase, up: _mugUp, rim: _mugLow, ground: 0 },
            calm,
          );
          coffee.amount = L.amount;
        } else {
          // in the fall layer, which draws the pouring and the puddle itself, on its own canvas:
          // here only the cup's level follows what is left
          if (!m.free) {
            m.free = true;
            L.disc.visible = false;
            coffee.amount = L.amount;
          }
          L.amount = coffee.amount;
        }
      }
    }

    // the laptop's cable: from its port to the monitor's, following it wherever it goes
    const lap = registry.get('laptop');
    const monitor = registry.get('monitor');
    if (lap && monitor && table.group) {
      if (!cable.current) {
        cable.current = buildCable(art);
        table.group.add(cable.current);
      }
      lap.lift.localToWorld(_cableA.set(0.14, 0.05, 0));
      _cableB.set(monitor.def.p[0] - 0.12, 0.012, monitor.def.p[2]);
      if (_cableA.distanceToSquared(cableAt.current) > 2.5e-7) {
        cableAt.current.copy(_cableA);
        const seg = lap.free ? null : cableSegments(_cableA, _cableB);
        if (seg) cable.current.geometry.setPositions(seg);
        cable.current.visible = !!seg;
      }
    }

    // headphones: the same object moves: held in the hands, seated on the head, set back down.
    // (applyPose has posed it, and put the hands on it, this frame: no lag between them.)
    const hp = registry.get('headphones');
    if (hp && !hp.free) {
      hp.obj.userData['locked'] = hpDrive.on;
      const tethered = tether.current?.strands.some((t) => t.item.entry === hp);
      if (!tethered) {
        if (!hpDrive.on) {
          if (hpDriven.current) {
            hpDriven.current = false;
            hp.fx.position.set(0, 0, 0);
            hp.fx.quaternion.identity();
            hp.fx.scale.set(1, 1, 1);
          }
        } else {
          hpDriven.current = true;
          const parent = hp.fx.parent;
          if (parent) {
            rig.root.updateWorldMatrix(true, false);
            _hpPos.copy(hpDrive.pos).applyMatrix4(rig.root.matrixWorld);
            rig.root.getWorldQuaternion(_hpQ).multiply(hpDrive.quat);
            parent.updateWorldMatrix(true, false);
            hp.fx.position.copy(parent.worldToLocal(_hpPos));
            parent.getWorldQuaternion(_hpParentQ).invert();
            hp.fx.quaternion.copy(_hpParentQ).multiply(_hpQ);
            hp.fx.scale.set(hpDrive.sx, 1, 1);
          }
        }
      }
    }

    // lamp: the head swings after a switch
    const lamp = registry.get('lamp');
    if (lamp) {
      const head = lamp.lift.getObjectByName('head');
      if (head) {
        x.lampV += -x.lampSwing * 60 * delta;
        x.lampV *= Math.exp(-3.2 * delta);
        x.lampSwing += x.lampV * delta;
        head.rotation.z = x.lampSwing * 0.18;
      }
    }

    // plant: a slow idle sway and a shake after a tap
    const plant = registry.get('plant');
    if (plant) {
      const leaves = plant.lift.getObjectByName('leaves');
      if (leaves) {
        x.leavesV += -x.leaves * 70 * delta;
        x.leavesV *= Math.exp(-2.6 * delta);
        x.leaves += x.leavesV * delta;
        const t = performance.now() / 1000;
        const idle = calm ? 0 : 1;
        leaves.rotation.z = x.leaves * 0.25 + Math.sin(t * 0.9) * 0.018 * idle;
        leaves.rotation.x = Math.sin(t * 0.7 + 1) * 0.014 * idle;
      }
    }

    // screen: scrolls with the typing, flashes on a click, changes with a tap
    if (screenTexture) {
      const clickNow = pose.clicks !== x.mouseClickSeen;
      if (clickNow) {
        x.mouseClickSeen = pose.clicks;
        screenState.click = 1;
        screenDirty = true;
      }
      if (pose.typed !== x.typedSeen) {
        x.typedSeen = pose.typed;
        screenState.typed = pose.typed;
        screenDirty = true;
      }
      if (screenState.click > 0) {
        screenState.click = Math.max(0, screenState.click - delta * 3);
        screenDirty = true;
      }
      const note = screenState.note;
      if (note) {
        // typed out, held a while, then gone
        note.t += delta;
        screenDirty = true;
        if (note.t > 8) screenState.note = null;
      }
      const now = performance.now();
      if (screenDirty && now - x.screenAt > 90) {
        x.screenAt = now;
        screenDirty = false;
        screenTexture.draw(screenState);
      }
    }
  });

  // Leave everything where it was drawn when the workstation goes (a remount builds a new Scene).
  useEffect(
    () => () => {
      cable.current?.removeFromParent();
      cable.current = null;
      liq.current?.world.removeFromParent();
      liq.current?.disc.removeFromParent();
      liq.current = null;
      if (tether.current) endTether(tether.current);
      tether.current = null;
    },
    [],
  );
  return null;
}
