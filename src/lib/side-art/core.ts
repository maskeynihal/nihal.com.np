/**
 * Shared state and hand-drawn helpers for the section art (src/lib/side-art). Plain canvas 2D, no
 * dependencies. Everything wobbles from a seeded hash, so lines never flicker between frames.
 * Drawings are typed loosely where the data is dynamic (`Pt`, `Col`, `Scene`); the helpers are strict.
 */
/** A point as the drawings pass them around. */
export type Pt = [number, number];
/** A column (engine.ts) as a drawing sees it: measured rects plus per-frame fields. Fields vary per scene. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Col = Record<string, any>;
/** A scene's own state, built by `init`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type State = Record<string, any>;
/** One drawing: init builds the state, update advances it, draw paints it, tap reacts to a press. */
export interface Scene {
  init(c: Col): State;
  update?(c: Col, s: State, dt: number): void;
  draw(c: Col, s: State): void;
  tap?(c: Col, s: State, x: number, y: number): void;
}

export const TAU = Math.PI * 2;
export const PI = Math.PI;

import { TUNE } from './tuning';

/** Frame environment shared by the engine and every drawing. */
export const E = {
  tt: 0,
  sy: 0,
  H: 0,
  W: 0,
  lamp: 1,
  day: 0.2,
  dayT: 0.2,
  rgb: '255,255,255',
  pg: '31,63,224',
  reduced: false,
  pvx: 0,
  pvy: 0,
  pspeed: 0,
  sv: 0,
  ref: 0,
  cx: -9999,
  cy: -9999,
  present: false,
  ms: 0,
  dpr: 1,
  dark: true,
  init: false,
  /** Stroke strength of the column being drawn (tuning.ts, raised briefly by a press). */
  str: 0.4,
};
export let g: CanvasRenderingContext2D;
export function setCtx(c: CanvasRenderingContext2D): void {
  g = c;
}

/* ---- seeded helpers ---- */
export const rnd = (a: number, b = 0): number => {
  const s = Math.sin(a * 127.1 + b * 311.7 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
export const clamp = (v: number, a: number, b: number): number =>
    v < a ? a : v > b ? b : v,
  lerp = (a: number, b: number, t: number): number => a + (b - a) * t,
  sm = (a: number, b: number, x: number): number => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
export const mulberry =
  (s: number): (() => number) =>
  () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
/* ---- drawing helpers (hand-drawn, wobble is seeded so it never flickers) ---- */
export const SA = (a: number): string =>
    `rgba(${E.rgb},${(a * E.str).toFixed(3)})`,
  PG = (a = 1): string => `rgba(${E.pg},${a})`;
export function ink(a = 0.85, w = 1.5): void {
  g.strokeStyle = SA(a);
  g.lineWidth = Math.min(
    TUNE.line.max,
    Math.max(TUNE.line.min, w * TUNE.line.scale),
  );
  g.stroke();
}
export function fillS(a: number): void {
  g.fillStyle = SA(a);
  g.fill();
}
export function fillP(a = 1): void {
  g.fillStyle = PG(a);
  g.fill();
}
/* wobbly polyline through pts [[x,y],...]; adds to current path (starts with moveTo unless cont) */
export function PL(
  pts: Pt[],
  seed = 1,
  amp = 0.8,
  close = false,
  cont = false,
  step = 14,
): void {
  const n = pts.length;
  let k = 0,
    first = true;
  const end = close ? n : n - 1;
  for (let i = 0; i < end; i++) {
    const a = pts[i]!,
      b = pts[(i + 1) % n]!;
    const dx = b[0] - a[0],
      dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const m = Math.max(1, Math.round(L / step)),
      nx = -dy / L,
      ny = dx / L;
    for (let j = 0; j < m; j++) {
      const t = j / m,
        r = (rnd(seed + k * 3.17, i) - 0.5) * 2 * amp;
      k++;
      const x = a[0] + dx * t + nx * r,
        y = a[1] + dy * t + ny * r;
      if (first && !cont) {
        g.moveTo(x, y);
      } else g.lineTo(x, y);
      first = false;
    }
  }
  if (!close) {
    const b = pts[n - 1]!;
    g.lineTo(
      b[0] + (rnd(seed, 99) - 0.5) * amp,
      b[1] + (rnd(seed, 98) - 0.5) * amp,
    );
  } else g.closePath();
}
export function LN(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
  amp: number,
): void {
  PL(
    [
      [x1, y1],
      [x2, y2],
    ],
    seed,
    amp,
  );
}
/* smooth closed/open curve through points (quadratic through midpoints) */
export function SM(pts: Pt[], close = false): void {
  const n = pts.length;
  if (n < 3) {
    g.moveTo(pts[0]![0], pts[0]![1]);
    g.lineTo(pts[n - 1]![0], pts[n - 1]![1]);
    return;
  }
  if (close) {
    const mx = (pts[n - 1]![0] + pts[0]![0]) / 2,
      my = (pts[n - 1]![1] + pts[0]![1]) / 2;
    g.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const p = pts[i]!,
        q = pts[(i + 1) % n]!;
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.closePath();
  } else {
    g.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i]!,
        q = pts[i + 1]!;
      g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    g.lineTo(pts[n - 1]![0], pts[n - 1]![1]);
  }
}
/* hand-drawn ellipse */
export function EL(
  x: number,
  y: number,
  rx: number,
  ry: number,
  seed = 1,
  amp = 0.7,
  rot = 0,
  a0 = 0,
  a1 = TAU,
): void {
  const full = a1 - a0 >= TAU - 0.01,
    m = Math.max(10, Math.round(Math.max(rx, ry) * 0.9 + 8)),
    pts: Pt[] = [];
  const co = Math.cos(rot),
    si = Math.sin(rot),
    cnt = full ? m : m + 1;
  for (let i = 0; i < cnt; i++) {
    const a = a0 + (a1 - a0) * (full ? i / m : i / m),
      j = 1 + ((rnd(seed + i * 1.7, 5) - 0.5) * 2 * amp) / Math.max(rx, ry, 6);
    const px = Math.cos(a) * rx * j,
      py = Math.sin(a) * ry * j;
    pts.push([x + px * co - py * si, y + px * si + py * co]);
  }
  SM(pts, full);
}
export function arcPts(
  x: number,
  y: number,
  r: number,
  a0: number,
  a1: number,
  n = 12,
): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    o.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return o;
}
/* hatch fill inside a rect-ish region using clip: caller sets path+clip */
export function hatch(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  gap: number,
  ang: number,
  a = 0.35,
  w = 1,
): void {
  g.save();
  g.beginPath();
  const c = Math.cos(ang),
    s = Math.sin(ang);
  const cx = (x0 + x1) / 2,
    cy = (y0 + y1) / 2,
    R = Math.hypot(x1 - x0, y1 - y0) / 2;
  for (let d = -R; d <= R; d += gap) {
    g.moveTo(cx + d * -s - c * R, cy + d * c - s * R);
    g.lineTo(cx + d * -s + c * R, cy + d * c + s * R);
  }
  g.strokeStyle = SA(a * TUNE.hatch);
  g.lineWidth = Math.max(0.7, w * TUNE.line.scale);
  g.stroke();
  g.restore();
}
export function circ(x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
}

export function glow(x: number, y: number, r: number, a: number): void {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, SA(a));
  gr.addColorStop(1, SA(0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}
