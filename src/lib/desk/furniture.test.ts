import { describe, expect, it } from 'vitest';
import { easeOut, DURATION_BASE, DURATION_FAST, DURATION_SLOW } from './tokens';
import { CHAIR_SEAT, STANDING_BOXES, TRAY_BOX } from './furniture';

describe('furniture colliders', () => {
  it('are real boxes: positive sizes, standing things resting on the desk top', () => {
    for (const [model, list] of Object.entries(STANDING_BOXES)) {
      expect(list.length, model).toBeGreaterThan(0);
      for (const b of list) {
        for (const h of b.h) expect(h, model).toBeGreaterThan(0);
        // nothing pokes through the desk top
        expect(b.c[1] - b.h[1], model).toBeGreaterThanOrEqual(-1e-9);
      }
    }
    expect(CHAIR_SEAT.h.every((h) => h > 0)).toBe(true);
    expect(TRAY_BOX.c[1]).toBeLessThan(0);
  });
});

describe('motion tokens', () => {
  it('mirror the site: 160, 240 and 360 ms, and the ease-out curve from 0 to 1', () => {
    expect([DURATION_FAST, DURATION_BASE, DURATION_SLOW]).toEqual([
      160, 240, 360,
    ]);
    expect(easeOut(0)).toBeCloseTo(0, 5);
    expect(easeOut(1)).toBeCloseTo(1, 5);
    // an ease-out is ahead of a straight line early on
    expect(easeOut(0.2)).toBeGreaterThan(0.2);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});
