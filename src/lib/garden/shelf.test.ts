import { describe, expect, it } from 'vitest';
import * as desk from '../desk/materials';
import { GRAVITY, TABLE_WORLD_M, fall, freeX } from './shelf';

describe('desk gravity', () => {
  it('is the number the desk uses', () => {
    expect(GRAVITY).toBeCloseTo(desk.GRAVITY, 10);
    expect(TABLE_WORLD_M).toBe(desk.TABLE_WORLD_M);
  });
});

describe('fall', () => {
  const run = (g: number, y0: number, h: number, floor: number, dt: number) => {
    const s = { y: y0, vy: 0, h, bounces: 0 };
    const heights: number[] = [];
    let steps = 0;
    while (!fall(s, dt, g, floor)) {
      heights.push(s.y + s.h);
      if (++steps > 5000) throw new Error('never rests');
    }
    return { s, heights, steps };
  };

  it.each([1 / 60, 1 / 30, 1 / 20])(
    'lands exactly on the floor, bounces once and rests (dt %f)',
    (dt) => {
      const floor = 760;
      const { s, heights } = run(6000, 40, 104, floor, dt);
      expect(s.y + s.h).toBe(floor);
      expect(s.vy).toBe(0);
      expect(s.bounces).toBe(1);
      // Never below the floor, and it rises after the first contact (the bounce) exactly once.
      expect(Math.max(...heights)).toBeLessThanOrEqual(floor);
      let rises = 0;
      for (let i = 1; i < heights.length; i++)
        if ((heights[i] as number) < (heights[i - 1] as number) - 0.01) {
          if ((heights[i - 1] as number) >= floor - 0.5) rises++;
        }
      expect(rises).toBeLessThanOrEqual(1);
    },
  );

  it('the bounce is small', () => {
    const { heights } = run(6000, 0, 100, 800, 1 / 60);
    // After the first contact the item never climbs more than a fifth of the way back to where it fell from.
    const first = heights.findIndex((v) => v >= 799);
    const after = heights.slice(first);
    expect(Math.min(...after)).toBeGreaterThan(800 - 0.2 * 700);
  });

  it('a slow drop does not bounce at all', () => {
    const s = { y: 699, vy: 50, h: 100, bounces: 0 };
    let done = false;
    for (let i = 0; i < 200 && !done; i++) done = fall(s, 1 / 60, 6000, 800);
    expect(done).toBe(true);
    expect(s.bounces).toBe(0);
    expect(s.y + s.h).toBe(800);
  });
});

describe('freeX', () => {
  const taken = [
    { x: 200, w: 84 },
    { x: 290, w: 120 },
  ];

  it('keeps the wanted x when it is free', () => {
    expect(freeX(taken, 84, 600, 100, 900)).toBe(600);
  });

  it('moves to the nearest gap and never overlaps', () => {
    for (const want of [150, 210, 260, 300, 380, 405]) {
      const x = freeX(taken, 84, want, 100, 900);
      expect(x).not.toBeNull();
      for (const t of taken)
        expect(x! + 84 <= t.x || x! >= t.x + t.w, `want ${want}`).toBe(true);
    }
  });

  it('stays between the limits', () => {
    const x = freeX([], 84, -50, 150, 400);
    expect(x).toBe(150);
    expect(freeX([], 84, 999, 150, 400)).toBe(400 - 84);
  });

  it('says so when nothing fits', () => {
    expect(freeX([{ x: 100, w: 100 }], 84, 120, 100, 200)).toBeNull();
  });
});
