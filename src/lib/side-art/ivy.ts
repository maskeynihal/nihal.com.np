/**
 * Ivy (section art for the contact section): a climbing vine that sprouts from a seed level with the
 * section heading (c.hb, measured from the heading's DOM rect) and grows DOWN the column as you scroll,
 * so growth runs the same way you read. It winds along a faint trellis stake, tendrils reaching out to
 * grab it, leaves and flowers opening up and outward behind a tip that leads with a small curled shoot.
 * It ends in the real garden: the column runs on below the section (c.ext), and the tip reaches the
 * grass when you reach the end.
 *
 * The stem is a seeded random walk on the heading (downward bias, smooth curvature), computed once; the
 * frame only reveals it. Everything that opens (leaves, tendrils, side shoots, flowers) is a pure
 * function of how far the tip has travelled past it (`s.g`), never of a timestamp, so scrolling back up
 * rolls the vine up again just as smoothly. Tapered ribbon stem, alternating leaves on short stalks,
 * tendrils, side shoots that carry the flowers, a curled tip that uncurls while it grows. Flowers use the
 * garden's three heads (src/lib/garden/flora.ts). One butterfly perches on the grown part.
 *
 * Birds are the main life of the scene: two pigeons (round body, small head, head-bob when walking, a
 * cooing puff), a sparrow that flits between perches, and now and then a distant flock of tiny Vs. They
 * perch only on grown parts: the trellis cross-ties below the tip and the stem behind it. One pigeon is a
 * carrier with a rolled letter on its leg: it flies off toward the contact text on a click, or once when
 * the end of the column is reached, and comes back with a new letter. A click near any bird startles it
 * (it flaps up and away, fading, and returns later). Under reduced motion the birds are perched and still.
 */
import {
  E,
  g,
  ink,
  fillS,
  fillP,
  circ,
  clamp,
  lerp,
  sm,
  rnd,
  mulberry,
  TAU,
  PI,
} from './core';
import type { Col, State, Scene } from './core';
import { TUNE } from './tuning';
import { easeInOut } from './motion';

/**
 * Largest extents (px), the numbers every confinement below uses. A leaf is at most ~41 long, plus the
 * sway (6) and a margin; a whole flower (tulip petals 1.6 r, r up to 15, tilt) fits in FLOWER_REACH;
 * a butterfly's wings reach BF_REACH from its body (garden butterfly, k up to 1.3).
 */
export const IVY_REACH = 50;
export const FLOWER_REACH = 34;
export const BF_REACH = 26;
/** A pigeon with its wings out: 17 px fore and aft, about 26 above its feet. */
export const BIRD_REACH = 26;
const TIE_HALF = 18;

/** [x, y, tx, ty]: a point on a path and its unit tangent. */
type Pt4 = [number, number, number, number];
interface Path {
  xs: number[];
  ys: number[];
  ls: number[];
  total: number;
}
interface WalkOpts {
  k: number;
  up: number;
  pull: number;
  xc: number;
  x0: number;
  x1: number;
  ymax: number;
}
type BirdMode = 'hidden' | 'perch' | 'walk' | 'fly' | 'away' | 'deliver';
interface Perch {
  key: string;
  k: 'tie' | 'stem';
  y?: number;
  l?: number;
}
interface Bird {
  id: number;
  sp: boolean;
  carrier: boolean;
  note: boolean;
  mode: BirdMode;
  timer: number;
  x: number;
  y: number;
  p: Perch | null;
  off: number;
  tx: number;
  face: number;
  ph: number;
  alpha: number;
  puff: number;
  coo: number;
  cooT: number;
  u: number;
  sx: number;
  sy: number;
  d0: number;
  vx: number;
  vy: number;
  k: number;
}
interface Flock {
  x: number;
  y: number;
  dir: number;
  n: number;
}
interface BirdPose {
  fly: boolean;
  ph: number;
  walk: number;
  puff: number;
  note: boolean;
  sp: boolean;
}

const ease = (x: number): number => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};

/** A seeded walk: heading th (0 = straight down, + = right) with smooth curvature, pulled plumb and toward xc. */
function walk(
  rg: () => number,
  x: number,
  y: number,
  th: number,
  n: number,
  ds: number,
  o: WalkOpts,
): Path {
  const xs = [x],
    ys = [y],
    ls = [0];
  let k = 0,
    acc = 0;
  for (let i = 0; i < n; i++) {
    k = k * 0.93 + (rg() - 0.5) * o.k;
    th += k;
    th -= th * o.up;
    th += clamp((o.xc - x) * o.pull, -0.03, 0.03);
    th = clamp(th, -1.15, 1.15);
    const nx = clamp(x + Math.sin(th) * ds, o.x0, o.x1),
      ny = y + Math.cos(th) * ds;
    acc += Math.hypot(nx - x, ny - y);
    x = nx;
    y = ny;
    xs.push(x);
    ys.push(y);
    ls.push(acc);
    if (y > o.ymax) break;
  }
  return { xs, ys, ls, total: acc };
}
const sw = (l: number, p: Path, t: number, amp: number, ph: number): number =>
  Math.sin(t * 0.5 + l * 0.012 + ph) * amp * Math.pow(l / (p.total || 1), 1.5);
