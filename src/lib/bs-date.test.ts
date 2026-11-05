import { describe, expect, it } from 'vitest';
import {
  BS_MAX_YEAR,
  BS_MIN_YEAR,
  adDayIn,
  bsFromAd,
  bsFromInstant,
  bsToAd,
  daysInBsMonth,
  formatBs,
} from './bs-date';
import { BS_MONTH_DAYS } from './bs-table';

/**
 * Known conversions, [BS, AD], each from a source other than the month-length table:
 *
 * spatie/holidays PR 247 (the owner's Nepal calendar), src/Calendars/NepaliCalendar.php at
 *   https://github.com/spatie/holidays/blob/608ed0df1d353a9783d70204145591b07ea7f3b9/src/Calendars/NepaliCalendar.php
 *   National days fixed by BS date, with the AD date the file lists for 2024 and 2025: Nepali
 *   New Year (Baisakh 1), National Republic Day (Jestha 15), Constitution Day (Ashwin 3,
 *   Asoj 3), Prithivi Jayanti (Paush 27), Makar Sankranti (Magh 1), Martyrs' Day (Magh 16),
 *   Democracy Day (Falgun 7).
 * nepali-datetime tests/test_conversions.py (PyPI nepali-datetime, 5 random conversions) and
 *   askbuddie/bikram-sambat src/BikramSambat.test.ts sampleData (4 of its 7; the other three
 *   are 2082-10-30, 2086-12-30 and 2089-01-29, which sit in rows that package has not updated
 *   to the published almanac, so they are not used) and
 *   puncoz-official/bikram-sambat-js src/__tests__ (2076-05-08).
 * askbuddie/bikram-sambat src/data/new-year-mapping.ts: the AD date of Baisakh 1, for years
 *   where that table agrees with the one in bs-table.ts (it does for every year 1976 to 2087;
 *   the ones below are spread across the range).
 * Reference values: the Unix epoch, 1970-01-01, is 17 Poush 2026 BS and 2000-01-01 is 17 Poush
 *   2056 BS (published in most converters; derived here independently of the table).
 */
const KNOWN: readonly (readonly [bs: string, ad: string])[] = [
  // spatie/holidays PR 247
  ['2081-01-01', '2024-04-13'],
  ['2081-02-15', '2024-05-28'],
  ['2081-06-03', '2024-09-19'],
  ['2081-09-27', '2025-01-11'],
  ['2081-10-01', '2025-01-14'],
  ['2081-10-16', '2025-01-29'],
  ['2081-11-07', '2025-02-19'],
  // nepali-datetime tests
  ['2013-02-08', '1956-05-21'],
  ['2051-10-01', '1995-01-15'],
  ['2076-06-27', '2019-10-14'],
  ['2077-04-04', '2020-07-19'],
  ['2081-03-31', '2024-07-15'],
  // askbuddie/bikram-sambat and bikram-sambat-js tests
  ['2075-01-01', '2018-04-14'],
  ['2072-10-03', '2016-01-17'],
  ['2069-11-30', '2013-03-13'],
  ['2080-05-08', '2023-08-25'],
  ['2076-05-08', '2019-08-25'],
  // reference values
  ['2026-09-17', '1970-01-01'],
  ['2056-09-17', '2000-01-01'],
  // askbuddie new-year-mapping.ts (Baisakh 1)
  ['2000-01-01', '1943-04-14'],
  ['2020-01-01', '1963-04-14'],
  ['2030-01-01', '1973-04-13'],
  ['2040-01-01', '1983-04-14'],
  ['2050-01-01', '1993-04-13'],
  ['2060-01-01', '2003-04-14'],
  ['2070-01-01', '2013-04-14'],
  ['2078-01-01', '2021-04-14'],
  ['2079-01-01', '2022-04-14'],
  ['2080-01-01', '2023-04-14'],
  ['2082-01-01', '2025-04-14'],
  ['2083-01-01', '2026-04-14'],
];

const parse = (s: string) => {
  const [year, month, day] = s.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
};

