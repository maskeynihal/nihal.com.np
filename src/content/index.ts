import type { BodyDef, CvRow, Holiday, PR, Post, WorkItem } from './schema';
import { validateAll } from './validate';

/**
 * Owner preview builds (`pnpm build:preview-unconfirmed`) set PUBLIC_SHOW_UNCONFIRMED=1.
 * Read at call time so tests can toggle it; Vite inlines the literal in real builds.
 */
const showUnconfirmed = (): boolean =>
  import.meta.env?.PUBLIC_SHOW_UNCONFIRMED === '1';

const visible = <T extends { confirmed: boolean }>(rows: readonly T[]): T[] =>
  showUnconfirmed() ? [...rows] : rows.filter((r) => r.confirmed);

// Parsed once at import. An invalid row throws a readable error and fails the build.
const data = validateAll();

export const getCopy = () => data.copy;
export const getWork = (): WorkItem[] => visible(data.work);
export const getCv = (): CvRow[] => visible(data.cv);
export const getObjects = (): BodyDef[] => visible(data.objects);
export const getOss = (): PR[] => [...data.oss];
export const getWriting = (): Post[] => [...data.writing];
export const getHolidays = (): Holiday[] => [...data.holidays];
export const getGithub = () => data.github;

export type { BodyDef, CvRow, Holiday, PR, Post, WorkItem };
