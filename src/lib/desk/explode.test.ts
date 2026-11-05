import { describe, expect, it } from 'vitest';
import { EXPLODE_EPS, explodeTarget, offsetFor, stepFactor } from './explode';

describe('explodeTarget', () => {
  it('is scroll over the range, clamped to 0..1', () => {
    expect(explodeTarget(0, 800)).toBe(0);
    expect(explodeTarget(400, 800)).toBe(0.5);
    expect(explodeTarget(800, 800)).toBe(1);
    expect(explodeTarget(5000, 800)).toBe(1);
    expect(explodeTarget(-30, 800)).toBe(0);
  });

  it('survives a zero range and bad input', () => {
    expect(explodeTarget(100, 0)).toBe(0);
    expect(explodeTarget(NaN, 800)).toBe(0);
  });
});

describe('stepFactor', () => {
  it('moves 12% of the way and reports not done', () => {
    const s = stepFactor(0, 1);
    expect(s.value).toBeCloseTo(0.12);
    expect(s.done).toBe(false);
  });

  it('converges and snaps to the target', () => {
    let v = 0;
    let frames = 0;
    for (; frames < 200; frames++) {
      const s = stepFactor(v, 0.5);
      v = s.value;
      if (s.done) break;
    }
    expect(v).toBe(0.5);
    expect(frames).toBeLessThan(80);
    expect(stepFactor(0.5 - EXPLODE_EPS / 2, 0.5).done).toBe(true);
  });

  it('is done at once when already there', () => {
    expect(stepFactor(1, 1)).toEqual({ value: 1, done: true });
  });
});

describe('offsetFor', () => {
  it('scales the def offset by the factor', () => {
    expect(offsetFor([0.2, 0.4, -0.1], 0.5)).toEqual([0.1, 0.2, -0.05]);
    expect(offsetFor([0.2, 0.4, -0.1], 0)).toEqual([0, 0, 0]);
  });
});