function pt(
  p: Path,
  l: number,
  t: number,
  amp: number,
  ph: number,
  bo = 0,
): Pt4 {
  const L = p.ls;
  let lo = 0,
    hi = L.length - 1;
  l = clamp(l, 0, p.total);
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (L[m]! < l) lo = m;
    else hi = m;
  }
  const f = (l - L[lo]!) / (L[hi]! - L[lo]! || 1);
  const x = lerp(p.xs[lo]!, p.xs[hi]!, f),
    y = lerp(p.ys[lo]!, p.ys[hi]!, f);
  const tx = p.xs[hi]! - p.xs[lo]!,
    ty = p.ys[hi]! - p.ys[lo]!,
    tl = Math.hypot(tx, ty) || 1;
  return [x + bo + sw(l, p, t, amp, ph), y, tx / tl, ty / tl];
}
/** The stem as one tapered ribbon (a filled outline: no segment joints), from the hanger to length l1. Wide at the top, fine at the tip. */
function ribbon(
  p: Path,
  l1: number,
  hw0: number,
  hw1: number,
  t: number,
  amp: number,
  ph: number,
  bo: number,
  y0: number,
  y1: number,
): void {
  const n = p.ls.length;
  const Lx: number[] = [],
    Ly: number[] = [],
    Rx: number[] = [],
    Ry: number[] = [];
  for (let i = 0; i < n && p.ls[i]! <= l1; i++) {
    if (p.ys[i]! > y1 + 60) break;
    if (p.ys[i]! < y0 - 60) continue;
    const l = p.ls[i]!,
      u = l / (p.total || 1);
    const x = p.xs[i]! + bo + sw(l, p, t, amp, ph),
      y = p.ys[i]!;
    const j = Math.min(n - 1, i + 1),
      k = Math.max(0, i - 1);
    const tx = p.xs[j]! - p.xs[k]!,
      ty = p.ys[j]! - p.ys[k]!,
      tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl,
      ny = tx / tl,
      hw = lerp(hw0, hw1, Math.pow(u, 0.75));
    Lx.push(x + nx * hw);
    Ly.push(y + ny * hw);
    Rx.push(x - nx * hw);
    Ry.push(y - ny * hw);
  }
  if (Lx.length < 2) return;
  g.beginPath();
  g.moveTo(Lx[0]!, Ly[0]!);
  for (let i = 1; i < Lx.length; i++) g.lineTo(Lx[i]!, Ly[i]!);
  for (let i = Rx.length - 1; i >= 0; i--) g.lineTo(Rx[i]!, Ry[i]!);
  g.closePath();
  fillS(0.95);
}
function leaf(len: number, open: number): void {
  if (open <= 0.01) return;
  const L = len * open,
    W = L * 0.34;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(L * 0.25, -W * 1.15, L * 0.7, -W * 0.9, L, 0);
  g.bezierCurveTo(L * 0.7, W * 0.75, L * 0.25, W * 0.95, 0, 0);
  fillP();
  ink(0.9, 1.4);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(L * 0.5, -L * 0.03, L * 0.96, 0);
  ink(0.5, 1);
}
function petal(x: number, y: number, a: number, len: number, wd: number): void {
  const ux = Math.cos(a),
    uy = Math.sin(a);
  const p = (u: number, v: number): [number, number] => [
    x + ux * u - uy * v,
    y + uy * u + ux * v,
  ];
  g.moveTo(x, y);
  g.bezierCurveTo(
    ...p(len * 0.3, -wd),
    ...p(len * 0.9, -wd * 0.8),
    ...p(len, 0),
  );
  g.bezierCurveTo(...p(len * 0.9, wd * 0.8), ...p(len * 0.3, wd), x, y);
}
/** The garden's three flower heads, drawn at the origin: bud, then petals easing open. */
function flower(kind: number, r: number, open: number, tilt: number): void {
  if (open <= 0.01) return;
  if (open < 0.12) {
    g.beginPath();
    g.ellipse(0, -r * 0.25, r * 0.3, r * 0.5, tilt, 0, TAU);
    fillP();
    ink(0.9, 1.3);
    return;
  }
  const k = 0.3 + 0.7 * ease(open);
  g.beginPath();
  if (kind === 0)
    for (let i = 0; i < 12; i++)
      petal(0, 0, tilt + (i / 12) * TAU, r * 1.15 * k, r * 0.2 * k);
  else if (kind === 1)
    for (const d of [-0.5, 0.5, 0])
      petal(0, r * 0.5, tilt - PI / 2 + d * k, r * 1.6 * k, r * 0.55 * k);
  else
    for (let i = 0; i < 5; i++)
      petal(0, 0, tilt + (i / 5) * TAU, r * 1.05 * k, r * 0.62 * k);
  fillP();
  ink(0.95, 1.4);
  if (kind !== 1) {
    circ(0, 0, (kind === 0 ? r * 0.3 : r * 0.22) * k);
    fillS(0.9);
  }
}
function spiral(
  cx: number,
  cy: number,
  r: number,
  turns: number,
  rot: number,
  p: number,
): void {
  g.beginPath();
  const n = Math.max(2, Math.round(14 * turns * p));
  for (let i = 0; i <= n; i++) {
    const q = i / (14 * turns),
      a = rot + q * turns * TAU,
      rr = r * (1 - q * 0.92);
    const px = cx + Math.cos(a) * rr,
      py = cy + Math.sin(a) * rr;
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  }
}
/** The garden's butterfly (src/lib/garden/butterflies.ts): two wings a side, a body, two feelers. flap 0.12..1, k size. */
function gbutterfly(
  x: number,
  y: number,
  rot: number,
  flap: number,
  k: number,
  idx: number,
): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  for (const sd of [-1, 1]) {
    const sx = sd * flap * k;
    g.beginPath();
    g.moveTo(0, -2 * k);
    g.bezierCurveTo(sx * 4, -15 * k, sx * 17, -15 * k, sx * 13, -3 * k);
    g.bezierCurveTo(sx * 9, 0, sx * 3, 0, 0, -1);
    g.moveTo(0, 0);
    g.bezierCurveTo(sx * 11, 0, sx * 11, 11 * k, sx * 5, 9 * k);
    g.bezierCurveTo(sx * 2, 7 * k, 0, 3, 0, 0);
    fillP();
    ink(0.95, 1.25);
    if (idx % 2 === 0 && flap > 0.3) {
      g.beginPath();
      g.arc(sx * 9, -8 * k, 1.6 * k, 0, TAU);
      ink(0.9, 1);
    }
  }
  g.beginPath();
  g.moveTo(0, -6 * k);
  g.lineTo(0, 8 * k);
  ink(1, 1.5);
  g.beginPath();
  g.moveTo(0, -6 * k);
  g.lineTo(-3, -11 * k);
  g.moveTo(0, -6 * k);
  g.lineTo(3, -11 * k);
  ink(0.9, 1);
  g.restore();
}

/** How far a side shoot has grown (0..1): it starts when the tip passes its base and takes 1.5 of its own lengths of tip travel. */
const shootP = (b: State, gl: number): number =>
  ease((gl - b.l) / (b.path.total * 1.5));

