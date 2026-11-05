import { describe, expect, it } from 'vitest';
import holidays from './holidays.json';
import { validateAll } from './validate';
import { copy } from './copy';
import { work } from './work';
import { oss } from './oss';
import { writing } from './writing';
import { cv } from './cv';
import { objects } from './objects';
import { pending } from './pending';
import { soundLabel } from './client-copy';
import { buildPosterAlt } from './poster-alt';
import { getObjects } from './index';

/** Keys whose values are not displayed prose. */
const NOT_PROSE = new Set([
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
    const notes = [
      ...pending.copy,
      ...Object.values(pending.work).flat(),
      ...Object.values(pending.cv).flat(),
      ...Object.values(pending.objects).flat(),
    ];
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n).toMatch(/\[(CONFIRM|ASK|Q\d)\]/);
  });

  it('displayed modules carry no pending field or note', () => {
    expect(JSON.stringify([copy, work, cv, objects])).not.toMatch(
      /pending|\[(CONFIRM|ASK|Q\d)\]/,
    );
  });

  it('client-copy matches copy.ts', () => {
    expect(soundLabel.on).toBe(copy.prefs.on);
    expect(soundLabel.off).toBe(copy.prefs.off);
  });

  it('cross-reference: every #work-<id> target names a work item', () => {
    const ids = new Set(work.map((w) => w.id));
    for (const o of objects) {
      const m = /^#work-(.+)$/.exec(o.target);
      if (m) expect(ids.has(m[1] as (typeof work)[number]['id'])).toBe(true);
    }
  });

  it('validateAll rejects an object that targets a missing work item', () => {
    const o = objects[0];
    if (!o) throw new Error('no objects');
    const saved = o.target;
    try {
      o.target = '#work-ghost' as typeof o.target;
      expect(() => validateAll()).toThrow();
    } finally {
      o.target = saved;
    }
  });

  it('pending keys all name existing rows', () => {
    const ids = new Set<string>(work.map((w) => w.id));
    for (const k of Object.keys(pending.work)) expect(ids.has(k)).toBe(true);
    const oids = new Set<string>(objects.map((x) => x.id));
    for (const k of Object.keys(pending.objects))
      expect(oids.has(k)).toBe(true);
  });

  describe('posterAlt', () => {
    it('plain build: confirmed objects only, no cruiser, one clock', () => {
      const alt = buildPosterAlt(getObjects());
      expect(alt).toBe(
        'Line drawing of an Arduino board with a small OLED screen, a desk clock, a Nepali desk calendar and a Pac-Man ghost laid out on blueprint paper.',
      );
      expect(alt).not.toMatch(/cruiser/i);
    });
    it('all objects: three clocks and the cruiser', () => {
      const alt = buildPosterAlt(objects);
      expect(alt).toContain('three desk clocks');
      expect(alt).toContain('a toy Land Cruiser');
    });
  });

  it('holidays.json is an empty array for now', () => {
    expect(holidays).toEqual([]);
  });
});
