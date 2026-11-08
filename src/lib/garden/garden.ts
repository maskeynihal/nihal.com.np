import { testHooks } from '../env';
import {
  type Ball,
  type Bloom,
  type Bouquet,
  type Colors,
  type World,
  BALL_EDGE,
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
  onVase,
  placeVase,
  spot,
  startWrap,
  stepBouquets,
  toVase,
} from './bouquet';
import {
  type Kind,
  type Rest,
  fall,
  floorY,
  freeX,
  gravityPx,
  limits,
  make,
  paint,
  place,
} from './shelf';
import {
  type Butterfly,
  drawButterfly,
  keepButterflyIn,
  perch,
  spawn,
  stepButterflies,
} from './butterflies';
import {
  ballAt,
  drawBall,
  drawDog,
  keepDogIn,
  mouth,
  spawnDogs,
  stepDogs,
} from './dogs';
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
  const dropBtn = act('drop');
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
    vase: { x: 0, y: 0, s: 1, bq: null, gone: false },
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
  /** Bouquets and the vase dropped to the bottom of the screen, oldest first. */
  const rest: Rest[] = [];
  /** What the pointer carries: shown by a fixed element so it can leave the canvas. */
  let carry: {
    r: Rest;
    from: 'lie' | 'vase' | 'garden' | 'rest';
    sw: number;
    swv: number;
    /** Where the press began (viewport), and when. */
    x: number;
    y: number;
    t: number;
    /** Where the pointer holds the element, from its top left. */
    ax: number;
    ay: number;
    /** Where a rested item was lifted from, for a cancelled drag. */
    rx: number;
  } | null = null;
  let dragId = -1;
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
      for (const d of dogs) {
        d.x *= kx;
        keepDogIn(w, d);
      }
      for (const f of w.flowers) {
        f.x *= kx;
        f.y = ky(f.y);
      }
      for (const b of w.balls) {
        b.x = clamp(b.x * kx, BALL_EDGE, w.W - BALL_EDGE);
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
        keepDogIn(w, d);
      });
      seedFlowers(w);
      w.balls = [newBall(w.W * 0.5, (w.g0 + w.g1) / 2 + 24)];
      w.px = w.W * 0.5;
      w.py = w.g1;
      stepBucket(w, 0, true);
      restore();
      announce();
    }
    for (const b of bugs) keepButterflyIn(w, b);
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
    if (!w.vase.gone) items.push([w.vase.y, () => drawVase(ctx, w.vase, col)]);
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
        b.x = clamp(w.px + b.ox, BALL_EDGE, w.W - BALL_EDGE);
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
      if (b.x < BALL_EDGE || b.x > w.W - BALL_EDGE) {
        b.x = clamp(b.x, BALL_EDGE, w.W - BALL_EDGE);
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
  /** Shows the controls that make sense now: wrap with paper down, vase and drop with something to place. */
  const syncUi = () => {
    const free = laid(w).length;
    const key = [
      w.bucket.count,
      w.paper ? 1 : 0,
      free,
      w.vase.bq ? 1 : 0,
      w.vase.gone ? 1 : 0,
      w.bqs.some((q) => q.mode === 'wrap') ? 1 : 0,
    ].join();
    if (key === uiKey) return;
    uiKey = key;
    show(newBtn, w.bucket.count > 0);
    show(wrapBtn, !!w.paper);
    show(vaseBtn, free > 0 && !w.vase.gone);
    // A laid bouquet drops first, then the vase.
    show(dropBtn, free > 0 || !w.vase.gone);
    dropBtn?.setAttribute(
      'aria-label',
      `drop the ${free > 0 ? 'bouquet' : 'vase'} to the bottom of the screen`,
    );
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
          // What is at the bottom of the screen: kind, x as a share of the width, and the bouquet.
          r: rest.map((o) => ({
            k: o.kind === 'vase' ? 'v' : 'b',
            x: +(o.tx / window.innerWidth).toFixed(3),
            i: o.bq ? enc(o.bq) : null,
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
      const d = JSON.parse(raw) as { v?: unknown; r?: unknown; p?: unknown };
      // v3.2 kept pins on an edge (`p`); they come back at the bottom of the screen.
      const list: { k: string; x: number; i: unknown }[] = [];
      if (Array.isArray(d.r))
        for (const o of d.r.slice(0, MAX_BOUQUETS + 1))
          list.push({ k: o?.k, x: Number(o?.x), i: o?.i });
      else if (Array.isArray(d.p))
        for (const o of d.p.slice(0, MAX_BOUQUETS - 1))
          list.push({ k: 'b', x: 0.5, i: o?.i });
      const vq = dec(d.v);
      if (list.some((o) => o.k === 'v')) w.vase.gone = true;
      else if (vq) {
        w.bqs.push(vq);
        toVase(w, vq);
        stepBouquets(w, 0, true);
      }
      for (const o of list) {
        const q = dec(o.i);
        const kind: Kind | null = o.k === 'v' ? 'vase' : q ? 'bq' : null;
        if (kind && !(kind === 'vase' && rest.some((r) => r.kind === 'vase')))
          land(mk(kind, q), clamp(o.x || 0.5, 0, 1) * window.innerWidth, true);
      }
    } catch {
      // Unreadable or blocked: start empty.
    }
  };

  /** Bouquets in the garden, in the vase and at the bottom of the screen. */
  const bouquets = () =>
    w.bqs.length + rest.filter((r) => r.kind === 'bq' || r.bq).length;
  /** At most MAX_BOUQUETS: the oldest one is put away for a new one. */
  const makeRoom = () => {
    while (bouquets() >= MAX_BOUQUETS) {
      const old = laid(w)[0] ?? w.vase.bq;
      if (old) {
        lift(w, old);
        continue;
      }
      const r = rest.find((o) => o.bq);
      if (!r) break;
      if (r.kind === 'vase') {
        r.bq = null;
        paint(r, col);
      } else drop(r);
    }
  };

  // The bottom of the screen: dropped things fall to the floor (the sheet's inner edge) and stay while the page scrolls.
  let fallRaf = 0;
  let fallLast = 0;
  const fallStep = (ts: number) => {
    const dt = fallLast ? Math.min(0.05, (ts - fallLast) / 1000) : 0.016;
    fallLast = ts;
    const floor = floorY();
    const g = gravityPx();
    let any = false;
    for (const r of rest) {
      if (!r.falling) continue;
      const k = Math.min(1, dt * 12);
      r.x += (r.tx - r.x) * k;
      r.tilt += (r.rest - r.tilt) * k;
      if (fall(r, dt, g, floor)) {
        r.falling = false;
        r.x = r.tx;
        r.tilt = r.rest;
        settleRest(r);
      } else any = true;
      place(r);
    }
    fallRaf = any ? requestAnimationFrame(fallStep) : 0;
    if (!any) fallLast = 0;
  };
  /** A resting item is a button: it can be focused and brought back. */
  const settleRest = (r: Rest) => {
    const el = r.el;
    delete el.dataset.carry;
    el.removeAttribute('aria-hidden');
    el.tabIndex = 0;
    el.setAttribute(
      'aria-label',
      `bring the ${r.kind === 'vase' ? 'vase' : 'bouquet'} back to the garden`,
    );
  };
  /** Removes an item from the screen's floor. */
  const drop = (r: Rest) => {
    const i = rest.indexOf(r);
    if (i >= 0) rest.splice(i, 1);
    r.falling = false;
    r.el.remove();
  };
  /** Where `r` lands: the free slot nearest `x`; with no room left, the oldest item goes back to the garden. */
  const slot = (r: Rest, x: number) => {
    const [lo, hi] = limits();
    for (;;) {
      const at = freeX(
        rest.filter((o) => o !== r),
        r.w,
        x,
        lo,
        hi,
      );
      if (at !== null) return at;
      const old = rest.find((o) => o !== r);
      if (!old) return clamp(x, lo, Math.max(lo, hi - r.w));
      bringBack(old);
    }
  };
  /** Sets `r` on the floor at about `x`: it falls from where it is, or is simply there (reduced motion, reload). */
  const land = (r: Rest, x: number, instant = false) => {
    const tx = slot(r, x);
    r.rest =
      r.kind === 'vase' ? 0 : tx + r.w / 2 < window.innerWidth / 2 ? 9 : -9;
    r.tx = tx;
    r.bounces = 0;
    r.vy = 0;
    if (!rest.includes(r)) rest.push(r);
    paint(r, col);
    if (instant || still()) {
      r.x = tx;
      r.y = floorY() - r.h;
      r.tilt = r.rest;
      r.falling = false;
      settleRest(r);
      place(r);
      return;
    }
    r.falling = true;
    r.el.setAttribute('aria-hidden', 'true');
    r.el.tabIndex = -1;
    place(r);
    if (!fallRaf) fallRaf = requestAnimationFrame(fallStep);
  };

  /** A fixed button for a bouquet or the vase: pressing it picks it up, a tap or Enter brings it back. */
  const mk = (kind: Kind, bq: Bouquet | null) => {
    const r = make(kind, bq);
    r.el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (carry || !rest.includes(r) || r.falling) return;
      e.preventDefault();
      cx = e.clientX;
      cy = e.clientY;
      startCarry(r, 'rest', e.clientX - r.x, e.clientY - r.y, e);
    });
    // Keyboard and assistive tech: a click with no pointer behind it (a tap is handled on release).
    r.el.addEventListener('click', (e) => {
      if (e.detail === 0 && rest.includes(r)) bringBack(r);
    });
    return r;
  };
  /** Takes a rested item back into the garden: a bouquet lies by the bucket, the vase stands in its place. */
  const bringBack = (r: Rest) => {
    drop(r);
    if (r.kind === 'vase') {
      w.vase.gone = false;
      placeVase(w);
      const q = r.bq;
      if (q) {
        w.bqs.push(q);
        q.x = w.vase.x;
        q.y = w.vase.y;
        toVase(w, q);
      }
      announce('the vase is back in the garden');
    } else if (r.bq) {
      const q = r.bq;
      lay(w, q, ...spot(w));
      q.x = q.tx;
      q.y = q.ty;
      q.rot = q.trot;
      w.bqs.push(q);
      announce('the bouquet is back in the garden');
    }
    save();
    settle();
  };
  /** Where an item of the garden is on screen, for starting its fall. */
  const startAt = (r: Rest, gx: number, gy: number) => {
    const b = canvas.getBoundingClientRect();
    r.x = b.left + gx - r.w / 2;
    r.y = Math.max(0, b.top + gy - r.h * 0.9);
  };
  /** The keyboard's way to drop: the laid bouquet, else the vase (with what stands in it). */
  const dropFromGarden = () => {
    const q = laid(w).at(-1);
    let r: Rest;
    if (q) {
      lift(w, q);
      r = mk('bq', q);
      startAt(r, q.x, q.y);
    } else if (!w.vase.gone) {
      const vq = w.vase.bq;
      if (vq) lift(w, vq);
      w.vase.gone = true;
      r = mk('vase', vq);
      startAt(r, w.vase.x, w.vase.y);
    } else return;
    land(r, r.x);
    announce(
      `the ${r.kind === 'vase' ? 'vase' : 'bouquet'} is at the bottom of the screen`,
    );
    save();
    settle();
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
      carryTo(c);
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
    | { kind: 'vase' }
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
    // The vase's body takes the vase and what stands in it; the flowers above the rim come out on their own.
    if (onVase(w, x, y)) return { kind: 'vase' };
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

  /** Moves the carried element to the pointer, swinging by `sw` radians. */
  const carryTo = (c: NonNullable<typeof carry>) => {
    c.r.x = cx - c.ax;
    c.r.y = cy - c.ay;
    c.r.tilt = (c.sw * 180) / Math.PI;
    place(c.r);
  };
  /** Starts carrying `r` (a fresh element for something from the garden, or a rested one) with the pointer `ax`, `ay` into it. */
  const startCarry = (
    r: Rest,
    from: 'lie' | 'vase' | 'garden' | 'rest',
    ax: number,
    ay: number,
    e: PointerEvent,
  ) => {
    const i = rest.indexOf(r);
    const rx = r.x;
    if (i >= 0) rest.splice(i, 1);
    r.falling = false;
    r.el.dataset.carry = '';
    r.el.removeAttribute('aria-label');
    r.el.setAttribute('aria-hidden', 'true');
    r.el.tabIndex = -1;
    carry = {
      r,
      from,
      sw: 0,
      swv: 0,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      ax,
      ay,
      rx,
    };
    carryTo(carry);
    setCursor('grabbing');
    if (from === 'rest') {
      // Nothing holds the pointer here, so the window follows it.
      dragId = e.pointerId;
      window.addEventListener('pointermove', onWinMove);
      window.addEventListener('pointerup', onWinUp);
      window.addEventListener('pointercancel', onWinUp);
      const [lxx, lyy] = local(e);
      w.px = lxx;
      w.py = lyy;
      trail.length = 0;
      trail.push({ x: lxx, y: lyy, t: performance.now() });
    }
    save();
    settle();
  };
  const onWinMove = (e: PointerEvent) => {
    if (e.pointerId === dragId) onMove(e);
  };
  const onWinUp = (e: PointerEvent) => {
    if (e.pointerId !== dragId) return;
    cx = e.clientX;
    cy = e.clientY;
    release(e.type === 'pointercancel');
  };

  let lx = 0;
  let lt = 0;
  let moved = 0;
  const onMove = (e: PointerEvent) => {
    // The canvas and the window can both see one event.
    if (e.timeStamp === moved) return;
    moved = e.timeStamp;
    const [x, y] = local(e);
    w.px = x;
    w.py = y;
    w.hover = true;
    cx = e.clientX;
    cy = e.clientY;
    if (carry) carryTo(carry);
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
  };
  canvas.addEventListener('pointermove', onMove);
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
    if (hit.kind === 'bouquet' || hit.kind === 'vase') {
      canvas.setPointerCapture(e.pointerId);
      let r: Rest;
      let from: 'lie' | 'vase' | 'garden';
      if (hit.kind === 'bouquet') {
        from = hit.bq.mode === 'vase' ? 'vase' : 'lie';
        lift(w, hit.bq);
        r = mk('bq', hit.bq);
      } else {
        // The vase comes with what stands in it.
        const vq = w.vase.bq;
        if (vq) lift(w, vq);
        w.vase.gone = true;
        from = 'garden';
        r = mk('vase', vq);
      }
      paint(r, col);
      startCarry(r, from, r.w / 2, r.h * (r.kind === 'vase' ? 0.7 : 0.62), e);
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
      b.x = clamp(vx, BALL_EDGE, w.W - BALL_EDGE);
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
  const release = (cancelled = false) => {
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
      dragId = -1;
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
      const r = c.r;
      const q = r.bq;
      const tap =
        !cancelled &&
        Math.hypot(cx - c.x, cy - c.y) < 8 &&
        performance.now() - c.t < 500;
      const b = canvas.getBoundingClientRect();
      const inside =
        cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
      if (cancelled && c.from === 'rest') {
        // A cancelled drag puts a rested item back where it was lifted from.
        land(r, c.rx, true);
        announce(
          `the ${r.kind === 'vase' ? 'vase' : 'bouquet'} is at the bottom of the screen`,
        );
      } else if (tap && c.from === 'rest') bringBack(r);
      else if (!inside && !tap && !cancelled) {
        // Let go outside the garden: it falls to the bottom of the screen.
        land(r, r.x);
        announce(
          `the ${r.kind === 'vase' ? 'vase' : 'bouquet'} is at the bottom of the screen`,
        );
      } else if (r.kind === 'vase') bringBack(r);
      else if (q) {
        drop(r);
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
  canvas.addEventListener('pointerup', (e) => {
    cx = e.clientX;
    cy = e.clientY;
    release();
  });
  canvas.addEventListener('pointercancel', () => release(true));
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
  dropBtn?.addEventListener('click', () => {
    dropFromGarden();
    refocus(dropBtn);
  });
  // The floor moves with the window (and a phone's URL bar): what rests on it follows, still apart from its neighbours.
  window.addEventListener('resize', () => {
    const [lo, hi] = limits();
    const floor = floorY();
    let cursor = lo;
    for (const r of [...rest].sort((a, b) => a.tx - b.tx)) {
      const x = Math.max(r.tx, cursor);
      if (x + r.w > hi) {
        bringBack(r);
        continue;
      }
      r.tx = x;
      cursor = x + r.w + 6;
      if (!r.falling) {
        r.x = x;
        r.y = floor - r.h;
        place(r);
      }
    }
  });

  const repaint = () => {
    readColors();
    for (const r of rest) paint(r, col);
    if (carry) paint(carry.r, col);
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
        gone: w.vase.gone,
      }),
      rested: () =>
        rest.map((o) => {
          const r = o.el.getBoundingClientRect();
          return {
            kind: o.kind,
            falling: o.falling,
            full: !!o.bq,
            x: r.left,
            y: r.top,
            width: o.w,
            height: o.h,
            // Where the box is, before it is turned about its foot.
            left: o.x,
            top: o.y,
          };
        }),
      carrying: () => (carry ? carry.r.kind : null),
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
