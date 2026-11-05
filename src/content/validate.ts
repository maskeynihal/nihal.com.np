import { z } from 'zod';
import { copy } from './copy';
import { work } from './work';
import { oss } from './oss';
import { writing } from './writing';
import { cv } from './cv';
import { objects } from './objects';
import holidays from './holidays.json';
import github from './generated/github.json';
import {
  BodyList,
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

/** Parse every content file with its schema. Throws on the first invalid file. */
export function validateAll() {
  return {
    copy: parse('copy.ts', Copy, copy),
    work: parse('work.ts', WorkList, work),
    oss: parse('oss.ts', PRList, oss),
    writing: parse('writing.ts', PostList, writing),
    cv: parse('cv.ts', CvList, cv),
    objects: parse('objects.ts', BodyList, objects),
    holidays: parse('holidays.json', HolidayList, holidays),
    github: parse('generated/github.json', GithubData, github),
  };
}
