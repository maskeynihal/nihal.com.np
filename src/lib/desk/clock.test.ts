import { describe, expect, it } from 'vitest';
import { handAngles, pivotY } from './clock';
import { KATHMANDU, formatClock } from '../time';

const deg = (r: number) => (r * 180) / Math.PI;

describe('handAngles', () => {
  it('points both hands at 12 at 00:00 and 12:00 in the zone', () => {
    // 2026-11-05 18:15 UTC is 00:00 in Kathmandu (UTC+5:45).
    const a = handAngles(new Date('2026-11-05T18:15:00Z'));
    expect(deg(a.hour)).toBeCloseTo(0, 6);
    expect(deg(a.minute)).toBeCloseTo(0, 6);
    const b = handAngles(new Date('2026-11-06T06:15:00Z'));
    expect(deg(b.hour)).toBeCloseTo(0, 6);
  });

  it('uses the same time as formatClock (the title block)', () => {
    for (const iso of [
      '2026-11-05T08:47:12Z',
      '2026-03-29T23:59:59Z',
      '2026-07-01T00:00:00Z',
    ]) {
      const d = new Date(iso);
      const [h, m] = formatClock(d, KATHMANDU).split(':').map(Number) as [
        number,
        number,
      ];
      const a = handAngles(d, KATHMANDU);
      expect(deg(a.minute)).toBeCloseTo(m * 6, 6);
      expect(deg(a.hour)).toBeCloseTo(((h % 12) + m / 60) * 30, 6);
    }
  });

  it('honours the zone', () => {
    const d = new Date('2026-11-05T12:00:00Z'); // 17:45 Kathmandu, 12:00 UTC
    expect(deg(handAngles(d, 'UTC').hour)).toBeCloseTo(0, 6);
    expect(deg(handAngles(d, KATHMANDU).minute)).toBeCloseTo(270, 6);
  });

  it('steps by whole minutes', () => {
    const a = handAngles(new Date('2026-11-05T08:00:10Z'));
    const b = handAngles(new Date('2026-11-05T08:00:50Z'));
    expect(a).toEqual(b);
  });

  it('pivot rotation is the negative angle (clockwise from above)', () => {
    expect(pivotY(Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 12);
  });
});
