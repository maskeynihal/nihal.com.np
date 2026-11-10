/**
 * Tree (section art for the CV): a career tree growing down the column as you scroll. A seed level with
 * the section heading (c.hb) sends a trunk down; each of the six roles, 2019 to now, is a node on it
 * (a small growth ring) that puts out a branch, alternating sides and a little longer each time. The tip of
 * the trunk and of every growing branch leads with a bud; twigs and leaves open behind it, and the trunk
 * and branches thicken as they are left behind. The newest node glows softly. Everything depends on how far
 * the trunk has grown (`s.y`), which follows the scroll both ways, so scrolling up draws it back in. A click
 * pops a new leaf on the nearest branch. Under reduced motion the whole tree is out, still.
 */
import {
  E,
  g,
  ink,
  fillS,
  fillP,
  glow,
  clamp,
  lerp,
  mulberry,
  TAU,
  PI,
} from './core';
import type { Col, Pt, Scene, State } from './core';

/** A sampled curve: points with cumulative arc length. */
interface Path {
  xs: number[];
  ys: number[];
  ls: number[];
  total: number;
}
/** A point on a path plus its unit tangent: x, y, dx, dy. */
type Seg = [number, number, number, number];
interface Twig {
  f: number;
  up: number;
  len: number;
  ph: number;
}
interface Node {
  y: number;
  x: number;
  side: number;
  path: Path;
  twigs: Twig[];
  dist: number;
  lit: number;
  ph: number;
}
interface Pop {
  n: Node;
  f: number;
  side: number;
  t0: number;
}

/** Largest extents (px): a branch tip with its leaves, kept this far from either side of the column. */
export const TIP_REACH = 38;
export const ROLES = 6;
export const MAX_POPS = 6;
const STEP = 8;

const ease = (x: number): number => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};

function leaf(len: number, open: number): void {
  if (open <= 0.01) return;
  const L = len * open,
    W = L * 0.34;
  g.beginPath();
  g.moveTo(0, 0);
  g.bezierCurveTo(L * 0.25, -W * 1.15, L * 0.7, -W * 0.9, L, 0);
  g.bezierCurveTo(L * 0.7, W * 0.75, L * 0.25, W * 0.95, 0, 0);
  fillP();
  ink(0.9, 1.3);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(L * 0.5, -L * 0.03, L * 0.96, 0);
  ink(0.45, 1);
}
/** A small bud leading a growing tip: a teardrop pointing along (dx, dy) with two tiny leaves flanking it. */
function bud(x: number, y: number, dx: number, dy: number, k: number): void {
  const a = Math.atan2(dy, dx);
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.ellipse(4.5 * k, 0, 4.5 * k, 2.6 * k, 0, 0, TAU);
  fillP();
  ink(0.95, 1.3);
  for (const sd of [-1, 1]) {
    g.save();
    g.rotate(sd * 0.9);
    leaf(9 * k, 1);
    g.restore();
  }
  g.restore();
}
/** Cubic sampled to a polyline with arc length. */
function sample(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 22): Path {
  const xs: number[] = [],
    ys: number[] = [],
    ls: number[] = [];
  let acc = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n,
      v = 1 - u;
    const x =
      v * v * v * p0[0] +
      3 * v * v * u * p1[0] +
      3 * v * u * u * p2[0] +
      u * u * u * p3[0];
    const y =
      v * v * v * p0[1] +
      3 * v * v * u * p1[1] +
      3 * v * u * u * p2[1] +
      u * u * u * p3[1];
    if (i) acc += Math.hypot(x - xs[i - 1]!, y - ys[i - 1]!);
    xs.push(x);
    ys.push(y);
    ls.push(acc);
  }
  return { xs, ys, ls, total: acc };
}
function at(P: Path, f: number): Seg {
  const l = clamp(f, 0, 1) * P.total,
    L = P.ls;
  let lo = 0,
    hi = L.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (L[m]! < l) lo = m;
    else hi = m;
  }
  const u = (l - L[lo]!) / (L[hi]! - L[lo]! || 1);
  const tx = P.xs[hi]! - P.xs[lo]!,
    ty = P.ys[hi]! - P.ys[lo]!,
    tl = Math.hypot(tx, ty) || 1;
  return [
    lerp(P.xs[lo]!, P.xs[hi]!, u),
    lerp(P.ys[lo]!, P.ys[hi]!, u),
    tx / tl,
    ty / tl,
  ];
}
/** A tapered filled ribbon along the first fraction f of P: thick at the base, fine at the tip. */
function ribbon(P: Path, f: number, hw0: number, hw1: number): void {
  const n = P.xs.length,
    Lx: number[] = [],
    Ly: number[] = [],
    Rx: number[] = [],
    Ry: number[] = [],
    lim = f * P.total;
  for (let i = 0; i < n; i++) {
    if (P.ls[i]! > lim && i > 1) break;
    const j = Math.min(n - 1, i + 1),
      k = Math.max(0, i - 1);
    const tx = P.xs[j]! - P.xs[k]!,
      ty = P.ys[j]! - P.ys[k]!,
      tl = Math.hypot(tx, ty) || 1;
    const hw = lerp(hw0, hw1, P.ls[i]! / (P.total || 1));
    Lx.push(P.xs[i]! - (ty / tl) * hw);
    Ly.push(P.ys[i]! + (tx / tl) * hw);
    Rx.push(P.xs[i]! + (ty / tl) * hw);
    Ry.push(P.ys[i]! - (tx / tl) * hw);
  }
  if (Lx.length < 2) return;
  g.beginPath();
  g.moveTo(Lx[0]!, Ly[0]!);
  for (let i = 1; i < Lx.length; i++) g.lineTo(Lx[i]!, Ly[i]!);
  for (let i = Rx.length - 1; i >= 0; i--) g.lineTo(Rx[i]!, Ry[i]!);
  g.closePath();
  fillS(0.95);
}

