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

export function grow(w: World): Flora {
  const r = rng(7);
  const blades = (n: number, y0: number, y1: number, h0: number, h1: number) =>
    Array.from({ length: n }, () => ({
      x: r() * (w.W + 20) - 10,
      y: y0 + r() * (y1 - y0),
      h: h0 + r() * (h1 - h0),
    }));
  const area = w.W / 1000;
  w.flowers = Array.from(
    { length: Math.max(5, Math.round(16 * area)) },
    (_, i) => {
      const h = 90 + r() * 100;
      return {
        x: ((i + 0.2 + r() * 0.6) / Math.max(5, Math.round(16 * area))) * w.W,
        y: w.g0 + 14 + r() * (w.g1 - w.g0 - 20),
        h,
        kind: i % 3,
        ph: r() * TAU,
        r: 12 + r() * 5,
        hx: 0,
        hy: 0,
        lean: 0,
      } satisfies Flower;
    },
  );
  return {
    back: blades(Math.round(w.W / 6), w.g0 - 14, w.g1 - 24, 26, 60),
    front: blades(Math.round(w.W / 18), w.g1 + 4, w.H - 2, 10, 24),
  };
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

export function drawFlowers(
  c: CanvasRenderingContext2D,
  w: World,
  col: Colors,
) {
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  for (const f of w.flowers) {
    f.lean = windAt(w, f.x, f.y - f.h * 0.6) * f.h * 0.3;
    f.hx = f.x + f.lean;
    f.hy = f.y - f.h + Math.sin(w.t * 1.5 + f.ph) * 2 + Math.abs(f.lean) * 0.1;
    const mx = f.x + f.lean * 0.15;
    const my = f.y - f.h * 0.55;
    c.beginPath();
    c.moveTo(f.x, f.y);
    c.quadraticCurveTo(mx, my, f.hx, f.hy);
    // One leaf, on the lower stem.
    const s = f.kind === 1 ? -1 : 1;
    c.moveTo(f.x + f.lean * 0.05, f.y - f.h * 0.28);
    c.quadraticCurveTo(
      f.x + s * 14 + f.lean * 0.1,
      f.y - f.h * 0.4,
      f.x + s * 20 + f.lean * 0.12,
      f.y - f.h * 0.36,
    );
    c.stroke();
    // Head.
    const tilt = f.lean / f.h;
    const r = f.r;
    c.beginPath();
    if (f.kind === 0) {
      for (let i = 0; i < 12; i++)
        petal(c, f.hx, f.hy, tilt + (i / 12) * TAU, r * 1.15, r * 0.2);
    } else if (f.kind === 1) {
      for (const d of [-0.5, 0.5, 0])
        petal(
          c,
          f.hx,
          f.hy + r * 0.5,
          tilt - Math.PI / 2 + d,
          r * 1.6,
          r * 0.55,
        );
    } else {
      for (let i = 0; i < 5; i++)
        petal(c, f.hx, f.hy, tilt + (i / 5) * TAU, r * 1.05, r * 0.62);
    }
    c.fill();
    c.stroke();
    if (f.kind !== 1) {
      c.beginPath();
      c.arc(f.hx, f.hy, f.kind === 0 ? r * 0.3 : r * 0.22, 0, TAU);
      c.fillStyle = col.stroke;
      c.fill();
      c.fillStyle = col.page;
    }
  }
}
