import {
  type Colors,
  type Cut,
  type Flower,
  type Flying,
  type Held,
  type World,
  TAU,
  clamp,
  mouthY,
  offset,
} from './core';
import { drawBouquet } from './bouquet';
import { drawBloom } from './flora';

const MAX = 14;

/** Where bloom number `i` of `n` points: angle off vertical and stem length past the rim. */
function slot(i: number, n: number): [number, number] {
  const step = clamp(0.34 - 0.014 * n, 0.15, 0.3);
  const o = offset(i);
  const ang = clamp(o * step, -1.05, 1.05);
  const len = 50 + Math.min(n, 12) * 1.6 + ((i * 7) % 3) * 8 - Math.abs(o) * 2;
  return [ang, len];
}

const stemFoot = (w: World, i: number): [number, number] => [
  w.bucket.x + offset(i) * 2.4 * w.bucket.s,
  w.bucket.y - 28 * w.bucket.s,
];

const headOf = (w: World, ang: number, len: number): [number, number] => {
  const b = w.bucket;
  return [
    b.x + Math.sin(ang) * len * b.s,
    b.y - mouthY * b.s - Math.cos(ang) * len * b.s,
  ];
};

export const placeBucket = (w: World) => {
  const b = w.bucket;
  b.s = w.W < 600 ? 0.85 : 1.1;
  b.x = w.W - (w.W < 600 ? 50 : 96);
  b.y = w.g1 - 2;
};

const cutOf = (f: Flower): Cut => ({ kind: f.kind, r: f.r, h: f.h, ph: f.ph });

/** Cuts a flower from the meadow. Returns the cut head position for the caller to animate. */
export function pick(w: World, f: Flower) {
  w.flowers = w.flowers.filter((o) => o !== f);
  w.spots.push({ x: f.x, y: f.y, t: 5 + Math.random() * 5 });
  if (w.held?.f === f) w.held = null;
}

/** Sends a cut flower to the bucket: a short flight, or straight in when `instant`. */
export function toBucket(
  w: World,
  f: Flower,
  from: { bx: number; by: number; hx: number; hy: number },
  instant: boolean,
) {
  const n = Math.min(MAX - 1, w.bucket.items.length + w.flying.length);
  const [ang, len] = slot(n, n + 1);
  const [fx, fy] = stemFoot(w, n);
  const [hx, hy] = headOf(w, ang, len);
  const cut = cutOf(f);
  if (instant) {
    land(w, cut, ang, len);
    return;
  }
  const d = Math.hypot(hx - from.hx, hy - from.hy);
  const fl: Flying = {
    cut,
    a: [from.bx, from.by, from.hx, from.hy],
    b: [fx, fy, hx, hy],
    t: 0,
    dur: 0.35 + d / 2600,
  };
  w.flying.push(fl);
}

function land(w: World, cut: Cut, ang: number, len: number) {
  const b = w.bucket;
  b.items.push({ cut, ang, len });
  if (b.items.length > MAX) b.items.shift();
  b.count++;
}

/** Fresh bouquet. */
export function empty(w: World) {
  w.bucket.items = [];
  w.bucket.count = 0;
  w.flying = [];
}

/** Moves flying flowers in and settles the fan toward its slots. */
export function stepBucket(w: World, dt: number, still = false) {
  const b = w.bucket;
  for (const fl of w.flying) fl.t += dt / fl.dur;
  for (const fl of w.flying.filter((x) => x.t >= 1)) {
    const n = b.items.length;
    const [ang, len] = slot(Math.min(n, MAX - 1), Math.min(n + 1, MAX));
    land(w, fl.cut, ang, len);
  }
  w.flying = w.flying.filter((x) => x.t < 1);
  const k = still ? 1 : 1 - Math.exp(-dt * 9);
  b.items.forEach((it, i) => {
    const [ang, len] = slot(i, b.items.length);
    it.ang += (ang - it.ang) * k;
    it.len += (len - it.len) * k;
  });
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The flower the pointer carries: foot at the pointer, head swung by pointer speed. */
export function drawHeld(c: CanvasRenderingContext2D, col: Colors, h: Held) {
  const L = Math.min(h.f.h, 110) * 0.9;
  const hx = h.bx + Math.sin(h.sw) * L;
  const hy = h.by - Math.cos(h.sw) * L;
  drawBloom(c, col, h.f, h.bx, h.by, hx, hy, 1);
  h.f.hx = hx;
  h.f.hy = hy;
}

export function drawFlying(
  c: CanvasRenderingContext2D,
  col: Colors,
  fl: Flying,
) {
  const t = fl.t < 0 ? 0 : fl.t > 1 ? 1 : fl.t;
  const e = t * t * (3 - 2 * t);
  const arc = Math.sin(Math.PI * t) * 40;
  drawBloom(
    c,
    col,
    fl.cut,
    lerp(fl.a[0], fl.b[0], e),
    lerp(fl.a[1], fl.b[1], e) - arc * 0.5,
    lerp(fl.a[2], fl.b[2], e),
    lerp(fl.a[3], fl.b[3], e) - arc,
    1,
  );
}

/** The line-art bucket with the bouquet standing in it. Drawn as one depth-sorted item. */
export function drawBucket(c: CanvasRenderingContext2D, w: World, col: Colors) {
  const { x, y, s } = w.bucket;
  const top = y - mouthY * s;
  const rx = 28 * s;
  const ry = 6 * s;
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // Shadow.
  c.globalAlpha = 0.14;
  c.fillStyle = col.stroke;
  c.beginPath();
  c.ellipse(x + 2, y + 1, 30 * s, 4.5 * s, 0, 0, TAU);
  c.fill();
  c.globalAlpha = 1;
  c.fillStyle = col.page;
  // Back rim, then the flowers, then the front of the pail over their stems.
  c.beginPath();
  c.ellipse(x, top, rx, ry, 0, Math.PI, TAU);
  c.stroke();
  w.bucket.items.forEach((it, i) => {
    const [fx, fy] = stemFoot(w, i);
    const [hx, hy] = headOf(w, it.ang, it.len);
    drawBloom(c, col, it.cut, fx, fy, hx, hy, 1);
  });
  // The bunch being wrapped rises out of the pail, still behind its front.
  for (const q of w.bqs)
    if (q.mode === 'wrap')
      drawBouquet(c, col, q, q.x, q.y - q.lift * 34 * q.s, 0, q.s);
  c.beginPath();
  c.moveTo(x - rx, top);
  c.lineTo(x - 21 * s, y - 2 * s);
  c.quadraticCurveTo(x, y + 4 * s, x + 21 * s, y - 2 * s);
  c.lineTo(x + rx, top);
  c.ellipse(x, top, rx, ry, 0, 0, Math.PI);
  c.closePath();
  c.fill();
  c.stroke();
  // Two bands.
  for (const k of [0.38, 0.72]) {
    const yy = top + (y - top) * k;
    const hw = lerp(rx, 21 * s, k);
    c.beginPath();
    c.ellipse(x, yy, hw, ry * 0.85, 0, 0.12, Math.PI - 0.12);
    c.stroke();
  }
  // Handle on the far side.
  c.beginPath();
  c.moveTo(x + rx, top + 3 * s);
  c.quadraticCurveTo(
    x + rx + 14 * s,
    top + 3 * s,
    x + rx + 11 * s,
    top + 18 * s,
  );
  c.stroke();
}
