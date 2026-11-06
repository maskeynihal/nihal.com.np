/**
 * What each object is made of, as far as the physics can tell: how bouncy, how grippy, how much
 * it resists rolling and spinning. The same values are used on the table and in the fall layer, so
 * a ball bounces the same way on both. Surfaces (the table, the floor, the walls) are neutral:
 * friction 1 and restitution 0, and the colliders combine with Multiply (friction) and Max
 * (restitution), so an object's own number is what you get. Pure data: no three.js, no rapier.
 */
export interface Feel {
  /** Bounce: 0 is a thud, 1 would never lose energy. */
  restitution: number;
  /** Grip: sliding friction coefficient against a neutral surface. */
  friction: number;
  /** Air and rolling resistance. */
  linearDamping: number;
  /** Spin resistance: what lets a ball roll to a stop and a letter stop tumbling. */
  angularDamping: number;
}

const BALL: Feel = {
  restitution: 0.72,
  friction: 0.45,
  linearDamping: 0.05,
  angularDamping: 0.35,
};
const HEAVY: Feel = {
  restitution: 0.05,
  friction: 0.85,
  linearDamping: 0.05,
  angularDamping: 1.6,
};

const byModel: Record<string, Feel> = {
  'ball-s': { ...BALL, restitution: 0.8 },
  'ball-m': BALL,
  'ball-l': { ...BALL, restitution: 0.66, angularDamping: 0.3 },
  // A standing disc on a round collider: rolls, but less livelily than a ball.
  pacman: {
    restitution: 0.4,
    friction: 0.6,
    linearDamping: 0.05,
    angularDamping: 0.6,
  },
  ghost: {
    restitution: 0.3,
    friction: 0.6,
    linearDamping: 0.05,
    angularDamping: 0.9,
  },
  laptop: { ...HEAVY, restitution: 0.04, friction: 0.9 },
  arduino: { ...HEAVY, restitution: 0.08 },
  clock: { ...HEAVY, restitution: 0.12 },
  calendar: { ...HEAVY, restitution: 0.1 },
  cruiser: { ...HEAVY, restitution: 0.15, friction: 0.6, angularDamping: 1.0 },
  'letter-n': { ...HEAVY, restitution: 0.12 },
  'letter-i': { ...HEAVY, restitution: 0.12 },
  'letter-h': { ...HEAVY, restitution: 0.12 },
  'letter-a': { ...HEAVY, restitution: 0.12 },
  'letter-l': { ...HEAVY, restitution: 0.12 },
};

export function feelFor(model: string): Feel {
  return byModel[model] ?? HEAVY;
}

/** Real gravity, m/s^2. Both layers use it, so the scale of a fall is the same in each. */
export const GRAVITY = 9.81;
