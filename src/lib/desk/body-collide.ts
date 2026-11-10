/**
 * A geometric check that the developer stays out of the furniture: the body as spheres along each
 * bone (head, torso, upper and lower arms, hands, thighs, shins, feet), the desk and the chair as
 * boxes, all in the chair frame (origin on the chair's home axis, y = 0 the desk top). Pure, so a
 * test can run every scripted sequence and measure how deep anything goes in.
 */
import {
  ANKLE_H,
  CHAIR_AT,
  DESK_RISE,
  FLOOR_Y,
  HAND_OFFSET,
  HEAD_OFFSET,
  HEAD_R,
  HIP,
  LEAN,
  UPPER,
  FORE,
  KNEE_POLE,
  hipAt,
  kneeAt,
  leaned,
  neckAt,
  poleFor,
  shoulderAt,
  solveArm,
  type V3,
} from './rig';
import type { Pose } from './dev-anim';
import { TRAY_SLIDE } from './furniture';

export interface Ball {
  c: V3;
  r: number;
  /** Which part of the body. */
  part: string;
}

/** An axis-aligned box: centre and half sizes. */
export interface Block {
  c: V3;
  h: V3;
  name: string;
}

const DESK_X = CHAIR_AT.x;
const DESK_Z = CHAIR_AT.z;
/** The desk board: 2.0 x 1.2, from 2 mm below the top down 68 mm; the chair frame has its origin 0.2 / 0.79 from the desk centre. */
export const BOARD_TOP_Y = -0.002;
export const BOARD_BOTTOM_Y = -0.07;
const BOARD: Block = {
  name: 'desk top',
  c: [-DESK_X, (BOARD_TOP_Y + BOARD_BOTTOM_Y) / 2, -DESK_Z],
  h: [1.0, (BOARD_TOP_Y - BOARD_BOTTOM_Y) / 2, 0.6],
};

/** The desk's own pieces, for a floor height (the desk base stretches when the desk is raised). */
let deskKey = '';
let deskMemo: Block[] = [];
export function deskBlocks(floorY: number, drawer = 0): Block[] {
  const key = `${floorY.toFixed(3)}|${drawer.toFixed(2)}`;
  if (key === deskKey) return deskMemo;
  deskMemo = buildDesk(floorY, drawer);
  deskKey = key;
  return deskMemo;
}

function buildDesk(floorY: number, drawer: number): Block[] {
  const out: Block[] = [BOARD];
  for (const sx of [-0.84, 0.84]) {
    // the side rail under the board, and the two A legs sampled as short blocks down to the floor
    out.push({
      name: 'desk rail',
      c: [sx - DESK_X, -0.095, -DESK_Z],
      h: [0.0225, 0.025, 0.4],
    });
    for (const sz of [-1, 1]) {
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const y = -0.12 + (floorY + 0.14) * u;
        const z = sz * (0.3 + 0.22 * u);
        out.push({
          name: 'desk leg',
          c: [sx - DESK_X, y, z - DESK_Z],
          h: [0.0225, Math.abs((floorY + 0.14) / n) / 2 + 0.01, 0.0225],
        });
      }
    }
  }
  if (drawer > 0.02) {
    // the open tray: its front and box, out past the desk's front edge (centre x -0.5, 0.46 wide)
    const s = TRAY_SLIDE * drawer;
    out.push({
      name: 'drawer',
      c: [-0.5 - DESK_X, -0.109, 0.6 + s / 2 + 0.009 - DESK_Z],
      h: [0.23, 0.035, s / 2 + 0.009],
    });
  }
  return out;
}

/** The chair's boxes (the part that turns with the swivel, and the column), in the chair frame. */
export function chairBlocks(): { fixed: Block[]; swivel: Block[] } {
  return {
    fixed: [{ name: 'chair column', c: [0, -0.33, 0], h: [0.03, 0.125, 0.03] }],
    swivel: [
      { name: 'chair seat', c: [0, -0.215, 0.02], h: [0.18, 0.03, 0.17] },
      { name: 'chair back', c: [0, 0.02, 0.225], h: [0.17, 0.17, 0.02] },
      { name: 'chair arm', c: [-0.2, -0.052, 0], h: [0.025, 0.011, 0.11] },
      { name: 'chair arm', c: [0.2, -0.052, 0], h: [0.025, 0.011, 0.11] },
      { name: 'chair post', c: [-0.2, -0.133, 0.02], h: [0.012, 0.07, 0.012] },
      { name: 'chair post', c: [0.2, -0.133, 0.02], h: [0.012, 0.07, 0.012] },
    ],
  };
}

