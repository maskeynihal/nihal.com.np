import { type Ball, type Colors, type World, TAU, clamp } from './core';

export interface Dog {
  x: number;
  y: number;
  f: number;
  type: number;
  size: number;
  /** go: running to the ball. grab: head down, taking it. back: carrying it. set: putting it down. */
  state: 'idle' | 'wander' | 'go' | 'grab' | 'back' | 'set';
  ball: Ball | null;
  /** Facing as drawn, -1..1: eases through 0 when the dog turns, so a carried ball swings round with the head. */
  fv: number;
  /** Head lowered to the ground, 0..1. */
  dip: number;
  /** Head held high for carrying, 0..1. */
  up: number;
  /** Seconds in the current fetch phase. */
  gt: number;
  /** Where the ball was, on screen, when the dog took hold of it. */
  rx: number;
  ry: number;
  tx: number;
  ty: number;
  timer: number;
  phase: number;
  speed: number;
  sniff: number;
  joy: number;
  seed: number;
}

export function spawnDogs(w: World): Dog[] {
  return [
    { type: 0, size: 1.9, x: w.W * 0.3, seed: 0 },
    { type: 1, size: 1.5, x: w.W * 0.68, seed: 2 },
  ].map((d) => ({
    ...d,
    y: (w.g0 + w.g1) / 2 + d.seed * 8,
    f: d.type ? -1 : 1,
    fv: d.type ? -1 : 1,
    dip: 0,
    up: 0,
    gt: 0,
    rx: 0,
    ry: 0,
    state: 'idle' as const,
    ball: null,
    tx: 0,
    ty: 0,
    timer: 1 + d.seed,
    phase: 0,
    speed: 0,
    sniff: 0,
    joy: 0,
  }));
}

const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

/** Hands each thrown ball to the nearest idle dog. */
function assign(w: World, dogs: Dog[]) {
  for (const b of w.balls) {
    if (b.claimed || b.grabbed || !b.fetch) continue;
    let best: Dog | null = null;
    for (const d of dogs) {
      if (d.ball || d.state === 'go' || d.state === 'grab') continue;
      if (d.state === 'back' || d.state === 'set') continue;
      if (!best || dist(d.x, d.y, b.x, b.y) < dist(best.x, best.y, b.x, b.y))
        best = d;
    }
    if (best) {
      b.claimed = true;
      best.ball = b;
      best.state = 'go';
    }
  }
}

