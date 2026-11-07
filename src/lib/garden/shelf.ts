import type { Bouquet, Colors, Vase } from './core';
import { drawBouquet, drawVase } from './bouquet';

/**
 * Things dropped outside the garden: a bouquet or the vase, one small fixed button each with its own canvas. They fall to
 * the bottom of the viewport, bounce once and stay put while the page scrolls.
 */
export type Kind = 'bq' | 'vase';
export interface Rest {
  kind: Kind;
  /** The bouquet itself, or the one standing in the vase. */
  bq: Bouquet | null;
  el: HTMLButtonElement;
  cv: HTMLCanvasElement;
  w: number;
  h: number;
  /** Top left, viewport px. */
  x: number;
  y: number;
  /** Where x slides to while falling (clear of its neighbours and of the corners). */
  tx: number;
  vy: number;
  /** Degrees, and the angle it lands at. */
  tilt: number;
  rest: number;
  bounces: number;
  falling: boolean;
}

const SIZE: Record<Kind, [number, number]> = {
  bq: [84, 104],
  vase: [120, 150],
};
/** The desk's reset button sits in the bottom right corner; this much of the right edge stays free. */
const RESET = 84;
/** The left index column (`--index-w`, 7.5rem), from 1024 px. */
const INDEX = 120;
const GAP = 6;

const tok = (n: string, f: number) =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) ||
  f;
const wide = () => window.innerWidth >= 1024;

/** Viewport y of the floor: the sheet border's inner edge, plus the index strip below 1024 px (as the desk's `floorPad`). */
export const floorY = () =>
  window.innerHeight - tok('--inset', 12) - (wide() ? 0 : tok('--strip-h', 44));

/** Leftmost x and the right limit: clear of the index and of the reset button. */
export const limits = (): [number, number] => [
  tok('--inset', 12) + (wide() ? INDEX + 32 : 6),
  window.innerWidth - RESET,
];

/**
 * Copied from `src/lib/desk/materials.ts` (WORLD_SCALE, GRAVITY), not imported: an import makes the bundler put that
 * file in a chunk shared with the desk, outside the garden's size budget. The test in shelf.test.ts keeps them equal.
 */
export const TABLE_WORLD_M = 1.6;
export const GRAVITY = 9.81 * (1.6 / 1.2);

/**
 * Gravity in px/s^2: the desk's world gravity times how many px one world unit is on screen. The table (1.6 units) fills
 * about 0.7 of the poster frame, so a fall here takes the time a fall off the table does.
 */
export const gravityPx = () => {
  const f =
    document.querySelector('.poster-frame')?.getBoundingClientRect().width ||
    window.innerWidth * 0.8;
  return (GRAVITY * 0.7 * f) / TABLE_WORLD_M;
};

/** One fall step. Lands on `floor`, bounces once and comes to rest. Returns true once at rest. */
export function fall(
  s: Pick<Rest, 'y' | 'vy' | 'h' | 'bounces'>,
  dt: number,
  g: number,
  floor: number,
): boolean {
  s.y += s.vy * dt + 0.5 * g * dt * dt;
  s.vy += g * dt;
  if (s.y + s.h < floor) return false;
  s.y = floor - s.h;
  if (s.bounces === 0 && s.vy > 300) {
    s.vy *= -0.28;
    s.bounces = 1;
    return false;
  }
  s.vy = 0;
  return true;
}

/** The x nearest `want` where a box `w` wide fits between the boxes in `taken`, inside [lo, hi]; null when nothing fits. */
export function freeX(
  taken: { x: number; w: number }[],
  w: number,
  want: number,
  lo: number,
  hi: number,
): number | null {
  const fits = (x: number) =>
    x >= lo &&
    x + w <= hi &&
    taken.every((t) => x + w + GAP <= t.x || x >= t.x + t.w + GAP);
  const cands = [want];
  for (const t of taken) cands.push(t.x + t.w + GAP, t.x - w - GAP);
  let best: number | null = null;
  for (const c of cands) {
    const x = Math.min(Math.max(c, lo), hi - w);
    if (
      fits(x) &&
      (best === null || Math.abs(x - want) < Math.abs(best - want))
    )
      best = x;
  }
  return best;
}

export function make(kind: Kind, bq: Bouquet | null): Rest {
  const [w, h] = SIZE[kind];
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'garden-pin';
  el.dataset.kind = kind;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.transformOrigin = `50% ${Math.round(((h - 3) / h) * 100)}%`;
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.width = `${w}px`;
  cv.style.height = `${h}px`;
  el.append(cv);
  document.body.append(el);
  return {
    kind,
    bq,
    el,
    cv,
    w,
    h,
    x: 0,
    y: 0,
    tx: 0,
    vy: 0,
    tilt: 0,
    rest: 0,
    bounces: 0,
    falling: false,
  };
}

/** Draws the item into its canvas, foot at the bottom centre. */
export function paint(r: Rest, col: Colors) {
  const c = r.cv.getContext('2d');
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (r.cv.width !== Math.round(r.w * dpr)) {
    r.cv.width = Math.round(r.w * dpr);
    r.cv.height = Math.round(r.h * dpr);
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, r.w, r.h);
  const x = r.w / 2;
  const y = r.h - 3;
  if (r.kind === 'bq') {
    if (r.bq)
      drawBouquet(c, col, { ...r.bq, wrap: 1, tie: 1, lift: 0 }, x, y, 0, 0.68);
    return;
  }
  const s = 0.72;
  const v: Vase = {
    x,
    y,
    s,
    gone: false,
    bq: r.bq
      ? {
          ...r.bq,
          wrap: 0,
          tie: 0,
          x,
          y: y - 24 * s,
          rot: 0,
          s: 0.8 * s,
        }
      : null,
  };
  drawVase(c, v, col);
}

/** Moves the element: top left at (r.x, r.y), turned `r.tilt` degrees about its foot. */
export function place(r: Rest) {
  r.el.style.transform = `translate(${r.x}px, ${r.y}px) rotate(${r.tilt}deg)`;
}