type M3 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
const mulV = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const mulM = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0) as M3;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        o[i * 3 + j] = (o[i * 3 + j] ?? 0) + a[i * 3 + k]! * b[k * 3 + j]!;
  return o;
};
const rx = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
const ry = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const rz = (a: number): M3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
};
/** three.js 'YXZ' Euler: R = Ry * Rx * Rz. */
const yxz = (x: number, y: number, z: number): M3 =>
  mulM(mulM(ry(y), rx(x)), rz(z));
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** One arm solved for a pose (root-local), as the Scene solves it. */
function armSolve(
  pose: Pose,
  i: number,
  wrist?: V3,
  up = pose.elbow[i] ?? 0,
): { sh: V3; sol: { elbow: V3; wrist: V3 } } {
  const c = Math.cos(-pose.chairYaw);
  const s = Math.sin(-pose.chairYaw);
  const side: -1 | 1 = i === 0 ? -1 : 1;
  const w = wrist ?? (i === 0 ? pose.l : pose.r);
  const px = w[0] - pose.pos.x;
  const pz = w[2] - pose.pos.z;
  const target: V3 = [px * c + pz * s, w[1] - pose.rootY, -px * s + pz * c];
  const tm = yxz(
    -pose.lean - 0.012 * pose.breath,
    pose.torsoYaw,
    pose.torsoRoll,
  );
  const sh = add(HIP, mulV(tm, sub(shoulderAt(side, LEAN), HIP)));
  return { sh, sol: solveArm(sh, target, poleFor(side, up), UPPER, FORE) };
}

/** The body as balls, in the chair frame, for a pose. */
export function bodyBalls(pose: Pose): Ball[] {
  const out: Ball[] = [];
  const yaw = ry(pose.chairYaw);
  const toDesk = (p: V3): V3 =>
    add(mulV(yaw, p), [pose.pos.x, pose.rootY, pose.pos.z]);
  const push = (c: V3, r: number, part: string) =>
    out.push({
      c: toDesk(c),
      r: part === 'head' || part === 'torso' || part === 'hand' ? r : r * 0.9,
      part,
    });
  const seg = (a: V3, b: V3, ra: number, rb: number, part: string) => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const n = Math.max(1, Math.ceil(l / 0.03));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      push(lerp(a, b, t), ra + (rb - ra) * t, part);
    }
  };
  // the torso turns about the hip; the head about the neck
  const tm = yxz(
    -pose.lean - 0.012 * pose.breath,
    pose.torsoYaw,
    pose.torsoRoll,
  );
  const aboutHip = (p: V3): V3 => add(HIP, mulV(tm, sub(p, HIP)));
  for (const x of [-0.09, 0, 0.09])
    for (let i = 0; i <= 6; i++) {
      const y = HIP[1] - 0.02 + (0.385 * i) / 6;
      // (drawn upright, then leaned by the rest lean)
      push(aboutHip(leaned([x, y, HIP[2]], LEAN)), 0.08, 'torso');
    }
  const neck = aboutHip(neckAt(LEAN));
  const hm = mulM(
    tm,
    yxz(pose.headPitch + pose.lean, pose.headYaw, pose.headRoll),
  );
  push(add(neck, mulV(hm, HEAD_OFFSET)), HEAD_R, 'head');
  // arms
  for (let i = 0; i < 2; i++) {
    const { sh, sol } = armSolve(pose, i);
    seg(sh, sol.elbow, 0.042, 0.04, 'upper arm');
    seg(sol.elbow, sol.wrist, 0.04, 0.028, 'forearm');
    push(add(sol.wrist, HAND_OFFSET), 0.03, 'hand');
  }
  // legs
  for (const side of [-1, 1] as const) {
    const phase = pose.gait.phase + (side < 0 ? 0 : 0.5);
    const ang = phase * Math.PI * 2;
    const fwd = 0.1 * pose.gait.amp * Math.cos(ang);
    const lift = 0.05 * pose.gait.amp * Math.max(0, -Math.sin(ang));
    const ankle: V3 = [
      side * 0.09,
      pose.floorY + ANKLE_H + lift - pose.rootY,
      -0.215 + 0.215 * pose.stand - fwd,
    ];
    const hip = hipAt(side);
    const sol = solveArm(
      hip,
      ankle,
      KNEE_POLE,
      Math.hypot(...(sub(kneeAt(side), hip) as V3)),
      Math.hypot(...(sub(kneeAt(side), [side * 0.09, -0.43, -0.215]) as V3)),
    );
    seg(hip, sol.elbow, 0.052, 0.05, 'thigh');
    seg(sol.elbow, sol.wrist, 0.046, 0.04, 'shin');
    push(add(sol.wrist, [0, -0.045, -0.06]), 0.04, 'foot');
  }
  return out;
}

