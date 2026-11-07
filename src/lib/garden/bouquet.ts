import {
  type Bloom,
  type Bouquet,
  type Colors,
  type Vase,
  type World,
  TAU,
  clamp,
} from './core';
import { drawBloom } from './flora';
import { mouthY, offset } from './core';

const ease = (v: number) => v * v * (3 - 2 * v);
const unit = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Most bouquets the garden, the vase and the ones dropped to the bottom of the screen hold between them. */
export const MAX_BOUQUETS = 3;
/** Wrapping paper shows with this many flowers in the bucket. */
export const WRAP_AT = 3;
/** Resting lean of a bouquet on the grass. */
const LIE = -0.95;
/** Seconds the wrap takes: lift, fold, tie. */
const WRAP_S = 1.15;

export const placeVase = (w: World) => {
  const v = w.vase;
  v.s = w.bucket.s;
  v.x = w.W < 600 ? 58 : 128;
  v.y = w.g1 - 2;
  if (v.bq) seat(w, v.bq, true);
};

/** Sets a bouquet standing in the vase: it eases there from where it was dropped, or snaps. */
const seat = (w: World, q: Bouquet, snap = false) => {
  q.mode = 'vase';
  q.ts = 0.8 * w.vase.s;
  q.tx = w.vase.x;
  q.ty = w.vase.y - 24 * w.vase.s;
  q.trot = 0;
  if (snap) {
    q.s = q.ts;
    q.x = q.tx;
    q.y = q.ty;
    q.rot = 0;
  }
};

/** Where the wrapped bouquet and the paper rest, left of the bucket. */
export const spot = (w: World): [number, number] => [
  w.bucket.x - 82 * w.bucket.s,
  w.bucket.y + 4,
];

/** Lays a bouquet on the grass at (x, y). */
export function lay(w: World, q: Bouquet, x: number, y: number) {
  q.mode = 'lie';
  q.x = x;
  q.y = y;
  q.ts = 0.8 * w.bucket.s;
  q.tx = clamp(x, 70, w.W - 30);
  q.ty = clamp(y, w.g0 + 14, w.g1 + 6);
  q.trot = x < w.W / 2 ? -LIE : LIE;
}

export const laid = (w: World) => w.bqs.filter((q) => q.mode === 'lie');

/** Takes a bouquet out of the garden (vase or ground), for carrying or dropping. */
export function lift(w: World, q: Bouquet) {
  w.bqs = w.bqs.filter((o) => o !== q);
  if (w.vase.bq === q) w.vase.bq = null;
}

/** Stands a bouquet in the vase; one already there is laid beside it. */
export function toVase(w: World, q: Bouquet) {
  if (w.vase.gone) return;
  const old = w.vase.bq;
  if (old && old !== q) lay(w, old, w.vase.x + 78 * w.vase.s, w.vase.y + 6);
  if (!w.bqs.includes(q)) w.bqs.push(q);
  w.vase.bq = q;
  seat(w, q);
}

export const newBouquet = (items: Bloom[], s: number): Bouquet => ({
  items,
  mode: 'lie',
  x: 0,
  y: 0,
  rot: 0,
  s,
  ts: s,
  tx: 0,
  ty: 0,
  trot: 0,
  k: 1,
  lift: 1,
  wrap: 1,
  tie: 1,
});

/** Starts the wrap: the bucket's flowers become one bouquet, rising out for the paper to fold round. */
export function startWrap(w: World, still: boolean): Bouquet | null {
  const b = w.bucket;
  if (b.items.length < WRAP_AT || w.bqs.some((q) => q.mode === 'wrap'))
    return null;
  const q = newBouquet(b.items, b.s);
  q.mode = 'wrap';
  q.x = b.x;
  q.y = b.y - 28 * b.s;
  q.k = q.lift = q.wrap = q.tie = 0;
  b.items = [];
  b.count = 0;
  w.flying = [];
  w.paper = null;
  w.bqs.push(q);
  if (still) finish(w, q, true);
  return q;
}

function finish(w: World, q: Bouquet, snap = false) {
  const [x, y] = spot(w);
  lay(w, q, x, y);
  q.k = 1;
  q.lift = q.wrap = q.tie = 1;
  if (snap) {
    q.x = q.tx;
    q.y = q.ty;
    q.rot = q.trot;
    q.s = q.ts;
  }
}

