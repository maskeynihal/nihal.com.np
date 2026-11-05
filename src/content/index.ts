import type {
  BodyDef,
  ClockDef,
  CvRow,
  Holiday,
  PR,
  Post,
  WorkItem,
} from './schema';
import type { GithubData } from './schema';
import { copy } from './copy';
import { work } from './work';
import { oss } from './oss';
import { writing } from './writing';
import { cv } from './cv';
import { objects } from './objects';
import { clocks } from './clocks';
import holidays from './holidays.json';
import github from './generated/github.json';

/**
 * Owner preview builds (`pnpm build:preview-unconfirmed`) set PUBLIC_SHOW_UNCONFIRMED=1.
 * Read at call time so tests can toggle it; Vite inlines the literal in real builds.
 */
const showUnconfirmed = (): boolean =>
  import.meta.env?.PUBLIC_SHOW_UNCONFIRMED === '1';

const visible = <T extends { confirmed: boolean }>(rows: readonly T[]): T[] =>
  showUnconfirmed() ? [...rows] : rows.filter((r) => r.confirmed);

// Validation is not done here: the `validate-content` Astro integration runs
// `validateAll()` (src/content/validate.ts) before every build, so it cannot be
// skipped by dropping this import from a page. Server-side use only.
export const getCopy = () => copy;
export const getWork = (): WorkItem[] => visible(work);
export const getCv = (): CvRow[] => visible(cv);
export const getObjects = (): BodyDef[] => visible(objects);
export const getClocks = (): ClockDef[] => visible(clocks);
export const getOss = (): PR[] => [...oss];
export const getWriting = (): Post[] => [...writing];
export const getHolidays = (): Holiday[] => [...(holidays as Holiday[])];
export const getGithub = (): GithubData => github as GithubData;

export type { BodyDef, ClockDef, CvRow, Holiday, PR, Post, WorkItem };
