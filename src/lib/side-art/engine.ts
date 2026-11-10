/**
 * Section art engine: one fixed canvas under the page, one drawing per section in the column the
 * text leaves empty. Loaded as its own chunk after idle, from 1024 px (see SectionArt.astro).
 *
 *  - Columns are measured from the real markup: each `section[data-art]` has a `.section-grid` and a
 *    `.section-body`; the empty column is the grid minus the body. Re-measured on resize, when the
 *    sheet changes height, and when fonts load.
 *  - The canvas takes no layout space and no pointer events. Pointer and taps are read from the
 *    window, so text stays selectable; presses on links, panels, controls and the desk are ignored.
 *  - At most 30 fps, DPR at most 2, asleep when no column is on screen or the tab is hidden. Under
 *    reduced motion (the `data-motion` attribute, which also follows the OS) a settled still frame
 *    is drawn instead of a loop.
 *  - The level comes from `data-lamp` on the root and `nihal:lamp`; colours are the page tokens
 *    (`--stroke`, `--page`) read from the computed style.
 *
 * Calm: only the column in view runs at full rate (the others ease to a still frame, ticking at 2 fps), and
 * after 20 s with no input the canvas holds one still frame until the next scroll or pointer move.
 */
import { E, setCtx, clamp } from './core';
import type { Col, Scene } from './core';
import { kite } from './kite';
import { ivy } from './ivy';
import { circuit } from './circuit';
import { lamp } from './lamp';
import { tree } from './tree';
import { dog } from './dog';
import type { ArtName } from './names';
import { TUNE } from './tuning';

const VARIANTS: Record<ArtName, Scene> = {
  kite,
  ivy,
  circuit,
  lamp,
  tree,
  dog,
};
// How bright the sky is at each lamp level (1 day ... 0 night); the sky eases toward it.
const DAY = { 4: 1, 3: 0.78, 2: 0.5, 1: 0.2, 0: 0 };
const MIN_W = 1024;
/**
 * Each column has two rects, in column-local px. `c.safe` is the measured empty column: every moving
 * character is confined to it with its own full extent (named constants at the top of each drawing file).
 * `c.clip` is the real canvas clip, wider: out to the sheet's inner border (at most CLIP_OUT), up and down
 * into the section padding (CLIP_V), and only CLIP_TEXT toward the text. Scenery may reach the clip and
 * fades there; nothing with a body meets a hard clip line.
 */
const CLIP_OUT = 160;
const CLIP_V = 70;
const CLIP_TEXT = 24;

let cv: HTMLCanvasElement;
let g: CanvasRenderingContext2D;
let cols: Col[] = [];
const keep = new Map<string, Col>();
let pageH = 0;
let raf = 0;
let last = 0;
let running = false;
let lastSy = 0;
let lcx = 0;
let lcy = 0;
let lastInput = 0;
const settled = new Set<string>();
const root = document.documentElement;

const isReduced = (): boolean =>
  root.dataset['motion'] === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = (): boolean => innerWidth >= MIN_W;

/** "#1f3fe0", "rgb(255 255 255 / .85)" or "rgb(1, 2, 3)" -> "r,g,b". */
function triple(css: string, fallback: string): string {
  const v = css.trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    let h = m[1]!;
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(v);
  if (m)
    return `${Math.round(+m[1]!)},${Math.round(+m[2]!)},${Math.round(+m[3]!)}`;
  return fallback;
}

function readLamp(): void {
  const n = Number(root.dataset['lamp']);
  E.lamp = n >= 0 && n <= 4 && Number.isInteger(n) ? n : 1;
  E.dayT = DAY[E.lamp as 0 | 1 | 2 | 3 | 4];
  E.dark = E.lamp <= 1;
  const cs = getComputedStyle(root);
  E.rgb = triple(
    cs.getPropertyValue('--stroke'),
    E.dark ? '255,255,255' : '31,63,224',
  );
  E.pg = triple(
    cs.getPropertyValue('--page'),
    E.dark ? '31,63,224' : '246,245,241',
  );
  if (isReduced()) E.day = E.dayT;
  kick();
}