/** Paper appears with enough flowers in the bucket; bouquets animate toward where they rest. */
export function stepBouquets(w: World, dt: number, still = false) {
  const b = w.bucket;
  const wrapping = w.bqs.some((q) => q.mode === 'wrap');
  const [hx, hy] = spot(w);
  const want = b.items.length >= WRAP_AT && !wrapping && !w.flying.length;
  if (want && !w.paper)
    w.paper = { x: hx, y: hy, hx, hy, t: still ? 1 : 0, drag: false };
  if (!want && w.paper && !w.paper.drag) w.paper = null;
  const p = w.paper;
  if (p) {
    p.hx = hx;
    p.hy = hy;
    p.t = still ? 1 : Math.min(1, p.t + dt * 4);
    if (!p.drag) {
      const k = still ? 1 : 1 - Math.exp(-dt * 10);
      p.x += (p.hx - p.x) * k;
      p.y += (p.hy - p.y) * k;
    }
  }
  for (const q of w.bqs) {
    if (q.mode === 'wrap') {
      q.k += dt / WRAP_S;
      q.lift = ease(unit(q.k / 0.28));
      q.wrap = ease(unit((q.k - 0.22) / 0.4));
      q.tie = unit((q.k - 0.72) / 0.22);
      if (q.k >= 1) finish(w, q);
      continue;
    }
    const k = still ? 1 : 1 - Math.exp(-dt * 8);
    q.x += (q.tx - q.x) * k;
    q.y += (q.ty - q.y) * k;
    q.rot += (q.trot - q.rot) * k;
    q.s += (q.ts - q.s) * k;
    const wantWrap = q.mode === 'vase' ? 0 : 1;
    q.wrap += (wantWrap - q.wrap) * k;
    q.tie += (wantWrap - q.tie) * k;
  }
}

/** Flowers, then paper, then the ribbon, in the bouquet's own frame (foot at the origin, up is -y). */
export function drawBouquet(
  c: CanvasRenderingContext2D,
  col: Colors,
  q: Bouquet,
  x: number,
  y: number,
  rot: number,
  s: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(s, s);
  // Stems gather as the paper closes round them.
  const gather = 1 - 0.3 * q.wrap;
  let minY = 1e9;
  let maxSin = 0;
  q.items.forEach((it: Bloom, i) => {
    const a = it.ang * gather;
    const hx = Math.sin(a) * it.len;
    const hy = -mouthY * 0.4 - Math.cos(a) * it.len;
    drawBloom(c, col, it.cut, offset(i) * 2.4, 0, hx, hy, 1);
    minY = Math.min(minY, -hy);
    maxSin = Math.max(maxSin, Math.abs(Math.sin(a)));
  });
  const e = clamp(q.wrap, 0, 1);
  const ph = clamp(minY * 0.62, 20, 50) * e;
  if (ph > 2) {
    const hw = Math.max(12, maxSin * ph + 9) * lerp(1.5, 1, e);
    c.lineWidth = 1.5;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.fillStyle = col.page;
    c.strokeStyle = col.stroke;
    c.beginPath();
    c.moveTo(0, 4);
    c.quadraticCurveTo(-hw * 0.4, -ph * 0.4, -hw, -ph);
    c.quadraticCurveTo(0, -ph + 8, hw, -ph);
    c.quadraticCurveTo(hw * 0.4, -ph * 0.4, 0, 4);
    c.closePath();
    c.fill();
    c.stroke();
    // Back lip, a crease and a turned-down corner.
    c.beginPath();
    c.moveTo(-hw, -ph);
    c.quadraticCurveTo(0, -ph - 7, hw, -ph);
    c.moveTo(0, 4);
    c.lineTo(hw * 0.32, -ph + 5);
    c.moveTo(-hw * 0.55, -ph + 3);
    c.lineTo(-hw * 0.2, -ph + 12);
    c.stroke();
    if (q.tie > 0) {
      // Ribbon: a band round the paper and a bow that draws in.
      const ty = -ph * 0.42;
      const bw = hw * 0.42 * q.tie;
      const l = 8 * q.tie;
      c.beginPath();
      c.moveTo(-bw, ty);
      c.lineTo(bw, ty);
      c.moveTo(0, ty);
      c.bezierCurveTo(-l * 1.5, ty - l, -l * 1.6, ty + l * 0.4, 0, ty);
      c.moveTo(0, ty);
      c.bezierCurveTo(l * 1.5, ty - l, l * 1.6, ty + l * 0.4, 0, ty);
      c.moveTo(0, ty);
      c.lineTo(-l * 0.6, ty + l * 1.6);
      c.moveTo(0, ty);
      c.lineTo(l * 0.7, ty + l * 1.5);
      c.stroke();
    }
  }
  c.restore();
}