export function stepDogs(w: World, dogs: Dog[], dt: number) {
  assign(w, dogs);
  for (const d of dogs) {
    if (d.ball && (!w.balls.includes(d.ball) || d.ball.grabbed)) {
      if (d.ball) d.ball.claimed = false;
      d.ball = null;
      d.state = 'idle';
      d.timer = 0.6;
    }
    d.timer -= dt;
    d.joy = Math.max(0, d.joy - dt);
    d.gt += dt;
    d.sniff = clamp(
      d.sniff +
        (d.state === 'idle' && d.timer < 0 && d.timer > -1.6 ? dt : -dt) * 4,
      0,
      1,
    );
    const sc = scaleOf(d);
    let speed = 0;
    let dipTo = 0;
    if (d.state === 'idle') {
      if (d.timer < -1.6) {
        d.timer = 2 + Math.random() * 3;
        if (Math.random() < 0.5) {
          d.state = 'wander';
          d.tx = 40 + Math.random() * (w.W - 80);
          d.ty = w.g0 + 20 + Math.random() * (w.g1 - w.g0 - 20);
        }
      }
    } else if (d.state === 'wander') {
      speed = 85;
    } else if (d.state === 'go' && d.ball) {
      const b = d.ball;
      // Face the ball from the side the dog is on, and stop where the mouth, not the body, meets it.
      if (Math.abs(b.x - d.x) > 12) d.f = b.x > d.x ? 1 : -1;
      d.tx = clamp(b.x - d.f * reach(d) * sc, 20, w.W - 20);
      d.ty = clamp(b.y, w.g0, w.g1 + 6);
      const l = Math.hypot(d.tx - d.x, (d.ty - d.y) * 1.6);
      speed = 300;
      dipTo = l < 110 ? 1 : 0;
      if (d.gt > 12) {
        // Cannot get there: give up.
        b.claimed = false;
        b.fetch = false;
        d.ball = null;
        d.state = 'idle';
        d.timer = 0.6;
      } else if (l < 5 && d.dip > 0.85 && b.z < 22) {
        b.held = true;
        b.vx = b.vy = b.vz = 0;
        d.rx = b.x;
        d.ry = b.y - b.z - 8;
        d.state = 'grab';
        d.gt = 0;
      }
    } else if (d.state === 'grab') {
      dipTo = 1;
      if (d.gt > 0.34) {
        d.state = 'back';
        d.gt = 0;
      }
    } else if (d.state === 'back') {
      speed = 230;
      dipTo = d.gt < 0.25 ? 1 - d.gt * 4 : 0;
      // Bring it to the pointer, stopping a little short on the dog's own side.
      const side = (d.x < w.px ? -1 : 1) * 60 * d.size;
      d.tx = clamp(w.px + side, 30, w.W - 30);
      d.ty = clamp(w.py, w.g0 + 14, w.g1);
      if (dist(d.x, d.y, d.tx, d.ty) < 26) {
        d.state = 'set';
        d.gt = 0;
        speed = 0;
      }
    } else if (d.state === 'set' && d.ball) {
      // Head down, then the ball is let go where the mouth is and rests on the grass.
      dipTo = 1;
      if (d.gt > 0.3 && d.dip > 0.9) {
        const b = d.ball;
        const m = mouth(d, w.t);
        b.held = false;
        b.claimed = false;
        b.fetch = false;
        b.x = clamp(m[0], 8, w.W - 8);
        b.y = d.y;
        b.z = Math.max(0, d.y - 8 - m[1]);
        b.vx = b.vy = b.vz = 0;
        d.ball = null;
        d.state = 'idle';
        d.timer = 1.4;
        d.joy = 2.2;
      }
    }
    d.dip += (dipTo - d.dip) * (1 - Math.exp(-dt * 9));
    const carry = d.ball?.held && d.state === 'back' && d.gt > 0.15;
    d.up += ((carry ? 1 : 0) - d.up) * (1 - Math.exp(-dt * 7));
    // Turns on the spot: a carried ball swings round with the head instead of jumping.
    d.fv += clamp(d.f - d.fv, -dt * 9, dt * 9);
    if (speed) {
      const dx = d.tx - d.x;
      const dy = (d.ty - d.y) * 1.6;
      const l = Math.hypot(dx, dy) || 1;
      if (d.state === 'wander' && l < 12) {
        d.state = 'idle';
        d.timer = 0.5 + Math.random() * 2;
      } else {
        const s = Math.min(speed, l * 6 + 40);
        d.x += (dx / l) * s * dt;
        d.y += (dy / l) * s * dt * 0.62;
        if (Math.abs(dx) > 6 && d.state !== 'go') d.f = dx > 0 ? 1 : -1;
        speed = s;
      }
    }
    d.x = clamp(d.x, 20, w.W - 20);
    d.y = clamp(d.y, w.g0, w.g1 + 6);
    d.speed += (speed - d.speed) * Math.min(1, dt * 10);
    // Feet cover the ground at the body's pace: no skating.
    const stride = 8 + clamp((d.speed - 100) / 150, 0, 1) * 8;
    d.phase += (dt * (d.speed / scaleOf(d)) * 1.885) / stride;
  }
}

export const scaleOf = (d: Dog) => d.size * (0.85 + (d.y / 400) * 0.25);

/** Two breeds: a sturdy retriever with a deep chest and a leaner terrier with longer legs. */
interface Build {
  legs: number;
  chest: number;
  tuck: number;
  sk: number;
  mz: number;
  tail: number;
}
const RETRIEVER: Build = {
  legs: 32,
  chest: 0.95,
  tuck: 5,
  sk: 1.05,
  mz: 13.5,
  tail: 0,
};
const TERRIER: Build = {
  legs: 36,
  chest: 0.8,
  tuck: 8,
  sk: 0.9,
  mz: 15,
  tail: 1,
};
const buildOf = (d: Dog): Build => (d.type ? TERRIER : RETRIEVER);

