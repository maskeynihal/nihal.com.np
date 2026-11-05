import { describe, expect, it } from 'vitest';
import { calendarFace } from './calendar';
import { BS_MONTH_NAMES, bsFromInstant, formatBs } from '../bs-date';
import type { Holiday } from '../../content/schema';

const holiday = (adDate: string, name: string): Holiday => ({
  bsDate: '2081-01-01',
  adDate,
  name,
  source: 'https://example.com/x',
});

describe('calendarFace', () => {
  it('shows exactly the bs-date output for the instant', () => {
    const now = new Date('2026-11-05T08:00:00Z');
    const bs = bsFromInstant(now);
    const face = calendarFace(now, []);
    expect(face?.iso).toBe(formatBs(bs));
    expect(face?.day).toBe(String(bs.day));
    expect(face?.monthYear).toBe(`${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`);
  });

  it("uses the Kathmandu day, not the viewer's", () => {
    // 20:00 UTC is already the next day in Kathmandu.
    const face = calendarFace(new Date('2026-11-05T20:00:00Z'), []);
    expect(face?.iso).toBe(
      formatBs(bsFromInstant(new Date('2026-11-06T12:00:00Z'))),
    );
  });

  it('marks a public holiday that falls today, and only when the data covers the year', () => {
    const now = new Date('2026-11-05T08:00:00Z');
    expect(
      calendarFace(now, [holiday('2026-11-05', 'Bhai Tika')])?.holiday,
    ).toBe('Bhai Tika');
    expect(
      calendarFace(now, [holiday('2026-11-06', 'Other')])?.holiday,
    ).toBeUndefined();
    expect(calendarFace(now, [])?.holiday).toBeUndefined();
  });

  it('returns nothing outside the conversion table rather than a wrong date', () => {
    expect(calendarFace(new Date('1800-01-01T00:00:00Z'), [])).toBeUndefined();
  });
});
