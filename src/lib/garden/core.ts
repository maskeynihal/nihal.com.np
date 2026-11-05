export interface Gust {
  x: number;
  y: number;
  s: number;
}
export interface Flower {
  x: number;
  y: number;
  h: number;
  kind: number;
  ph: number;
  r: number;
  /** Head position, refreshed every draw. */
  hx: number;
  hy: number;
  lean: number;
}
export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  claimed: boolean;
  held: boolean;
  /** Seconds since the ball was dropped by a dog; -1 while it is still in play. */
  done: number;
  rx: number;
  ry: number;
}
export interface Colors {
  stroke: string;
  page: string;
}
export interface World {
  W: number;
  H: number;
  /** Ground band the dogs and balls live in. */
  g0: number;
  g1: number;
  t: number;
  gusts: Gust[];
  flowers: Flower[];
  balls: Ball[];
  px: number;
  py: number;
  /** Pointer is over the garden. */
  hover: boolean;
}

export const rng = (s: number) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const clamp = (v: number, a: number, b: number) =>
  v < a ? a : v > b ? b : v;
export const TAU = Math.PI * 2;

/** Wind push at a point: layered sines for the ambient breeze plus the pointer's gust trail. */
export function windAt(w: World, x: number, y: number): number {
  let v =
    Math.sin(x * 0.008 + w.t * 0.9) * 0.35 +
    Math.sin(x * 0.021 - w.t * 1.7 + 1) * 0.2 +
    Math.sin(w.t * 0.4 + x * 0.002) * 0.25;
  for (const g of w.gusts) {
    const dx = x - g.x;
    const dy = y - g.y;
    v += g.s * Math.exp(-(dx * dx) / 18000 - (dy * dy) / 28000);
  }
  return v;
}
