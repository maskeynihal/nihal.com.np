/**
 * Scroll motion for the objects on the table (D3): each object sits on a damped spring that the
 * page's scroll speed pushes, so a faster scroll moves them more and light things (balls,
 * pac-men) more than heavy ones (the laptop). Pure maths, no three.js and no DOM, so the Scene
 * chunk can use it without the physics engine and it can be unit tested.
 */

/** What one model does in response to scroll. Heavy things barely move, light things lean. */
export interface ScrollFeel {
  /** 0..1: share of the largest shift and tilt this object gets. */
  gain: number;
  /** A ball rolls: its tilt is the shift over its radius (m), not a lean. 0 for everything else. */
  rollRadius: number;
}

const LIGHT: ScrollFeel = { gain: 1, rollRadius: 0 };
const MID: ScrollFeel = { gain: 0.4, rollRadius: 0 };
const HEAVY: ScrollFeel = { gain: 0.15, rollRadius: 0 };

const byModel: Record<string, ScrollFeel> = {
  'ball-s': { gain: 1, rollRadius: 0.035 },
  'ball-m': { gain: 0.8, rollRadius: 0.05 },
  'ball-l': { gain: 0.6, rollRadius: 0.07 },
  pacman: LIGHT,
  ghost: LIGHT,
  clock: MID,
  calendar: MID,
  arduino: MID,
  cruiser: MID,
  'letter-n': MID,
  'letter-i': MID,
  'letter-h': MID,
  'letter-a': MID,
  'letter-l': MID,
  laptop: HEAVY,
};

export function scrollFeelFor(model: string): ScrollFeel {
  return byModel[model] ?? HEAVY;
}

/** Largest shift along the table (m): about 5 screen px at the table's scale, for gain 1. */
export const MAX_SHIFT = 0.008;
/** Largest lean (rad) for gain 1, about 5 degrees. */
export const MAX_LEAN = 0.09;
/** Scroll speed (px/s) at which the push reaches its maximum. */
export const FULL_SPEED = 2500;
/** Spring: natural frequency (Hz) and damping ratio. Under-damped, so it overshoots once. */
export const SPRING_HZ = 3.2;
export const SPRING_ZETA = 0.4;
/** Below this (m) with no speed, the spring is at rest and no frames are asked for. */
export const REST = 0.00025;

export interface Spring {
  /** Shift (m, towards the viewer is positive) and its speed. */
  x: number;
  v: number;
}

/** The shift the spring is pulled towards for a scroll speed `vel` (px/s, down is positive). */
export function pushFor(vel: number, feel: ScrollFeel): number {
  const k = Math.max(-1, Math.min(1, vel / FULL_SPEED));
  // Content moves up as the page scrolls down; the objects trail it, so they lean the other way.
  return -k * MAX_SHIFT * feel.gain;
}

/**
 * One step of the damped spring towards `target`. Semi-implicit Euler with a small fixed sub-step,
 * stable at any frame time. `calm` makes it settle faster (a held or moving object).
 */
export function stepSpring(
  s: Spring,
  target: number,
  dt: number,
  calm = false,
): void {
  const w = 2 * Math.PI * SPRING_HZ * (calm ? 1.6 : 1);
  const z = calm ? 1 : SPRING_ZETA;
  let left = Math.min(dt, 0.1);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120);
    s.v += (w * w * (target - s.x) - 2 * z * w * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
}

/** True when the spring has settled at zero (so it can stop asking for frames). */
export function atRest(s: Spring, target: number): boolean {
  return target === 0 && Math.abs(s.x) < REST && Math.abs(s.v) < REST * 4;
}

/** The lean (rad) for a shift: a ball rolls by shift / radius, anything else tips a little. */
export function leanFor(x: number, feel: ScrollFeel): number {
  if (feel.rollRadius > 0) return x / feel.rollRadius;
  return (x / MAX_SHIFT) * MAX_LEAN * feel.gain;
}