/** Perches on the grown part of the vine, as functions of the sway so a butterfly rides its leaf. */
function ivyAnchors(s: State): State[] {
  const gl: number = s.g,
    out: State[] = [];
  for (const n of s.nodes) if (gl - n.l > 70) out.push({ k: 'leaf', n });
  for (const b of s.branches)
    if (shootP(b, gl) > 0.99) out.push({ k: 'bend', b });
  for (const n of s.nodes)
    if (n.fl && gl - n.l > 110) out.push({ k: 'mfl', n });
  if (out.length < 2)
    for (let i = 0; i < 3; i++) out.push({ k: 'stem', f: 0.25 + i * 0.25 });
  return out;
}
function anchorOk(s: State, a: State): boolean {
  const gl = s.g;
  if (a.k === 'leaf') return gl - a.n.l > 50;
  if (a.k === 'bend') return shootP(a.b, gl) > 0.95;
  if (a.k === 'mfl') return gl - a.n.l > 90;
  return true;
}
function anchorXY(c: Col, s: State, a: State): [number, number] {
  const t = s.clk,
    main = s.main;
  if (a.k === 'leaf') {
    const n = a.n,
      p = pt(main, n.l, t, s.amp, s.ph),
      ta = Math.atan2(p[3], p[2]) + n.side * n.ang,
      r = n.stalk + n.len * 0.72;
    return [p[0] + Math.cos(ta) * r, p[1] + Math.sin(ta) * r - 3];
  }
  if (a.k === 'bend') {
    const b = a.b,
      bo = sw(b.l, main, t, s.amp, s.ph),
      p = pt(b.path, b.path.total, t, s.amp * 0.8, b.ph, bo);
    return [p[0], p[1] - 3];
  }
  if (a.k === 'mfl') {
    const n = a.n,
      p = pt(main, n.l, t, s.amp, s.ph),
      L = n.fl.stalk,
      ang = -PI / 2 + n.side * 0.8;
    return [
      clamp(p[0] + Math.cos(ang) * L * 0.9, FLOWER_REACH, c.w - FLOWER_REACH),
      p[1] + Math.sin(ang) * L * 0.9 - 3,
    ];
  }
  const p = pt(main, Math.max(10, s.g) * a.f, t, s.amp, s.ph);
  return [p[0] + 3, p[1]];
}
function pickAnchor(
  c: Col,
  s: State,
  list: State[],
  from: State | null,
  seed: number,
): State | null {
  const ok: State[] = [];
  for (const a of list) {
    if (from && from.a === a) continue;
    const p = anchorXY(c, s, a);
    if (
      p[0] < BF_REACH ||
      p[0] > c.w - BF_REACH ||
      p[1] < BF_REACH ||
      p[1] > c.h - BF_REACH
    )
      continue;
    const inView = p[1] > c.v0 + 30 && p[1] < c.v1 - 30;
    const d = from ? Math.hypot(p[0] - from.x, p[1] - from.y) : 0;
    ok.push({ a, inView, d });
  }
  if (!ok.length) return null;
  const near = ok.filter(
    (o: State) => o.inView && (!from || (o.d > 50 && o.d < 280)),
  );
  const pool = near.length
    ? near
    : ok.filter((o: State) => o.inView).length
      ? ok.filter((o: State) => o.inView)
      : ok;
  return pool[
    Math.floor(rnd(s.clk, seed + pool.length) * pool.length) % pool.length
  ]!.a;
}

