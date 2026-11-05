import { type Ball, type Colors, type World, clamp, rng } from './core';
import {
  type Butterfly,
  drawButterfly,
  perch,
  spawn,
  stepButterflies,
} from './butterflies';
import { drawBall, drawDog, mouth, spawnDogs, stepDogs } from './dogs';
import { type Flora, drawFlowers, drawGrass, grow } from './flora';

const G = 1500;

export function mountGarden(root: HTMLElement): void {
  const canvas = root.querySelector('canvas');
  const btn = root.querySelector<HTMLButtonElement>('[data-garden-throw]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  const docEl = document.documentElement;
  const w: World = {
    W: 0,
    H: 0,
    g0: 0,
    g1: 0,
    t: 0,
    gusts: [],
    flowers: [],
    balls: [],
    px: 0,
    py: 0,
    hover: false,
  };
  const dogs = spawnDogs(w);
  const bugs: Butterfly[] = spawn(w, 4, rng(11));
  let flora: Flora = { back: [], front: [] };
  let col: Colors = { stroke: '#fff', page: '#000' };
  let dpr = 1;
  let visible = false;
  let raf = 0;
  let last = 0;

  const still = () => docEl.dataset.motion === 'reduce';
  const readColors = () => {
    const rs = getComputedStyle(docEl);
    const bs = getComputedStyle(document.body);
    const v = (n: string, f: string) => rs.getPropertyValue(n).trim() || f;
    col = {
      stroke: v('--stroke', bs.color),
      page: v('--page', bs.backgroundColor),
    };
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const old = w.W;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w.W = r.width;
    w.H = r.height;
    w.g0 = w.H * 0.5;
    w.g1 = w.H * 0.82;
    canvas.width = Math.round(w.W * dpr);
    canvas.height = Math.round(w.H * dpr);
    flora = grow(w);
    dogs.forEach((d, i) => (d.size = (i ? 1.5 : 1.9) * (w.W < 600 ? 0.72 : 1)));
    if (old) for (const d of dogs) d.x = clamp(d.x * (w.W / old), 20, w.W - 20);
    else {
      dogs.forEach((d, i) => {
        d.x = w.W * (i ? 0.68 : 0.3);
        d.y = (w.g0 + w.g1) / 2 + i * 14;
      });
    }
    for (const b of bugs) b.x = clamp(b.x, 6, w.W - 6);
    w.flowers.forEach((f) => {
      f.hx = f.x;
      f.hy = f.y - f.h;
    });
    if (!old && still()) perch(w, bugs);
    frame(0, true);
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w.W, w.H);
    drawGrass(ctx, w, flora, false, col);
    drawFlowers(ctx, w, col);
    const items: [number, () => void][] = [];
    for (const d of dogs) {
      items.push([d.y, () => drawDog(ctx, w, d, col)]);
      if (d.ball?.held) {
        const m = mouth(d, w.t);
        const b = d.ball;
        items.push([d.y + 1, () => drawBall(ctx, b, col, true, m)]);
      }
    }
    for (const b of w.balls)
      if (!b.held) items.push([b.y, () => drawBall(ctx, b, col)]);
    items.sort((p, q) => p[0] - q[0]);
    for (const [, fn] of items) fn();
    drawGrass(ctx, w, flora, true, col);
    bugs.forEach((b, i) => drawButterfly(ctx, b, col, i));
  };

  const stepBalls = (dt: number) => {
    for (const b of w.balls) {
      if (b.held) continue;
      if (b.done >= 0) b.done += dt;
      b.x += b.vx * dt;
      b.y = clamp(b.y + b.vy * dt, w.g0 + 6, w.g1 + 6);
      b.vz -= G * dt;
      b.z += b.vz * dt;
      if (b.z < 0) {
        b.z = 0;
        if (b.vz < -90) {
          b.vz *= -0.5;
          b.vx *= 0.7;
        } else b.vz = 0;
      }
      if (b.z === 0) b.vx *= Math.exp(-dt * 2.4);
      if (b.x < 8 || b.x > w.W - 8) {
        b.x = clamp(b.x, 8, w.W - 8);
        b.vx *= -0.5;
      }
    }
    w.balls = w.balls.filter((b) => b.done < 9.5);
  };

  const step = (dt: number) => {
    w.t += dt;
    const k = Math.exp(-dt * 1.7);
    for (const g of w.gusts) g.s *= k;
    w.gusts = w.gusts.filter((g) => Math.abs(g.s) > 0.02);
    stepBalls(dt);
    stepDogs(w, dogs, dt);
    stepButterflies(w, bugs, dt);
  };

  function frame(ts: number, once = false) {
    if (once) {
      draw();
      return;
    }
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
    last = ts;
    step(dt);
    draw();
    raf =
      visible && !document.hidden && !still()
        ? requestAnimationFrame((t) => frame(t))
        : 0;
  }

  const sync = () => {
    const run = visible && !document.hidden && !still();
    if (run && !raf) {
      last = 0;
      raf = requestAnimationFrame((t) => frame(t));
    } else if (!run) {
      cancelAnimationFrame(raf);
      raf = 0;
      if (w.W) draw();
    }
  };

  const throwBall = (tx: number, ty: number) => {
    if (still() || !w.W) return;
    ty = clamp(ty, w.g0 + 24, w.g1);
    const sx = tx < w.W / 2 ? -12 : w.W + 12;
    const T = 0.5 + Math.abs(tx - sx) / 2200;
    const z0 = 90;
    const ball: Ball = {
      x: sx,
      y: ty,
      z: z0,
      vx: (tx - sx) / T,
      vy: 0,
      vz: (0.5 * G * T * T - z0) / T,
      claimed: false,
      held: false,
      done: -1,
      rx: sx < 0 ? 70 : w.W - 70,
      ry: (w.g0 + w.g1) / 2,
    };
    w.balls.push(ball);
    if (w.balls.length > 6) w.balls.shift();
    sync();
  };

  const local = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  let lx = 0;
  let lt = 0;
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    w.px = x;
    w.py = y;
    w.hover = true;
    const now = performance.now();
    const dx = x - lx;
    lx = x;
    if (now - lt > 30 && Math.abs(dx) > 2 && !still()) {
      const s = clamp((dx / Math.max(16, now - lt)) * 0.9, -1.3, 1.3);
      lt = now;
      w.gusts.push({ x, y, s });
      if (w.gusts.length > 14) w.gusts.shift();
    }
  });
  canvas.addEventListener('pointerleave', () => (w.hover = false));
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e);
    w.px = x;
    w.py = y;
    w.hover = e.pointerType === 'mouse';
    lx = x;
  });
  canvas.addEventListener('click', (e) => {
    const [x, y] = local(e);
    throwBall(x, y);
  });
  btn?.addEventListener('click', () =>
    throwBall(
      40 + Math.random() * (w.W - 80),
      w.g0 + Math.random() * (w.g1 - w.g0),
    ),
  );

  const repaint = () => {
    readColors();
    if (!raf && w.W) draw();
  };
  window.addEventListener('nihal:theme', repaint);
  new MutationObserver(() => {
    if (btn) btn.hidden = still();
    sync();
  }).observe(docEl, { attributes: true, attributeFilter: ['data-motion'] });
  if (btn) btn.hidden = still();
  document.addEventListener('visibilitychange', sync);
  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    sync();
  }).observe(canvas);
  new ResizeObserver(() => {
    resize();
    sync();
  }).observe(canvas);
  readColors();
  resize();
}
