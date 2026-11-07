import { describe, expect, it } from 'vitest';
import {
  BodyDef,
  Copy,
  CvRow,
  GithubData,
  Holiday,
  Post,
  PR,
  WorkItem,
} from './schema';
import { copy } from './copy';
import { work } from './work';
import { oss } from './oss';
import { writing } from './writing';
import { cv } from './cv';
import { objects } from './objects';

const w = work[1]!;
const o = objects[0]!;
const omit = (v: object, k: string) =>
  Object.fromEntries(Object.entries(v).filter(([key]) => key !== k));
const rejects = (
  s: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown,
) => expect(s.safeParse(v).success).toBe(false);
const accepts = (
  s: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown,
) => expect(s.safeParse(v).success).toBe(true);

describe('WorkItem', () => {
  it('accepts a valid row', () => accepts(WorkItem, w));
  it('rejects a bad URL', () =>
    rejects(WorkItem, { ...w, links: [{ label: 'x', href: 'not a url' }] }));
  it('rejects http URLs', () =>
    rejects(WorkItem, { ...w, links: [{ label: 'x', href: 'http://a.com' }] }));
  it('rejects javascript: URLs', () =>
    rejects(WorkItem, {
      ...w,
      links: [{ label: 'x', href: 'javascript:alert(1)' }],
    }));
  it('accepts mailto', () =>
    accepts(WorkItem, {
      ...w,
      links: [{ label: 'x', href: 'mailto:a@b.co' }],
    }));
  it('rejects an unknown key', () => rejects(WorkItem, { ...w, extra: 1 }));
  it('rejects an unknown nested key', () =>
    rejects(WorkItem, {
      ...w,
      links: [{ label: 'x', href: 'https://a.com', z: 1 }],
    }));
  it('rejects a missing field', () => {
    rejects(WorkItem, omit(w, 'title'));
  });
  it('rejects a wrong type', () =>
    rejects(WorkItem, { ...w, confirmed: 'yes' }));
  it('rejects empty body', () => rejects(WorkItem, { ...w, body: [] }));
});

describe('PR', () => {
  const pr = oss[0]!;
  it('accepts', () => accepts(PR, pr));
  it('rejects bad URL', () => rejects(PR, { ...pr, href: 'github.com/x' }));
  it('rejects unknown key', () => rejects(PR, { ...pr, n: 1 }));
  it('rejects bad repo', () => rejects(PR, { ...pr, repo: 'nope' }));
  it('rejects missing field', () => rejects(PR, { repo: pr.repo }));
});

describe('Post', () => {
  const p = writing[0]!;
  it('accepts', () => accepts(Post, p));
  it('rejects non-ISO date', () => rejects(Post, { ...p, date: '11/05/2026' }));
  it('rejects bad URL', () => rejects(Post, { ...p, href: '/relative' }));
  it('rejects unknown key', () => rejects(Post, { ...p, tags: [] }));
  it('rejects missing field', () => rejects(Post, { date: p.date }));
});

describe('CvRow', () => {
  const r = cv[0]!;
  it('accepts', () => accepts(CvRow, r));
  it('rejects unknown key', () => rejects(CvRow, { ...r, x: 1 }));
  it('rejects wrong type', () => rejects(CvRow, { ...r, confirmed: 1 }));
  it('rejects missing field', () => rejects(CvRow, { when: '2020' }));
});

describe('BodyDef', () => {
  it('accepts', () => accepts(BodyDef, o));
  it('rejects a wrong target', () =>
    rejects(BodyDef, { ...o, target: '#nowhere' }));
  it('accepts exactly the allowed targets', () => {
    for (const t of [
      '#desk',
      '#work',
      '#work-trayt',
      '#work-tz-converter',
      '#work-space-hog',
      '#work-car-sensors',
      '#work-pac-man',
      '#open-source',
      '#writing',
      '#cv',
      '#contact',
    ])
      accepts(BodyDef, { ...o, target: t });
  });
  it('rejects #work-<unknown id> and near misses', () => {
    for (const t of [
      '#work-nope',
      '#work-',
      '#work-pac-man-2',
      '#Work',
      'work',
    ])
      rejects(BodyDef, { ...o, target: t });
  });
  it('rejects a wrong collider kind', () =>
    rejects(BodyDef, { ...o, collider: { ...o.collider, kind: 'mesh' } }));
  it('rejects a short vector', () =>
    rejects(BodyDef, { ...o, home: { ...o.home, p: [0, 1] } }));
  it('rejects an unknown key', () => rejects(BodyDef, { ...o, extra: true }));
  it('rejects a missing field', () => {
    rejects(BodyDef, omit(o, 'mass'));
  });
  it('rejects an unknown id', () => rejects(BodyDef, { ...o, id: 'toaster' }));
});

describe('Holiday', () => {
  const h = {
    bsDate: '2083-01-01',
    adDate: '2026-04-14',
    name: 'New Year',
    source: 'https://github.com/spatie/holidays/pull/247',
  };
  it('accepts', () => accepts(Holiday, h));
  it('rejects bad date', () => rejects(Holiday, { ...h, adDate: 'April' }));
  it('rejects bad URL', () => rejects(Holiday, { ...h, source: 'spatie' }));
  it('rejects unknown key', () => rejects(Holiday, { ...h, x: 1 }));
  it('rejects missing field', () => rejects(Holiday, { bsDate: h.bsDate }));
});

