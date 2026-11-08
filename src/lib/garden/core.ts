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
  /** Growth 0..1: stem rises, leaf unfolds, bud opens. */
  grow: number;
  /** Head position, refreshed every draw. */
  hx: number;
  hy: number;
  lean: number;
  /** Lean toward the pointer, eased. */
  pl: number;
}
/** A flower that has been cut: it drifts to the bucket or sits in the bouquet. */
export interface Cut {
  kind: number;
  r: number;
  h: number;
  ph: number;
}
export interface Held {
  f: Flower;
  /** Stem foot, easing from where it grew to the pointer. */
  bx: number;
  by: number;
  /** Sideways swing of the stem, from pointer speed. */
  sw: number;
  swv: number;
}
export interface Flying {
  cut: Cut;
  /** Start and end of the stem foot and of the head. */
  a: [number, number, number, number];
  b: [number, number, number, number];
  t: number;
  dur: number;
}
export interface Bloom {
  cut: Cut;
  ang: number;
  len: number;
}
export interface Bucket {
  x: number;
  y: number;
  s: number;
  items: Bloom[];
  /** Everything ever dropped in, shown as a count. */
  count: number;
}
/** A bunch of cut flowers, drawn from the foot of the stems. `lie` rests on the grass, `vase` stands in the vase. */
export interface Bouquet {
  items: Bloom[];
  mode: 'wrap' | 'lie' | 'vase';
  x: number;
  y: number;
  rot: number;
  s: number;
  /** Where a bouquet at rest eases to. */
  ts: number;
  tx: number;
  ty: number;
  trot: number;
  /** Wrapping progress 0..1 while mode is `wrap`. */
  k: number;
  /** Flowers lifted out of the bucket, paper folded round the stems, ribbon tied; each 0..1. */
  lift: number;
  wrap: number;
  tie: number;
}
/** The sheet of wrapping paper on the ground by the bucket. */
export interface Paper {
  x: number;
  y: number;
  /** Where it rests when let go. */
  hx: number;
  hy: number;
  /** Appears 0..1. */
  t: number;
  drag: boolean;
}
export interface Vase {
  x: number;
  y: number;
  s: number;
  bq: Bouquet | null;
  /** Taken out of the garden: carried, or dropped to the bottom of the screen. */
  gone: boolean;
}
export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** A dog is running for it. */
  claimed: boolean;
  /** In a dog's mouth. */
  held: boolean;
  /** Pressed and carried by the pointer. */
  grabbed: boolean;
  /** Dogs go for it (set when it is thrown or let go, cleared when a dog drops it). */
  fetch: boolean;
  /** Seconds before dogs try this ball again after one gave up on it. */
  wait: number;
  /** Removed by a newer ball: 0 normally, then rises 0..1 as it shrinks away. */
  fade: number;
  spin: number;
  /** Squash on landing, 0..1. */
  sq: number;
  /** Where the ball sat against the pointer when it was picked up; eases to 0 so it does not jump. */
  ox: number;
  oy: number;
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
  bucket: Bucket;
  paper: Paper | null;
  bqs: Bouquet[];
  vase: Vase;
  flying: Flying[];
  held: Held | null;
  /** Most flowers the meadow carries, where picked ones will regrow, and the next free sprout. */
  cap: number;
  spots: { x: number; y: number; t: number }[];
  sprout: number;
  px: number;
  py: number;
  /** Pointer is over the garden, or has been (touch). */
  hover: boolean;
}

export const rng = (s: number) => () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Slot order for a fan, centre first then out to each side; and how far the bucket's rim stands above the foot. */
export const offset = (i: number) =>
  i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2);
export const mouthY = 46;

/** Nearest a ball's centre may be to the left or right edge: a dog's nose reaches about 20 px past a ball it holds. */
export const BALL_EDGE = 24;

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
