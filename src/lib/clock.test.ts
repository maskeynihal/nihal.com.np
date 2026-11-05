import { describe, expect, it } from 'vitest';
import { handAngles, utcOffsetLabel } from './clock';

const at = (iso: string) => new Date(iso);

describe('utcOffsetLabel', () => {
  it('formats the Kathmandu quarter-hour offset', () => {
    expect(utcOffsetLabel(at('2026-11-05T00:00:00Z'), 'Asia/Kathmandu')).toBe(
      'utc+5:45',
    );
  });
  it('drops the minutes when they are zero and the sign when UTC', () => {
    expect(utcOffsetLabel(at('2026-11-05T00:00:00Z'), 'Australia/Sydney')).toBe(
      'utc+11',
    );
    expect(utcOffsetLabel(at('2026-11-05T00:00:00Z'), 'UTC')).toBe('utc');
  });
  it('follows daylight saving for the instant', () => {
    expect(
      utcOffsetLabel(at('2026-01-15T00:00:00Z'), 'America/Los_Angeles'),
    ).toBe('utc-8');
    expect(
      utcOffsetLabel(at('2026-07-15T00:00:00Z'), 'America/Los_Angeles'),
    ).toBe('utc-7');
  });
});

describe('handAngles', () => {
  it('puts the hands where the wall time is', () => {
    // 06:15 UTC is 12:00 in Kathmandu.
    expect(handAngles(at('2026-11-05T06:15:00Z'), 'Asia/Kathmandu')).toEqual({
      hour: 0,
      minute: 0,
    });
    // 09:00 UTC is 14:45 in Kathmandu: hour hand at 2:45.
    expect(handAngles(at('2026-11-05T09:00:00Z'), 'Asia/Kathmandu')).toEqual({
      hour: 2 * 30 + 45 * 0.5,
      minute: 270,
    });
  });
});