/* ---- layout ---- */
function layout(): void {
  if (!wide()) {
    running = false;
    if (g) g.clearRect(0, 0, cv.width, cv.height);
    return;
  }
  E.W = innerWidth;
  E.H = innerHeight;
  E.dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(E.W * E.dpr);
  const h = Math.round(E.H * E.dpr);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const sc = scrollY;
  const next: Col[] = [];
  document
    .querySelectorAll<HTMLElement>('section[data-art]')
    .forEach((sec, i) => {
      const grid = sec.querySelector('.section-grid');
      const body = sec.querySelector('.section-body');
      if (!grid || !body) return;
      const sr = sec.getBoundingClientRect();
      const gr = grid.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      const textLeft = sec.dataset['side'] === 'left';
      const l = textLeft ? br.right + 16 : gr.left;
      const r = textLeft ? gr.right : br.left - 16;
      if (r - l < 200) return;
      const name = sec.dataset['art'] as ArtName;
      const v = VARIANTS[name];
      if (!v) return;
      const t = sr.top + sc;
      let b = sr.bottom + sc;
      // Ivy hangs down into the real garden: its column runs on below the section, through the gap,
      // down into the garden's grass (a fixed fraction of the garden canvas, see tuning.ts).
      let ext = 0;
      let bucketX: number | null = null;
      if (name === 'ivy') {
        const gc = document.querySelector('.garden-canvas');
        if (gc) {
          const rr = gc.getBoundingClientRect();
          const ground = rr.top + sc + rr.height * TUNE.gardenRoot;
          // The garden's bucket stands this far in from the canvas's right edge (src/lib/garden/bucket.ts).
          bucketX = rr.left + rr.width - (rr.width < 600 ? 50 : 96) - l;
          if (ground > b) {
            ext = ground - b;
            b = ground;
          }
        }
      }
      const cw = r - l;
      const ch = b - t;
      // The heading's baseline, in column px from the section top: the ivy's seed (and the tree's) sits level with it.
      const hd = sec.querySelector('.section-heading');
      const hr = hd ? hd.getBoundingClientRect() : null;
      const hb = hr ? hr.top + sc - t + hr.height * 0.8 : 0;
      const old = keep.get(name);
      let c;
      if (
        old &&
        Math.abs(old.w - cw) < 24 &&
        Math.abs(old.h - ch) < 30 &&
        Math.abs((old.hb || 0) - hb) < 14
      ) {
        c = old;
        c.w = cw;
        c.h = ch;
      } else {
        c = {
          id: name,
          v,
          S: null,
          w: cw,
          h: ch,
          phone: false,
          seed: i * 17 + 3,
          mx: 0,
          my: 0,
          bleed: 0,
          boost: 0,
          ext: 0,
          facing: 1,
          bucketX: null,
        };
        keep.set(name, c);
      }
      c.ext = ext;
      c.hb = hb;
      c.bucketX = bucketX;
      c.facing = textLeft ? -1 : 1; // which side the text is on: -1 left, 1 right
      const inset =
        parseFloat(getComputedStyle(root).getPropertyValue('--inset')) || 12;
      const out = clamp(
        textLeft ? innerWidth - inset - r : l - inset,
        0,
        CLIP_OUT,
      );
      c.safe = { x0: 0, y0: 0, x1: cw, y1: ch };
      c.clip = {
        x0: textLeft ? -CLIP_TEXT : -out,
        x1: textLeft ? cw + out : cw + CLIP_TEXT,
        y0: -CLIP_V,
        y1: ch + CLIP_V,
      };
      c.l = l;
      c.t = t;
      c.b = b;
      c.r = r;
      next.push(c);
    });
  cols = next;
  pageH = root.scrollHeight;
  kick();
}