export function drawPaper(c: CanvasRenderingContext2D, col: Colors, w: World) {
  const p = w.paper;
  if (!p) return;
  const k = ease(p.t);
  const lift = p.drag ? 7 : 0;
  c.save();
  c.translate(p.x, p.y);
  c.scale(k * 1.4, k * 1.4);
  c.strokeStyle = col.stroke;
  c.fillStyle = col.stroke;
  c.lineWidth = 1.5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.globalAlpha = 0.14;
  c.beginPath();
  c.ellipse(2, 2, 30, 5.5, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
  c.translate(0, -lift);
  c.fillStyle = col.page;
  // A sheet lying askew, one corner turned up, a fold across it and a hint of a pattern.
  c.beginPath();
  c.moveTo(-28, -3);
  c.lineTo(14, -13);
  c.lineTo(30, 3);
  c.lineTo(-12, 12);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(14, -13);
  c.lineTo(15, -2);
  c.lineTo(30, 3);
  c.moveTo(-6, -8);
  c.lineTo(8, 8);
  c.stroke();
  c.globalAlpha = 0.5;
  c.beginPath();
  for (const [dx, dy] of [
    [-16, 0],
    [-4, 2],
    [2, -6],
    [16, 0],
  ] as const) {
    c.moveTo(dx - 1.5, dy);
    c.lineTo(dx + 1.5, dy);
    c.moveTo(dx, dy - 1.5);
    c.lineTo(dx, dy + 1.5);
  }
  c.stroke();
  c.restore();
}

/** The vase, with a bouquet standing in it when there is one. Drawn as one depth-sorted item. */
export function drawVase(c: CanvasRenderingContext2D, v: Vase, col: Colors) {
  const { x, y, s, bq } = v;
  const top = y - 56 * s;
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.lineWidth = 1.5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.globalAlpha = 0.14;
  c.fillStyle = col.stroke;
  c.beginPath();
  c.ellipse(x + 2, y + 1, 22 * s, 4 * s, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
  c.fillStyle = col.page;
  c.beginPath();
  c.ellipse(x, top, 12 * s, 3 * s, 0, Math.PI, TAU);
  c.stroke();
  if (bq) drawBouquet(c, col, bq, bq.x, bq.y, bq.rot, bq.s);
  c.beginPath();
  c.moveTo(x - 12 * s, top);
  c.bezierCurveTo(
    x - 7 * s,
    top + 8 * s,
    x - 7 * s,
    top + 14 * s,
    x - 14 * s,
    y - 34 * s,
  );
  c.bezierCurveTo(
    x - 26 * s,
    y - 20 * s,
    x - 18 * s,
    y - 2 * s,
    x - 11 * s,
    y - 1 * s,
  );
  c.quadraticCurveTo(x, y + 3 * s, x + 11 * s, y - 1 * s);
  c.bezierCurveTo(
    x + 18 * s,
    y - 2 * s,
    x + 26 * s,
    y - 20 * s,
    x + 14 * s,
    y - 34 * s,
  );
  c.bezierCurveTo(
    x + 7 * s,
    top + 14 * s,
    x + 7 * s,
    top + 8 * s,
    x + 12 * s,
    top,
  );
  c.ellipse(x, top, 12 * s, 3 * s, 0, 0, Math.PI);
  c.closePath();
  c.fill();
  c.stroke();
  // A band and a few drawn leaves.
  c.beginPath();
  c.ellipse(x, y - 24 * s, 21 * s, 4.5 * s, 0, 0.15, Math.PI - 0.15);
  c.moveTo(x - 4 * s, y - 14 * s);
  c.quadraticCurveTo(x, y - 20 * s, x + 4 * s, y - 14 * s);
  c.stroke();
}

/** True when (px, py) is on the bouquet: near the line from its foot up through the heads. */
export function onBouquet(q: Bouquet, px: number, py: number): boolean {
  const L = 78 * q.s;
  const ex = q.x + Math.sin(q.rot) * L;
  const ey = q.y - Math.cos(q.rot) * L;
  const dx = ex - q.x;
  const dy = ey - q.y;
  const t = clamp(
    ((px - q.x) * dx + (py - q.y) * dy) / (dx * dx + dy * dy),
    0,
    1,
  );
  return Math.hypot(px - (q.x + dx * t), py - (q.y + dy * t)) < 24 * q.s + 10;
}

export const onPaper = (w: World, px: number, py: number) =>
  !!w.paper &&
  w.paper.t > 0.5 &&
  Math.abs(px - w.paper.x) < 46 &&
  Math.abs(py - w.paper.y) < 28;

/** True when (px, py) is on the vase's body, below its rim. */
export const onVase = (w: World, px: number, py: number) => {
  const { x, y, s, gone } = w.vase;
  return !gone && Math.abs(px - x) < 26 * s && py > y - 56 * s && py < y + 6;
};

/** Drops a bouquet near the vase: its mouth, or the bouquet standing in it. */
export const nearVase = (w: World, px: number, py: number) =>
  !w.vase.gone &&
  Math.hypot(px - w.vase.x, py - (w.vase.y - 40 * w.vase.s)) < 92;
