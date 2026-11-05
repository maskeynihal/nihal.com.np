import { describe, expect, it } from 'vitest';
import {
  ACTIVE_OPACITY,
  FADE_IN_MS,
  FADE_OUT_MS,
  REST_OPACITY,
  fadeAt,
  fadeMs,
  keepInside,
  labelPlacement,
  leaderDirection,
} from './callouts';

describe('callout fades', () => {
  it('uses 160 ms in and 240 ms out, and none when motion is reduced', () => {
    expect(fadeMs(true, true)).toBe(FADE_IN_MS);
    expect(fadeMs(false, true)).toBe(FADE_OUT_MS);
    expect(fadeMs(true, false)).toBe(0);
    expect(fadeMs(false, false)).toBe(0);
    expect(FADE_IN_MS).toBe(160);
    expect(FADE_OUT_MS).toBe(240);
  });

  it('runs from rest to active and settles exactly', () => {
    expect(fadeAt(REST_OPACITY, ACTIVE_OPACITY, 0, 160)).toBe(REST_OPACITY);
    const mid = fadeAt(REST_OPACITY, ACTIVE_OPACITY, 80, 160);
    expect(mid).toBeGreaterThan(REST_OPACITY);
    expect(mid).toBeLessThan(ACTIVE_OPACITY);
    expect(fadeAt(REST_OPACITY, ACTIVE_OPACITY, 160, 160)).toBe(ACTIVE_OPACITY);
    expect(fadeAt(ACTIVE_OPACITY, REST_OPACITY, 999, 240)).toBe(REST_OPACITY);
  });

  it('is instant for a zero duration', () => {
    expect(fadeAt(0.5, 1, 0, 0)).toBe(1);
  });
});

describe('leader geometry', () => {
  it('leaves the anchor away from the object centre', () => {
    expect(leaderDirection([0.16, 0.02, 0])).toEqual({ x: 1, z: 0 });
    const d = leaderDirection([0, 0.03, -0.1]);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(-1);
    expect(leaderDirection([0, 0.1, 0])).toEqual({ x: 1, z: 0 });
  });

  it('places the label beside, above or below its end point', () => {
    expect(labelPlacement({ x: 1, z: 0 })).toEqual({ tx: '0', ty: '-50%' });
    expect(labelPlacement({ x: -1, z: 0 })).toEqual({
      tx: '-100%',
      ty: '-50%',
    });
    expect(labelPlacement({ x: 0, z: -1 })).toEqual({
      tx: '-50%',
      ty: '-100%',
    });
    expect(labelPlacement({ x: 0, z: 1 })).toEqual({ tx: '-50%', ty: '0' });
  });
});

describe('keepInside', () => {
  it('leaves a label that already fits alone', () => {
    expect(keepInside(100, '0', 50, 400)).toBe(100);
  });

  it('pulls a left-aligned label back from the right edge', () => {
    expect(keepInside(390, '0', 50, 400)).toBe(346);
  });

  it('pulls a right-aligned label in from the left edge', () => {
    expect(keepInside(10, '-100%', 50, 400)).toBe(54);
  });

  it('keeps a centred label whole on both sides', () => {
    expect(keepInside(5, '-50%', 40, 400)).toBe(24);
    expect(keepInside(399, '-50%', 40, 400)).toBe(376);
  });

  it('centres a label wider than the canvas', () => {
    expect(keepInside(0, '0', 500, 400)).toBe(-50);
  });
});