/* ---- birds ---- */
/** A bird in side view, feet at (x, y), facing `face` (+1 right). pose: fly, ph, walk 0..1, puff 0..1, note, sp (sparrow). */
function bird(
  x: number,
  y: number,
  face: number,
  k: number,
  pose: BirdPose,
): void {
  const fly = pose.fly,
    sp = pose.sp,
    by = fly ? -7 : -9,
    bob = pose.walk > 0.05 && !sp ? Math.sin(pose.ph * 2) * 1.5 * pose.walk : 0;
  g.save();
  g.translate(x, y);
  g.scale(face * k, k);
  if (!fly) {
    const a = Math.sin(pose.ph) * pose.walk * 3;
    g.beginPath();
    g.moveTo(-1, by + 5);
    g.lineTo(-1 + a, 0);
    g.moveTo(2, by + 5);
    g.lineTo(2 - a, 0);
    g.moveTo(-1 + a, 0);
    g.lineTo(2 + a, 0);
    g.moveTo(2 - a, 0);
    g.lineTo(5 - a, 0);
    ink(0.9, 1.1);
  }
  if (pose.note) {
    const ny = fly ? by + 5 : -5;
    g.beginPath();
    g.rect(-4.5, ny, 7, 3.2);
    fillP();
    ink(0.9, 1.1);
    g.beginPath();
    g.moveTo(-1, ny);
    g.lineTo(-1, ny + 3.2);
    ink(0.6, 1);
  }
  // tail
  g.beginPath();
  if (sp) {
    g.moveTo(-6, by - 1);
    g.lineTo(-14, by - 3);
    g.lineTo(-6.5, by + 2.5);
  } else {
    g.moveTo(-8, by - 1);
    g.lineTo(-17, by + 1.5);
    g.lineTo(-8, by + 4);
  }
  g.closePath();
  fillP();
  ink(0.9, 1.2);
  // wing, flapping, in flight
  if (fly) {
    const th = -PI / 2 + 1.25 * Math.sin(pose.ph) - 0.2,
      L = sp ? 11 : 16;
    g.save();
    g.translate(-1, by - 3);
    g.rotate(th);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(L * 0.3, -4.5, L * 0.75, -4, L, 0);
    g.bezierCurveTo(L * 0.7, 3.5, L * 0.3, 3, 0, 0);
    fillP();
    ink(0.9, 1.2);
    g.restore();
  }
  // body, chest swelling when it coos
  const rx = sp ? 7 : 9,
    ry = (sp ? 5.2 : 6.2) * (1 + 0.14 * (pose.puff || 0));
  g.beginPath();
  g.ellipse(0, by, rx, ry, fly ? -0.05 : -0.22, 0, TAU);
  fillP();
  ink(0.95, 1.4);
  if (!fly) {
    g.beginPath();
    g.moveTo(-6, by - 1);
    g.quadraticCurveTo(-1, by - 4.5, 4, by + 0.5);
    ink(0.6, 1);
  }
  // head, beak, eye
  const hx = (sp ? 7 : 8.5) + bob,
    hy = by - (fly ? 3 : sp ? 5 : 6),
    hr = sp ? 2.7 : 3.1;
  g.beginPath();
  g.arc(hx, hy, hr, 0, TAU);
  fillP();
  ink(0.95, 1.4);
  g.beginPath();
  g.moveTo(hx + hr, hy - 0.4);
  g.lineTo(hx + hr + (sp ? 2.6 : 3.4), hy + 0.5);
  g.lineTo(hx + hr, hy + 1.3);
  ink(0.95, 1.2);
  g.beginPath();
  g.arc(hx + 0.8, hy - 0.7, 0.7, 0, TAU);
  fillS(0.95);
  // coo: two small arcs by the beak
  if ((pose.puff || 0) > 0.3 && !fly) {
    g.beginPath();
    g.arc(hx + 6, hy - 1, 3, -0.9, 0.9);
    ink(0.5 * pose.puff, 1);
    g.beginPath();
    g.arc(hx + 6, hy - 1, 5.6, -0.8, 0.8);
    ink(0.5 * pose.puff, 1);
  }
  g.restore();
}
function perchList(c: Col, s: State): Perch[] {
  const tip = pt(s.main, s.g, s.clk, s.amp, s.ph)[1],
    out: Perch[] = [];
  for (let i = 0, y = s.oy + 46; y < c.h - 6; i++, y += 46)
    if (y < tip - 26) out.push({ key: 't' + i, k: 'tie', y });
  for (let i = 0, l = 40; l < s.g - 40; i++, l += 80)
    out.push({ key: 's' + i, k: 'stem', l });
  return out;
}
function perchXY(c: Col, s: State, p: Perch, off: number): [number, number] {
  if (p.k === 'tie')
    return [clamp(s.xc + off, BIRD_REACH, c.w - BIRD_REACH), p.y! - 1];
  const q = pt(s.main, p.l!, s.clk, s.amp, s.ph);
  return [clamp(q[0] + 1, BIRD_REACH, c.w - BIRD_REACH), q[1] - 1];
}
function perchOk(s: State, p: Perch | null): boolean {
  if (!p) return false;
  if (p.k === 'tie') return p.y! < pt(s.main, s.g, s.clk, s.amp, s.ph)[1] - 20;
  return p.l! < s.g - 30;
}
function pickPerch(c: Col, s: State, list: Perch[], b: Bird): Perch | null {
  const used = new Set(
    (s.birds as Bird[])
      .filter((o) => o !== b && o.p && o.mode !== 'hidden')
      .map((o) => o.p!.key),
  );
  let pool = list.filter(
    (p) => !used.has(p.key) && !(b.p && p.key === b.p.key),
  );
  if (b.sp) {
    const st = pool.filter((p) => p.k === 'stem');
    if (st.length && rnd(s.clk, b.id) < 0.6) pool = st;
  }
  const vis = pool.filter((p) => {
    const y = perchXY(c, s, p, 0)[1];
    return y > c.v0 + 20 && y < c.v1 - 20;
  });
  if (vis.length) pool = vis;
  if (!pool.length) return null;
  return pool[
    Math.floor(rnd(s.clk * 1.7, b.id + pool.length) * pool.length) % pool.length
  ]!;
}
const birdPose = (b: Bird): BirdPose => ({
  fly: b.mode === 'fly' || b.mode === 'away' || b.mode === 'deliver',
  ph: b.ph,
  walk: b.mode === 'walk' ? 1 : 0,
  puff: b.puff,
  note: b.note,
  sp: b.sp,
});
function initBirds(s: State): void {
  s.birds = [0, 1, 2].map((i): Bird => ({
    mode: 'hidden',
    id: i,
    sp: i > 1,
    carrier: i === 0,
    note: i === 0,
    timer: 0.6 + i * 1.4,
    x: 0,
    y: 0,
    p: null,
    off: 0,
    tx: 0,
    face: 1,
    ph: i * 2,
    alpha: 0,
    puff: 0,
    coo: 2 + i * 1.7,
    cooT: 9,
    u: 0,
    sx: 0,
    sy: 0,
    d0: 40,
    vx: 0,
    vy: 0,
    k: i > 1 ? 0.62 : 1,
  }));
  s.flock = null;
  s.flockT = 45 + rnd(s.ph ?? 1, 31) * 40;
  s.auto = false;
}
function startle(b: Bird, fx: number): void {
  if (b.mode === 'hidden' || b.mode === 'away' || b.mode === 'deliver') return;
  b.mode = 'away';
  b.u = 0;
  const dir = Math.sign(b.x - fx) || (b.id % 2 ? 1 : -1);
  b.vx = dir * 55;
  b.vy = -75;
  b.face = dir;
}
function deliver(c: Col, b: Bird): void {
  b.mode = 'deliver';
  b.u = 0;
  const dir = (c.facing || -1) < 0 ? -1 : 1; // toward the contact text
  b.vx = dir * 80;
  b.vy = -30;
  b.face = dir;
}
function updateBirds(c: Col, s: State, dt: number): void {
  if (!s.birds) initBirds(s);
  const list = perchList(c, s),
    clk: number = s.clk,
    W: number = c.w;
  for (const b of s.birds as Bird[]) {
    if (E.reduced) {
      if (b.mode !== 'perch' || !perchOk(s, b.p)) {
        const p = pickPerch(c, s, list, b);
        if (!p) {
          b.mode = 'hidden';
          b.alpha = 0;
          continue;
        }
        b.p = p;
        b.off = b.sp ? 0 : (b.id - 1) * 7;
        b.mode = 'perch';
        b.alpha = 1;
        b.face = b.id % 2 ? 1 : -1;
      }
      const q = perchXY(c, s, b.p!, b.off);
      b.x = q[0];
      b.y = q[1];
      continue;
    }
    const flying =
      b.mode === 'fly' || b.mode === 'away' || b.mode === 'deliver';
    b.ph += dt * (flying ? 16 : b.mode === 'walk' ? 7 : 1.2);
    if (b.mode === 'hidden') {
      b.timer -= dt;
      if (b.timer <= 0) {
        const p = pickPerch(c, s, list, b);
        if (!p) {
          b.timer = 1;
          continue;
        }
        b.p = p;
        b.off = b.sp ? 0 : (rnd(clk, b.id + 3) - 0.5) * 2 * (TIE_HALF - 8);
        if (b.carrier) b.note = true;
        const q = perchXY(c, s, p, b.off),
          side = rnd(clk, b.id) < 0.5 ? -1 : 1;
        b.sx = clamp(q[0] + side * 50, BIRD_REACH, W - BIRD_REACH);
        b.sy = clamp(q[1] - 80, BIRD_REACH, c.h - 8);
        b.d0 = Math.max(40, Math.hypot(q[0] - b.sx, q[1] - b.sy));
        b.u = 0;
        b.alpha = 0;
        b.mode = 'fly';
      }
    } else if (b.mode === 'perch' || b.mode === 'walk') {
      if (!perchOk(s, b.p)) {
        b.mode = 'perch';
        b.timer = 0;
      }
      const q = perchXY(c, s, b.p!, b.off);
      b.x = q[0];
      b.y = q[1];
      if (b.mode === 'walk') {
        const d = b.tx - b.off,
          st = Math.min(Math.abs(d), 9 * dt);
        b.off += Math.sign(d) * st;
        b.face = d > 0 ? 1 : -1;
        if (Math.abs(d) < 0.6) {
          b.mode = 'perch';
          b.timer = 4 + rnd(clk, b.id) * 6;
        }
      } else {
        b.timer -= dt;
        b.coo -= dt;
        if (b.coo < 0) {
          b.coo = 5 + rnd(clk, b.id + 9) * 7;
          b.cooT = 0;
        }
        b.cooT += dt;
        b.puff =
          !b.sp && b.cooT < 1.6
            ? Math.sin((b.cooT / 1.6) * PI * 2) * 0.5 + 0.5
            : 0;
        if (b.timer <= 0) {
          const walkable =
            !b.sp && b.p!.k === 'tie' && rnd(clk, b.id + 5) < 0.55;
          if (walkable) {
            const lim = TIE_HALF - 8;
            let t = (rnd(clk, b.id + 7) - 0.5) * 2 * lim;
            if (Math.abs(t - b.off) < 8) t = b.off > 0 ? -lim : lim;
            b.tx = t;
            b.mode = 'walk';
          } else {
            const p = pickPerch(c, s, list, b);
            if (p) {
              b.p = p;
              b.off = b.sp
                ? 0
                : (rnd(clk, b.id + 4) - 0.5) * 2 * (TIE_HALF - 8);
              const t = perchXY(c, s, p, b.off);
              b.sx = b.x;
              b.sy = b.y;
              b.d0 = Math.max(40, Math.hypot(t[0] - b.sx, t[1] - b.sy));
              b.u = 0;
              b.mode = 'fly';
              b.face = t[0] - b.sx > 6 ? 1 : t[0] - b.sx < -6 ? -1 : b.face;
            } else b.timer = 3;
          }
        }
      }
    } else if (b.mode === 'fly') {
      const t = perchXY(c, s, b.p!, b.off),
        sp = b.sp ? 115 : 78;
      b.u = Math.min(1, b.u + (dt * sp) / b.d0);
      const e = easeInOut(b.u),
        arc = Math.min(26, b.d0 * 0.25);
      b.x = lerp(b.sx, t[0], e) + Math.sin(b.u * TAU) * 7;
      b.y = lerp(b.sy, t[1], e) - Math.sin(b.u * PI) * arc;
      b.alpha = Math.min(1, b.alpha + dt * 3);
      if (Math.abs(t[0] - b.sx) > 6) b.face = t[0] - b.sx > 0 ? 1 : -1;
      if (b.u >= 1) {
        b.mode = 'perch';
        b.timer = b.sp ? 3 + rnd(clk, b.id) * 4 : 6 + rnd(clk, b.id) * 8;
        b.puff = 0;
        b.cooT = 9;
      }
    } else {
      // away (startled) or deliver (the letter goes): flap off, fading, then stay hidden a while
      const del = b.mode === 'deliver';
      b.u += dt / (del ? 2.6 : 1.3);
      b.x = clamp(b.x + b.vx * dt, BIRD_REACH, W - BIRD_REACH);
      b.y = clamp(b.y + b.vy * dt, BIRD_REACH, c.h - 8);
      b.alpha = del ? 1 - ease((b.u - 0.45) / 0.55) : 1 - ease(b.u);
      if (b.u >= 1) {
        if (del) b.note = false;
        b.mode = 'hidden';
        b.alpha = 0;
        b.timer = del ? 12 + rnd(clk, 2) * 6 : 7 + rnd(clk, b.id) * 6;
      }
    }
  }
  if (E.reduced) return;
  // the letter goes on its own once the end of the column is reached (once per visit to the page)
  const car: Bird = s.birds[0];
  if (
    !s.auto &&
    s.g > s.main.total * 0.92 &&
    car.note &&
    (car.mode === 'perch' || car.mode === 'walk')
  ) {
    s.auto = true;
    deliver(c, car);
  }
  // a distant flock of tiny Vs, now and then
  if (!s.flock) {
    s.flockT -= dt;
    if (s.flockT <= 0) {
      const dir = rnd(clk, 21) < 0.5 ? 1 : -1;
      s.flock = {
        x: dir > 0 ? -30 : W + 30,
        y: clamp(
          c.v0 + (c.v1 - c.v0) * (0.12 + 0.3 * rnd(clk, 22)),
          40,
          c.h - 40,
        ),
        dir,
        n: 5 + Math.floor(rnd(clk, 23) * 3),
      };
    }
  } else {
    s.flock.x += s.flock.dir * 16 * dt;
    if (s.flock.x < -50 || s.flock.x > W + 50) {
      s.flock = null;
      s.flockT = 60 + rnd(clk, 24) * 60;
    }
  }
}
function drawBirds(c: Col, s: State): void {
  if (!s.birds) return;
  const keep = E.str,
    t = s.clk;
  E.str = TUNE.bird.strength;
  // the flock first, small and faint, behind the near birds; it fades before it reaches either edge
  if (s.flock) {
    const f: Flock = s.flock,
      a = Math.min(sm(-20, 70, f.x), sm(c.w + 20, c.w - 70, f.x));
    if (a > 0.02) {
      E.str = TUNE.bird.strength * 0.7 * a;
      g.beginPath();
      for (let i = 0; i < f.n; i++) {
        const x = f.x - f.dir * (10 + i * 9) * (i % 2 ? 1 : 0.8),
          y = f.y + (i % 2 ? 1 : -1) * (4 + i * 2.5),
          fl = Math.sin(t * 3 + i * 1.3) * 1.8;
        g.moveTo(x - 4, y - 2 + fl);
        g.lineTo(x, y);
        g.lineTo(x + 4, y - 2 + fl);
      }
      ink(0.9, 1);
      E.str = TUNE.bird.strength;
    }
  }
  for (const b of s.birds as Bird[]) {
    if (
      b.mode === 'hidden' ||
      b.alpha < 0.02 ||
      b.y < c.v0 - 60 ||
      b.y > c.v1 + 60
    )
      continue;
    g.globalAlpha = b.alpha;
    bird(b.x, b.y, b.face, b.k, birdPose(b));
  }
  g.globalAlpha = 1;
  E.str = keep;
}