/** How deep a ball is in a box (0 when clear). */
export function depth(ball: { c: V3; r: number }, b: Block): number {
  const d: V3 = [
    Math.abs(ball.c[0] - b.c[0]) - b.h[0],
    Math.abs(ball.c[1] - b.c[1]) - b.h[1],
    Math.abs(ball.c[2] - b.c[2]) - b.h[2],
  ];
  const out = Math.hypot(
    Math.max(d[0], 0),
    Math.max(d[1], 0),
    Math.max(d[2], 0),
  );
  if (out > 0) return Math.max(0, ball.r - out);
  // centre inside: out through the nearest face
  return ball.r - Math.max(d[0], d[1], d[2]);
}

export interface Hit {
  depth: number;
  part: string;
  other: string;
}

/**
 * The deepest penetrations of one pose: the body against the desk (always) and the chair (while
 * the sitter is out of it), and the chair against the desk. `drawer` is how far the tray is out, 0..1.
 */
export function penetrations(pose: Pose, drawer = 0): Hit[] {
  const hits: Hit[] = [];
  const desk = deskBlocks(pose.floorY, drawer);
  const balls = bodyBalls(pose);
  const note = (d: number, part: string, other: string) => {
    if (d > 0) hits.push({ depth: d, part, other });
  };
  for (const ball of balls)
    for (const b of desk) note(depth(ball, b), ball.part, b.name);
  // the chair: where it is, how it is turned
  const ch = chairBlocks();
  const turn = ry(pose.chair.turn);
  const sw = ry(pose.chair.turn + pose.chairYaw * (1 - pose.stand));
  const at: V3 = [pose.chair.x, 0, pose.chair.z];
  // each chair block as a ball cloud against the desk blocks is clumsy; test the block corners
  // and face centres as balls of 1 cm
  const corners = (b: Block, m: M3): Ball[] => {
    const o: Ball[] = [];
    for (const sx of [-1, 0, 1])
      for (const sy of [-1, 0, 1])
        for (const sz of [-1, 0, 1])
          o.push({
            c: add(
              at,
              mulV(m, [
                b.c[0] + sx * b.h[0],
                b.c[1] + sy * b.h[1],
                b.c[2] + sz * b.h[2],
              ]),
            ),
            r: 0.01,
            part: b.name,
          });
    return o;
  };
  const chairBalls = [
    ...ch.fixed.flatMap((b) => corners(b, turn)),
    ...ch.swivel.flatMap((b) => corners(b, sw)),
  ];
  for (const ball of chairBalls)
    for (const b of desk) note(depth(ball, b), ball.part, b.name);
  // a standing or walking sitter against the chair (seated, the body rests on it by design)
  if (pose.stand > 0.7) {
    const inv = (m: M3): M3 => [
      m[0],
      m[3],
      m[6],
      m[1],
      m[4],
      m[7],
      m[2],
      m[5],
      m[8],
    ];
    for (const ball of balls) {
      for (const [list, m] of [
        [ch.fixed, turn],
        [ch.swivel, sw],
      ] as const) {
        const local: V3 = mulV(inv(m), sub(ball.c, at));
        for (const b of list)
          note(depth({ c: local, r: ball.r }, b), ball.part, b.name);
      }
    }
  }
  void FLOOR_Y;
  void DESK_RISE;
  return hits;
}

export function worst(pose: Pose, drawer = 0): Hit | null {
  let w: Hit | null = null;
  for (const h of penetrations(pose, drawer))
    if (!w || h.depth > w.depth) w = h;
  return w;
}

/** The chair's boxes' corners and face centres as small balls in the chair frame, for a pose. */
function chairBalls(pose: Pose): Ball[] {
  const ch = chairBlocks();
  const turn = ry(pose.chair.turn);
  const sw = ry(pose.chair.turn + pose.chairYaw * (1 - pose.stand));
  const at: V3 = [pose.chair.x, 0, pose.chair.z];
  const out: Ball[] = [];
  const corners = (b: Block, m: M3) => {
    for (const sx of [-1, 0, 1])
      for (const sy of [-1, 0, 1])
        for (const sz of [-1, 0, 1])
          out.push({
            c: add(
              at,
              mulV(m, [
                b.c[0] + sx * b.h[0],
                b.c[1] + sy * b.h[1],
                b.c[2] + sz * b.h[2],
              ]),
            ),
            r: 0.01,
            part: b.name,
          });
  };
  for (const b of ch.fixed) corners(b, turn);
  for (const b of ch.swivel) corners(b, sw);
  return out;
}