describe('known dates', () => {
  it('has at least 20', () => expect(KNOWN.length).toBeGreaterThanOrEqual(20));
  it.each(KNOWN)('BS %s is AD %s, both ways', (bs, ad) => {
    expect(bsToAd(parse(bs))).toBe(ad);
    expect(formatBs(bsFromAd(ad))).toBe(bs);
  });
});

describe('table', () => {
  it('covers 1975 to 2100 with legal month lengths', () => {
    expect(BS_MIN_YEAR).toBe(1975);
    expect(BS_MAX_YEAR).toBe(2100);
    for (const [i, months] of BS_MONTH_DAYS.entries()) {
      expect(months, `row ${1975 + i}`).toHaveLength(12);
      for (const d of months) expect(d >= 29 && d <= 32).toBe(true);
      const total = months.reduce((a, b) => a + b, 0);
      expect(
        total >= 364 && total <= 367,
        `year ${1975 + i} has ${total} days`,
      ).toBe(true);
    }
  });

  it('every day in range round-trips and advances by exactly one day', () => {
    let prev = '';
    for (let y = BS_MIN_YEAR; y <= BS_MAX_YEAR; y++)
      for (let m = 1; m <= 12; m++)
        for (let d = 1; d <= daysInBsMonth(y, m); d++) {
          const ad = bsToAd({ year: y, month: m, day: d });
          expect(bsFromAd(ad)).toEqual({ year: y, month: m, day: d });
          if (prev)
            expect(
              Date.parse(`${ad}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`),
            ).toBe(86_400_000);
          prev = ad;
        }
  });
});

describe('edges and errors', () => {
  it('first and last supported days', () => {
    expect(bsToAd({ year: 1975, month: 1, day: 1 })).toBe('1918-04-13');
    expect(formatBs(bsFromAd('1918-04-13'))).toBe('1975-01-01');
    const last = { year: 2100, month: 12, day: daysInBsMonth(2100, 12) };
    expect(bsFromAd(bsToAd(last))).toEqual(last);
    expect(() => bsFromAd('1918-04-12')).toThrow(RangeError);
    const after = new Date(Date.parse(`${bsToAd(last)}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(() => bsFromAd(after)).toThrow(RangeError);
  });
  it('rejects days a month does not have and bad input', () => {
    expect(() => bsToAd({ year: 2082, month: 10, day: 30 })).toThrow(
      RangeError,
    ); // Magh 2082 has 29
    expect(() => bsToAd({ year: 2083, month: 13, day: 1 })).toThrow(RangeError);
    expect(() => bsToAd({ year: 2083, month: 1, day: 0 })).toThrow(RangeError);
    expect(() => bsToAd({ year: 2101, month: 1, day: 1 })).toThrow(RangeError);
    expect(() => bsFromAd('2026-02-30')).toThrow(RangeError);
    expect(() => bsFromAd('2026-2-3')).toThrow(RangeError);
  });
  it('leap and month-length cases: 2081 Chait has 31, Magh 2081 has 30', () => {
    expect(daysInBsMonth(2081, 12)).toBe(31);
    expect(daysInBsMonth(2081, 10)).toBe(30);
    expect(bsToAd({ year: 2081, month: 12, day: 31 })).toBe('2025-04-13');
    expect(bsToAd({ year: 2082, month: 1, day: 1 })).toBe('2025-04-14');
  });
});

describe('instants and zones', () => {
  it('uses the calendar day in Kathmandu, not UTC or the machine zone', () => {
    // 2026-04-13 19:00Z is 2026-04-14 00:45 in Kathmandu: Nepali New Year 2083.
    const t = new Date('2026-04-13T19:00:00Z');
    expect(adDayIn(t)).toBe('2026-04-14');
    expect(formatBs(bsFromInstant(t))).toBe('2083-01-01');
    // One minute earlier it is still Chait 30 / 31 of 2082.
    const before = new Date('2026-04-13T18:14:00Z');
    expect(adDayIn(before)).toBe('2026-04-13');
    expect(formatBs(bsFromInstant(before))).toBe('2082-12-30');
  });
  it('takes another zone', () => {
    expect(adDayIn(new Date('2026-04-13T19:00:00Z'), 'America/New_York')).toBe(
      '2026-04-13',
    );
  });
});
