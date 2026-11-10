import { describe, expect, it } from 'vitest';
import { createDevAnim, TETHER_SLOT, type Env, type Pose } from './dev-anim';
import { worst, type Hit } from './body-collide';
import type { V3 } from './rig';

const MUG: V3 = [0.46, 0, -0.21];
const INTEREST: V3[] = [
  [-0.3, 0.05, -0.6],
  [0.4, 0.1, -0.9],
  [0.9, 0.1, -1.1],
  [-0.9, 0.1, -0.9],
];
const env = (over: Partial<Env> = {}): Env => ({
  viewYaw: -2.77,
  mug: MUG,
  interest: INTEREST,
  hp: [-0.62, 0.041, -0.65],
  hpPitch: Math.PI / 2,
  ...over,
});

interface Result {
  name: string;
  depth: number;
  at: number;
  hit: Hit | null;
}
const DT = 1 / 60;

/** Runs a script and returns the deepest penetration seen. */
function measure(
  name: string,
  seconds: number,
  start: (a: ReturnType<typeof createDevAnim>) => void,
  e: Env = env(),
  drawer = 0,
  seed = 3,
): Result {
  const a = createDevAnim(seed);
  e = { ...e, drawer };
  a.update(0, e);
  start(a);
  let best: Result = { name, depth: 0, at: 0, hit: null };
  for (let t = 0; t < seconds; t += DT) {
    const p: Pose = a.update(DT, e);
    const h = worst(p, drawer);
    if (h && h.depth > best.depth)
      best = { name, depth: h.depth, at: t, hit: h };
  }
  return best;
}

const SCRIPTS: [
  string,
  number,
  (a: ReturnType<typeof createDevAnim>) => void,
  Env?,
  number?,
][] = [
  ['idle loop', 120, () => {}],
  ['idle loop seed 9', 90, () => {}],
  ['idle loop seed 5', 120, () => {}],
  ['idle loop seed 12', 120, () => {}],
  ['idle loop, drawer open', 90, () => {}, env(), 1],
  ['wave, drawer open', 5, (a) => a.trigger('wave'), env(), 1],
  ['spin, drawer open', 3, (a) => a.trigger('spin'), env(), 1],
  ['wave, mug missing', 5, (a) => a.trigger('wave'), env({ mug: null })],
  ['wave', 5, (a) => a.trigger('wave')],
  ['spin', 3, (a) => a.trigger('spin')],
  ['fast typing', 4, (a) => a.trigger('fast')],
  ['shrug', 2, (a) => a.trigger('shrug')],
  ['nod', 2, (a) => a.trigger('nod')],
  ['sip', 4, (a) => a.trigger('sip')],
  [
    'headphones on/off (left, flat)',
    8,
    (a) => {
      a.trigger('cans', { cans: true });
    },
  ],
  [
    'headphones on/off (right, flat)',
    8,
    (a) => a.trigger('cans', { cans: true }),
    env({ hp: [0.62, 0.041, -0.6] }),
  ],
  [
    'headphones on/off (left, upright)',
    8,
    (a) => a.trigger('cans', { cans: true }),
    env({ hp: [-0.7, 0, -0.5], hpPitch: 0 }),
  ],
  [
    'headphones, near the keyboard',
    8,
    (a) => a.trigger('cans', { cans: true }),
    env({ hp: [-0.2, 0.041, -0.3] }),
  ],
  [
    'mug sip far right',
    5,
    (a) => a.trigger('sip'),
    env({ mug: [0.9, 0, -0.35] }),
  ],
  [
    'floppy reach',
    4,
    (a) => a.trigger('reach'),
    env({ reach: [-0.3, 0.12, -0.5] }),
  ],
  [
    'reset shots',
    9,
    (a) =>
      a.trigger('tether', {
        shots: [
          { yaw: -1.2, at: [-0.7, 0.1, -0.1] },
          { yaw: 0.2, at: [0.1, 0.1, -0.9] },
          { yaw: 1.4, at: [0.9, 0.1, -0.2] },
          { yaw: 2.2, at: [0.9, 0.1, 0.4] },
        ],
      }),
  ],
  ['walk round the desk', 30, (a) => a.trigger('walk')],
  ['standing desk up then down', 14, (a) => a.setDeskUp(true)],
  ['drawer open, seated', 6, () => {}, env(), 1],
  [
    'drawer open, headphones',
    8,
    (a) => a.trigger('cans', { cans: true }),
    env(),
    1,
  ],
];

describe('the developer stays out of the desk and the chair', () => {
  const results: Result[] = [];
  for (const [name, secs, start, e, drawer] of SCRIPTS) {
    it(
      name,
      () => {
        const r = measure(
          name,
          secs,
          start,
          e ?? env(),
          drawer ?? 0,
          name.includes('seed 9')
            ? 9
            : name.includes('seed 5')
              ? 5
              : name.includes('seed 12')
                ? 12
                : 3,
        );
        results.push(r);
        if (r.depth > 0.005)
          console.log(
            `${name}: ${(r.depth * 1000).toFixed(1)} mm at ${r.at.toFixed(2)} s: ${r.hit?.part} in ${r.hit?.other}`,
          );
        expect(r.depth).toBeLessThanOrEqual(0.005);
      },
      60000,
    );
  }
  void TETHER_SLOT;
});
