import { type Colors, type Flower, type World, TAU, rng, windAt } from './core';

export interface Blade {
  x: number;
  y: number;
  h: number;
}
export interface Flora {
  back: Blade[];
  front: Blade[];
}

export function layoutGrass(w: World): Flora {
  const r = rng(7);
  const blades = (n: number, y0: number, y1: number, h0: number, h1: number) =>
    Array.from({ length: n }, () => ({
      x: r() * (w.W + 20) - 10,
      y: y0 + r() * (y1 - y0),
      h: h0 + r() * (h1 - h0),
    }));
  return {
    back: blades(Math.round(w.W / 6), w.g0 - 14, w.g1 - 24, 26, 60),
    front: blades(Math.round(w.W / 18), w.g1 + 4, w.H - 2, 10, 24),
  };
}

const ease = (v: number) => 1 - (1 - v) * (1 - v);
const unit = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** A new flower at (x, y); `grow` 1 is full height. */
export function plant(
  x: number,
  y: number,
  kind: number,
  r: () => number,
  grow: number,
): Flower {
  return {
    x,
    y,
    h: 90 + r() * 90,
    kind,
    ph: r() * TAU,
    r: 12 + r() * 5,
    grow,
    hx: x,
    hy: y,
    lean: 0,
    pl: 0,
  };
}

/** Keeps new growth out of the bucket's way. */
const clear = (w: World, x: number) =>
  Math.abs(x - w.bucket.x) > 56 * w.bucket.s;

/** The meadow at first load: most of the flowers are grown, the rest are about to sprout. */
export function seedFlowers(w: World) {
  const r = rng(7);
  w.cap = Math.max(9, Math.round(18 * (w.W / 1000)));
  const n = Math.ceil(w.cap * 0.7);
  w.flowers = [];
  w.spots = [];
  for (let i = 0; i < n; i++) {
    let x = ((i + 0.2 + r() * 0.6) / n) * w.W;
    if (!clear(w, x)) x = w.bucket.x - 70 * w.bucket.s - r() * 30;
    w.flowers.push(plant(x, w.g0 + 14 + r() * (w.g1 - w.g0 - 20), i % 3, r, 1));
  }
  w.sprout = 1.5;
}

/** Grows what is planted, and plants new ones where one was picked or at random, up to the cap. */
export function stepFlora(w: World, dt: number) {
  const e = 1 - Math.exp(-dt * 5);
  for (const f of w.flowers) {
    if (f.grow < 1) f.grow = Math.min(1, f.grow + dt / (7 + f.ph));
    // Flowers near the pointer lean toward it, more the closer it is.
    let to = 0;
    if (w.hover && !w.held) {
      const dx = w.px - f.x;
      const dy = w.py - (f.y - f.h * 0.5);
      to =
        Math.sign(dx) *
        Math.exp(-(dx * dx) / 9000 - (dy * dy) / 40000) *
        f.h *
        Math.min(1, f.grow) *
        0.22 *
        Math.min(1, Math.abs(dx) / 24);
    }
    f.pl += (to - f.pl) * e;
  }
  for (const s of w.spots) s.t -= dt;
  w.sprout -= dt;
  if (w.flowers.length >= w.cap) {
    w.spots = w.spots.filter((s) => s.t > 0);
    return;
  }
  const due = w.spots.findIndex((s) => s.t <= 0);
  if (due >= 0 || w.sprout <= 0) {
    const r = Math.random;
    let x: number;
    let y: number;
    if (due >= 0) {
      const s = w.spots.splice(due, 1)[0] ?? { x: 0, y: 0, t: 0 };
      x = s.x + (r() - 0.5) * 36;
      y = s.y + (r() - 0.5) * 14;
    } else {
      x = 30 + r() * (w.W - 60);
      y = w.g0 + 14 + r() * (w.g1 - w.g0 - 20);
    }
    x = Math.max(16, Math.min(w.W - 16, x));
    y = Math.max(w.g0 + 10, Math.min(w.g1, y));
    if (clear(w, x)) {
      w.flowers.push(plant(x, y, Math.floor(r() * 3), r, 0));
    }
    w.sprout = 3.5 + r() * 3.5;
  }
}

const near = (
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) => {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy || 1;
  const t = unit(((px - ax) * dx + (py - ay) * dy) / l);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};

