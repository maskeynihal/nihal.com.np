/**
 * The desk's feel, in one file: gravity, what the surfaces are, and what each object is made of.
 * The table world and the fall layer both read it, so an object lands, bounces and rolls the same
 * way in each and the handoff between them does not change it. Pure data: no three.js, no rapier
 * (the Scene chunk reads it too, and must not pull the physics engine in).
 *
 * How the numbers were chosen (the measurements are in the v3.2 desk commit messages):
 *
 *  - Scale. The table is 1.6 x 1.2 m in the world (`TABLE_HALF` in drag.ts), but a desk this
 *    size reads as a table about 1.2 m wide. Everything is therefore 1.6 / 1.2 = 1.33 times too
 *    large for a real thing, and at real gravity a 1.33 times larger world falls 1.15 times too
 *    slowly (time goes with the square root of length over gravity): that is the floaty feel.
 *    Scaling gravity by the same factor restores the real fall time for the picture on screen.
 *  - Contact. The physics step adds some bounce of its own, so a restitution of 0.12 shows as
 *    about 0.33. Heavy things are given 0.02 to 0.04 to land with a thud, balls 0.55 to 0.68.
 *  - Rolling. A rolling ball loses speed at about `linearDamping + angularDamping * 2/7` per
 *    second (the 2/7 is a solid sphere's share of the spin in a roll). The old 0.05 and 0.35 gave
 *    0.15 per second: a ball rolled for 15 s, as on ice. Now about 1.2 per second: it rolls a
 *    couple of body lengths and stops in 3 to 4 s.
 */

/** How far the table is bigger than the real table the picture reads as, m / m. */
export const TABLE_WORLD_M = 1.6;
export const TABLE_REAL_M = 1.2;
export const WORLD_SCALE = TABLE_WORLD_M / TABLE_REAL_M;

/**
 * Gravity, m/s^2 in world units: real gravity times the world's size over a real table's, so a
 * fall takes as long as it would for a real object of the size the picture shows. Both layers
 * use this one number (the table world, the fall world and the handoff's acceleration match).
 */
export const GRAVITY = 9.81 * WORLD_SCALE;

/**
 * The table, the floor and the walls are neutral: friction 1 and restitution 0, combined with
 * Multiply (friction) and Max (restitution), so an object's own number is what you get.
 */
export const SURFACE = { friction: 1, restitution: 0 } as const;

/**
 * Fall layer: a handed-over body starts with the gravity that matches the apparent acceleration
 * the table view showed (never less than this fraction), then grows to full gravity over this
 * many 1/60 s steps. Shorter than the old 14 steps (0.23 s of reduced gravity read as hovering).
 */
export const HANDOFF_MIN_GRAVITY = 0.3;
export const HANDOFF_RAMP_STEPS = 8;

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
  restitution: 0.62,
  friction: 0.6,
  linearDamping: 0.3,
  angularDamping: 3,
};
const HEAVY: Feel = {
  restitution: 0.03,
  friction: 0.9,
  linearDamping: 0.2,
  angularDamping: 2.5,
};

const byModel: Record<string, Feel> = {
  'ball-s': { ...BALL, restitution: 0.68 },
  'ball-m': BALL,
  'ball-l': { ...BALL, restitution: 0.55 },
  // A standing disc on a round collider: rolls, but less livelily than a ball.
  pacman: {
    restitution: 0.25,
    friction: 0.7,
    linearDamping: 0.3,
    angularDamping: 3,
  },
  ghost: {
    restitution: 0.2,
    friction: 0.7,
    linearDamping: 0.3,
    angularDamping: 3,
  },
  laptop: { ...HEAVY, restitution: 0.02, friction: 0.95 },
  arduino: { ...HEAVY, restitution: 0.03 },
  clock: { ...HEAVY, restitution: 0.03 },
  calendar: { ...HEAVY, restitution: 0.03 },
  cruiser: { ...HEAVY, restitution: 0.05, friction: 0.7 },
  'letter-n': { ...HEAVY, restitution: 0.03 },
  'letter-i': { ...HEAVY, restitution: 0.03 },
  'letter-h': { ...HEAVY, restitution: 0.03 },
  'letter-a': { ...HEAVY, restitution: 0.03 },
  'letter-l': { ...HEAVY, restitution: 0.03 },
};

export function feelFor(model: string): Feel {
  return byModel[model] ?? HEAVY;
}
