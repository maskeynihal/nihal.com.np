import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatClock, msToNextMinute, everyMinute } from './time';

afterEach(() => vi.useRealTimers());

describe('formatClock', () => {
  it('shows Kathmandu at UTC+5:45', () => {
    expect(formatClock(new Date('2026-11-05T08:47:00Z'))).toBe('14:32');
  });
  it('rolls over midnight and pads', () => {
    expect(formatClock(new Date('2026-11-05T18:15:00Z'))).toBe('00:00');
    expect(formatClock(new Date('2026-11-05T18:20:00Z'))).toBe('00:05');
  });
  it('takes other zones; DST edges follow Intl', () => {
    // US spring forward 2026-03-08 07:00Z: New York jumps 01:59 EST -> 03:00 EDT.
    expect(
      formatClock(new Date('2026-03-08T06:59:00Z'), 'America/New_York'),
    ).toBe('01:59');
    expect(
      formatClock(new Date('2026-03-08T07:00:00Z'), 'America/New_York'),
    ).toBe('03:00');
    expect(
      formatClock(new Date('2026-11-05T08:47:00Z'), 'Australia/Sydney'),
    ).toBe('19:47');
  });
});

describe('msToNextMinute', () => {
  it('counts to the boundary and never returns 0', () => {
    expect(msToNextMinute(new Date('2026-11-05T08:47:15.000Z'))).toBe(45_000);
    expect(msToNextMinute(new Date('2026-11-05T08:47:00.000Z'))).toBe(60_000);
  });
});

describe('everyMinute', () => {
  it('ticks now, then on each boundary, and stops', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T08:47:30Z'));
    const seen: string[] = [];
    const stop = everyMinute((d) => seen.push(formatClock(d)));
    expect(seen).toEqual(['14:32']);
    vi.advanceTimersByTime(30_000);
    expect(seen).toEqual(['14:32', '14:33']);
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual(['14:32', '14:33', '14:34']);
    stop();
    vi.advanceTimersByTime(120_000);
    expect(seen).toHaveLength(3);
  });
});