/** The grown flower under a press: on its head or close to its stem. */
export function flowerAt(w: World, x: number, y: number): Flower | null {
  let best: Flower | null = null;
  let bd = 1e9;
  for (const f of w.flowers) {
    if (f.grow < 0.6) continue;
    const dh = Math.hypot(x - f.hx, y - f.hy) - f.r * 1.2 - 6;
    const ds = near(x, y, f.x, f.y, f.hx, f.hy) - 9;
    const d = Math.min(dh, ds);
    if (d < 0 && d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

function blades(
  c: CanvasRenderingContext2D,
  w: World,
  list: Blade[],
  k: number,
) {
  c.beginPath();
  for (const b of list) {
    const lean = windAt(w, b.x, b.y - b.h / 2) * b.h * k;
    c.moveTo(b.x, b.y);
    c.quadraticCurveTo(
      b.x + lean * 0.25,
      b.y - b.h * 0.6,
      b.x + lean,
      b.y - b.h * (1 - Math.min(0.35, Math.abs(lean) / b.h / 2)),
    );
  }
  c.stroke();
}

export function drawGrass(
  c: CanvasRenderingContext2D,
  w: World,
  f: Flora,
  front: boolean,
  col: Colors,
) {
  c.strokeStyle = col.stroke;
  c.lineCap = 'round';
  c.globalAlpha = front ? 1 : 0.55;
  c.lineWidth = front ? 1.5 : 1;
  blades(c, w, front ? f.front : f.back, front ? 0.5 : 0.42);
  c.globalAlpha = 1;
}

function petal(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  len: number,
  wd: number,
) {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const p = (u: number, v: number): [number, number] => [
    x + ux * u - uy * v,
    y + uy * u + ux * v,
  ];
  c.moveTo(x, y);
  c.bezierCurveTo(
    ...p(len * 0.3, -wd),
    ...p(len * 0.9, -wd * 0.8),
    ...p(len, 0),
  );
  c.bezierCurveTo(...p(len * 0.9, wd * 0.8), ...p(len * 0.3, wd), x, y);
}

/** Closed bud, or an open head whose petals unfold with `open` 0..1. */
function head(
  c: CanvasRenderingContext2D,
  col: Colors,
  kind: number,
  r: number,
  x: number,
  y: number,
  tilt: number,
  open: number,
) {
  if (open < 0.12) {
    c.beginPath();
    c.ellipse(x, y - r * 0.25, r * 0.3, r * 0.5, tilt, 0, TAU);
    c.fill();
    c.stroke();
    return;
  }
  const k = 0.3 + 0.7 * ease(open);
  c.beginPath();
  if (kind === 0) {
    for (let i = 0; i < 12; i++)
      petal(c, x, y, tilt + (i / 12) * TAU, r * 1.15 * k, r * 0.2 * k);
  } else if (kind === 1) {
    for (const d of [-0.5, 0.5, 0])
      petal(
        c,
        x,
        y + r * 0.5,
        tilt - Math.PI / 2 + d * k,
        r * 1.6 * k,
        r * 0.55 * k,
      );
  } else {
    for (let i = 0; i < 5; i++)
      petal(c, x, y, tilt + (i / 5) * TAU, r * 1.05 * k, r * 0.62 * k);
  }
  c.fill();
  c.stroke();
  if (kind !== 1) {
    c.beginPath();
    c.arc(x, y, (kind === 0 ? r * 0.3 : r * 0.22) * k, 0, TAU);
    c.fillStyle = col.stroke;
    c.fill();
    c.fillStyle = col.page;
  }
}

export interface Look {
  kind: number;
  r: number;
}

/** Stem, leaf and head from a foot (bx, by) to a head (hx, hy). `grow` runs the sprout: stem, leaf, bud, bloom. */
export function drawBloom(
  c: CanvasRenderingContext2D,
  col: Colors,
  f: Look,
  bx: number,
  by: number,
  hx: number,
  hy: number,
  grow = 1,
) {
  const mx = bx + (hx - bx) * 0.15;
  const my = by + (hy - by) * 0.55;
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(bx, by);
  c.quadraticCurveTo(mx, my, hx, hy);
  const lt = unit((grow - 0.25) / 0.35);
  if (lt > 0) {
    // One leaf, unfolding from the lower stem.
    const s = f.kind === 1 ? -1 : 1;
    const t = 0.28;
    const px = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * mx + t * t * hx;
    const py = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * my + t * t * hy;
    const len = Math.min(20, Math.abs(by - hy) * 0.22);
    c.moveTo(px, py);
    c.quadraticCurveTo(
      px + s * 0.7 * len * lt,
      py - 0.45 * len * lt - 3 * (1 - lt),
      px + s * len * lt,
      py - 0.3 * len * lt + 6 * (1 - lt),
    );
  }
  c.stroke();
  const tilt = Math.atan2(hx - bx, by - hy) * 0.6;
  head(c, col, f.kind, f.r, hx, hy, tilt, unit((grow - 0.55) / 0.4));
}

export function drawFlowers(
  c: CanvasRenderingContext2D,
  w: World,
  col: Colors,
) {
  for (const f of w.flowers) {
    const g = ease(unit(f.grow / 0.6));
    const h = f.h * g;
    f.lean = windAt(w, f.x, f.y - h * 0.6) * h * 0.3 + f.pl;
    f.hx = f.x + f.lean;
    f.hy =
      f.y - h + Math.sin(w.t * 1.5 + f.ph) * 2 * g + Math.abs(f.lean) * 0.1;
    drawBloom(c, col, f, f.x, f.y, f.hx, f.hy, f.grow);
  }
}