/* ---- loop ---- */
function updateEnv(dt: number): void {
  E.tt += dt * 0.45;
  const sy = scrollY;
  E.sy = sy;
  const mx = Math.max(1, pageH - E.H);
  E.ref = sy + E.H * (0.35 + 0.65 * clamp(sy / mx, 0, 1));
  if (!E.init) {
    lastSy = sy;
    E.init = true;
  }
  const rv = clamp((sy - lastSy) / Math.max(dt, 1e-3), -4000, 4000);
  lastSy = sy;
  E.sv += (rv - E.sv) * (1 - Math.exp(-dt * 7));
  if (E.present) {
    const k = 1 - Math.exp(-dt * 14);
    E.pvx +=
      (clamp((E.cx - lcx) / Math.max(dt, 1e-3), -3000, 3000) - E.pvx) * k;
    E.pvy +=
      (clamp((E.cy - lcy) / Math.max(dt, 1e-3), -3000, 3000) - E.pvy) * k;
  } else {
    E.pvx = E.pvy = 0;
  }
  lcx = E.cx;
  lcy = E.cy;
  E.pspeed = Math.hypot(E.pvx, E.pvy);
  E.day += (E.dayT - E.day) * (1 - Math.exp(-dt * 1.15));
}
function prep(c: Col): void {
  c.mx = E.cx - c.l;
  c.my = E.cy + E.sy - c.t;
  c.mIn =
    E.present && c.mx > -24 && c.mx < c.w + 24 && c.my > -24 && c.my < c.h + 24;
  c.prog = clamp((E.ref - c.t) / c.h, 0, 1);
  c.v0 = Math.max(0, E.sy - c.t - 60);
  c.v1 = Math.min(c.h, E.sy + E.H - c.t + 60);
}
const visible = (c: Col): boolean => c.t < E.sy + E.H + 80 && c.b > E.sy - 80;
const getS = (c: Col): Col => (c['S'] ??= (c['v'] as Scene).init(c));

