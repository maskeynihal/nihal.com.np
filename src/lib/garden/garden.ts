import { testHooks } from '../env';
import {
  type Ball,
  type Bloom,
  type Bouquet,
  type Colors,
  type World,
  clamp,
  rng,
} from './core';
import {
  MAX_BOUQUETS,
  drawBouquet,
  drawPaper,
  drawVase,
  laid,
  lay,
  lift,
  nearVase,
  newBouquet,
  onBouquet,
  onPaper,
  placeVase,
  spot,
  startWrap,
  stepBouquets,
  toVase,
} from './bouquet';
import {
  type Edge,
  type Pin,
  PH,
  PW,
  carryTo,
  edgeAt,
  makePin,
  paintPin,
  placePin,
} from './pins';
import {
  type Butterfly,
  drawButterfly,
  perch,
  spawn,
  stepButterflies,
} from './butterflies';
import { ballAt, drawBall, drawDog, mouth, spawnDogs, stepDogs } from './dogs';
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
/** Most balls in the garden. */
const MAX_BALLS = 4;

export function mountGarden(root: HTMLElement): void {
  const canvas = root.querySelector('canvas');
  const act = (n: string) =>
    root.querySelector<HTMLButtonElement>(`[data-garden-act="${n}"]`);
  const btn = act('throw');
  const pickBtn = act('pick');
  const newBtn = act('new');
  const wrapBtn = act('wrap');
  const vaseBtn = act('vase');
  const pinBtn = act('pin');
  const outBtn = act('out');
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
    paper: null,
    bqs: [],
    vase: { x: 0, y: 0, s: 1, bq: null },
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
  const pins: Pin[] = [];
  /** The bouquet under the pointer: shown by a fixed element so it can leave the canvas. */
  let carry: {
    pin: Pin;
    from: 'lie' | 'vase';
    sw: number;
    swv: number;
    x: number;
    y: number;
    t: number;
  } | null = null;
  let paperDown: { x: number; y: number } | null = null;
  let cx = 0;
  let cy = 0;

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
    wait: 0,
    fade: 0,
    spin: 0,
    sq: 0,
    ox: 0,
    oy: 0,
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
    placeVase(w);
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
      for (const q of w.bqs) {
        if (q.mode !== 'lie') continue;
        q.x = q.tx = clamp(q.x * kx, 70, w.W - 30);
        q.y = q.ty = clamp(ky(q.y), w.g0 + 14, w.g1 + 6);
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
      restore();
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
      [w.vase.y, () => drawVase(ctx, w, col)],
    ];
    for (const q of w.bqs)
      if (q.mode === 'lie')
        items.push([q.y, () => drawBouquet(ctx, col, q, q.x, q.y, q.rot, q.s)]);
    if (w.paper && !w.paper.drag)
      items.push([w.paper.y, () => drawPaper(ctx, col, w)]);
    for (const d of dogs) {
      items.push([d.y, () => drawDog(ctx, w, d, col)]);
      if (d.ball?.held) {
        const m = ballAt(d, w.t);
        const b = d.ball;
        items.push([d.y + 1, () => drawBall(ctx, b, col, true, m)]);
      }
    }
    for (const b of w.balls)
      if (!b.held) items.push([b.y, () => drawBall(ctx, b, col)]);
    items.sort((p, q) => p[0] - q[0]);
    for (const [, fn] of items) fn();
    drawGrass(ctx, w, flora, true, col);
    if (w.paper?.drag) drawPaper(ctx, col, w);
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
      if (b.fade > 0) b.fade += dt / 0.35;
      b.sq = Math.max(0, b.sq - dt * 5);
      if (b.grabbed) {
        const v = velocity();
        const e = Math.exp(-dt * 12);
        b.ox *= e;
        b.oy *= e;
        b.x = clamp(w.px + b.ox, 8, w.W - 8);
        b.y = clamp(w.py + 24 + b.oy, w.g0 + 6, w.g1 + 6);
        b.z = Math.max(0, b.y - w.py - b.oy - 8);
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
    if (w.balls.some((b) => b.fade >= 1))
      w.balls = w.balls.filter((b) => b.fade < 1);
  };

  let lastCount = 0;
  let lastPaper = false;
  let uiKey = '';
  const show = (b: HTMLButtonElement | null, on: boolean) => {
    if (b) b.hidden = !on;
  };
  /** Shows the controls that make sense now: wrap with paper down, vase and pin with a bouquet to place. */
  const syncUi = () => {
    const free = laid(w).length;
    const key = [
      w.bucket.count,
      w.paper ? 1 : 0,
      free,
      w.vase.bq ? 1 : 0,
      w.bqs.some((q) => q.mode === 'wrap') ? 1 : 0,
      pins.length,
    ].join();
    if (key === uiKey) return;
    uiKey = key;
    show(newBtn, w.bucket.count > 0);
    show(wrapBtn, !!w.paper);
    show(vaseBtn, free > 0);
    show(pinBtn, free > 0 || !!w.vase.bq);
    show(outBtn, !!w.vase.bq);
  };
  const announce = (msg?: string) => {
    const n = w.bucket.count;
    lastCount = n;
    lastPaper = !!w.paper;
    syncUi();
    if (readout)
      readout.textContent =
        msg ??
        (n === 0
          ? 'the bucket is empty'
          : `${n} ${n === 1 ? 'flower' : 'flowers'} in the bucket${w.paper ? ', wrapping paper is ready' : ''}`);
  };

  /** Settles after a change: still frames snap and redraw, moving ones keep the loop going. */
  const settle = () => {
    if (still()) stepBouquets(w, 0, true);
    syncUi();
    sync();
  };

  // Bouquet placement is kept as a convenience; the garden renders the same without it.
  const KEY = 'nihal:bouquets';
  const enc = (q: Bouquet) =>
    q.items.map((it) => [
      it.cut.kind,
      +it.cut.r.toFixed(1),
      Math.round(it.cut.h),
      +it.cut.ph.toFixed(2),
      +it.ang.toFixed(3),
      +it.len.toFixed(1),
    ]);
  const save = () => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          v: w.vase.bq ? enc(w.vase.bq) : null,
          p: pins.map((p) => ({
            e: p.edge,
            a: Math.round(p.along),
            i: enc(p.bq),
          })),
        }),
      );
    } catch {
      // Storage can be blocked; nothing depends on it.
    }
  };
  const dec = (v: unknown): Bouquet | null => {
    if (!Array.isArray(v) || !v.length || v.length > 14) return null;
    const items: Bloom[] = [];
    for (const r of v) {
      if (!Array.isArray(r) || r.length !== 6 || !r.every(Number.isFinite))
        return null;
      const [kind, rr, h, ph, ang, len] = r as number[];
      items.push({
        cut: {
          kind: (kind as number) % 3,
          r: clamp(rr as number, 8, 24),
          h: clamp(h as number, 40, 220),
          ph: ph as number,
        },
        ang: clamp(ang as number, -1.2, 1.2),
        len: clamp(len as number, 30, 110),
      });
    }
    return newBouquet(items, 0.8 * w.bucket.s);
  };
  const restore = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as { v?: unknown; p?: unknown };
      const vq = dec(d.v);
      if (vq) {
        w.bqs.push(vq);
        toVase(w, vq);
        stepBouquets(w, 0, true);
      }
      if (Array.isArray(d.p))
        for (const o of d.p.slice(0, MAX_BOUQUETS - 1)) {
          const q = dec(o?.i);
          const e = o?.e;
          if (q && 'lrtb'.includes(e) && e.length === 1 && Number.isFinite(o.a))
            attachPin(q, e as Edge, o.a);
        }
    } catch {
      // Unreadable or blocked: start empty.
    }
  };

  /** A fixed element drawing a bouquet, for carrying it and for pinning it to an edge. */
  const pinFor = (q: Bouquet, label: string) => {
    const { el, cv } = makePin(label);
    paintPin(cv, col, q);
    return { bq: q, el, cv, edge: 'r' as Edge, along: 0 };
  };
  const attachPin = (q: Bouquet, edge: Edge, along: number, pin?: Pin) => {
    const p = pin ?? pinFor(q, 'take the bouquet back into the garden');
    p.edge = edge;
    p.along = along;
    delete p.el.dataset.carry;
    p.el.removeAttribute('aria-hidden');
    p.el.setAttribute('aria-label', 'take the bouquet back into the garden');
    p.el.tabIndex = 0;
    placePin(p);
    pins.push(p);
    let down: { x: number; y: number } | null = null;
    p.el.addEventListener('click', () => unpin(p));
    p.el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      p.el.setPointerCapture(e.pointerId);
    });
    p.el.addEventListener('pointermove', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10)
        unpin(p);
    });
    return p;
  };
  const unpin = (p: Pin) => {
    const i = pins.indexOf(p);
    if (i < 0) return;
    pins.splice(i, 1);
    p.el.remove();
    const [x, y] = spot(w);
    lay(w, p.bq, x, y);
    w.bqs.push(p.bq);
    p.bq.x = p.bq.tx;
    p.bq.y = p.bq.ty;
    p.bq.rot = p.bq.trot;
    announce('the bouquet is back in the garden');
    save();
    settle();
  };
  /** At most MAX_BOUQUETS between garden, vase and edges: the oldest one is put away for a new one. */
  const makeRoom = () => {
    while (w.bqs.length + pins.length >= MAX_BOUQUETS) {
      const old = laid(w)[0] ?? w.vase.bq;
      if (old) {
        lift(w, old);
        continue;
      }
      const p = pins.shift();
      if (!p) break;
      p.el.remove();
    }
  };
  const doWrap = () => {
    makeRoom();
    if (!startWrap(w, still())) return;
    announce('wrapped the flowers into a bouquet');
    save();
    settle();
  };
  const refocus = (b: HTMLButtonElement | null) =>
    queueMicrotask(() => {
      if (b?.hidden) pickBtn?.focus();
    });

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
    const pp = w.paper;
    if (pp?.drag) {
      const e = 1 - Math.exp(-dt * 22);
      pp.x += (clamp(w.px, 30, w.W - 30) - pp.x) * e;
      pp.y += (clamp(w.py, w.g0 - 20, w.H - 10) - pp.y) * e;
    }
    stepBouquets(w, dt);
    if (carry) {
      const c = carry;
      const target = clamp(velocity().x * 0.0004, -0.6, 0.6);
      c.swv += ((target - c.sw) * 120 - c.swv * 12) * dt;
      c.sw += c.swv * dt;
      carryTo(c.pin.el, cx, cy, c.sw);
    }
    if (w.bucket.count !== lastCount || !!w.paper !== lastPaper) announce();
    else syncUi();
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
    // At most four: a fifth shrinks the oldest free one away. A held or carried ball stays; one a dog is still running for goes last.
    const live = w.balls.filter((b) => b.fade === 0);
    if (live.length > MAX_BALLS) {
      const free = live.filter((b) => !b.held && !b.grabbed);
      const old = free.find((b) => !b.claimed) ?? free[0];
      if (old) {
        old.fade = 0.001;
        old.fetch = old.claimed = false;
      }
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
      stepBouquets(w, 0, true);
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
    | { kind: 'bouquet'; bq: Bouquet }
    | { kind: 'paper' }
    | { kind: 'flower'; flower: (typeof w.flowers)[number] };
  const hitTest = (x: number, y: number, touch: boolean): Hit | null => {
    const reach = touch ? 28 : 20;
    if (!still()) {
      let best: Ball | null = null;
      let bd = reach;
      for (const b of w.balls) {
        if (b.fade > 0) continue;
        let bx = b.x;
        let by = b.y - b.z - 8;
        if (b.held) {
          const d = dogs.find((o) => o.ball === b);
          if (!d) continue;
          [bx, by] = ballAt(d, w.t);
        }
        const d = Math.hypot(x - bx, y - by);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) return { kind: 'ball', ball: best };
    }
    for (const q of w.bqs)
      if (q.mode !== 'wrap' && onBouquet(q, x, y))
        return { kind: 'bouquet', bq: q };
    if (onPaper(w, x, y)) return { kind: 'paper' };
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
    cx = e.clientX;
    cy = e.clientY;
    if (carry) carryTo(carry.pin.el, cx, cy, carry.sw);
    const now = performance.now();
    trail.push({ x, y, t: now });
    if (trail.length > 12) trail.shift();
    if (
      !w.held &&
      !grabbed &&
      !carry &&
      !w.paper?.drag &&
      e.pointerType === 'mouse'
    )
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
    cx = e.clientX;
    cy = e.clientY;
    const hit = hitTest(x, y, e.pointerType !== 'mouse');
    if (!hit) return;
    e.preventDefault();
    if (hit.kind === 'paper') {
      if (still()) {
        doWrap();
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      if (w.paper) w.paper.drag = true;
      paperDown = { x, y };
      setCursor('grabbing');
      sync();
      return;
    }
    if (hit.kind === 'bouquet') {
      const q = hit.bq;
      canvas.setPointerCapture(e.pointerId);
      const from = q.mode === 'vase' ? 'vase' : 'lie';
      lift(w, q);
      const p = pinFor(q, '');
      p.el.dataset.carry = '';
      p.el.removeAttribute('aria-label');
      p.el.setAttribute('aria-hidden', 'true');
      p.el.tabIndex = -1;
      carryTo(p.el, cx, cy, 0);
      carry = { pin: p, from, sw: 0, swv: 0, x, y, t: performance.now() };
      setCursor('grabbing');
      save();
      settle();
      return;
    }
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
    // The ball keeps the spot it was seen at and eases to the pointer: no jump.
    let vx = b.x;
    let vy = b.y - b.z - 8;
    if (b.held) {
      // Taken back out of the dog's mouth: the dog lets go and stands down.
      const d = dogs.find((o) => o.ball === b);
      if (d) {
        [vx, vy] = ballAt(d, w.t);
        d.ball = null;
        d.state = 'idle';
        d.timer = 1.2;
      }
      b.held = false;
      b.x = clamp(vx, 8, w.W - 8);
      b.y = clamp(vy + 8, w.g0 + 6, w.g1 + 6);
      b.z = 0;
    }
    b.ox = vx - x;
    b.oy = vy - y;
    b.claimed = false;
    b.fetch = false;
    b.grabbed = true;
    b.vx = b.vy = b.vz = 0;
    grabbed = b;
    setCursor('grabbing');
    sync();
  });
  const release = () => {
    if (paperDown && w.paper) {
      const p = w.paper;
      p.drag = false;
      const moved = Math.hypot(w.px - paperDown.x, w.py - paperDown.y) > 8;
      const near =
        Math.hypot(p.x - w.bucket.x, p.y - (w.bucket.y - 30)) <
        90 * w.bucket.s + 20;
      paperDown = null;
      if (!moved || near) doWrap();
      else settle();
    }
    if (carry) {
      const c = carry;
      carry = null;
      const q = c.pin.bq;
      const tap =
        Math.hypot(w.px - c.x, w.py - c.y) < 8 && performance.now() - c.t < 500;
      const edge = tap ? null : edgeAt(cx, cy);
      if (edge) {
        const along =
          edge === 'l' || edge === 'r' ? cy - PH * 0.6 : cx - PW / 2;
        w.bqs = w.bqs.filter((o) => o !== q);
        attachPin(q, edge, along, c.pin);
        announce('the bouquet is pinned to the edge');
      } else {
        c.pin.el.remove();
        if (tap) {
          // A tap sends it to the vase, or back to the grass from the vase.
          if (c.from === 'vase') lay(w, q, ...spot(w));
          else toVase(w, q);
        } else if (nearVase(w, w.px, w.py)) toVase(w, q);
        else
          lay(
            w,
            q,
            clamp(w.px, 70, w.W - 30),
            clamp(w.py + 30, w.g0 + 14, w.g1 + 6),
          );
        if (!w.bqs.includes(q)) w.bqs.push(q);
        announce(
          w.vase.bq === q
            ? 'the bouquet stands in the vase'
            : 'the bouquet is on the grass',
        );
      }
      save();
      settle();
    }
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
    stepBouquets(w, 0, true);
    announce('started a new bouquet');
    refocus(newBtn);
    if (!raf && w.W) draw();
  });
  wrapBtn?.addEventListener('click', () => {
    doWrap();
    refocus(wrapBtn);
  });
  vaseBtn?.addEventListener('click', () => {
    const q = laid(w).at(-1);
    if (!q) return;
    toVase(w, q);
    announce('the bouquet stands in the vase');
    save();
    settle();
    refocus(vaseBtn);
  });
  outBtn?.addEventListener('click', () => {
    const q = w.vase.bq;
    if (!q) return;
    w.vase.bq = null;
    lay(w, q, ...spot(w));
    announce('the bouquet is out of the vase');
    save();
    settle();
    refocus(outBtn);
  });
  pinBtn?.addEventListener('click', () => {
    const q = laid(w).at(-1) ?? w.vase.bq;
    if (!q) return;
    lift(w, q);
    attachPin(q, 'r', window.innerHeight * 0.4);
    announce('the bouquet is pinned to the edge');
    save();
    settle();
    refocus(pinBtn);
  });
  window.addEventListener('resize', () => {
    for (const p of pins) placePin(p);
  });

  const repaint = () => {
    readColors();
    for (const p of pins) paintPin(p.cv, col, p.bq);
    if (carry) paintPin(carry.pin.cv, col, carry.pin.bq);
    if (!raf && w.W) draw();
  };
  window.addEventListener('nihal:theme', repaint);
  window.addEventListener('nihal:lamp', repaint);
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
  // Test hooks (PUBLIC_TEST_HOOKS=1 only; a plain build drops this): where things are on screen.
  if (testHooks && window.__hooks) {
    const at = (x: number, y: number) => {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + x, y: r.top + y };
    };
    window.__hooks.garden = {
      balls: () =>
        w.balls.map((b) => ({
          ...at(b.x, b.y - b.z - 8),
          held: b.held,
          grabbed: b.grabbed,
          speed: Math.hypot(b.vx, b.vy),
          fetch: b.fetch,
          claimed: b.claimed,
          fading: b.fade > 0,
        })),
      time: () => w.t,
      flowers: () =>
        w.flowers
          .filter((f) => f.grow >= 0.9)
          .map((f) => ({ ...at(f.hx, f.hy) })),
      bucket: () => ({ ...at(w.bucket.x, w.bucket.y), count: w.bucket.count }),
      paper: () =>
        w.paper ? { ...at(w.paper.x, w.paper.y), t: w.paper.t } : null,
      bouquets: () =>
        w.bqs.map((q) => ({
          mode: q.mode,
          wrap: q.wrap,
          ...at(
            q.x + Math.sin(q.rot) * 40 * q.s,
            q.y - Math.cos(q.rot) * 40 * q.s,
          ),
        })),
      vase: () => ({
        ...at(w.vase.x, w.vase.y - 40 * w.vase.s),
        full: !!w.vase.bq,
      }),
      pins: () =>
        pins.map((p) => {
          const r = p.el.getBoundingClientRect();
          return {
            edge: p.edge,
            x: r.left,
            y: r.top,
            width: r.width,
            height: r.height,
          };
        }),
      dogs: () =>
        dogs.map((d) => {
          const m = mouth(d, w.t);
          return {
            ...at(d.x, d.y),
            f: d.f,
            size: d.size,
            state: d.state,
            mouth: [at(m[0], m[1]).x, at(m[0], m[1]).y] as [number, number],
            ball: d.ball
              ? d.ball.held
                ? { ...at(...ballAt(d, w.t)), held: true }
                : { ...at(d.ball.x, d.ball.y - d.ball.z - 8), held: false }
              : null,
          };
        }),
    };
  }
}