export const ivy: Scene = {
  init(c: Col): State {
    const w = c.w,
      h = c.h,
      rg = mulberry(c.seed * 11 + 7);
    c.bleed = 0;
    const face = c.facing || -1;
    // Every leaf and flower must fit inside the safe rect, so the stem and branches are walked inside it.
    const x0 = IVY_REACH,
      x1 = w - IVY_REACH;
    // Where the vine hangs and where it drifts to: a little off the column's middle, and well clear of the
    // garden's bucket (and its vase) where it reaches the ground.
    let xc = face < 0 ? w * 0.45 : w * 0.55;
    if (c.bucketX != null && Math.abs(xc - c.bucketX) < 100)
      xc = c.bucketX + (xc < c.bucketX ? -110 : 110);
    xc = clamp(xc, x0 + 10, x1 - 10);
    const rx = xc;
    const oy = clamp(c.hb || 30, 8, h * 0.5); // the seed sits at the heading's baseline
    const ymax = h - 4;
    const o: WalkOpts = { k: 0.14, up: 0.03, pull: 0.0026, xc, x0, x1, ymax };
    const main = walk(
      rg,
      rx,
      oy,
      (rg() - 0.5) * 0.4,
      Math.ceil((h * 1.7) / 4),
      4,
      o,
    );
    const tot = main.total;
    // Leaves from alternate nodes: larger near the hanger, smaller toward the tip, irregular spacing.
    const nodes: State[] = [];
    let l = 30,
      k = 0,
      flowersOnMain = 0;
    while (l < tot - 30) {
      const u = l / tot;
      nodes.push({
        l,
        side: k % 2 ? 1 : -1,
        len: lerp(34, 13, u) * (0.8 + rg() * 0.4),
        ang: 1.5 + rg() * 0.7,
        stalk: 5 + rg() * 5,
        seed: rg() * 50,
        tend: u > 0.12 && rg() < 0.4,
        fl:
          u > 0.3 && flowersOnMain < 3 && rg() < 0.14
            ? (flowersOnMain++,
              {
                kind: Math.floor(rg() * 3),
                r: 11 + rg() * 3,
                stalk: 14 + rg() * 8,
                delay: 0.5 + rg(),
              })
            : null,
      });
      l += lerp(30, 58, u) * (0.65 + rg() * 0.7);
      k++;
    }
    // Side shoots at irregular heights, shorter than the stem; they hang from it and carry the flowers.
    const branches: State[] = [];
    for (const [a, b] of [
      [0.14, 0.3],
      [0.38, 0.54],
      [0.62, 0.76],
    ] as [number, number][]) {
      const bl = tot * (a + rg() * (b - a)),
        side = branches.length % 2 ? 1 : -1;
      const base = pt(main, bl, 0, 0, 0);
      const th0 = Math.atan2(base[2], base[3]) + side * (0.7 + rg() * 0.5);
      const bo: WalkOpts = {
        k: 0.2,
        up: 0.04,
        pull: 0.0014,
        xc,
        x0,
        x1,
        ymax: h - 8,
      };
      const path = walk(
        rg,
        base[0],
        base[1],
        th0,
        Math.round((tot * (0.14 + rg() * 0.1)) / 4),
        4,
        bo,
      );
      const leaves: State[] = [];
      for (const f of [0.35, 0.65])
        if (rg() < 0.85)
          leaves.push({
            l: path.total * f,
            side: leaves.length % 2 ? 1 : -1,
            len: 13 + rg() * 8,
            ang: 0.6 + rg() * 0.4,
          });
      branches.push({
        path,
        l: bl,
        ph: rg() * 6,
        leaves,
        kind: Math.floor(rg() * 3),
        r: 11 + rg() * 4,
        mid:
          rg() < 0.5
            ? {
                l: path.total * (0.5 + rg() * 0.2),
                kind: Math.floor(rg() * 3),
                r: 9 + rg() * 3,
              }
            : null,
      });
    }
    const amp = 6 * (c.phone ? 0.8 : 1);
    return {
      main,
      nodes,
      branches,
      rx,
      xc,
      oy,
      g: 24,
      gv: 0,
      clk: 0,
      amp,
      ph: rg() * 6,
      bfs: [],
      extras: [],
    };
  },
  tap(c: Col, s: State, x: number, y: number): void {
    // A blossom on the nearest grown part of the main stem (at most 4); butterflies near the press lift off.
    let bl: number | null = null,
      bdd = 1e9;
    for (let l = 20; l <= Math.max(s.g, 30); l += 14) {
      const p = pt(s.main, l, s.clk, s.amp, s.ph);
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bdd) {
        bdd = d;
        bl = l;
      }
    }
    if (bl !== null) {
      s.extras.push({
        l: bl,
        side: x > pt(s.main, bl, s.clk, s.amp, s.ph)[0] ? 1 : -1,
        kind: Math.floor(Math.random() * 3),
        r: 11 + Math.random() * 3,
        t0: s.clk,
      });
      if (s.extras.length > 4) s.extras.shift();
    }
    for (const b of s.bfs)
      if (Math.hypot(b.x - x, b.y - y) < 120) b.lift = true;
    if (s.birds) {
      const car: Bird = s.birds[0];
      for (const b of s.birds as Bird[])
        if (b !== car && Math.hypot(b.x - x, b.y - y) < 120) startle(b, x);
      // a click sends the letter off to the contact text; with no letter left, a click on the carrier just startles it
      if (car.note && (car.mode === 'perch' || car.mode === 'walk'))
        deliver(c, car);
      else if (Math.hypot(car.x - x, car.y - y) < 120) startle(car, x);
    }
  },
  update(c: Col, s: State, dt: number): void {
    s.clk += dt;
    const clk = s.clk,
      tot = s.main.total;
    // The tip follows the scroll both ways: down the page it unfurls, up the page it rolls back.
    // progress runs from the heading (the seed) to the end of the column
    const pr = clamp((E.ref - c.t - s.oy) / Math.max(1, c.h - s.oy), 0, 1);
    const target = E.reduced ? tot : clamp(pr * tot * 1.04 + 24, 24, tot);
    const prev = s.g;
    if (E.reduced || c.snap) s.g = target;
    else
      s.g += clamp(
        (target - s.g) * (1 - Math.exp(-dt * 2.2)),
        -260 * dt,
        260 * dt,
      );
    s.gv += ((s.g - prev) / Math.max(dt, 1e-3) - s.gv) * Math.min(1, dt * 2);
    // One butterfly, always here: each perches on a leaf or bloom of the grown vine with its wings
    // slowly opening and closing, hops to another every 10 to 20 s, lifts off if a press lands near it
    // or the vine rolls up from under it.
    const anchors = ivyAnchors(s);
    if (!s.bfs.length) {
      for (let i = 0; i < 1; i++) {
        const a = pickAnchor(c, s, anchors, null, i);
        const p = a ? anchorXY(c, s, a) : [c.w * 0.5, c.h * 0.5];
        s.bfs.push({
          x: p[0],
          y: p[1],
          a,
          mode: 'perch',
          timer: 4 + i * 6 + rnd(i, 3) * 5,
          ph: i * 2,
          flap: 0,
          rot: 0,
          k: TUNE.butterfly.size + i * 0.1,
          lift: false,
          ti: i,
        });
      }
    }
    for (const b of s.bfs) {
      b.ph += dt * (b.mode === 'perch' ? 1.3 : 9);
      b.timer -= dt;
      if (b.a && !anchorOk(s, b.a)) {
        b.lift = true;
        if (b.mode === 'fly') {
          const a = pickAnchor(c, s, anchors, b, b.ti);
          if (a) b.a = a;
        }
      }
      if (b.mode === 'perch') {
        if (b.a) {
          const p = anchorXY(c, s, b.a);
          b.x = p[0];
          b.y = p[1];
        }
        b.rot += (0 - b.rot) * Math.min(1, dt * 3);
        if (b.timer <= 0 || b.lift) {
          const a = pickAnchor(c, s, anchors, b, b.ti);
          if (a) {
            b.a = a;
            b.mode = 'fly';
            b.lift = false;
          } else b.timer = 6;
        }
      } else {
        const p = anchorXY(c, s, b.a),
          dx = p[0] - b.x,
          dy = p[1] - b.y,
          d = Math.hypot(dx, dy);
        const sp = Math.min(55, 18 + d * 0.5);
        if (d < 3) {
          b.mode = 'perch';
          b.timer = 10 + rnd(clk, b.ph) * 10;
          b.lift = false;
        } else {
          b.x += (dx / d) * sp * dt + Math.sin(clk * 3 + b.ti) * 6 * dt;
          b.y += (dy / d) * sp * dt + Math.cos(clk * 2.4 + b.ti) * 6 * dt;
          b.rot +=
            (clamp((dx / d) * 0.35, -0.4, 0.4) - b.rot) * Math.min(1, dt * 3);
        }
      }
      b.x = clamp(b.x, BF_REACH, c.w - BF_REACH);
      b.y = clamp(b.y, BF_REACH, c.h - BF_REACH);
    }
    updateBirds(c, s, dt);
  },
  draw(c: Col, s: State): void {
    const t = s.clk,
      y0 = c.v0,
      y1 = c.v1,
      amp = s.amp,
      ph = s.ph,
      main = s.main,
      gl = s.g;
    const wind = clamp(E.sv * 0.0002, -0.1, 0.1);
    // the trellis: a faint stake with cross-ties, always there; the vine winds along it
    {
      const x = s.xc,
        ya = Math.max(s.oy + 4, y0 - 20),
        yb = Math.min(c.h, y1 + 20);
      if (yb > ya) {
        g.beginPath();
        g.setLineDash([3, 6]);
        g.moveTo(x, ya);
        g.lineTo(x, yb);
        ink(0.3, 1);
        g.setLineDash([]);
        g.beginPath();
        for (let y = s.oy + 46; y < c.h - 6; y += 46) {
          if (y < y0 - 20 || y > y1 + 20) continue;
          g.moveTo(x - TIE_HALF, y);
          g.lineTo(x + TIE_HALF, y);
        }
        ink(0.3, 1);
      }
    }
    // the seed: a small seed in the soil mark at the heading's baseline, with two first leaves
    {
      const p = pt(main, 0, t, amp, ph);
      g.beginPath();
      g.ellipse(p[0], s.oy - 1, 4, 5.5, 0, 0, TAU);
      fillP();
      ink(0.9, 1.3);
      const o = ease(gl / 60);
      for (const sd of [-1, 1]) {
        g.save();
        g.translate(p[0], s.oy - 4);
        g.rotate(-PI / 2 + sd * (0.9 - 0.2 * o));
        leaf(14 * o + 4, 1);
        g.restore();
      }
    }
    // main stem
    ribbon(main, gl, 0.75, 0.25, t, amp, ph, 0, y0, y1);
    // side shoots
    for (const b of s.branches) {
      const bp = shootP(b, gl);
      if (bp <= 0.001) continue;
      const bl = bp * b.path.total;
      const bo = sw(b.l, main, t, amp, ph);
      if (pt(main, b.l, t, amp, ph)[1] < y0 - 140) continue;
      if (b.path.ys[0] > y1 + 140) continue;
      ribbon(b.path, bl, 0.55, 0.2, t, amp * 0.8, b.ph, bo, y0, y1);
      for (const lf of b.leaves) {
        if (bl < lf.l) continue;
        const op = ease((bl - lf.l) / 30 + 0.05),
          p = pt(b.path, lf.l, t, amp * 0.8, b.ph, bo);
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(
          Math.atan2(p[3], p[2]) + lf.side * lf.ang - lf.side * (1 - op) * 0.5,
        );
        leaf(lf.len, op);
        g.restore();
      }
      const flowerAt = (
        p: [number, number] | Pt4,
        kind: number,
        r: number,
        open: number,
        tilt: number,
      ): void => {
        g.save();
        g.translate(p[0], p[1]);
        g.rotate(tilt);
        flower(kind, r, open, 0);
        g.restore();
      };
      if (b.mid && bl >= b.mid.l) {
        const p = pt(b.path, b.mid.l, t, amp * 0.8, b.ph, bo);
        flowerAt(
          [p[0] + 6, p[1] + 3],
          b.mid.kind,
          b.mid.r,
          ease((bl - b.mid.l) / 60),
          Math.sin(t * 0.6 + b.ph) * 0.05,
        );
      }
      if (bp > 0.85) {
        const p = pt(b.path, b.path.total, t, amp * 0.8, b.ph, bo);
        flowerAt(
          p,
          b.kind,
          b.r,
          ease((bp - 0.85) / 0.15),
          Math.sin(t * 0.6 + b.ph) * 0.05,
        );
      }
    }
    // leaves, tendrils and the few flowers on the main stem
    for (const n of s.nodes) {
      if (gl < n.l) continue;
      const p = pt(main, n.l, t, amp, ph);
      if (p[1] < y0 - 90 || p[1] > y1 + 90) continue;
      const d = gl - n.l,
        op = ease(d / 46);
      const ta =
        Math.atan2(p[3], p[2]) +
        n.side * n.ang +
        Math.sin(t * 0.7 + n.seed) * 0.04 +
        wind * n.side;
      g.save();
      g.translate(p[0], p[1]);
      g.rotate(ta - (1 - op) * n.side * 0.5);
      const sl = n.stalk * op;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(sl, 0);
      ink(0.85, 1.1);
      g.translate(sl, 0);
      leaf(n.len, op);
      g.restore();
      if (n.tend) {
        const tp = ease((d - 14) / 50),
          tta = Math.atan2(-0.35, Math.sign(s.xc - p[0]) || -n.side);
        if (tp > 0.01) {
          g.save();
          g.translate(p[0], p[1]);
          g.beginPath();
          g.moveTo(0, 0);
          g.quadraticCurveTo(
            Math.cos(tta) * 12 * tp,
            Math.sin(tta) * 12 * tp,
            Math.cos(tta) * 20 * tp,
            Math.sin(tta) * 20 * tp,
          );
          ink(0.7, 1.1);
          const cx =
              Math.cos(tta) * 20 * tp + Math.cos(tta + (PI / 2) * n.side) * 5,
            cy =
              Math.sin(tta) * 20 * tp + Math.sin(tta + (PI / 2) * n.side) * 5;
          spiral(
            cx,
            cy,
            5,
            1.5,
            Math.atan2(
              Math.sin(tta) * 20 * tp - cy,
              Math.cos(tta) * 20 * tp - cx,
            ),
            tp,
          );
          ink(0.7, 1.1);
          g.restore();
        }
      }
      if (n.fl) {
        const fa = ease((d - 16) / 40),
          open = ease((d - 36 - n.fl.delay * 30) / 70);
        if (fa > 0) {
          const L = n.fl.stalk * fa,
            ang = -PI / 2 + n.side * 0.8;
          const ex = clamp(
              p[0] + Math.cos(ang) * L * 0.9,
              FLOWER_REACH,
              c.w - FLOWER_REACH,
            ),
            ey = p[1] + Math.sin(ang) * L * 0.9;
          g.beginPath();
          g.moveTo(p[0], p[1]);
          g.quadraticCurveTo(
            p[0] + Math.cos(ang) * L * 0.5,
            p[1] + Math.sin(ang) * L * 0.5,
            ex,
            ey,
          );
          ink(0.85, 1.1);
          g.save();
          g.translate(ex, ey);
          flower(n.fl.kind, n.fl.r, open, Math.sin(t * 0.6 + n.seed) * 0.05);
          g.restore();
        }
      }
    }
    for (const e of s.extras) {
      if (gl < e.l) continue;
      const p = pt(main, e.l, t, amp, ph),
        L = 14 * ease((t - e.t0) / 1.2) * ease((gl - e.l) / 30);
      const ex = p[0] + e.side * L,
        ey = p[1] - L * 0.6;
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.quadraticCurveTo(p[0] + e.side * L * 0.2, p[1] - L * 0.5, ex, ey);
      ink(0.85, 1.1);
      g.save();
      g.translate(ex, ey);
      flower(e.kind, e.r, ease((t - e.t0 - 0.8) / 3), 0);
      g.restore();
    }
    // the growing tip: a small curled shoot that uncurls while it grows
    {
      const p = pt(main, gl, t, amp, ph),
        un = clamp(Math.abs(s.gv) / 30, 0, 1),
        r = 7 - 3 * un,
        turns = 1.7 * (1 - un) + 0.35;
      const cx = p[0] + -p[3] * r,
        cy = p[1] + p[2] * r;
      spiral(cx, cy, r, turns, Math.atan2(p[1] - cy, p[0] - cx), 1);
      ink(0.9, 1.3);
    }
    drawBirds(c, s);
    // butterflies: their own, higher strength so they read against the fainter vine
    const keep = E.str;
    E.str = TUNE.butterfly.strength;
    for (let i = 0; i < s.bfs.length; i++) {
      const b = s.bfs[i];
      const flap =
        b.mode === 'perch'
          ? 0.35 + 0.65 * Math.abs(Math.cos(b.ph))
          : 0.12 + 0.88 * Math.abs(Math.cos(b.ph));
      gbutterfly(b.x, b.y, b.rot, flap, b.k, i);
    }
    E.str = keep;
  },
};