export const tree: Scene = {
  init(c: Col): State {
    const w = c.w,
      h = c.h,
      rg = mulberry(c.seed * 29 + 5);
    const oy = clamp(c.hb || 30, 8, h * 0.4);
    const yBot = Math.max(oy + 260, h - 48);
    const sx = w / 2,
      A = Math.min(w * 0.05, 14),
      ph = rg() * 6;
    const X = (y: number): number => sx + A * Math.sin((y - oy) * 0.009 + ph);
    const tx: number[] = [],
      ty: number[] = [],
      tl: number[] = [];
    for (let y = oy; y < yBot + STEP; y += STEP) {
      tx.push(X(y));
      ty.push(Math.min(y, yBot));
      tl.push(
        tl.length
          ? tl[tl.length - 1]! +
              Math.hypot(
                tx[tx.length - 1]! - tx[tx.length - 2]!,
                ty[ty.length - 1]! - ty[ty.length - 2]!,
              )
          : 0,
      );
    }
    const trunk: Path = { xs: tx, ys: ty, ls: tl, total: tl[tl.length - 1]! };
    // Six nodes down the trunk, one branch each, alternating sides and growing a little longer.
    const first = rg() < 0.5 ? 1 : -1,
      y0 = oy + 34,
      range = yBot - y0;
    const nodes: Node[] = [];
    for (let i = 0; i < ROLES; i++) {
      const y =
        y0 +
        range *
          (0.04 +
            0.7 * (i / (ROLES - 1)) +
            (i && i < ROLES - 1 ? (rg() - 0.5) * 0.03 : 0));
      const x = X(y),
        side = i % 2 ? -first : first;
      const avail = (side > 0 ? w - x : x) - TIP_REACH;
      const dx = Math.max(34, Math.min(lerp(78, 118, i / (ROLES - 1)), avail)),
        dy = dx * (0.38 + rg() * 0.12);
      const path = sample(
        [x, y],
        [x + side * dx * 0.5, y + dy * 0.75],
        [x + side * dx * 0.88, y + dy * 1.15],
        [x + side * dx, y + dy],
      );
      const twigs = [0.32, 0.55, 0.78].map((f, k) => ({
        f,
        up: k % 2 ? -1 : 1,
        len: 15 + rg() * 11,
        ph: rg() * 6,
      }));
      nodes.push({
        y,
        x,
        side,
        path,
        twigs,
        dist: Math.min(path.total * 1.3, (yBot - y) * 0.9),
        lit: 0,
        ph: rg() * 6,
      });
    }
    return { w, h, sx, oy, yBot, trunk, nodes, y: oy + 6, clk: 0, pops: [] };
  },
  tap(_c: Col, s: State, x: number, y: number): void {
    // a new leaf on the nearest grown part of a branch
    let best: { n: Node; f: number; side: number } | null = null,
      bd = 1e9;
    for (const n of s.nodes as Node[]) {
      const bp = ease((s.y - n.y) / n.dist);
      if (bp < 0.2) continue;
      for (let f = 0.15; f <= bp * 0.95; f += 0.1) {
        const p = at(n.path, f),
          d = Math.hypot(p[0] - x, p[1] - y);
        if (d < bd) {
          bd = d;
          best = { n, f, side: y < p[1] ? 1 : -1 };
        }
      }
    }
    if (!best) return;
    (s.pops as Pop[]).push({
      n: best.n,
      f: best.f,
      side: best.side,
      t0: s.clk,
    });
    if ((s.pops as Pop[]).length > MAX_POPS) (s.pops as Pop[]).shift();
  },
  update(c: Col, s: State, dt: number): void {
    s.clk += dt;
    const pr = clamp((E.ref - c.t - s.oy) / Math.max(1, c.h - s.oy), 0, 1);
    const tgt = s.oy + 6 + (s.yBot - s.oy - 6) * clamp(pr * 1.04, 0, 1);
    if (E.reduced) s.y = s.yBot;
    else if (c.snap) s.y = tgt;
    else
      s.y += clamp(
        (tgt - s.y) * (1 - Math.exp(-dt * 2.4)),
        -280 * dt,
        280 * dt,
      );
    let last = -1;
    (s.nodes as Node[]).forEach((n: Node, i: number) => {
      if (s.y >= n.y + 30) last = i;
    });
    (s.nodes as Node[]).forEach((n: Node, i: number) => {
      n.lit += ((i === last ? 1 : 0) - n.lit) * Math.min(1, dt * 1.4);
    });
  },
  draw(c: Col, s: State): void {
    const t = s.clk,
      v0 = c.v0,
      v1 = c.v1,
      sy = s.y as number,
      T = s.trunk as Path;
    const tf = clamp((sy - s.oy) / (T.ys[T.ys.length - 1]! - s.oy || 1), 0, 1);
    // the seed at the heading's baseline, with its first two leaves
    {
      const x = T.xs[0]!,
        o = ease((sy - s.oy) / 70);
      g.beginPath();
      g.ellipse(x, s.oy - 2, 4, 5.5, 0, 0, TAU);
      fillP();
      ink(0.9, 1.3);
      for (const sd of [-1, 1]) {
        g.save();
        g.translate(x, s.oy - 6);
        g.rotate(-PI / 2 + sd * (1 - 0.25 * o) + Math.sin(t * 0.7 + sd) * 0.03);
        leaf(8 + 8 * o, 1);
        g.restore();
      }
    }
    // trunk: thick at the seed, fine at the tip
    ribbon(T, tf, 1.9, 0.6);
    // branches, one per role
    for (const n of s.nodes as Node[]) {
      const gp = (sy - n.y) / n.dist;
      if (gp <= 0) continue;
      if (n.y > v1 + 140 || n.y < v0 - 200) continue;
      const bp = ease(gp),
        P = n.path;
      if (n.lit > 0.02) glow(n.x, n.y, 30, 0.5 * n.lit);
      // growth ring on the trunk: the role
      g.beginPath();
      g.arc(n.x, n.y, 4.2 * ease(gp * 6), 0, TAU);
      fillP();
      ink(0.95, 1.4);
      g.beginPath();
      g.arc(n.x, n.y, 1.6 * ease(gp * 6), 0, TAU);
      fillS(0.9);
      ribbon(P, bp, 1.3, 0.4);
      // twigs with leaves, reaching up and out
      for (const tw of n.twigs) {
        const tp = ease((bp - tw.f) / 0.2);
        if (tp <= 0.01) continue;
        const p = at(P, tw.f),
          a =
            Math.atan2(p[3], p[2]) -
            n.side * tw.up * 0.95 +
            Math.sin(t * 0.6 + tw.ph) * 0.04;
        const L = tw.len * tp,
          ex = clamp(p[0] + Math.cos(a) * L, 14, s.w - 14),
          ey = p[1] + Math.sin(a) * L;
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.lineTo(ex, ey);
        ink(0.8, 1.1);
        g.save();
        g.translate(ex, ey);
        g.rotate(a);
        leaf(13, ease((tp - 0.4) / 0.6));
        g.restore();
      }
      // the tip: a bud while it grows, a leaf pair once it has arrived
      const tp = at(P, bp);
      if (bp < 0.97) bud(tp[0], tp[1], tp[2], tp[3], 1);
      else {
        const a = Math.atan2(tp[3], tp[2]),
          o = ease((gp - 1) * 3 + 0.2);
        for (const sd of [-0.45, 0.45]) {
          g.save();
          g.translate(tp[0], tp[1]);
          g.rotate(a + sd + Math.sin(t * 0.6 + n.ph + sd) * 0.04);
          leaf(20, o);
          g.restore();
        }
      }
    }
    // leaves popped by a click
    for (const q of s.pops as Pop[]) {
      if (ease((sy - q.n.y) / q.n.dist) * 0.95 < q.f) continue;
      const p = at(q.n.path, q.f),
        a = Math.atan2(p[3], p[2]) - q.n.side * q.side * 0.9,
        o = ease((t - q.t0) / 1.2);
      g.save();
      g.translate(p[0], p[1]);
      g.rotate(a);
      leaf(15, o);
      g.restore();
    }
    // the trunk's tip
    const tpos = at(T, tf);
    bud(tpos[0], tpos[1], tpos[2], tpos[3], 1.1);
  },
};
