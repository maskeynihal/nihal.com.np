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
      b.tx = clamp(b.x + dx * 2, 20, w.W - 20);
      b.ty = clamp(b.y + dy * 2, 30, w.g1 - 30);
    }
    if (b.land) {
      const f = w.flowers[b.fl];
      if (!f) {
        b.land = 0;
        continue;
      }
      b.x = f.hx;
      b.y = f.hy - 3;
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
      if (b.noLand <= 0 && Math.random() < 0.45) {
        let pick = 0;
        for (let k = 0; k < 5; k++) {
          pick = Math.floor(Math.random() * w.flowers.length);
          if (!list.some((o) => o !== b && o.fl === pick)) break;
        }
        b.fl = pick;
      } else {
        b.tx = 30 + Math.random() * (w.W - 60);
        b.ty = 30 + Math.random() * (w.g1 - 60);
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
    b.x = clamp(b.x, 6, w.W - 6);
    b.y = clamp(b.y, 8, w.g1);
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