describe('Copy', () => {
  it('accepts', () => accepts(Copy, copy));
  it('rejects an unknown key', () => rejects(Copy, { ...copy, extra: 'x' }));
  it('rejects a bad email', () =>
    rejects(Copy, {
      ...copy,
      titleBlock: { ...copy.titleBlock, email: 'nope' },
    }));
  it('rejects a missing field', () => {
    rejects(WorkItem, omit(w, 'title'));
  });
  it('rejects a wrong type', () =>
    rejects(WorkItem, { ...w, confirmed: 'yes' }));
  it('rejects empty body', () => rejects(WorkItem, { ...w, body: [] }));
});

describe('PR', () => {
  const pr = oss[0]!;
  it('accepts', () => accepts(PR, pr));
  it('rejects bad URL', () => rejects(PR, { ...pr, href: 'github.com/x' }));
  it('rejects unknown key', () => rejects(PR, { ...pr, n: 1 }));
  it('rejects bad repo', () => rejects(PR, { ...pr, repo: 'nope' }));
  it('rejects missing field', () => rejects(PR, { repo: pr.repo }));
});

describe('Post', () => {
  const p = writing[0]!;
  it('accepts', () => accepts(Post, p));
  it('rejects non-ISO date', () => rejects(Post, { ...p, date: '11/05/2026' }));
  it('rejects bad URL', () => rejects(Post, { ...p, href: '/relative' }));
  it('rejects unknown key', () => rejects(Post, { ...p, tags: [] }));
  it('rejects missing field', () => rejects(Post, { date: p.date }));
});

describe('CvRow', () => {
  const r = cv[0]!;
  it('accepts', () => accepts(CvRow, r));
  it('rejects unknown key', () => rejects(CvRow, { ...r, x: 1 }));
  it('rejects wrong type', () => rejects(CvRow, { ...r, confirmed: 1 }));
  it('rejects missing field', () => rejects(CvRow, { when: '2020' }));
});

describe('BodyDef', () => {
  it('accepts', () => accepts(BodyDef, o));
  it('rejects a wrong target', () =>
    rejects(BodyDef, { ...o, target: '#nowhere' }));
  it('accepts exactly the allowed targets', () => {
    for (const t of [
      '#desk',
      '#work',
      '#work-trayt',
      '#work-tz-converter',
      '#work-space-hog',
      '#work-car-sensors',
      '#work-pac-man',
      '#open-source',
      '#writing',
      '#cv',
      '#contact',
    ])
      accepts(BodyDef, { ...o, target: t });
  });
  it('rejects #work-<unknown id> and near misses', () => {
    for (const t of [
      '#work-nope',
      '#work-',
      '#work-pac-man-2',
      '#Work',
      'work',
    ])
      rejects(BodyDef, { ...o, target: t });
  });
  it('rejects a wrong collider kind', () =>
    rejects(BodyDef, { ...o, collider: { ...o.collider, kind: 'mesh' } }));
  it('rejects a short vector', () =>
    rejects(BodyDef, { ...o, home: { ...o.home, p: [0, 1] } }));
  it('rejects an unknown key', () => rejects(BodyDef, { ...o, extra: true }));
  it('rejects a missing field', () => {
    rejects(BodyDef, omit(o, 'mass'));
  });
  it('rejects an unknown id', () => rejects(BodyDef, { ...o, id: 'toaster' }));
});

describe('Holiday', () => {
  const h = {
    bsDate: '2083-01-01',
    adDate: '2026-04-14',
    name: 'New Year',
    source: 'https://github.com/spatie/holidays/pull/247',
  };
  it('accepts', () => accepts(Holiday, h));
  it('rejects bad date', () => rejects(Holiday, { ...h, adDate: 'April' }));
  it('rejects bad URL', () => rejects(Holiday, { ...h, source: 'spatie' }));
  it('rejects unknown key', () => rejects(Holiday, { ...h, x: 1 }));
  it('rejects missing field', () => rejects(Holiday, { bsDate: h.bsDate }));
});

describe('Copy', () => {
  it('accepts', () => accepts(Copy, copy));
  it('rejects an unknown key', () => rejects(Copy, { ...copy, extra: 'x' }));
  it('rejects a bad email', () =>
    rejects(Copy, {
      ...copy,
      titleBlock: { ...copy.titleBlock, email: 'nope' },
    }));
  it('rejects a bad option letter', () =>
    rejects(Copy, {
      ...copy,
      titleBlock: { ...copy.titleBlock, selected: 'D' },
    }));
  it('rejects a missing field', () => {
    rejects(Copy, omit(copy, 'consoleLine'));
  });
  it('has the owner sentence as the single title block line', () =>
    expect(copy.titleBlock.line).toMatch(/^Lead engineer at Leapfrog/));
});

describe('GithubData', () => {
  const g = {
    fetchedAt: '2026-11-05T00:00:00Z',
    merged: 1,
    closed: 0,
    repos: { 'a/b': { stars: 1, pushedAt: '2026-11-05T00:00:00Z' } },
  };
  it('accepts', () => accepts(GithubData, g));
  it('rejects negative counts', () =>
    rejects(GithubData, { ...g, merged: -1 }));
  it('rejects bad timestamp', () =>
    rejects(GithubData, { ...g, fetchedAt: 'yesterday' }));
  it('rejects unknown key', () => rejects(GithubData, { ...g, x: 1 }));
  it('rejects missing field', () => rejects(GithubData, { merged: 1 }));
});
