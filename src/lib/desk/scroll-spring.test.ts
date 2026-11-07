import { describe, expect, it } from 'vitest';
import {
  MAX_SHIFT,
  atRest,
  leanFor,
  pushFor,
  scrollFeelFor,
  stepSpring,
  type Spring,
} from './scroll-spring';

function run(vel: number, model: string, frames: number, dt = 1 / 60) {
  const feel = scrollFeelFor(model);
  const s: Spring = { x: 0, v: 0 };
  let peak = 0;
  for (let i = 0; i < frames; i++) {
    stepSpring(s, pushFor(vel, feel), dt);
    peak = Math.max(peak, Math.abs(s.x));
  }
  return { s, peak, feel };
}

describe('scroll spring', () => {
  it('faster scroll moves an object more', () => {
    expect(run(2500, 'pacman', 60).peak).toBeGreaterThan(
      run(600, 'pacman', 60).peak * 2,
    );
  });

  it('light things shift and lean more than heavy ones', () => {
    const light = run(2500, 'pacman', 60);
    const heavy = run(2500, 'laptop', 60);
    expect(light.peak).toBeGreaterThan(heavy.peak * 3);
    expect(leanFor(light.peak, light.feel)).toBeGreaterThan(
      leanFor(heavy.peak, heavy.feel) * 3,
    );
  });

  it('stays within a few px at any speed, and a ball rolls by shift over radius', () => {
    for (const m of ['pacman', 'ball-s', 'clock', 'laptop'])
      expect(run(50_000, m, 120).peak).toBeLessThanOrEqual(MAX_SHIFT * 1.6);
    expect(leanFor(0.007, scrollFeelFor('ball-s'))).toBeCloseTo(0.2, 6);
  });

  it('settles at zero when the push stops: no drift', () => {
    const feel = scrollFeelFor('pacman');
    const s: Spring = { x: 0, v: 0 };
    for (let i = 0; i < 30; i++) stepSpring(s, pushFor(2500, feel), 1 / 60);
    for (let i = 0; i < 240; i++) stepSpring(s, 0, 1 / 60);
    expect(atRest(s, 0)).toBe(true);
  });

  it('is stable at a long frame time', () => {
    const s: Spring = { x: 0, v: 0 };
    for (let i = 0; i < 100; i++) stepSpring(s, 0.008, 0.5);
    expect(Math.abs(s.x - 0.008)).toBeLessThan(0.001);
  });
});
