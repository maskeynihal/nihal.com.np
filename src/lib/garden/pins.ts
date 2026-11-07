import type { Bouquet, Colors } from './core';
import { drawBouquet } from './bouquet';

/** A bouquet pinned to a viewport edge, or being carried there: one small fixed button with its own canvas. */
export type Edge = 'l' | 'r' | 't' | 'b';
export interface Pin {
  bq: Bouquet;
  el: HTMLButtonElement;
  cv: HTMLCanvasElement;
  edge: Edge;
  /** Distance along the edge, in px from the viewport's top (sides) or left (top, bottom). */
  along: number;
}

export const PW = 84;
export const PH = 104;
const MARGIN = 6;
/** Keeps clear of the lamp in the top right. */
const LAMP = 132;
/** The left index column, from 1024 px. */
const INDEX = 120;

const wide = () => window.innerWidth >= 1024;
const inset = () => (wide() ? 24 : 12);
const strip = () => (wide() ? 0 : 44);

/** Draws the bouquet into a pin's canvas, foot at the bottom centre. */
export function paintPin(cv: HTMLCanvasElement, col: Colors, bq: Bouquet) {
  const c = cv.getContext('2d');
  if (!c) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== PW * dpr) {
    cv.width = PW * dpr;
    cv.height = PH * dpr;
  }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, PW, PH);
  drawBouquet(
    c,
    col,
    { ...bq, wrap: 1, tie: 1, lift: 0 },
    PW / 2,
    PH - 6,
    0,
    0.68,
  );
}

export function makePin(label: string): {
  el: HTMLButtonElement;
  cv: HTMLCanvasElement;
} {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'garden-pin';
  el.setAttribute('aria-label', label);
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.width = `${PW}px`;
  cv.style.height = `${PH}px`;
  el.append(cv);
  document.body.append(el);
  return { el, cv };
}

/** The edge a drop at viewport point (x, y) pins to, or null. The left edge is the index column on wide screens. */
export function edgeAt(x: number, y: number): Edge | null {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const zone = 44;
  const d: [Edge, number][] = [
    ['r', W - x],
    ['b', H - y - strip()],
    ['t', y],
  ];
  if (!wide()) d.push(['l', x]);
  let best: Edge | null = null;
  let bd = zone;
  for (const [e, v] of d) {
    if (v < bd) {
      bd = v;
      best = e;
    }
  }
  // The top right belongs to the lamp.
  if (best === 't' && x > W - LAMP) return 'r';
  return best;
}

/** Puts a pin on its edge, tilted, inside the sheet border and clear of the index, lamp and phone strip. */
export function placePin(p: Pin) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const ins = inset() + MARGIN;
  const bottom = H - PH - ins - strip();
  const side = (a: number) => Math.max(LAMP, Math.min(a, bottom));
  const row = (a: number) => {
    const lo = wide() ? ins + INDEX + 32 : ins;
    return Math.max(lo, Math.min(a, W - PW - (p.edge === 't' ? LAMP : ins)));
  };
  let x: number;
  let y: number;
  if (p.edge === 'r') {
    x = W - PW - ins;
    y = side(p.along);
  } else if (p.edge === 'l') {
    x = ins;
    y = side(p.along);
  } else if (p.edge === 't') {
    y = ins;
    x = row(p.along);
  } else {
    y = bottom;
    x = row(p.along);
  }
  const tilt = { r: -16, l: 16, t: 172, b: 8 }[p.edge];
  p.el.dataset.edge = p.edge;
  p.el.style.left = `${x}px`;
  p.el.style.top = `${y}px`;
  p.el.style.setProperty('--tilt', `${tilt}deg`);
}

/** Moves the carried bouquet's element to the pointer, swinging by `sw` radians. */
export function carryTo(el: HTMLElement, x: number, y: number, sw: number) {
  el.style.left = `${x - PW / 2}px`;
  el.style.top = `${y - PH * 0.62}px`;
  el.style.setProperty('--tilt', `${(sw * 180) / Math.PI}deg`);
}