function drawAll(dt: number, doUpdate: boolean): number {
  const vis = cols.filter(visible);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  if (!vis.length) return 0;
  // Calm: the column with the most of the viewport is the live one; the rest ease toward a still frame.
  let best: Col | null = null;
  let bestO = 0;
  for (const c of vis) {
    const o = Math.min(c.b, E.sy + E.H) - Math.max(c.t, E.sy);
    if (o > bestO) {
      bestO = o;
      best = c;
    }
  }
  for (const c of vis) {
    prep(c);
    const s = getS(c);
    const id = c.id as ArtName;
    const speed = TUNE.speed[id];
    const strength = TUNE.strength[id];
    const want = c === best ? 1 : 0;
    c.live =
      c.live === undefined
        ? want
        : c.live + (want - c.live) * (1 - Math.exp((-dt * 3) / TUNE.calm.ease));
    c.snap = c.live < 0.05;
    // a scene's draw reads what its update sets: never draw a state that has not been updated once
    if (c.v.update && !s.primed) {
      c.v.update(c, s, 1 / 30);
      s.primed = true;
    }
    if (doUpdate && c.v.update) {
      if (!c.snap) c.v.update(c, s, dt * speed * c.live);
      else {
        // still: one tiny step a few times a second (keeps scroll-driven growth in step, nothing visibly moves)
        c.acc = (c.acc ?? 0) + dt;
        if (c.acc >= 1 / TUNE.calm.stillFps) {
          c.acc = 0;
          c.v.update(c, s, (1 / 30) * speed);
        }
      }
    }
    c.boost *= Math.exp(-dt * TUNE.click.ease);
    E.str = strength + (TUNE.click.strength - strength) * c.boost;
    g.setTransform(E.dpr, 0, 0, E.dpr, c.l * E.dpr, (c.t - E.sy) * E.dpr);
    g.save();
    g.beginPath();
    g.rect(c.clip.x0, c.clip.y0, c.clip.x1 - c.clip.x0, c.clip.y1 - c.clip.y0);
    g.clip();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    c.v.draw(c, s);
    g.restore();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  return vis.length;
}

function frame(now: number): void {
  raf = 0;
  if (!running) return;
  const el = now - last;
  if (el < 1000 / 30 - 3) {
    raf = requestAnimationFrame(frame);
    return;
  }
  last = now;
  if (now - lastInput > TUNE.calm.idle * 1000) {
    // no input for a while: hold one still frame; the next scroll or pointer move wakes the loop
    updateEnv(0.001);
    drawAll(0, false);
    running = false;
    return;
  }
  const dt = Math.min(0.05, el / 1000);
  updateEnv(dt);
  const n = drawAll(dt, true);
  if (!n) {
    running = false; // nothing on screen: sleep until a scroll or resize wakes it
    return;
  }
  raf = requestAnimationFrame(frame);
}

function staticFrame(): void {
  E.reduced = true;
  updateEnv(1 / 30);
  E.day = E.dayT;
  for (const c of cols.filter(visible)) {
    prep(c);
    const s = getS(c);
    const key = `${c.id}:${Math.round(c.h)}`;
    if (!settled.has(key)) {
      settled.add(key);
      if (c.v.update)
        for (let i = 0; i < 240; i++) {
          prep(c);
          c.v.update(c, s, 1 / 30);
        }
    }
  }
  drawAll(0, false);
}

/** Input arrived (scroll, pointer, key): wake the loop and restart the idle clock. */
function touch(): void {
  lastInput = performance.now();
  kick();
}

function kick(): void {
  if (!cv || !wide()) return;
  E.reduced = isReduced();
  if (E.reduced) {
    running = false;
    if (!raf)
      raf = requestAnimationFrame(() => {
        raf = 0;
        staticFrame();
      });
    return;
  }
  if (document.hidden) return;
  if (!running) {
    running = true;
    last = performance.now() - 40;
  }
  if (!raf) raf = requestAnimationFrame(frame);
}

/* ---- input: window level, the canvas never takes events ---- */
const SKIP =
  'a,button,input,textarea,select,label,summary,iframe,h1,h2,h3,.paper,.panel,.lamp,.sheet-index,.garden,[data-desk],[role="button"]';
let down: { x: number; y: number; t: number } | null = null;

function doTap(x: number, y: number): void {
  const py = y + scrollY;
  for (const c of cols) {
    if (x >= c.l && x <= c.r && py >= c.t && py <= c.b) {
      prep(c);
      const s = getS(c);
      if (c.v.tap) c.v.tap(c, s, x - c.l, py - c.t);
      c.boost = 1;
    }
  }
  kick();
}

function listen(): void {
  addEventListener(
    'pointermove',
    (e) => {
      E.cx = e.clientX;
      E.cy = e.clientY;
      E.present = true;
      touch();
    },
    { passive: true },
  );
  root.addEventListener('pointerleave', () => {
    E.present = false;
  });
  addEventListener('blur', () => {
    E.present = false;
  });
  addEventListener(
    'pointerdown',
    (e) => {
      const t = e.target as Element | null;
      if (t && t.closest && t.closest(SKIP)) {
        down = null;
        return;
      }
      lastInput = performance.now();
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      E.cx = e.clientX;
      E.cy = e.clientY;
      E.present = true;
    },
    { passive: true },
  );
  addEventListener(
    'pointerup',
    (e) => {
      if (!down) {
        if (e.pointerType === 'touch') E.present = false;
        return;
      }
      const d = down;
      down = null;
      if (
        Math.hypot(e.clientX - d.x, e.clientY - d.y) < 12 &&
        performance.now() - d.t < 600
      )
        doTap(e.clientX, e.clientY);
      if (e.pointerType === 'touch') E.present = false;
    },
    { passive: true },
  );
  addEventListener('pointercancel', (e) => {
    down = null;
    if (e.pointerType === 'touch') E.present = false;
  });
  addEventListener('scroll', touch, { passive: true });
  addEventListener('keydown', touch, { passive: true });
  addEventListener('resize', layout);
  addEventListener('nihal:lamp', readLamp);
  addEventListener('nihal:theme', readLamp);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // hidden tab: stop the loop entirely
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else touch();
  });
  // Motion toggled in the page (the attribute) or in the OS: settle or resume.
  new MutationObserver(kick).observe(root, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  const sheet = document.querySelector('.sheet');
  if (sheet && 'ResizeObserver' in window)
    new ResizeObserver(() => layout()).observe(sheet);
  document.fonts?.ready.then(layout).catch(() => {});
  addEventListener('load', layout);
}

export function mountSideArt(canvas: HTMLCanvasElement): void {
  cv = canvas;
  g = cv.getContext('2d')!;
  setCtx(g);
  lastInput = performance.now();
  readLamp();
  E.day = E.dayT;
  listen();
  layout();
}
