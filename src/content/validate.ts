import { z } from 'zod';
import { copy } from './copy';
import { work } from './work';
import { oss } from './oss';
import { writing } from './writing';
import { cv } from './cv';
import { objects } from './objects';
import { clocks } from './clocks';
import { pending } from './pending';
import holidays from './holidays.json';
import github from './generated/github.json';
import {
  BodyList,
  ClockList,
  Copy,
  CvList,
  GithubData,
  HolidayList,
  PostList,
  PRList,
  WorkList,
} from './schema';

function parse<S extends z.ZodType>(
  file: string,
  schema: S,
  value: unknown,
): z.output<S> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const lines = r.error.issues.map(
    (i) => `  ${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
  );
  throw new Error(
    `Invalid content in src/content/${file}\n${lines.join('\n')}\nFix the data and rebuild.`,
  );
}

function fail(file: string, lines: string[]): never {
  throw new Error(
    `Invalid content in src/content/${file}\n${lines.map((l) => `  ${l}`).join('\n')}\nFix the data and rebuild.`,
  );
}

/** Cross-file references: object targets and pending keys must name real rows. */
function crossCheck(
  workRows: { id: string }[],
  objectRows: { id: string; target: string }[],
  cvRows: { when: string; role: string }[],
) {
  const workIds = new Set(workRows.map((w) => w.id));
  const bad: string[] = [];
  for (const o of objectRows) {
    const m = /^#work-(.+)$/.exec(o.target);
    if (m && !workIds.has(m[1] ?? ''))
      bad.push(`${o.id}.target: ${o.target} names no work item`);
  }
  if (bad.length) fail('objects.ts', bad);

  const stale: string[] = [];
  for (const id of Object.keys(pending.work))
    if (!workIds.has(id)) stale.push(`work.${id}`);
  const objIds = new Set(objectRows.map((o) => o.id));
  for (const id of Object.keys(pending.objects))
    if (!objIds.has(id)) stale.push(`objects.${id}`);
  const cvKeys = new Set(cvRows.map((r) => `${r.when} | ${r.role}`));
  for (const k of Object.keys(pending.cv))
    if (!cvKeys.has(k)) stale.push(`cv.${k}`);
  if (stale.length)
    fail(
      'pending.ts',
      stale.map((k) => `${k}: names no existing row`),
    );
}

/** Parse every content file with its schema. Throws on the first invalid file. */
export function validateAll() {
  const parsed = {
    copy: parse('copy.ts', Copy, copy),
    work: parse('work.ts', WorkList, work),
    oss: parse('oss.ts', PRList, oss),
    writing: parse('writing.ts', PostList, writing),
    cv: parse('cv.ts', CvList, cv),
    objects: parse('objects.ts', BodyList, objects),
    clocks: parse('clocks.ts', ClockList, clocks),
    holidays: parse('holidays.json', HolidayList, holidays),
    github: parse('generated/github.json', GithubData, github),
  };
  crossCheck(parsed.work, parsed.objects, parsed.cv);
  return parsed;
}