/**
 * How far back (+z, away from the desk) a ball must go to be out of a block, or 0: the block is
 * in front of it (the desk is at -z of the sitter), so the way out is straight back.
 */
function backBy(ball: { c: V3; r: number }, b: Block): number {
  if (ball.c[2] < b.c[2] - b.h[2]) return 0;
  const dx = Math.max(Math.abs(ball.c[0] - b.c[0]) - b.h[0], 0);
  const dy = Math.max(Math.abs(ball.c[1] - b.c[1]) - b.h[1], 0);
  const rr = ball.r * ball.r - dx * dx - dy * dy;
  if (rr <= 0) return 0;
  return Math.max(0, b.c[2] + b.h[2] + Math.sqrt(rr) - ball.c[2]);
}

/**
 * How far back the sitter's body (hips, torso, head, legs) and the chair each need to be to clear
 * the desk, as the pose stands (the arms are dealt with by their own targets).
 */
export function clearanceBack(
  pose: Pose,
  drawer = 0,
): { body: number; chair: number } {
  const desk = deskBlocks(pose.floorY, drawer);
  let body = 0;
  for (const ball of bodyBalls(pose)) {
    if (
      ball.part === 'hand' ||
      ball.part === 'forearm' ||
      ball.part === 'upper arm'
    )
      continue;
    for (const b of desk) body = Math.max(body, backBy(ball, b));
  }
  let chair = 0;
  for (const ball of chairBalls(pose))
    for (const b of desk) chair = Math.max(chair, backBy(ball, b));
  return { body, chair };
}

/**
 * How deep an arm (solved for `target`, with the elbow raised by `up`) is in the desk: the whole
 * arm when `whole`, otherwise the forearm and hand.
 */
function armDepth(
  pose: Pose,
  i: number,
  target: V3,
  up: number,
  desk: Block[],
): number {
  const { sh, sol } = armSolve(pose, i, target, up);
  let deep = 0;
  const yaw = ry(pose.chairYaw);
  const off: V3 = [pose.pos.x, pose.rootY, pose.pos.z];
  const test = (a: V3, bb: V3, ra: number, rb: number) => {
    const m = Math.max(
      1,
      Math.ceil(Math.hypot(bb[0] - a[0], bb[1] - a[1], bb[2] - a[2]) / 0.03),
    );
    for (let k = 0; k <= m; k++) {
      const t = k / m;
      const world: V3 = add(mulV(yaw, lerp(a, bb, t)), off);
      for (const b of desk)
        deep = Math.max(
          deep,
          depth({ c: world, r: (ra + (rb - ra) * t) * 0.9 }, b),
        );
    }
  };
  test(sh, sol.elbow, 0.042, 0.04);
  test(sol.elbow, sol.wrist, 0.04, 0.028);
  const hand = add(mulV(yaw, add(sol.wrist, HAND_OFFSET)), off);
  for (const b of desk) deep = Math.max(deep, depth({ c: hand, r: 0.03 }, b));
  return deep;
}

/**
 * Keeps the arms out of the desk: the elbow comes up (the least it takes, never below `hold`),
 * and the hand target is lifted if the elbow alone is not enough. Sets `pose.elbow`, may lift
 * `pose.l` / `pose.r`; returns the elbow raise each arm needed.
 */
export function clearArms(
  pose: Pose,
  hold: [number, number] = [0, 0],
  drawer = 0,
): [number, number] {
  const desk = deskBlocks(pose.floorY, drawer);
  const targets = [pose.l, pose.r];
  const need: [number, number] = [0, 0];
  for (let i = 0; i < 2; i++) {
    const t = targets[i]!;
    const ok = (up: number) => armDepth(pose, i, t, up, desk) < 0.003;
    let up = hold[i]!;
    if (!ok(up)) {
      if (ok(1.2)) {
        let lo = up;
        let hi = 1.2;
        for (let n = 0; n < 7; n++) {
          const mid = (lo + hi) / 2;
          if (ok(mid)) hi = mid;
          else lo = mid;
        }
        up = hi;
      } else {
        up = 1.2;
        for (let n = 0; n < 8; n++) {
          const deep = armDepth(pose, i, t, up, desk);
          if (deep < 0.003 || t[1] > 0.2) break;
          t[1] += deep + 0.001;
        }
      }
    }
    need[i] = up;
    pose.elbow[i] = up;
  }
  return need;
}
