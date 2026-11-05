/**
 * Exploded view maths (design 4.4). Scroll progress over the hero (0 at the top, 1 once the hero
 * has scrolled away) drives an explode factor; the shown factor lerps toward it and snaps once
 * it is close, so the frame loop can stop. Pure; no three.js, no DOM.
 */
/** Fraction of the remaining distance covered per frame. */
export const EXPLODE_LERP = 0.12;
/** Closer than this snaps to the target. */
export const EXPLODE_EPS = 1e-3;
/** Leader lines are hidden below this factor. */
export const LEADER_MIN = 0.01;

export function explodeTarget(scrollY: number, range: number): number {
  if (!(range > 0) || !Number.isFinite(scrollY)) return 0;
  return Math.min(1, Math.max(0, scrollY / range));
}

export function stepFactor(
  current: number,
  target: number,
): { value: number; done: boolean } {
  const d = target - current;
  if (Math.abs(d) < EXPLODE_EPS) return { value: target, done: true };
  return { value: current + d * EXPLODE_LERP, done: false };
}

export function offsetFor(
  explode: readonly [number, number, number],
  factor: number,
): [number, number, number] {
  // `+ 0` turns -0 (a negative offset at factor 0) into 0.
  return [
    explode[0] * factor + 0,
    explode[1] * factor + 0,
    explode[2] * factor + 0,
  ];
}
