import { describe, expect, it } from 'vitest';
import holidays from './holidays.json';
import { validateAll } from './validate';
import { copy } from './copy';
import { work } from './work';
import { oss } from './oss';
import { writing } from './writing';
import { cv } from './cv';
import { objects } from './objects';

/** Keys whose values are not displayed prose. */
const NOT_PROSE = new Set([
  'pending',
  'href',
  'sourceHref',
  'allHref',
  'model',
  'id',
  'target',
  'source',
]);

function strings(v: unknown, out: string[] = [], key = ''): string[] {
  if (NOT_PROSE.has(key)) return out;
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out, key));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) strings(x, out, k);
  return out;
}

const all = [
  ...strings(copy),
  ...strings(work),
  ...strings(oss),
  ...strings(writing),
  ...strings(cv),
  ...strings(objects),
];

describe('content files', () => {
  it('all parse with their schemas', () => {
    expect(() => validateAll()).not.toThrow();
  });

  it('has five work panels with the required ids', () => {
    expect(work.map((w) => w.id)).toEqual([
      'trayt',
      'tz-converter',
      'space-hog',
      'car-sensors',
      'pac-man',
    ]);
  });

  it('has seven oss rows and five posts', () => {
    expect(oss).toHaveLength(7);
    expect(writing).toHaveLength(5);
  });

  it('uses real hashnode and github URLs', () => {
    for (const p of writing)
      expect(p.href).toMatch(
        /^https:\/\/nihalmaskey\.hashnode\.dev\/[a-z0-9-]+$/,
      );
    for (const r of oss)
      expect(r.href).toMatch(
        /^https:\/\/github\.com\/[^/]+\/[^/]+\/(pull\/\d+|commits\?author=maskeynihal)$/,
      );
  });

  it('displayed strings have no brackets, TODO or lorem', () => {
    const bad = all.filter((s) => /[[\]]|TODO|lorem/i.test(s));
    expect(bad).toEqual([]);
  });

  it('has no hard-coded year spans', () => {
    const bad = all.filter((s) => /\b\d+\+?\s*(years?|yrs?)\b/i.test(s));
    expect(bad).toEqual([]);
  });

  it('keeps every pending note in bracket form', () => {
    const notes = [...copy.pending, ...work, ...cv, ...objects].flatMap((x) =>
      typeof x === 'string' ? [x] : (x.pending ?? []),
    );
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n).toMatch(/\[(CONFIRM|ASK|Q\d)\]/);
  });

  it('holidays.json is an empty array for now', () => {
    expect(holidays).toEqual([]);
  });
});
