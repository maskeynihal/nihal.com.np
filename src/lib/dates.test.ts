import { describe, expect, it } from 'vitest';
import { dayOf, isDatetime, splitDateLine } from './dates';
import { work } from '../content/work';

describe('splitDateLine', () => {
  it('pulls the leading month and year out', () => {
    expect(splitDateLine('nov 2026 · 0.8.1 in the chrome web store')).toEqual({
      date: { datetime: '2026-11', text: 'nov 2026' },
      rest: ' · 0.8.1 in the chrome web store',
    });
    expect(splitDateLine('jan 2025 → · lead engineer').date?.datetime).toBe(
      '2025-01',
    );
    expect(splitDateLine('aug 2020 · javascript, canvas').date?.datetime).toBe(
      '2020-08',
    );
  });
  it('leaves other lines alone', () => {
    expect(splitDateLine('2026 · x')).toEqual({ date: null, rest: '2026 · x' });
    expect(splitDateLine('foo 2026').date).toBeNull();
  });
  it('every work date line starts with a month and a year', () => {
    for (const w of work)
      expect(splitDateLine(w.dateLine).date, w.id).not.toBeNull();
  });
});

describe('isDatetime', () => {
  it('accepts months and dates, rejects ranges, bare years and bad months', () => {
    for (const ok of ['2023-06', '2026-10-26'])
      expect(isDatetime(ok)).toBe(true);
    for (const bad of ['2023 → 2026', '2021', '2023-13', '2023-06-32', ''])
      expect(isDatetime(bad), bad).toBe(false);
  });
});

describe('dayOf', () => {
  it('cuts an ISO timestamp to its date', () => {
    expect(dayOf('2026-11-05T09:11:43.682Z')).toBe('2026-11-05');
  });
});
