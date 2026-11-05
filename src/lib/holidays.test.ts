import { describe, expect, it } from 'vitest';
import { coversYear, holidaysOn, holidaysShownOn } from './holidays';
import { getHolidays } from '../content';
import { Holiday } from '../content/schema';
import { bsFromAd, formatBs } from './bs-date';
import { buildHolidays } from '../../scripts/port-holidays';

const list = getHolidays();

describe('holidays.json', () => {
  it('matches the schema and the generator (no hand edits)', () => {
    for (const h of list) expect(Holiday.safeParse(h).success).toBe(true);
    expect(list).toEqual(buildHolidays());
  });
  it('every row has a source and a BS date that agrees with its AD date', () => {
    for (const h of list) {
      expect(h.source).toMatch(/^https:\/\/github\.com\/spatie\/holidays\//);
      expect(h.bsDate).toBe(formatBs(bsFromAd(h.adDate)));
    }
  });
  it('holds the 23 PR holidays plus two fixed ones for each of 2024 and 2025', () => {
    expect(list).toHaveLength(23 + 4);
  });
});

describe('lookup', () => {
  it('finds holidays on a day, several when they coincide', () => {
    expect(holidaysOn('2024-04-13', list).map((h) => h.name)).toEqual([
      'Nepali New Year',
    ]);
    expect(holidaysOn('2024-10-12', list)).toHaveLength(2);
    expect(holidaysOn('2024-04-14', list)).toEqual([]);
  });
  it('covers only the years the data has', () => {
    expect(coversYear(2024, list)).toBe(true);
    expect(coversYear(2025, list)).toBe(true);
    expect(coversYear(2026, list)).toBe(false);
  });
  it('shows nothing for an uncovered year even on a fixed-date holiday', () => {
    expect(holidaysShownOn('2026-12-25', list)).toEqual([]);
    expect(holidaysShownOn('2025-12-25', list).map((h) => h.name)).toEqual([
      'Christmas',
    ]);
  });
});