type P = [number, number];

/** How low the head is: sniffing the ground or reaching down for the ball. */
const lowOf = (d: Dog) => Math.max(d.sniff, d.dip);

/** Head frame (origin: middle of the skull, +x toward the nose) to dog space. Lowered for a sniff or a ball, raised to carry. */
function headPose(
  d: Dog,
  b: Build,
  bob: number,
  t: number,
  low = lowOf(d),
  up = d.up,
) {
  const top = -(b.legs + 14);
  const run = clamp((d.speed - 100) / 150, 0, 1);
  const hb =
    d.speed > 20 ? Math.sin(d.phase * (run ? 1 : 2)) * (1 + run * 1.6) : 0;
  const x = 36 + low * 7 - up * 1;
  // The extra reach on the ball (d.dip) puts the mouth on the ground, not a hand above it.
  const y = top - 10 + bob * 0.6 + hb + low * 30 + d.dip * 4 - up * 6;
  const r =
    low * 0.95 +
    (run ? 0.05 : 0) -
    up * 0.2 +
    (1 - low) * Math.sin(t * 0.9 + d.seed) * 0.03;
  return { x, y, r, top };
}

const bobOf = (d: Dog) => {
  const run = clamp((d.speed - 100) / 150, 0, 1);
  return d.speed > 20
    ? run
      ? Math.sin(d.phase) * 2.6
      : Math.abs(Math.sin(d.phase)) * 1.2
    : 0;
};

/** Between the jaws, in the dog's own space (not flipped, not scaled). */
function jaws(
  d: Dog,
  t: number,
  bob: number,
  low?: number,
  up?: number,
): [number, number] {
  const b = buildOf(d);
  const h = headPose(d, b, bob, t, low, up);
  const u = 8.3 * b.sk + b.mz - 3;
  const v = 4.6 * b.sk;
  return [
    h.x + u * Math.cos(h.r) - v * Math.sin(h.r),
    h.y + u * Math.sin(h.r) + v * Math.cos(h.r),
  ];
}

/** Where the mouth is on screen right now, from the head pose the dog is drawn in. */
export function mouth(d: Dog, t: number): [number, number] {
  const [lx, ly] = jaws(d, t, bobOf(d));
  const sc = scaleOf(d);
  return [d.x + d.fv * lx * sc, d.y + ly * sc];
}

/** How far ahead of its feet the mouth reaches with the head down and the dog standing still, in dog units. */
const reach = (d: Dog) => jaws(d, 0, 0, 1, 0)[0];

/** Where a ball in a dog's mouth is drawn: on the ground at first, rising into the jaws as they close. */
export function ballAt(d: Dog, t: number): [number, number] {
  const m = mouth(d, t);
  if (d.state !== 'grab') return m;
  const k = clamp(d.gt / 0.2, 0, 1);
  const e = k * k * (3 - 2 * k);
  return [d.rx + (m[0] - d.rx) * e, d.ry + (m[1] - d.ry) * e];
}

/** Two-bone solve: the middle joint for a limb from a to b, bending toward +x or -x. */
function ik(a: P, b: P, l1: number, l2: number, bend: number): P {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const ux = dx / (Math.hypot(dx, dy) || 1);
  const uy = dy / (Math.hypot(dx, dy) || 1);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const mx = a[0] + ux * along;
  const my = a[1] + uy * along;
  const k1: P = [mx - uy * off, my + ux * off];
  const k2: P = [mx + uy * off, my - ux * off];
  return (k1[0] - k2[0]) * bend > 0 ? k1 : k2;
}

/** A jointed limb drawn as thick segments with an outline: outline pass, then fill pass. */
function limb(
  c: CanvasRenderingContext2D,
  col: Colors,
  pts: P[],
  ws: number[],
  o: number,
  outline = 1,
) {
  c.lineCap = 'round';
  const seg = (i: number, w: number) => {
    const p = pts[i];
    const q = pts[i + 1];
    if (!p || !q) return;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(p[0], p[1]);
    c.lineTo(q[0], q[1]);
    c.stroke();
  };
  c.globalAlpha = outline;
  c.strokeStyle = col.stroke;
  for (let i = 0; i < pts.length - 1; i++) seg(i, (ws[i] ?? 4) + o * 2);
  c.globalAlpha = 1;
  c.strokeStyle = col.page;
  for (let i = 0; i < pts.length - 1; i++) seg(i, ws[i] ?? 4);
  c.strokeStyle = col.stroke;
  c.lineWidth = o;
}

