/**
 * Scroll motion for the objects on the table (v3.3 T3). A scroll is a nudge to the table: every
 * object slides a little along the table, towards the viewer when the page scrolls down (it lags
 * the table, like something on a tray), and eases back. Only a ball turns, and only by rolling:
 * its turn is exactly the distance it slid over its radius. Nothing else rotates or tilts.
 *
 * Pure maths, no three.js and no DOM, so the Scene chunk can use it without the physics engine
 * and so it can be unit tested at 60 Hz. Distances here are screen pixels; the caller converts to
 * metres with the table's scale, which is what keeps the push to about 6 px at every width.
 */

/** What one model does in response to scroll. */
export interface ScrollFeel {
  /** 0..1: share of the largest slide this object gets (lightness). */
  gain: number;
  /** A ball rolls by slide / radius (m). 0 for everything else, which never turns. */
  rollRadius: number;
}

const byModel: Record<string, ScrollFeel> = {
  'ball-s': { gain: 1, rollRadius: 0.035 },
  'ball-m': { gain: 0.95, rollRadius: 0.05 },
  'ball-l': { gain: 0.85, rollRadius: 0.07 },
  pacman: { gain: 0.55, rollRadius: 0 },
  ghost: { gain: 0.55, rollRadius: 0 },
  clock: { gain: 0.25, rollRadius: 0 },
  calendar: { gain: 0.25, rollRadius: 0 },
  cruiser: { gain: 0.3, rollRadius: 0 },
  'letter-n': { gain: 0.3, rollRadius: 0 },
  'letter-i': { gain: 0.3, rollRadius: 0 },
  'letter-h': { gain: 0.3, rollRadius: 0 },
  'letter-a': { gain: 0.3, rollRadius: 0 },
  'letter-l': { gain: 0.3, rollRadius: 0 },
  // The board and the laptop barely move.
  arduino: { gain: 0.1, rollRadius: 0 },
  laptop: { gain: 0.1, rollRadius: 0 },
};

export function scrollFeelFor(model: string): ScrollFeel {
  return byModel[model] ?? { gain: 0.1, rollRadius: 0 };
}

/** Largest slide on screen (px) for gain 1. */
export const MAX_PX = 6;
/** Scroll speed (px/s) scale: the push is `tanh(speed / SPEED_SCALE)` of the maximum. */
export const SPEED_SCALE = 2200;
/** Time constant (s) of the scroll-speed smoothing: a wheel step is a burst, not a jerk. */
export const SPEED_TAU = 0.09;
/** One frame that moves the page further than this (px) is a jump, not a scroll: ignored. */
export const JUMP_PX = 500;
/**
 * +1: scroll down slides the objects towards the viewer (down the screen); -1 the other way.
 * The page content moves up while scrolling down, the objects lag behind it.
 */
export const SLIDE_SIGN = 1;
/** Spring: natural frequency (Hz) and damping ratio. Close to critical: about 1.5 % overshoot. */
export const SPRING_HZ = 2.6;
export const SPRING_ZETA = 0.8;
/** At rest below this (px) with no speed: snapped to exactly zero. */
export const REST_PX = 0.02;

export interface Spring {
  /** Slide (px, towards the viewer is positive) and its speed (px/s). */
  x: number;
  v: number;
}

/** Low-pass of the scroll speed: `inst` is this frame's speed (px/s), `dt` the frame time (s). */
export function smoothSpeed(prev: number, inst: number, dt: number): number {
  const a = 1 - Math.exp(-Math.max(0, dt) / SPEED_TAU);
  return prev + (inst - prev) * a;
}

/** Speed of the page over one frame, or 0 when the frame was a jump. */
export function frameSpeed(deltaY: number, dt: number): number {
  if (Math.abs(deltaY) > JUMP_PX || dt <= 0) return 0;
  return deltaY / dt;
}

/** The slide (px) the spring is pulled towards for a smoothed scroll speed `vel` (px/s). */
export function targetPx(vel: number, feel: ScrollFeel): number {
  return SLIDE_SIGN * Math.tanh(vel / SPEED_SCALE) * MAX_PX * feel.gain;
}

/**
 * One step of the spring towards `target`. Semi-implicit Euler with a fixed sub-step, stable at
 * any frame time. `calm` settles faster and without overshoot (a held or moving object).
 */
export function stepSpring(
  s: Spring,
  target: number,
  dt: number,
  calm = false,
): void {
  const w = 2 * Math.PI * SPRING_HZ * (calm ? 1.8 : 1);
  const z = calm ? 1 : SPRING_ZETA;
  let left = Math.min(dt, 0.25);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 240);
    s.v += (w * w * (target - s.x) - 2 * z * w * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}

/** True when the spring has settled (so it can stop asking for frames and be set to zero). */
export function atRest(s: Spring, target: number): boolean {
  return target === 0 && Math.abs(s.x) < REST_PX && Math.abs(s.v) < REST_PX * 8;
}

/** A ball's turn (rad) for a slide of `distance` metres: it rolls. Everything else: exactly 0. */
export function rollAngle(distance: number, feel: ScrollFeel): number {
  return feel.rollRadius > 0 ? distance / feel.rollRadius : 0;
}
