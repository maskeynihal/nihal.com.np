import { type Ball, type Colors, type World, clamp, rng } from './core';
import {
  type Butterfly,
  drawButterfly,
  perch,
  spawn,
  stepButterflies,
} from './butterflies';
import { drawBall, drawDog, mouth, spawnDogs, stepDogs } from './dogs';
import {
  type Flora,
  drawFlowers,
  drawGrass,
  flowerAt,
  layoutGrass,
  seedFlowers,
  stepFlora,
} from './flora';
import {
  drawBucket,
  drawFlying,
  drawHeld,
  empty,
  pick,
  placeBucket,
  stepBucket,
  toBucket,
} from './bucket';

const G = 1500;

export function mountGarden(root: HTMLElement): void {
  const canvas = root.querySelector('canvas');
  const btn = root.querySelector<HTMLButtonElement>('[data-garden-throw]');
  const pickBtn = root.querySelector<HTMLButtonElement>('[data-garden-pick]');
  const newBtn = root.querySelector<HTMLButtonElement>('[data-garden-new]');
  const readout = root.querySelector<HTMLElement>('[data-garden-count]');
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
    bucket: { x: 0, y: 0, s: 1, items: [], count: 0 },
    flying: [],
    held: null,
    cap: 9,
    spots: [],
    sprout: 2,
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

  const newBall = (x: number, y: number, fetch = false): Ball => ({
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    claimed: false,
    held: false,
    grabbed: false,
    fetch,
    spin: 0,
    sq: 0,
  });

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const old = w.W;
    const og0 = w.g0;
    const og1 = w.g1;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w.W = r.width;
    w.H = r.height;
    w.g0 = w.H * 0.5;
    w.g1 = w.H * 0.82;
    canvas.width = Math.round(w.W * dpr);
    canvas.height = Math.round(w.H * dpr);
    placeBucket(w);
    flora = layoutGrass(w);
    dogs.forEach(
      (d, i) => (d.size = (i ? 1.45 : 1.8) * (w.W < 600 ? 0.72 : 1)),
    );
    if (old) {
      const kx = w.W / old;
      const ky = (y: number) =>
        w.g0 + ((y - og0) / (og1 - og0 || 1)) * (w.g1 - w.g0);
      for (const d of dogs) d.x = clamp(d.x * kx, 20, w.W - 20);
      for (const f of w.flowers) {
        f.x *= kx;
        f.y = ky(f.y);
      }
      for (const b of w.balls) {
        b.x = clamp(b.x * kx, 8, w.W - 8);
        b.y = clamp(ky(b.y), w.g0 + 6, w.g1 + 6);
      }
    } else {
      dogs.forEach((d, i) => {
        d.x = w.W * (i ? 0.62 : 0.3);
        d.y = (w.g0 + w.g1) / 2 + i * 14;
      });
      seedFlowers(w);
      w.balls = [newBall(w.W * 0.5, (w.g0 + w.g1) / 2 + 24)];
      w.px = w.W * 0.5;
      w.py = w.g1;
      stepBucket(w, 0, true);
      announce();
    }
    for (const b of bugs) b.x = clamp(b.x, 6, w.W - 6);
    w.flowers.forEach((f) => {
      f.hx = f.x;
      f.hy = f.y - f.h * Math.min(1, f.grow / 0.6);
    });
    if (!old && still()) perch(w, bugs);
    frame(0, true);
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w.W, w.H);
    drawGrass(ctx, w, flora, false, col);
    drawFlowers(ctx, w, col);
    const items: [number, () => void][] = [
      [w.bucket.y, () => drawBucket(ctx, w, col)],
    ];
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
    for (const fl of w.flying) drawFlying(ctx, col, fl);
    if (w.held) drawHeld(ctx, col, w.held);
    bugs.forEach((b, i) => drawButterfly(ctx, b, col, i));
  };

  // Pointer speed over the last ~90 ms, for flicks and for the swing of a carried flower.
  const trail: { x: number; y: number; t: number }[] = [];
  const velocity = () => {
    const now = performance.now();
    while (trail.length && now - (trail[0]?.t ?? now) > 90) trail.shift();
    if (trail.length < 2) return { x: 0, y: 0 };
    const a = trail[0];
    const b = trail[trail.length - 1];
    if (!a || !b) return { x: 0, y: 0 };
    const dt = Math.max(16, b.t - a.t) / 1000;
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  };

  let grabbed: Ball | null = null;

  const stepBalls = (dt: number) => {
    for (const b of w.balls) {
      if (b.held) continue;
      b.sq = Math.max(0, b.sq - dt * 5);
      if (b.grabbed) {
        const v = velocity();
        b.x = clamp(w.px, 8, w.W - 8);
        b.y = clamp(w.py + 24, w.g0 + 6, w.g1 + 6);
        b.z = Math.max(0, b.y - w.py - 8);
        b.spin += (v.x / 8) * dt * 0.5;
        continue;
      }
      b.x += b.vx * dt;
      b.y = clamp(b.y + b.vy * dt, w.g0 + 6, w.g1 + 6);
      b.vz -= G * dt;
      b.z += b.vz * dt;
      if (b.z < 0) {
        b.z = 0;
        if (b.vz < -90) {
          b.sq = Math.min(1, -b.vz / 650);
          b.vz *= -0.52;
          b.vx *= 0.8;
          b.vy *= 0.8;
        } else b.vz = 0;
      }
      if (b.z === 0) {
        // Rolling friction.
        const k = Math.exp(-dt * 1.6);
        b.vx *= k;
        b.vy *= k;
        if (Math.abs(b.vx) < 3) b.vx = 0;
        if (Math.abs(b.vy) < 3) b.vy = 0;
      }
      b.spin += (b.vx / 8) * dt;
      if (b.x < 8 || b.x > w.W - 8) {
        b.x = clamp(b.x, 8, w.W - 8);
        b.vx *= -0.5;
      }
    }
  };

  let lastCount = 0;
  const announce = (msg?: string) => {
    const n = w.bucket.count;
    lastCount = n;
    if (newBtn) newBtn.hidden = n === 0;
    if (readout)
      readout.textContent =
        msg ??
        (n === 0
          ? 'the bucket is empty'
          : `${n} ${n === 1 ? 'flower' : 'flowers'} in the bucket`);
  };

  const step = (dt: number) => {
    w.t += dt;
    const k = Math.exp(-dt * 1.7);
    for (const g of w.gusts) g.s *= k;
    w.gusts = w.gusts.filter((g) => Math.abs(g.s) > 0.02);
    stepFlora(w, dt);
    const h = w.held;
    if (h) {
      const e = 1 - Math.exp(-dt * 18);
      h.bx += (w.px - h.bx) * e;
      h.by += (w.py - h.by) * e;
      const target = clamp(velocity().x * 0.0005, -0.7, 0.7);
      h.swv += ((target - h.sw) * 120 - h.swv * 12) * dt;
      h.sw += h.swv * dt;
    }
    stepBucket(w, dt);
    if (w.bucket.count !== lastCount) announce();
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
    const ball = newBall(sx, ty, true);
    ball.z = z0;
    ball.vx = (tx - sx) / T;
    ball.vz = (0.5 * G * T * T - z0) / T;
    w.balls.push(ball);
    if (w.balls.length > 3) {
      const i = w.balls.findIndex((b) => !b.held && !b.grabbed && !b.claimed);
      if (i >= 0) w.balls.splice(i, 1);
    }
    sync();
  };

  /** Cuts a flower and sends it to the bucket; no flight under reduced motion. */
  const sendFlower = (
    f: (typeof w.flowers)[number],
    from?: { bx: number; by: number; hx: number; hy: number },
  ) => {
    const was = w.held?.f === f;
    const src = from ?? { bx: f.x, by: f.y, hx: f.hx, hy: f.hy };
    if (!was) pick(w, f);
    w.held = null;
    const instant = still();
    toBucket(w, f, src, instant);
    if (instant) {
      stepBucket(w, 0, true);
      announce();
      draw();
    } else sync();
  };

  const local = (e: PointerEvent | MouseEvent | Touch) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  type Hit =
    | { kind: 'ball'; ball: Ball }
    | { kind: 'flower'; flower: (typeof w.flowers)[number] };
  const hitTest = (x: number, y: number, touch: boolean): Hit | null => {
    const reach = touch ? 28 : 20;
    if (!still()) {
      let best: Ball | null = null;
      let bd = reach;
      for (const b of w.balls) {
        let bx = b.x;
        let by = b.y - b.z - 8;
        if (b.held) {
          const d = dogs.find((o) => o.ball === b);
          if (!d) continue;
          [bx, by] = mouth(d, w.t);
        }
        const d = Math.hypot(x - bx, y - by);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) return { kind: 'ball', ball: best };
    }
    const f = flowerAt(w, x, y);
    return f ? { kind: 'flower', flower: f } : null;
  };

  const setCursor = (c: string) => {
    if (canvas.style.cursor !== c) canvas.style.cursor = c;
  };

  let lx = 0;
  let lt = 0;
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = local(e);
    w.px = x;
    w.py = y;
    w.hover = true;
    const now = performance.now();
    trail.push({ x, y, t: now });
    if (trail.length > 12) trail.shift();
    if (!w.held && !grabbed && e.pointerType === 'mouse')
      setCursor(hitTest(x, y, false) ? 'grab' : 'default');
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
  // A press on a flower or a ball grabs it; a press anywhere else is left to scroll the page.
  canvas.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      const [x, y] = local(t);
      if (hitTest(x, y, true)) e.preventDefault();
    },
    { passive: false },
  );
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const [x, y] = local(e);
    w.px = x;
    w.py = y;
    w.hover = e.pointerType === 'mouse';
    lx = x;
    trail.length = 0;
    trail.push({ x, y, t: performance.now() });
    const hit = hitTest(x, y, e.pointerType !== 'mouse');
    if (!hit) return;
    e.preventDefault();
    if (hit.kind === 'flower') {
      const f = hit.flower;
      if (still()) {
        sendFlower(f);
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      pick(w, f);
      w.held = { f, bx: f.x, by: f.y, sw: 0, swv: 0 };
      setCursor('grabbing');
      sync();
      return;
    }
    const b = hit.ball;
    canvas.setPointerCapture(e.pointerId);
    if (b.held) {
      // Taken back out of the dog's mouth.
      const d = dogs.find((o) => o.ball === b);
      if (d) {
        d.ball = null;
        d.state = 'idle';
        d.timer = 1.2;
      }
      b.held = false;
      b.x = clamp(x, 8, w.W - 8);
      b.y = clamp(y + 24, w.g0 + 6, w.g1 + 6);
    }
    b.claimed = false;
    b.fetch = false;
    b.grabbed = true;
    b.vx = b.vy = b.vz = 0;
    grabbed = b;
    setCursor('grabbing');
    sync();
  });
  const release = () => {
    if (w.held) {
      const h = w.held;
      sendFlower(h.f, { bx: h.bx, by: h.by, hx: h.f.hx, hy: h.f.hy });
    }
    if (grabbed) {
      const b = grabbed;
      const v = velocity();
      grabbed = null;
      b.grabbed = false;
      b.vx = clamp(v.x, -1500, 1500);
      b.vz = clamp(-v.y * 0.8, -400, 1000);
      b.vy = clamp(v.y * 0.15, -110, 110);
      b.fetch = true;
    }
    setCursor('default');
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  btn?.addEventListener('click', () =>
    throwBall(
      40 + Math.random() * (w.W - 80),
      w.g0 + Math.random() * (w.g1 - w.g0),
    ),
  );
  pickBtn?.addEventListener('click', () => {
    const ready = w.flowers.filter((f) => f.grow >= 0.9 && f !== w.held?.f);
    if (!ready.length) {
      announce('no flower is ready yet');
      return;
    }
    const f = ready[Math.floor(Math.random() * ready.length)];
    if (f) sendFlower(f);
  });
  newBtn?.addEventListener('click', () => {
    empty(w);
    announce('started a new bouquet');
    if (newBtn) newBtn.hidden = true;
    lastCount = 0;
    if (!raf && w.W) draw();
  });

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