/** The head, in its own frame: skull, stop, tapering muzzle, nose, jaw, drop ear. */
function drawHead(
  c: CanvasRenderingContext2D,
  col: Colors,
  b: Build,
  open: number,
  tongue: number,
  earA: number,
  type: number,
  lw: number,
) {
  const S = b.sk;
  const M = b.mz;
  const x0 = 8.3 * S;
  const x1 = x0 + M;
  c.lineWidth = lw;
  c.fillStyle = col.page;
  c.strokeStyle = col.stroke;
  // Lower jaw, hinged under the cheek.
  const px = x0 - 1;
  const py = 4.4 * S;
  const len = x1 - px;
  c.save();
  c.translate(px, py);
  c.rotate(open);
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(len - 2, -1.3);
  c.bezierCurveTo(len + 0.4, -1.1, len + 0.4, 2.2, len - 2.4, 2.6);
  c.bezierCurveTo(len - 8, 3.0, 5, 3.2 * S, -2, 1.6 * S);
  c.closePath();
  c.fill();
  c.stroke();
  if (tongue > 0) {
    // Tongue lolls over the lower jaw.
    c.beginPath();
    c.moveTo(len - 12, -0.2);
    c.bezierCurveTo(
      len - 12,
      3.5 + tongue * 5,
      len - 5.5,
      4 + tongue * 5,
      len - 6,
      -0.2,
    );
    c.fill();
    c.stroke();
  }
  c.restore();
  // Skull, stop, bridge, nose, lip, cheek.
  c.beginPath();
  c.moveTo(-8.6 * S, 1.5 * S);
  c.bezierCurveTo(-9.4 * S, -6 * S, -4 * S, -10.4 * S, 2 * S, -9.8 * S);
  c.bezierCurveTo(5 * S, -9.5 * S, 7.8 * S, -8.8 * S, 8.4 * S, -5.4 * S);
  c.bezierCurveTo(x0 + M * 0.25, -6 * S, x1 - M * 0.35, -5.2, x1 - 1.2, -4.6);
  c.bezierCurveTo(x1 + 1.6, -4.8, x1 + 2.6, -2.2, x1 + 1.9, 0.6);
  c.bezierCurveTo(x1 + 1.6, 2, x1 - 0.6, 2.9, x1 - 2.6, 2.8);
  c.lineTo(x0 + 3, 3.7);
  c.lineTo(px, py);
  c.bezierCurveTo(x0 - 5, 6.4 * S, 0, 9.6 * S, -5 * S, 8 * S);
  c.bezierCurveTo(-8 * S, 6 * S, -8.6 * S, 3.6 * S, -8.6 * S, 1.5 * S);
  c.closePath();
  c.fill();
  c.stroke();
  // Nose, black, at the very tip.
  c.beginPath();
  c.moveTo(x1 - 2.4, -4.9);
  c.bezierCurveTo(x1 + 1.4, -5.6, x1 + 3.3, -3, x1 + 2.6, -0.2);
  c.bezierCurveTo(x1 + 2.2, 1.2, x1 - 0.2, 0.6, x1 - 2, -1.2);
  c.closePath();
  c.fillStyle = col.stroke;
  c.fill();
  c.fillStyle = col.page;
  // Mouth corner, and the eye behind the stop.
  c.beginPath();
  c.moveTo(px, py);
  c.quadraticCurveTo(px - 1.2, py - 2.4, px - 3, py - 2.6);
  c.stroke();
  c.beginPath();
  c.arc(4.4 * S, -3.4 * S, 1.45 * Math.max(0.9, S), 0, TAU);
  c.fillStyle = col.stroke;
  c.fill();
  c.fillStyle = col.page;
  // Brow, a small line above the eye.
  c.beginPath();
  c.moveTo(2.6 * S, -6 * S);
  c.quadraticCurveTo(4.8 * S, -7 * S, 6.6 * S, -6 * S);
  c.stroke();
  // Ear, hanging from the back of the skull.
  c.save();
  c.translate(-0.8 * S, -5.6 * S);
  c.rotate(earA);
  c.beginPath();
  if (type === 0) {
    c.moveTo(-3.4 * S, 0);
    c.bezierCurveTo(-11 * S, 1 * S, -11.5 * S, 10 * S, -6.5 * S, 14.5 * S);
    c.bezierCurveTo(-2 * S, 16.5 * S, 3.2 * S, 11 * S, 3.6 * S, 0.4 * S);
    c.bezierCurveTo(2 * S, -1.5 * S, -1 * S, -1.8 * S, -3.4 * S, 0);
  } else {
    // Folded-over terrier ear: a short triangle with a soft tip.
    c.moveTo(-3.2 * S, -0.5 * S);
    c.bezierCurveTo(-8 * S, 3 * S, -8.4 * S, 9 * S, -6 * S, 12 * S);
    c.bezierCurveTo(-2 * S, 11 * S, 2 * S, 7 * S, 3.6 * S, 0);
    c.bezierCurveTo(1.6 * S, -2 * S, -1 * S, -2 * S, -3.2 * S, -0.5 * S);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
}

export function drawDog(
  c: CanvasRenderingContext2D,
  w: World,
  d: Dog,
  col: Colors,
) {
  const sc = scaleOf(d);
  const b = buildOf(d);
  const run = clamp((d.speed - 100) / 150, 0, 1);
  const moving = clamp(d.speed / 60, 0, 1);
  const carrying = d.ball?.held === true;
  const wag = d.state === 'idle' || d.joy > 0 || d.state === 'back';
  const t = w.t;
  c.save();
  c.translate(d.x, d.y);
  // Soft shadow on the grass.
  c.globalAlpha = 0.12;
  c.fillStyle = col.stroke;
  c.beginPath();
  c.ellipse(2, 1, 40 * sc, 4.5 * sc, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 0.35;
  c.lineWidth = 1;
  c.strokeStyle = col.stroke;
  c.stroke();
  c.globalAlpha = 1;
  // A little hop of joy after setting the ball down.
  if (d.joy > 0 && !d.ball)
    c.translate(
      0,
      -Math.abs(Math.sin(d.joy * 8)) * 5 * sc * clamp(d.joy, 0, 1),
    );
  c.scale(sc * d.fv, sc);
  const lw = 1.5 / sc;
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const bob = moving
    ? run
      ? Math.sin(d.phase) * 2.6
      : Math.abs(Math.sin(d.phase)) * 1.2
    : 0;
  const L = b.legs;
  const T = -(L + 14);
  const B = T + 23 * b.chest;
  const Bt = B - b.tuck;
  const a = d.phase;
  const stride = 8 + run * 8;
  const lift = 3.5 + run * 8;
  // [far front, far back, near front, near back]: trot in diagonal pairs, gallop in bunched pairs.
  const ph: [number, number, number, number] =
    run > 0.5
      ? [a + 0.5, a + 2.1, a, a + 1.55]
      : [a + Math.PI, a, a, a + Math.PI];
  const foot = (p: number, front: boolean, off: number): P => {
    const u = (((p / TAU) % 1) + 1) % 1;
    const stance = run > 0.5 ? 0.45 : 0.62;
    let fx: number;
    let fy = 0;
    if (u < stance) fx = stride * (1 - (2 * u) / stance);
    else {
      const k = (u - stance) / (1 - stance);
      fx = -stride + 2 * stride * k;
      fy = -Math.sin(Math.PI * k) * lift;
    }
    return [(front ? 18 : -15) + fx * moving + off * (1 - moving), fy * moving];
  };
  const leg = (front: boolean, p: number, far: boolean) => {
    const f = foot(p, front, front ? (far ? 5 : -2) : far ? -5 : 3);
    const o = lw;
    const wf = front ? 6.2 + b.chest : 7.2;
    let pts: P[];
    let ws: number[];
    if (front) {
      const hip: P = [18, B - 8 + bob * 0.4];
      const wrist: P = [f[0] + 1, f[1] - 9];
      const elbow = ik(hip, wrist, 13, 14, -1);
      pts = [hip, elbow, wrist, [f[0] + 0.5, f[1] - 2.5]];
      ws = [wf, wf * 0.7, wf * 0.58];
    } else {
      const hip: P = [-15, B - 8 + bob * 0.4];
      const hock: P = [f[0] - 4, f[1] - 12];
      const stifle = ik(hip, hock, 12, 15, 1);
      pts = [hip, stifle, hock, [f[0] - 1, f[1] - 2.5]];
      ws = [wf * 1.1, wf * 0.66, wf * 0.56];
    }
    limb(c, col, pts, ws, o, far ? 0.5 : 1);
    c.globalAlpha = far ? 0.5 : 1;
    c.lineWidth = lw;
    // Paw.
    c.beginPath();
    c.ellipse(f[0] + 2, f[1] - 1.8, 4.4, 2.4, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.globalAlpha = 1;
  };
  leg(true, ph[0], true);
  leg(false, ph[1], true);
  leg(true, ph[2], false);
  leg(false, ph[3], false);

  // Tail: a tapering curve, otter-thick on the retriever, a curl on the terrier.
  const ang =
    (d.type ? 1.15 : 0.6) +
    (wag
      ? Math.sin(t * (d.joy > 0 ? 24 : 12) + d.seed) * (d.joy > 0 ? 0.5 : 0.25)
      : 0) -
    run * 0.35;
  const tl = d.type ? 24 : 30;
  const tx = -23;
  const ty = T + 6 + bob;
  const tip: P = [tx - Math.cos(ang) * tl, ty - Math.sin(ang) * tl];
  const mid: P = [
    tx - Math.cos(ang - (d.type ? -0.5 : 0.35)) * tl * 0.55,
    ty - Math.sin(ang - (d.type ? -0.5 : 0.35)) * tl * 0.55 + (d.type ? 0 : 5),
  ];
  const tpts: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const u = i / 6;
    tpts.push([
      (1 - u) * (1 - u) * tx + 2 * (1 - u) * u * mid[0] + u * u * tip[0],
      (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * mid[1] + u * u * tip[1],
    ]);
  }
  limb(
    c,
    col,
    tpts,
    [6, 5.6, 5, 4.4, 3.6, 2.6].map((v) => v * (d.type ? 0.7 : 1)),
    lw,
  );

  // Head pose first: the neck is drawn to meet it.
  const hp = headPose(d, b, bob, t);
  const cr = Math.cos(hp.r);
  const sr = Math.sin(hp.r);
  const H = (u: number, v: number): P => [
    hp.x + (u * cr - v * sr) * 1,
    hp.y + (u * sr + v * cr) * 1,
  ];
  const nape = H(-6.5 * b.sk, -6 * b.sk);
  const throat = H(-3 * b.sk, 8.4 * b.sk);
  // Body: back line, arched neck, deep chest, tucked belly, rump with a thigh lobe.
  const cx = 28;
  c.beginPath();
  c.moveTo(-25, T + 11 + bob);
  c.bezierCurveTo(-24, T + 2 + bob, -12, T - 1 + bob, 0, T + bob);
  c.bezierCurveTo(8, T + 0.5 + bob, 14, T - 0.5 + bob, 19, T - 1.5 + bob);
  c.bezierCurveTo(
    24,
    T - 2.5 + bob,
    nape[0] - 8,
    nape[1] + 5,
    nape[0],
    nape[1],
  );
  c.lineTo(throat[0] + 2, throat[1] - 2);
  c.bezierCurveTo(
    throat[0] + 1,
    throat[1] + 8,
    cx + 5,
    B - 14 * b.chest,
    cx + 1,
    B - 6,
  );
  c.bezierCurveTo(cx - 1, B - 1, 22, B + 1, 16, B + 1);
  c.bezierCurveTo(8, B + 1, 2, Bt, -7, Bt + bob);
  c.bezierCurveTo(-11, Bt + 1 + bob, -11, B + 3 + bob, -15, B + 3 + bob);
  c.bezierCurveTo(-24, B + 2 + bob, -27, T + 22 + bob, -25, T + 11 + bob);
  c.closePath();
  c.fill();
  c.stroke();
  // Shoulder and thigh, two soft lines inside the body.
  c.globalAlpha = 0.6;
  c.beginPath();
  c.moveTo(14, T + 3 + bob);
  c.quadraticCurveTo(22, T + 11 + bob, 18, B - 5 + bob);
  c.moveTo(-5, T + 5 + bob);
  c.quadraticCurveTo(-17, T + 11 + bob, -13, Bt + bob);
  c.stroke();
  c.globalAlpha = 1;
  // Head.
  const open = carrying ? 0.2 : run > 0.3 || d.joy > 0 ? 0.42 : 0;
  const tongue =
    !carrying && (run > 0.3 || d.joy > 0) ? 0.6 + Math.sin(t * 20) * 0.25 : 0;
  const earA = Math.min(
    0.5,
    0.12 +
      run * 0.45 +
      Math.sin(d.phase * (run ? 1 : 2) + 1) * 0.22 * moving +
      Math.sin(t * 1.8 + d.seed) * 0.035 +
      lowOf(d) * 0.25,
  );
  c.save();
  c.translate(hp.x, hp.y);
  c.rotate(hp.r);
  drawHead(c, col, b, open, tongue, earA - hp.r * 0.85, d.type, lw);
  c.restore();
  // Collar: a band across the neck, a third of the way down.
  if (!d.type && lowOf(d) < 0.25) {
    const lp = (p: P, q: P, k: number): P => [
      p[0] + (q[0] - p[0]) * k,
      p[1] + (q[1] - p[1]) * k,
    ];
    const p1 = lp(nape, [19, T - 1.5], 0.45);
    const p2 = lp(throat, [cx + 1, B - 8], 0.4);
    c.beginPath();
    c.moveTo(p1[0], p1[1]);
    c.quadraticCurveTo(
      (p1[0] + p2[0]) / 2 + 3,
      (p1[1] + p2[1]) / 2 + 1,
      p2[0],
      p2[1],
    );
    c.lineWidth = lw * 1.8;
    c.stroke();
    c.lineWidth = lw;
  }
  c.restore();
}

export function drawBall(
  c: CanvasRenderingContext2D,
  b: Ball,
  col: Colors,
  held = false,
  at?: [number, number],
) {
  const r = 8;
  const sq = held ? 0 : Math.max(0, b.sq);
  const rx = r * (1 + 0.32 * sq);
  const ry = r * (1 - 0.32 * sq);
  const sx = at ? at[0] : b.x;
  const sy = at ? at[1] : b.y - b.z - ry;
  if (!held) {
    // Shadow follows height: smaller and fainter when the ball is up.
    const k = clamp(1 - b.z / 260, 0.25, 1);
    const w = r * (1.25 - Math.min(0.5, b.z / 220));
    c.globalAlpha = 0.16 * k;
    c.fillStyle = col.stroke;
    c.beginPath();
    c.ellipse(b.x, b.y, w, w * 0.34, 0, 0, TAU);
    c.fill();
    c.globalAlpha = 0.35 * k;
    c.strokeStyle = col.stroke;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 1;
  }
  c.save();
  c.translate(sx, sy);
  c.lineWidth = 1.5;
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  c.fill();
  c.stroke();
  // Seams: two arcs that turn with the roll. Clipped to the ball.
  c.save();
  c.beginPath();
  c.ellipse(0, 0, rx, ry, 0, 0, TAU);
  c.clip();
  c.scale(rx / r, ry / r);
  c.rotate(b.spin);
  c.lineWidth = 1.1;
  c.beginPath();
  c.arc(-r * 1.5, 0, r * 1.05, -0.9, 0.9);
  c.moveTo(
    r * 1.5 + r * 1.05 * Math.cos(Math.PI - 0.9),
    r * 1.05 * Math.sin(Math.PI - 0.9),
  );
  c.arc(r * 1.5, 0, r * 1.05, Math.PI - 0.9, Math.PI + 0.9);
  c.stroke();
  c.restore();
  c.restore();
}
