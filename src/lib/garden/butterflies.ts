import { type Colors, type World, TAU, clamp } from './core';

export interface Butterfly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  /** 0 flying, 1 landed. */
  land: number;
  fl: number;
  timer: number;
  ph: number;
  k: number;
  noLand: number;
}

/**
 * How far a drawn butterfly reaches from its centre, in units of its own size `k`: a wing is up to
 * 17 wide at full flap and 15 high, the antennae 11 up, the lower wing 11 down; a tilt of up to
 * 0.5 rad adds a little. A pixel or two keeps the outline off the edge.
 */
const REACH_X = 17;
const REACH_UP = 16;
const REACH_DOWN = 12;
const PAD = 3;

/** Moves a butterfly inside the canvas, whole wings included (a landed one too, on a flower near the edge). */
export function keepButterflyIn(w: World, b: Butterfly) {
  const mx = REACH_X * b.k + PAD;
  b.x = clamp(b.x, mx, w.W - mx);
  b.y = clamp(b.y, REACH_UP * b.k + PAD, w.H - REACH_DOWN * b.k - PAD);
}

export function spawn(w: World, n: number, r: () => number): Butterfly[] {
  return Array.from({ length: n }, (_, i) => ({
    x: ((i + 0.5) / n) * w.W,
    y: 50 + r() * (w.g0 - 60),
    vx: 0,
    vy: 0,
    tx: r() * w.W,
    ty: 40 + r() * w.g0,
    land: 0,
    fl: -1,
    timer: r() * 3,
    ph: r() * TAU,
    k: 1.4 + r() * 0.5,
    noLand: 0,
  }));
}

/** Park every butterfly on a flower: the single still frame. */
export function perch(w: World, list: Butterfly[]) {
  list.forEach((b, i) => {
    const fi = (i * 3 + 1) % w.flowers.length;
    const f = w.flowers[fi];
    if (!f) return;
    b.land = i % 2 ? 0 : 1;
    b.fl = b.land ? fi : -1;
    b.x = b.land ? f.hx : f.hx + 40 + i * 20;
    b.y = b.land ? f.hy - 3 : f.hy - 50 - i * 10;
    keepButterflyIn(w, b);
  });
}

export function stepButterflies(w: World, list: Butterfly[], dt: number) {
  for (const b of list) {
    b.ph += dt * (b.land ? 2.2 : 24);
    b.noLand -= dt;
    const dx = b.x - w.px;
    const dy = b.y - w.py;
    const d = Math.hypot(dx, dy);
    const scared = w.hover && d < 110;
    if (scared) {
      b.land = 0;
      b.fl = -1;
      b.noLand = 1.5;
      const f = (1 - d / 110) * 900 * dt;
      b.vx += (dx / (d || 1)) * f;
      b.vy += (dy / (d || 1)) * f;
      b.tx = clamp(b.x + dx * 2, REACH_X * b.k, w.W - REACH_X * b.k);
      b.ty = clamp(b.y + dy * 2, REACH_UP * b.k + 10, w.g1 - 30);
    }
    if (b.land) {
      const f = w.flowers[b.fl];
      if (!f) {
        b.land = 0;
        continue;
      }
      b.x = f.hx;
      b.y = f.hy - 3;
      keepButterflyIn(w, b);
      b.timer -= dt;
      if (b.timer <= 0) {
        b.land = 0;
        b.fl = -1;
        b.noLand = 2;
        b.timer = 1;
        b.vy = -40;
      }
      continue;
    }
    b.timer -= dt;
    const f = (b.fl >= 0 && w.flowers[b.fl]) || null;
    if (f) {
      b.tx = f.hx;
      b.ty = f.hy - 3;
      if (Math.hypot(b.x - b.tx, b.y - b.ty) < 7) {
        b.land = 1;
        b.timer = 2 + Math.random() * 3;
        b.vx = b.vy = 0;
        continue;
      }
    } else if (b.timer <= 0 || Math.hypot(b.x - b.tx, b.y - b.ty) < 20) {
      b.timer = 1.5 + Math.random() * 2.5;
      const mx = REACH_X * b.k + PAD;
      let pick = -1;
      if (b.noLand <= 0 && Math.random() < 0.45) {
        for (let k = 0; k < 5 && pick < 0; k++) {
          const i = Math.floor(Math.random() * w.flowers.length);
          const fp = w.flowers[i];
          // A flower too near the edge to land on whole is not a choice.
          if (
            fp &&
            fp.hx > mx &&
            fp.hx < w.W - mx &&
            !list.some((o) => o !== b && o.fl === i)
          )
            pick = i;
        }
      }
      if (pick >= 0) b.fl = pick;
      else {
        b.tx = mx + Math.random() * (w.W - 2 * mx);
        b.ty = REACH_UP * b.k + PAD + Math.random() * (w.g1 - 60);
      }
    }
    const ax = b.tx - b.x;
    const ay = b.ty - b.y;
    const al = Math.hypot(ax, ay) || 1;
    const near = f ? clamp(al / 40, 0.25, 1) : 1;
    b.vx +=
      (ax / al) * 140 * dt * near + Math.cos(b.ph * 0.3 + b.k * 9) * 90 * dt;
    b.vy += (ay / al) * 140 * dt * near + Math.sin(b.ph * 0.37) * 120 * dt;
    b.vx *= Math.exp(-dt * 1.4);
    b.vy *= Math.exp(-dt * 1.4);
    const sp = Math.hypot(b.vx, b.vy);
    const max = scared ? 240 : 70 * near + 10;
    if (sp > max) {
      b.vx *= max / sp;
      b.vy *= max / sp;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    keepButterflyIn(w, b);
    b.y = Math.min(b.y, w.g1);
  }
}

export function drawButterfly(
  c: CanvasRenderingContext2D,
  b: Butterfly,
  col: Colors,
  idx: number,
) {
  const flap = b.land
    ? 0.35 + 0.65 * Math.abs(Math.cos(b.ph))
    : 0.12 + 0.88 * Math.abs(Math.cos(b.ph));
  const k = b.k;
  c.save();
  c.translate(b.x, b.y);
  c.rotate(clamp(b.vx * 0.004, -0.5, 0.5));
  c.lineWidth = 1.25;
  c.lineJoin = 'round';
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  for (const s of [-1, 1]) {
    const sx = s * flap * k;
    c.beginPath();
    c.moveTo(0, -2 * k);
    c.bezierCurveTo(sx * 4, -15 * k, sx * 17, -15 * k, sx * 13, -3 * k);
    c.bezierCurveTo(sx * 9, 0, sx * 3, 0, 0, -1);
    c.moveTo(0, 0);
    c.bezierCurveTo(sx * 11, 0, sx * 11, 11 * k, sx * 5, 9 * k);
    c.bezierCurveTo(sx * 2, 7 * k, 0, 3, 0, 0);
    c.fill();
    c.stroke();
    if (idx % 2 === 0 && flap > 0.3) {
      c.beginPath();
      c.arc(sx * 9, -8 * k, 1.6 * k, 0, TAU);
      c.stroke();
    }
  }
  c.lineWidth = 1.8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -6 * k);
  c.lineTo(0, 8 * k);
  c.lineWidth = 1;
  c.moveTo(0, -6 * k);
  c.lineTo(-3, -11 * k);
  c.moveTo(0, -6 * k);
  c.lineTo(3, -11 * k);
  c.stroke();
  c.restore();
}
