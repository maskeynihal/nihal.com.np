/* eslint-disable */
// @ts-nocheck
/**
 * Bloom (section art): a climbing plant that comes up out of the real garden and grows with scroll.
 * The stem is a seeded random walk on the heading (upward bias, smooth curvature), computed once;
 * the frame only reveals it. Tapered ribbon stem, alternating leaves on short stalks, tendrils, a few
 * side branches that carry the flowers, a curled tip that uncurls while it grows. Flowers use the
 * garden's three heads (src/lib/garden/flora.ts).
 */
import { E, g, SA, PG, ink, fillS, fillP, circ, clamp, lerp, sm, rnd, mulberry, TAU, PI } from './core';
import { TUNE } from './tuning';

/**
 * Largest extents (px), the numbers every confinement below uses. A leaf is at most ~41 long, plus the
 * sway (6) and a margin; a whole flower (tulip petals 1.6 r, r up to 15, tilt) fits in FLOWER_REACH;
 * a butterfly's wings reach BF_REACH from its body (garden butterfly, k up to 1.3).
 */
export const BLOOM_REACH = 50;
export const FLOWER_REACH = 34;
export const BF_REACH = 26;

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/** A seeded walk: heading th (0 = straight up, + = right) with smooth curvature, pulled upright and toward xc. */
function walk(rg, x, y, th, n, ds, o) {
  const xs = [x], ys = [y], ls = [0];
  let k = 0, acc = 0;
  for (let i = 0; i < n; i++) {
    k = k * 0.93 + (rg() - 0.5) * o.k;
    th += k;
    th -= th * o.up;
    th += clamp((o.xc - x) * o.pull, -0.03, 0.03);
    th = clamp(th, -1.15, 1.15);
    const nx = clamp(x + Math.sin(th) * ds, o.x0, o.x1), ny = y - Math.cos(th) * ds;
    acc += Math.hypot(nx - x, ny - y);
    x = nx; y = ny;
    xs.push(x); ys.push(y); ls.push(acc);
    if (y < o.ymin) break;
  }
  return { xs, ys, ls, total: acc };
}
const sw = (l, p, t, amp, ph) => Math.sin(t * 0.5 + l * 0.012 + ph) * amp * Math.pow(l / (p.total || 1), 1.5);
function pt(p, l, t, amp, ph, bo = 0) {
  const L = p.ls;
  let lo = 0, hi = L.length - 1;
  l = clamp(l, 0, p.total);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < l) lo = m; else hi = m; }
  const f = (l - L[lo]) / ((L[hi] - L[lo]) || 1);
  const x = lerp(p.xs[lo], p.xs[hi], f), y = lerp(p.ys[lo], p.ys[hi], f);
  const tx = p.xs[hi] - p.xs[lo], ty = p.ys[hi] - p.ys[lo], tl = Math.hypot(tx, ty) || 1;
  return [x + bo + sw(l, p, t, amp, ph), y, tx / tl, ty / tl];
}
/** The stem as one tapered ribbon (a filled outline: no segment joints), from the root to length l1. */
function ribbon(p, l1, hw0, hw1, t, amp, ph, bo, y0, y1) {
  const n = p.ls.length;
  const Lx = [], Ly = [], Rx = [], Ry = [];
  for (let i = 0; i < n && p.ls[i] <= l1; i++) {
    if (p.ys[i] > y1 + 60 || p.ys[i] < y0 - 60) { if (Lx.length && p.ys[i] < y0 - 60) break; continue; }
    const l = p.ls[i], u = l / (p.total || 1);
    const x = p.xs[i] + bo + sw(l, p, t, amp, ph), y = p.ys[i];
    const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
    const tx = p.xs[j] - p.xs[k], ty = p.ys[j] - p.ys[k], tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl, hw = lerp(hw0, hw1, Math.pow(u, 0.75));
    Lx.push(x + nx * hw); Ly.push(y + ny * hw); Rx.push(x - nx * hw); Ry.push(y - ny * hw);
  }
  if (Lx.length < 2) return;
  g.beginPath();
  g.moveTo(Lx[0], Ly[0]);
  for (let i = 1; i < Lx.length; i++) g.lineTo(Lx[i], Ly[i]);
  for (let i = Rx.length - 1; i >= 0; i--) g.lineTo(Rx[i], Ry[i]);
  g.closePath();
  fillS(0.95);
}
function leaf(len, open) {
  if (open <= 0.01) return;
  const L = len * open, W = L * 0.34;
  g.beginPath();
  g.moveTo(0, 0); g.bezierCurveTo(L * 0.25, -W * 1.15, L * 0.7, -W * 0.9, L, 0);
  g.bezierCurveTo(L * 0.7, W * 0.75, L * 0.25, W * 0.95, 0, 0);
  fillP(); ink(0.9, 1.4);
  g.beginPath();
  g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, -L * 0.03, L * 0.96, 0);
  ink(0.5, 1);
}
function petal(x, y, a, len, wd) {
  const ux = Math.cos(a), uy = Math.sin(a);
  const p = (u, v) => [x + ux * u - uy * v, y + uy * u + ux * v];
  g.moveTo(x, y);
  g.bezierCurveTo(...p(len * 0.3, -wd), ...p(len * 0.9, -wd * 0.8), ...p(len, 0));
  g.bezierCurveTo(...p(len * 0.9, wd * 0.8), ...p(len * 0.3, wd), x, y);
}
/** The garden's three flower heads, drawn at the origin: bud, then petals easing open. */
function flower(kind, r, open, tilt) {
  if (open < 0.12) {
    g.beginPath(); g.ellipse(0, -r * 0.25, r * 0.3, r * 0.5, tilt, 0, TAU); fillP(); ink(0.9, 1.3); return;
  }
  const k = 0.3 + 0.7 * ease(open);
  g.beginPath();
  if (kind === 0) for (let i = 0; i < 12; i++) petal(0, 0, tilt + (i / 12) * TAU, r * 1.15 * k, r * 0.2 * k);
  else if (kind === 1) for (const d of [-0.5, 0.5, 0]) petal(0, r * 0.5, tilt - PI / 2 + d * k, r * 1.6 * k, r * 0.55 * k);
  else for (let i = 0; i < 5; i++) petal(0, 0, tilt + (i / 5) * TAU, r * 1.05 * k, r * 0.62 * k);
  fillP(); ink(0.95, 1.4);
  if (kind !== 1) { circ(0, 0, (kind === 0 ? r * 0.3 : r * 0.22) * k); fillS(0.9); }
}
function spiral(cx, cy, r, turns, rot, p) {
  g.beginPath();
  const n = Math.max(2, Math.round(14 * turns * p));
  for (let i = 0; i <= n; i++) {
    const q = i / (14 * turns), a = rot + q * turns * TAU, rr = r * (1 - q * 0.92);
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
}
/** The garden's butterfly (src/lib/garden/butterflies.ts): two wings a side, a body, two feelers. flap 0.12..1, k size. */
function gbutterfly(x, y, rot, flap, k, idx) {
  g.save(); g.translate(x, y); g.rotate(rot);
  for (const sd of [-1, 1]) {
    const sx = sd * flap * k;
    g.beginPath();
    g.moveTo(0, -2 * k);
    g.bezierCurveTo(sx * 4, -15 * k, sx * 17, -15 * k, sx * 13, -3 * k);
    g.bezierCurveTo(sx * 9, 0, sx * 3, 0, 0, -1);
    g.moveTo(0, 0);
    g.bezierCurveTo(sx * 11, 0, sx * 11, 11 * k, sx * 5, 9 * k);
    g.bezierCurveTo(sx * 2, 7 * k, 0, 3, 0, 0);
    fillP(); ink(0.95, 1.25);
    if (idx % 2 === 0 && flap > 0.3) { g.beginPath(); g.arc(sx * 9, -8 * k, 1.6 * k, 0, TAU); ink(0.9, 1); }
  }
  g.beginPath(); g.moveTo(0, -6 * k); g.lineTo(0, 8 * k); ink(1, 1.5);
  g.beginPath(); g.moveTo(0, -6 * k); g.lineTo(-3, -11 * k); g.moveTo(0, -6 * k); g.lineTo(3, -11 * k); ink(0.9, 1);
  g.restore();
}

/** Perches on the grown part of the vine, as functions of the sway so a butterfly rides its leaf. */
function bloomAnchors(c, s) {
  const t = s.clk, main = s.main, out = [];
  for (const n of s.nodes) if (n.t0 !== null && t - n.t0 > 2.6) out.push({ k: 'leaf', n });
  for (const b of s.branches) if (b.t0 !== null && t - b.t0 > 7.5) out.push({ k: 'bend', b });
  for (const n of s.nodes) if (n.fl && n.t0 !== null && t - n.t0 > 5) out.push({ k: 'mfl', n });
  if (!out.length || s.g > 60) for (let i = 0; i < 4; i++) out.push({ k: 'stem', l: 40 + (Math.max(s.g, 60) - 40) * (0.15 + i * 0.25) });
  return out;
}
function anchorXY(c, s, a) {
  const t = s.clk, main = s.main;
  if (a.k === 'leaf') {
    const n = a.n, p = pt(main, n.l, t, s.amp, s.ph), ta = Math.atan2(p[3], p[2]) + n.side * n.ang, r = n.stalk + n.len * 0.72;
    return [p[0] + Math.cos(ta) * r, p[1] + Math.sin(ta) * r - 3];
  }
  if (a.k === 'bend') {
    const b = a.b, bo = sw(b.l, main, t, s.amp, s.ph), p = pt(b.path, b.path.total, t, s.amp * 0.8, b.ph, bo);
    return [p[0], p[1] - 3];
  }
  if (a.k === 'mfl') {
    const n = a.n, p = pt(main, n.l, t, s.amp, s.ph), L = n.fl.stalk, ang = Math.atan2(p[3], p[2]) - n.side * 0.7;
    return [clamp(p[0] + Math.cos(ang) * L * 0.9 + n.side * L * 0.3, FLOWER_REACH, c.w - FLOWER_REACH), p[1] + Math.sin(ang) * L * 0.9 - L * 0.1 - 3];
  }
  const p = pt(main, a.l, t, s.amp, s.ph);
  return [p[0] + 3, p[1]];
}
function pickAnchor(c, s, list, from, seed) {
  const ok = [];
  for (const a of list) {
    if (from && from.a === a) continue;
    const p = anchorXY(c, s, a);
    if (p[0] < BF_REACH || p[0] > c.w - BF_REACH || p[1] < BF_REACH || p[1] > c.h - BF_REACH) continue;
    const inView = p[1] > c.v0 + 30 && p[1] < c.v1 - 30;
    const d = from ? Math.hypot(p[0] - from.x, p[1] - from.y) : 0;
    ok.push({ a, inView, d });
  }
  if (!ok.length) return null;
  const near = ok.filter((o) => o.inView && (!from || (o.d > 50 && o.d < 280)));
  const pool = near.length ? near : ok.filter((o) => o.inView).length ? ok.filter((o) => o.inView) : ok;
  return pool[Math.floor(rnd(s.clk, seed + pool.length) * pool.length) % pool.length].a;
}

export const bloom = {
  init(c) {
    const w = c.w, h = c.h, rg = mulberry(c.seed * 11 + 7);
    c.bleed = 0;
    const face = c.facing || -1;
    // Every leaf and flower must fit inside the safe rect, so the stem and branches are walked inside it.
    const x0 = BLOOM_REACH, x1 = w - BLOOM_REACH;
    const xc = face < 0 ? w * 0.6 : w * 0.4;
    // Root: well clear of the garden's bucket (and its vase), a little off the column's middle.
    let rx = face < 0 ? w * 0.4 : w * 0.6;
    if (c.bucketX != null && Math.abs(rx - c.bucketX) < 100) rx = c.bucketX + (rx < c.bucketX ? -110 : 110);
    rx = clamp(rx, x0 + 10, x1 - 10);
    const o = { k: 0.16, up: 0.03, pull: 0.0011, xc, x0, x1, ymin: BLOOM_REACH + 8 };
    const main = walk(rg, rx, h - 2, (rg() - 0.5) * 0.5, Math.ceil((h * 1.7) / 4), 4, o);
    const tot = main.total;
    // Leaves from alternate nodes: larger low down, smaller toward the tip, irregular spacing.
    const nodes = [];
    let l = 30, k = 0, flowersOnMain = 0;
    while (l < tot - 30) {
      const u = l / tot;
      nodes.push({
        l, side: k % 2 ? 1 : -1, len: lerp(34, 13, u) * (0.8 + rg() * 0.4), ang: 0.5 + rg() * 0.5, stalk: 5 + rg() * 5, seed: rg() * 50, t0: null,
        tend: u > 0.12 && rg() < 0.4,
        fl: u > 0.5 && flowersOnMain < 2 && rg() < 0.14 ? (flowersOnMain++, { kind: Math.floor(rg() * 3), r: 11 + rg() * 3, stalk: 14 + rg() * 8, delay: 0.5 + rg() }) : null,
      });
      l += lerp(30, 58, u) * (0.65 + rg() * 0.7);
      k++;
    }
    // Side branches at irregular heights, shorter than the stem; they carry the flowers.
    const branches = [];
    for (const [a, b] of [[0.2, 0.38], [0.45, 0.62], [0.68, 0.84]]) {
      const bl = tot * (a + rg() * (b - a)), side = branches.length % 2 ? 1 : -1;
      const base = pt(main, bl, 0, 0, 0);
      const th0 = Math.atan2(base[2], -base[3]) + side * (0.7 + rg() * 0.5);
      const bo = { k: 0.2, up: 0.04, pull: 0.0008, xc, x0, x1, ymin: BLOOM_REACH + 8 };
      const path = walk(rg, base[0], base[1], th0, Math.round((tot * (0.14 + rg() * 0.1)) / 4), 4, bo);
      const leaves = [];
      for (const f of [0.35, 0.65]) if (rg() < 0.85) leaves.push({ l: path.total * f, side: leaves.length % 2 ? 1 : -1, len: 13 + rg() * 8, ang: 0.6 + rg() * 0.4 });
      branches.push({ path, l: bl, ph: rg() * 6, leaves, t0: null, kind: Math.floor(rg() * 3), r: 11 + rg() * 4, mid: rg() < 0.5 ? { l: path.total * (0.5 + rg() * 0.2), kind: Math.floor(rg() * 3), r: 9 + rg() * 3 } : null, extra: [] });
    }
    // A few low sprouts and blades round the root so it sits in the ground.
    const sprouts = [-26, -11, 14, 30].map((dx, i) => ({ dx: dx + (rg() - 0.5) * 6, len: 12 + rg() * 14, bend: (rg() - 0.5) * 10, leaf: 8 + rg() * 6, seed: rg() }));
    const blades = Array.from({ length: 7 }, (_, i) => ({ dx: (i - 3) * 8 + (rg() - 0.5) * 4, hh: 8 + rg() * 12, l: (rg() - 0.5) * 8 }));
    const amp = 6 * (c.phone ? 0.8 : 1);
    return { main, nodes, branches, sprouts, blades, rx, g: 0, gv: 0, clk: 0, amp, ph: rg() * 6, bfs: [], extras: [] };
  },
  tap(c, s, x, y) {
    // A flower on the nearest side shoot that has grown; if none has, on the main stem.
    let best = null, bd = 1e9;
    for (const b of s.branches) {
      if (b.t0 === null) continue;
      const age = s.clk - b.t0, bl = ease(age / 5) * b.path.total;
      const p = pt(b.path, bl, s.clk, s.amp * 0.8, b.ph, sw(b.l, s.main, s.clk, s.amp, s.ph));
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) {
      const l = best.path.total * (0.3 + Math.random() * 0.55);
      best.extra.push({ l, kind: Math.floor(Math.random() * 3), r: 10 + Math.random() * 4, t0: s.clk });
      if (best.extra.length > 4) best.extra.shift();
    } else {
      let bl = null, bdd = 1e9;
      for (let l = 20; l <= Math.max(s.g, 30); l += 14) { const p = pt(s.main, l, s.clk, s.amp, s.ph); const d = Math.hypot(p[0] - x, p[1] - y); if (d < bdd) { bdd = d; bl = l; } }
      if (bl !== null) { s.extras.push({ l: bl, side: x > pt(s.main, bl, s.clk, s.amp, s.ph)[0] ? 1 : -1, kind: Math.floor(Math.random() * 3), r: 11 + Math.random() * 3, t0: s.clk }); if (s.extras.length > 4) s.extras.shift(); }
    }
    for (const b of s.bfs) if (Math.hypot(b.x - x, b.y - y) < 120) b.lift = true;
  },
  update(c, s, dt) {
    s.clk += dt;
    const clk = s.clk, tot = s.main.total;
    // Always rooted: the stem stands from the garden's ground up through the gap; growth carries on from it.
    const base = Math.min(tot, (c.ext || 0) + 90);
    if (s.g < base) s.g = base;
    const target = E.reduced ? tot : Math.min(tot, Math.max(base, c.prog * tot * 1.06 + 30));
    const prev = s.g;
    if (target > s.g) s.g = Math.min(target, s.g + Math.max(40, (target - s.g) * 1.8) * dt);
    if (E.reduced) s.g = target;
    s.gv += ((s.g - prev) / Math.max(dt, 1e-3) - s.gv) * Math.min(1, dt * 2);
    for (const n of s.nodes) if (n.t0 === null && s.g >= n.l) n.t0 = clk;
    for (const b of s.branches) if (b.t0 === null && s.g >= b.l) b.t0 = clk;
    // Two butterflies, always here: each perches on a leaf or bloom of the grown vine with its wings
    // slowly opening and closing, hops to another every 10 to 20 s, lifts off if a press lands near it.
    const anchors = bloomAnchors(c, s);
    if (!s.bfs.length) {
      for (let i = 0; i < 2; i++) {
        const a = pickAnchor(c, s, anchors, null, i);
        const p = a ? anchorXY(c, s, a) : [c.w * 0.5, c.h * 0.5];
        s.bfs.push({ x: p[0], y: p[1], a, mode: 'perch', timer: 4 + i * 6 + rnd(i, 3) * 5, ph: i * 2, flap: 0, rot: 0, k: TUNE.butterfly.size + i * 0.1, lift: false, ti: i });
      }
    }
    for (const b of s.bfs) {
      b.ph += dt * (b.mode === 'perch' ? 1.3 : 9);
      b.timer -= dt;
      if (b.mode === 'perch') {
        if (b.a) { const p = anchorXY(c, s, b.a); b.x = p[0]; b.y = p[1]; }
        b.rot += (0 - b.rot) * Math.min(1, dt * 3);
        if (b.timer <= 0 || b.lift) {
          const a = pickAnchor(c, s, anchors, b, b.ti);
          if (a) { b.a = a; b.mode = 'fly'; b.lift = false; }
          else b.timer = 6;
        }
      } else {
        const p = anchorXY(c, s, b.a), dx = p[0] - b.x, dy = p[1] - b.y, d = Math.hypot(dx, dy);
        const sp = Math.min(55, 18 + d * 0.5);
        if (d < 3) { b.mode = 'perch'; b.timer = 10 + rnd(clk, b.ph) * 10; b.lift = false; }
        else {
          b.x += (dx / d) * sp * dt + Math.sin(clk * 3 + b.ti) * 6 * dt;
          b.y += (dy / d) * sp * dt + Math.cos(clk * 2.4 + b.ti) * 6 * dt;
          b.rot += (clamp(dx / d * 0.35, -0.4, 0.4) - b.rot) * Math.min(1, dt * 3);
        }
      }
      b.x = clamp(b.x, BF_REACH, c.w - BF_REACH); b.y = clamp(b.y, BF_REACH, c.h - BF_REACH);
    }
  },
  draw(c, s) {
    const t = s.clk, h = c.h, y0 = c.v0, y1 = c.v1, amp = s.amp, ph = s.ph, main = s.main;
    const wind = clamp(E.sv * 0.0002, -0.1, 0.1);
    // blades and low sprouts round the root: always there
    g.beginPath();
    for (const bl of s.blades) { const x = s.rx + bl.dx, sx = Math.sin(t * 0.8 + bl.dx) * 1.5; g.moveTo(x, h - 1); g.quadraticCurveTo(x + bl.l * 0.4 + sx * 0.3, h - 1 - bl.hh * 0.6, x + bl.l + sx, h - 1 - bl.hh); }
    ink(0.6, 1.1);
    for (const sp of s.sprouts) {
      const x = s.rx + sp.dx, ex = x + sp.bend + Math.sin(t * 0.7 + sp.seed * 6) * 1.5, ey = h - 1 - sp.len;
      g.beginPath(); g.moveTo(x, h - 1); g.quadraticCurveTo(x + sp.bend * 0.2, h - 1 - sp.len * 0.6, ex, ey); ink(0.85, 1.2);
      g.save(); g.translate(ex, ey); g.rotate(-PI / 2 + (sp.bend > 0 ? 0.7 : -0.7)); leaf(sp.leaf, 1); g.restore();
    }
    // main stem
    const gl = s.g;
    ribbon(main, gl, 0.75, 0.25, t, amp, ph, 0, y0, y1);
    // side branches
    for (const b of s.branches) {
      if (b.t0 === null) continue;
      const age = t - b.t0, bp = ease(age / 5), bl = bp * b.path.total;
      const bo = sw(b.l, main, t, amp, ph);
      if (b.l < main.total && pt(main, b.l, t, amp, ph)[1] > y1 + 140) continue;
      ribbon(b.path, bl, 0.55, 0.2, t, amp * 0.8, b.ph, bo, y0, y1);
      for (const lf of b.leaves) {
        if (bl < lf.l) continue;
        const op = ease((bl - lf.l) / 30 + 0.05), p = pt(b.path, lf.l, t, amp * 0.8, b.ph, bo);
        g.save(); g.translate(p[0], p[1]); g.rotate(Math.atan2(p[3], p[2]) + lf.side * lf.ang - lf.side * (1 - op) * 0.5); leaf(lf.len, op); g.restore();
      }
      const flowerAt = (p, kind, r, open, tilt) => { g.save(); g.translate(p[0], p[1]); g.rotate(tilt); flower(kind, r, open, 0); g.restore(); };
      if (b.mid && bl >= b.mid.l) { const p = pt(b.path, b.mid.l, t, amp * 0.8, b.ph, bo); flowerAt([p[0] + 6, p[1] - 3], b.mid.kind, b.mid.r, ease((bl - b.mid.l) / 60), Math.sin(t * 0.6 + b.ph) * 0.05); }
      if (bp >= 0.999) { const p = pt(b.path, b.path.total, t, amp * 0.8, b.ph, bo); flowerAt(p, b.kind, b.r, ease((age - 5) / 3.5), Math.sin(t * 0.6 + b.ph) * 0.05); }
      for (const e of b.extra) { const p = pt(b.path, e.l, t, amp * 0.8, b.ph, bo); if (bl >= e.l) flowerAt([p[0] + 4, p[1] - 4], e.kind, e.r, ease((t - e.t0) / 3), 0); }
    }
    // leaves, tendrils and the few flowers on the main stem
    for (const n of s.nodes) {
      if (n.t0 === null) continue;
      const p = pt(main, n.l, t, amp, ph);
      if (p[1] < y0 - 90 || p[1] > y1 + 90) continue;
      const age = t - n.t0, op = ease(age / 2.2);
      const ta = Math.atan2(p[3], p[2]) + n.side * n.ang + Math.sin(t * 0.7 + n.seed) * 0.04 + wind * n.side;
      g.save(); g.translate(p[0], p[1]); g.rotate(ta - (1 - op) * n.side * 0.5);
      const sl = n.stalk * op;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(sl, 0); ink(0.85, 1.1);
      g.translate(sl, 0); leaf(n.len, op); g.restore();
      if (n.tend) {
        const tp = ease((age - 0.6) / 2.4), tta = Math.atan2(p[3], p[2]) - n.side * 1.3;
        g.save(); g.translate(p[0], p[1]);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(tta) * 12 * tp, Math.sin(tta) * 12 * tp, Math.cos(tta) * 20 * tp, Math.sin(tta) * 20 * tp); ink(0.7, 1.1);
        const cx = Math.cos(tta) * 20 * tp + Math.cos(tta + (PI / 2) * n.side) * 5, cy = Math.sin(tta) * 20 * tp + Math.sin(tta + (PI / 2) * n.side) * 5;
        spiral(cx, cy, 5, 1.5, Math.atan2(Math.sin(tta) * 20 * tp - cy, Math.cos(tta) * 20 * tp - cx), tp); ink(0.7, 1.1);
        g.restore();
      }
      if (n.fl) {
        const fa = ease((age - 0.8) / 2), open = ease((age - n.fl.delay - 1.2) / 3);
        if (fa > 0) {
          const L = n.fl.stalk * fa, ang = Math.atan2(p[3], p[2]) - n.side * 0.7;
          const ex = clamp(p[0] + Math.cos(ang) * L * 0.9 + n.side * L * 0.3, FLOWER_REACH, c.w - FLOWER_REACH), ey = Math.max(FLOWER_REACH, p[1] + Math.sin(ang) * L * 0.9 - L * 0.1);
          g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + Math.cos(ang) * L * 0.5, p[1] + Math.sin(ang) * L * 0.5, ex, ey); ink(0.85, 1.1);
          g.save(); g.translate(ex, ey); flower(n.fl.kind, n.fl.r, open, Math.sin(t * 0.6 + n.seed) * 0.05); g.restore();
        }
      }
    }
    for (const e of s.extras) {
      const p = pt(main, e.l, t, amp, ph), L = 14 * ease((t - e.t0) / 1.2);
      const ex = p[0] + e.side * L, ey = p[1] - L * 0.6;
      g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo(p[0] + e.side * L * 0.2, p[1] - L * 0.5, ex, ey); ink(0.85, 1.1);
      g.save(); g.translate(ex, ey); flower(e.kind, e.r, ease((t - e.t0 - 0.8) / 3), 0); g.restore();
    }
    // the growing tip: a small curled shoot that uncurls while it grows
    {
      const p = pt(main, gl, t, amp, ph), un = clamp(s.gv / 30, 0, 1), r = 7 - 3 * un, turns = 1.7 * (1 - un) + 0.35;
      const cx = p[0] + -p[3] * r, cy = p[1] + p[2] * r;
      spiral(cx, cy, r, turns, Math.atan2(p[1] - cy, p[0] - cx), 1); ink(0.9, 1.3);
    }
    // butterflies: their own, higher strength so they read against the fainter vine
    const keep = E.str; E.str = TUNE.butterfly.strength;
    for (let i = 0; i < s.bfs.length; i++) {
      const b = s.bfs[i];
      const flap = b.mode === 'perch' ? 0.35 + 0.65 * Math.abs(Math.cos(b.ph)) : 0.12 + 0.88 * Math.abs(Math.cos(b.ph));
      gbutterfly(b.x, b.y, b.rot, flap, b.k, i);
    }
    E.str = keep;
  },
};
