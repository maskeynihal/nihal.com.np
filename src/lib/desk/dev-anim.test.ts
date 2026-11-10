import { describe, expect, it } from 'vitest';
import { createDevAnim, lookAngles, type Env } from './dev-anim';
import {
  FORE,
  UPPER,
  WRIST_REST,
  restArm,
  shoulderAt,
  solveArm,
  type V3,
} from './rig';

const dist = (a: V3, b: V3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const MUG: V3 = [0.46, 0, -0.21];
/** A point of the sitter's frame carried round with the chair (wrist targets are not). */
const swivelled = (v: V3, a: number): V3 => [
  v[0] * Math.cos(a) + v[2] * Math.sin(a),
  v[1],
  -v[0] * Math.sin(a) + v[2] * Math.cos(a),
];
const env = (mug: V3 | null = MUG): Env => ({
  viewYaw: -2.77,
  mug,
  interest: [
    [-0.3, 0.05, -0.6],
    [0.4, 0.1, -0.9],
  ],
});

function run(seconds: number, e: Env, step: (t: number) => void = () => {}) {
  const a = createDevAnim(3);
  let last = a.update(1 / 30, e);
  for (let t = 0; t < seconds; t += 1 / 30) {
    step(t);
    last = a.update(1 / 30, e);
  }
  return { a, last };
}

describe('two-bone arm solve', () => {
  it('keeps both bones their length and reaches a target in range', () => {
    const s = shoulderAt(1);
    const target: V3 = [0.32, 0.075, -0.29];
    const { elbow, wrist } = solveArm(s, target, [0.5, -1, 0.5]);
    expect(dist(s, elbow)).toBeCloseTo(UPPER, 6);
    expect(dist(elbow, wrist)).toBeCloseTo(FORE, 6);
    expect(dist(wrist, target)).toBeLessThan(1e-6);
  });
  it('stretches towards a target out of reach instead of breaking', () => {
    const s = shoulderAt(-1);
    const { elbow, wrist } = solveArm(s, [-3, 0, -3], [-0.5, -1, 0.5]);
    expect(dist(s, elbow)).toBeCloseTo(UPPER, 6);
    expect(dist(elbow, wrist)).toBeCloseTo(FORE, 6);
    expect(dist(s, wrist)).toBeLessThan(UPPER + FORE);
  });
  it('the rest pose is the typing pose: both wrists on their rest targets', () => {
    expect(dist(restArm(-1).wrist, WRIST_REST.l)).toBeLessThan(1e-6);
    expect(dist(restArm(1).wrist, WRIST_REST.r)).toBeLessThan(1e-6);
  });
});

describe('the developer', () => {
  it('never produces a bad number in two minutes of idling', () => {
    const { last } = run(120, env());
    for (const n of [
      last.chairYaw,
      last.lean,
      last.headYaw,
      last.headPitch,
      ...last.l,
      ...last.r,
    ])
      expect(Number.isFinite(n)).toBe(true);
  });

  it('is the same every run (seeded)', () => {
    const a = run(30, env()).last;
    const b = run(30, env()).last;
    expect(a).toEqual(b);
  });

  it('keeps both wrists within an arm of the shoulder, whatever it is doing', () => {
    const a = createDevAnim(5);
    const e = env();
    const kinds = [
      'wave',
      'spin',
      'fast',
      'mouse',
      'sip',
      'cans',
      'shrug',
    ] as const;
    for (const k of kinds) {
      a.trigger(k);
      for (let t = 0; t < 5; t += 1 / 30) {
        const p = a.update(1 / 30, e);
        // wrist targets are what the solve is given; the solve clamps, but they should be sane
        expect(dist(p.l, swivelled(shoulderAt(-1), p.chairYaw))).toBeLessThan(
          0.62,
        );
        expect(dist(p.r, swivelled(shoulderAt(1), p.chairYaw))).toBeLessThan(
          0.62,
        );
      }
    }
  });

  it('types: the keys press, and the count climbs', () => {
    const { last } = run(5, env(null));
    expect(last.typed).toBeGreaterThan(5);
  });

  it('types faster after a tap on the keyboard', () => {
    const a = createDevAnim(1);
    const e = env(null);
    for (let t = 0; t < 1; t += 1 / 30) a.update(1 / 30, e);
    const before = a.update(0, e).typed;
    a.trigger('fast');
    let after = before;
    for (let t = 0; t < 2; t += 1 / 30) after = a.update(1 / 30, e).typed;
    const calm = createDevAnim(1);
    for (let t = 0; t < 1; t += 1 / 30) calm.update(1 / 30, e);
    const c0 = calm.update(0, e).typed;
    let c1 = c0;
    for (let t = 0; t < 2; t += 1 / 30) c1 = calm.update(1 / 30, e).typed;
    expect(after - before).toBeGreaterThan(c1 - c0);
  });

  it('carries the mug to the mouth and puts it back', () => {
    const a = createDevAnim(2);
    const e = env();
    a.trigger('sip');
    let held = 0;
    let top = 0;
    for (let t = 0; t < 3.7; t += 1 / 30) {
      const p = a.update(1 / 30, e);
      if (p.mug) {
        held += 1;
        top = Math.max(top, p.mug.dy);
      }
    }
    expect(held).toBeGreaterThan(30);
    expect(top).toBeGreaterThan(0.15);
    // after the segment the mug is on the desk again
    for (let t = 0; t < 2; t += 1 / 30) a.update(1 / 30, e);
    expect(a.update(1 / 30, e).mug).toBeNull();
  });

  describe.each([
    ['left, upright', [-0.7, 0, -0.5] as V3, 0],
    ['left, flat', [-0.62, 0.041, -0.65] as V3, Math.PI / 2],
    ['right, flat', [0.62, 0.041, -0.6] as V3, Math.PI / 2],
    ['near the keyboard', [-0.2, 0.041, -0.3] as V3, Math.PI / 2],
  ])('headphones: %s', (_name, hpAt, hpPitch) => {
    it('picks them up from the desk, carries them over the head, seats them, and later sets them back', () => {
      const a = createDevAnim(2);
      const e: Env = { ...env(), hp: hpAt, hpPitch };
      expect(a.cansOn()).toBe(false);
      a.trigger('cans', { cans: true });
      let p = a.update(0, e);
      let held = 0;
      let seatedAt = -1;
      let rolled = 0;
      let locked = 0;
      let reachWorst = 0;
      for (let t = 0; t < 4; t += 1 / 60) {
        p = a.update(1 / 60, e);
        if (p.hp.active && !p.hp.worn) held += 1;
        if (p.hp.worn && seatedAt < 0) seatedAt = t;
        rolled = Math.max(rolled, Math.abs(p.pos.x));
        // with a hand on the headphones, the grip is within reach of its shoulder
        for (const [w, wrist, side] of [
          [
            p.hp.lead.w,
            p.hp.side === 'l' ? p.l : p.r,
            p.hp.side === 'l' ? -1 : 1,
          ],
          [
            p.hp.aux.w,
            p.hp.side === 'l' ? p.r : p.l,
            p.hp.side === 'l' ? 1 : -1,
          ],
        ] as const) {
          if (w < 0.99) continue;
          const sh = shoulderAt(side, 0.2 + p.lean);
          const d = dist(wrist, [
            sh[0] + p.pos.x,
            sh[1] + p.rootY,
            sh[2] + p.pos.z,
          ]);
          reachWorst = Math.max(reachWorst, d);
          locked += 1;
        }
      }
      // (wrist to shoulder, a little under the arm's length: nothing is clamped)
      expect(locked).toBeGreaterThan(60);
      expect(reachWorst).toBeLessThan(UPPER + FORE - 0.015);
      expect(held).toBeGreaterThan(80);
      // on the ears in about two seconds
      expect(seatedAt).toBeGreaterThan(1.8);
      expect(seatedAt).toBeLessThan(2.4);
      expect(a.cansOn()).toBe(true);
      expect(p.hp.worn).toBe(true);
      expect(p.hp.active).toBe(true);
      expect(p.hp.k).toBe(1);
      expect(p.hp.spread).toBe(0);
      // hands home on the keys (each its own, not crossed)
      expect(dist(p.l, WRIST_REST.l)).toBeLessThan(0.03);
      expect(p.r[0]).toBeGreaterThan(0);
      // out of reach, so the chair rolls towards them
      if (hpAt[2] < -0.4) expect(rolled).toBeGreaterThan(0.05);
      a.trigger('cans', { cans: false });
      let off = 0;
      let setDownAt = -1;
      reachWorst = 0;
      for (let t = 0; t < 3; t += 1 / 60) {
        p = a.update(1 / 60, e);
        if (p.hp.active) off += 1;
        else if (setDownAt < 0) setDownAt = t;
        for (const [w, wrist, side] of [
          [
            p.hp.lead.w,
            p.hp.side === 'l' ? p.l : p.r,
            p.hp.side === 'l' ? -1 : 1,
          ],
          [
            p.hp.aux.w,
            p.hp.side === 'l' ? p.r : p.l,
            p.hp.side === 'l' ? 1 : -1,
          ],
        ] as const) {
          if (w < 0.99) continue;
          const sh = shoulderAt(side, 0.2 + p.lean);
          reachWorst = Math.max(
            reachWorst,
            dist(wrist, [sh[0] + p.pos.x, sh[1] + p.rootY, sh[2] + p.pos.z]),
          );
        }
      }
      expect(reachWorst).toBeLessThan(UPPER + FORE - 0.015);
      expect(off).toBeGreaterThan(60);
      // set down in about a second and a half, then back to the keys
      expect(setDownAt).toBeGreaterThan(1.2);
      expect(setDownAt).toBeLessThan(1.8);
      expect(a.cansOn()).toBe(false);
      expect(p.hp.worn).toBe(false);
      expect(p.hp.active).toBe(false);
      expect(Math.abs(p.pos.x)).toBeLessThan(0.02);
      expect(dist(p.l, WRIST_REST.l)).toBeLessThan(0.03);
      expect(p.r[0]).toBeGreaterThan(0);
    });
  });

  it('reduced motion: the headphones go on and off at once', () => {
    const a = createDevAnim(2);
    a.setCalm(true);
    const e: Env = { ...env(), hp: [-0.6, 0.041, -0.6], hpPitch: Math.PI / 2 };
    a.trigger('cans', { cans: true });
    const p = a.update(1 / 60, e);
    expect(a.cansOn()).toBe(true);
    expect(p.hp.active).toBe(true);
    expect(p.hp.worn).toBe(true);
    expect(p.hp.lead.w).toBe(0);
    a.trigger('cans', { cans: false });
    expect(a.cansOn()).toBe(false);
    expect(a.update(1 / 60, e).hp.active).toBe(false);
  });

  it('turns to face the viewer to wave, and comes back', () => {
    const a = createDevAnim(2);
    const e = env();
    a.trigger('wave');
    let min = 0;
    let p = a.update(0, e);
    for (let t = 0; t < 2.5; t += 1 / 30) {
      p = a.update(1 / 30, e);
      min = Math.min(min, p.chairYaw);
    }
    expect(min).toBeLessThan(-2.4);
    for (let t = 0; t < 4; t += 1 / 30) p = a.update(1 / 30, e);
    expect(Math.abs(p.chairYaw)).toBeLessThan(0.1);
  });

  it('spins the chair a full turn and ends where it began', () => {
    const a = createDevAnim(2);
    const e = env();
    a.trigger('spin');
    let max = 0;
    let p = a.update(0, e);
    for (let t = 0; t < 1.8; t += 1 / 30) {
      p = a.update(1 / 30, e);
      max = Math.max(max, Math.abs(p.chairYaw));
    }
    expect(max).toBeGreaterThan(5.5);
    for (let t = 0; t < 1.5; t += 1 / 30) p = a.update(1 / 30, e);
    expect(Math.abs(p.chairYaw)).toBeLessThan(0.3);
  });

  it('looks at a point on the desk: yaw and pitch, relative to the chair', () => {
    // straight ahead and level with the head: no turn
    const ahead = lookAngles([0, 0.34, -1], 0);
    expect(Math.abs(ahead.yaw)).toBeLessThan(0.05);
    const right = lookAngles([1, 0.34, -0.04], 0);
    expect(right.yaw).toBeLessThan(-1.2);
    const turned = lookAngles([1, 0.34, -0.04], -Math.PI / 2);
    expect(Math.abs(turned.yaw)).toBeLessThan(0.1);
  });

  it('stands up, walks round the right end of the desk, and sits down again', () => {
    const a = createDevAnim(4);
    const e = env();
    a.trigger('walk');
    let maxX = 0;
    let minZ = 0;
    let top = 0;
    let p = a.update(0, e);
    for (let t = 0; t < 20; t += 1 / 30) {
      p = a.update(1 / 30, e);
      maxX = Math.max(maxX, p.pos.x);
      minZ = Math.min(minZ, p.pos.z);
      top = Math.max(top, p.stand);
      for (const n of [p.rootY, p.pos.x, p.pos.z, ...p.l, ...p.r])
        expect(Number.isFinite(n)).toBe(true);
    }
    expect(top).toBeGreaterThan(0.99);
    // past the end of the desk (0.6 m right of the chair axis puts them at its edge), never through it
    expect(maxX).toBeGreaterThan(0.75);
    expect(minZ).toBeGreaterThan(-0.8);
    expect(p.stand).toBeLessThan(0.01);
    expect(Math.hypot(p.pos.x, p.pos.z)).toBeLessThan(0.01);
  });

  it('raises the desk, stands the sitter, and lowers both again', () => {
    const a = createDevAnim(4);
    const e = env();
    a.setDeskUp(true);
    let p = a.update(0, e);
    for (let t = 0; t < 3; t += 1 / 30) p = a.update(1 / 30, e);
    expect(p.desk).toBeCloseTo(1, 2);
    expect(p.stand).toBeCloseTo(1, 2);
    expect(p.floorY).toBeLessThan(-0.7);
    expect(a.standing()).toBe(true);
    a.setDeskUp(false);
    for (let t = 0; t < 3; t += 1 / 30) p = a.update(1 / 30, e);
    expect(p.desk).toBeCloseTo(0, 2);
    expect(p.rootY).toBeCloseTo(0, 2);
    expect(a.standing()).toBe(false);
  });

  it('does not lean back with hands behind the head while standing at a raised desk', () => {
    const a = createDevAnim(4);
    const e = env();
    a.setDeskUp(true);
    for (let t = 0; t < 130; t += 1 / 30) {
      const p = a.update(1 / 30, e);
      if (t > 3) expect(p.kind).not.toBe('lean');
    }
  });

  it('reaches for something hanging in the air with the left hand, and carries it', () => {
    const a = createDevAnim(6);
    const hover: V3 = [-0.4, 0.2, -0.29];
    const e: Env = { ...env(), reach: hover };
    a.trigger('reach');
    let carried = 0;
    let nearest = 9;
    let p = a.update(0, e);
    for (let t = 0; t < 3.5; t += 1 / 30) {
      p = a.update(1 / 30, e);
      if (p.carry) {
        carried += 1;
        nearest = Math.min(
          nearest,
          dist([p.l[0], p.l[1] - 0.012, p.l[2] - 0.036], hover),
        );
      }
    }
    expect(carried).toBeGreaterThan(20);
    expect(nearest).toBeLessThan(0.03);
    expect(p.carry).toBe(false);
  });

  it('is calm under reduced motion: no typing, no walk, no glances, the poster pose', () => {
    const a = createDevAnim(8);
    a.setCalm(true);
    const e = env();
    let p = a.update(0, e);
    let maxHead = 0;
    for (let t = 0; t < 60; t += 1 / 30) {
      p = a.update(1 / 30, e);
      maxHead = Math.max(maxHead, Math.abs(p.headYaw));
      expect(p.kind).toBe('type');
    }
    expect(p.typed).toBe(0);
    expect(maxHead).toBeLessThan(1e-6);
    expect(dist(p.r, WRIST_REST.r)).toBeLessThan(0.02);
    // a tap is a short nod, never a walk or a wave
    a.trigger('walk');
    p = a.update(1 / 30, e);
    expect(p.kind).toBe('nod');
    for (let t = 0; t < 1; t += 1 / 30) p = a.update(1 / 30, e);
    expect(p.kind).toBe('type');
    expect(p.stand).toBe(0);
  });

  it('stands and sits in about 160 ms when calm', () => {
    const a = createDevAnim(8);
    a.setCalm(true);
    const e = env();
    a.setDeskUp(true);
    let p = a.update(0, e);
    for (let t = 0; t < 0.3; t += 1 / 30) p = a.update(1 / 30, e);
    expect(p.stand).toBeCloseTo(1, 2);
    expect(p.desk).toBeCloseTo(1, 2);
  });

  it('now and then knocks the mug over while mousing, never twice in a minute, and never when calm', () => {
    const e = env();
    let totalKnocks = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const a = createDevAnim(seed, { solid: false });
      let last = 0;
      let lastAt = -1000;
      for (let t = 0; t < 600; t += 1 / 30) {
        const p = a.update(1 / 30, e);
        if (p.knocks !== last) {
          last = p.knocks;
          totalKnocks += 1;
          expect(t - lastAt).toBeGreaterThan(60);
          lastAt = t;
          // the hand has just knocked it: the sitter starts to startle
          expect(p.kind).toBe('startle');
        }
      }
    }
    expect(totalKnocks).toBeGreaterThan(3);
    const calm = createDevAnim(3);
    calm.setCalm(true);
    let p = calm.update(0, e);
    for (let t = 0; t < 600; t += 1 / 30) p = calm.update(1 / 30, e);
    expect(p.knocks).toBe(0);
    // no mug on the desk, nothing to knock
    const bare = createDevAnim(3);
    let q = bare.update(0, env(null));
    for (let t = 0; t < 600; t += 1 / 30) q = bare.update(1 / 30, env(null));
    expect(q.knocks).toBe(0);
  }, 30000);

  it('does the reset: faces each thing in turn, left and right, aims, and returns to the screen', () => {
    const a = createDevAnim(9);
    const e = env();
    let p = a.update(0, e);
    for (let t = 0; t < 1.5; t += 1 / 30) p = a.update(1 / 30, e);
    // one thing far to the right (yaw about -1.2), then one far to the left (about 1.5)
    a.trigger('tether', {
      items: 2,
      shots: [
        { yaw: -1.2, at: [0.7, 0.05, -0.5] },
        { yaw: 1.5, at: [-0.9, 0.05, -0.4] },
      ],
    });
    let minYaw = 0;
    let maxYaw = 0;
    let reach = 0;
    let swing = 0;
    let last = 0;
    for (let t = 0; t < 4.2; t += 1 / 30) {
      p = a.update(1 / 30, e);
      minYaw = Math.min(minYaw, p.chairYaw);
      maxYaw = Math.max(maxYaw, p.chairYaw);
      reach = Math.max(reach, Math.hypot(p.r[0] - 0.09, p.r[2] + 0.28));
      // the swivel is eased: no jump of more than a few degrees a frame
      swing = Math.max(swing, Math.abs(p.chairYaw - last));
      last = p.chairYaw;
    }
    expect(minYaw).toBeLessThan(-0.7);
    expect(maxYaw).toBeGreaterThan(0.9);
    expect(reach).toBeGreaterThan(0.2);
    expect(swing).toBeLessThan(0.08);
    for (let t = 0; t < 4; t += 1 / 30) p = a.update(1 / 30, e);
    expect(p.kind).not.toBe('tether');
    expect(Math.abs(p.chairYaw)).toBeLessThan(0.15);
  });

  it('follows the pointer a little: at most about 12 degrees of yaw, and not while calm', () => {
    const gaze = { x: 1, y: 1, fresh: true };
    const a = createDevAnim(2);
    let p = a.update(0, { ...env(), gaze });
    let most = 0;
    for (let t = 0; t < 2.4; t += 1 / 30) {
      p = a.update(1 / 30, { ...env(), gaze });
      most = Math.max(most, Math.abs(p.headYaw));
    }
    expect(most).toBeGreaterThan(0.12);
    expect(most).toBeLessThan(0.23);
    // it lets go again once the pointer has been still
    for (let t = 0; t < 3; t += 1 / 30)
      p = a.update(1 / 30, { ...env(), gaze: { ...gaze, fresh: false } });
    expect(Math.abs(p.headYaw)).toBeLessThan(0.03);
    const calm = createDevAnim(2);
    calm.setCalm(true);
    let c = calm.update(0, { ...env(), gaze });
    for (let t = 0; t < 2; t += 1 / 30)
      c = calm.update(1 / 30, { ...env(), gaze });
    expect(Math.abs(c.headYaw)).toBeLessThan(1e-6);
  });

  it('now and then stops typing to think, a hand to the chin', () => {
    const a = createDevAnim(3);
    const e = env();
    let thought = 0;
    for (let t = 0; t < 120; t += 1 / 30)
      if (a.update(1 / 30, e).kind === 'think') thought += 1;
    expect(thought).toBeGreaterThan(30);
  });

  it('walks with a hip bob: the hips dip at each footfall and rise as the leg passes', () => {
    const a = createDevAnim(4);
    const e = env();
    a.trigger('walk');
    let lo = 9;
    let hi = -9;
    for (let t = 0; t < 14; t += 1 / 30) {
      const p = a.update(1 / 30, e);
      if (p.kind === 'walk' && p.gait.amp > 0.95) {
        lo = Math.min(lo, p.rootY);
        hi = Math.max(hi, p.rootY);
      }
    }
    expect(hi - lo).toBeGreaterThan(0.008);
    expect(hi - lo).toBeLessThan(0.02);
  });
});
