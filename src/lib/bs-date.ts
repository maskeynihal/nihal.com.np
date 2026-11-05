import { BS_FIRST_YEAR, BS_MONTH_DAYS } from './bs-table';

/**
 * Gregorian <-> Bikram Sambat, by table (bs-table.ts). Civil dates only: a `YYYY-MM-DD` string
 * or the calendar day an instant has in a zone (Kathmandu by default). No `Date` arithmetic in
 * local time, so the user's zone and DST never matter. Used by the calendar object (E-04) and
 * nowhere else.
 */
export interface BsDate {
  year: number;
  /** 1 = Baisakh ... 12 = Chait */
  month: number;
  day: number;
}

export const BS_MIN_YEAR = BS_FIRST_YEAR;
export const BS_MAX_YEAR = BS_FIRST_YEAR + BS_MONTH_DAYS.length - 1;

/** AD civil date of BS 1975-01-01 (the table anchor), as days since 1970-01-01. */
const ANCHOR_DAYS = Date.UTC(1918, 3, 13) / 86_400_000;

const DAY_MS = 86_400_000;

/** Days from the anchor to Baisakh 1 of each table year, plus a final entry for the end. */
const yearStart: number[] = (() => {
  const out = [0];
  for (const months of BS_MONTH_DAYS)
    out.push((out[out.length - 1] ?? 0) + months.reduce((a, b) => a + b, 0));
  return out;
})();

const monthDays = (year: number): readonly number[] => {
  const row = BS_MONTH_DAYS[year - BS_MIN_YEAR];
  if (!row)
    throw new RangeError(
      `BS year ${year} is outside ${BS_MIN_YEAR}..${BS_MAX_YEAR}`,
    );
  return row;
};

export function daysInBsMonth(year: number, month: number): number {
  const d = monthDays(year)[month - 1];
  if (d === undefined) throw new RangeError(`BS month ${month} is not 1..12`);
  return d;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

const parseAd = (ad: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ad);
  if (!m) throw new RangeError(`expected YYYY-MM-DD, got "${ad}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d
  )
    throw new RangeError(`not a calendar date: ${ad}`);
  return t / DAY_MS;
};

/** AD `YYYY-MM-DD` to BS. Throws RangeError outside 1918-04-13 .. the end of BS 2100. */
export function bsFromAd(ad: string): BsDate {
  let n = parseAd(ad) - ANCHOR_DAYS;
  if (n < 0 || n >= (yearStart[yearStart.length - 1] ?? 0))
    throw new RangeError(`${ad} is outside the supported BS range`);
  let y = 0;
  while (n >= (yearStart[y + 1] ?? 0)) y++;
  n -= yearStart[y] ?? 0;
  const months = BS_MONTH_DAYS[y] ?? [];
  let m = 0;
  while (n >= (months[m] ?? 0)) {
    n -= months[m] ?? 0;
    m++;
  }
  return { year: BS_MIN_YEAR + y, month: m + 1, day: n + 1 };
}

/** BS to AD `YYYY-MM-DD`. Throws RangeError for a day the month does not have. */
export function bsToAd({ year, month, day }: BsDate): string {
  if (!Number.isInteger(day) || day < 1 || day > daysInBsMonth(year, month))
    throw new RangeError(`BS ${year}-${month}-${day} does not exist`);
  const months = monthDays(year);
  const n =
    (yearStart[year - BS_MIN_YEAR] ?? 0) +
    months.slice(0, month - 1).reduce((a, b) => a + b, 0) +
    day -
    1;
  const d = new Date((ANCHOR_DAYS + n) * DAY_MS);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The AD calendar day an instant has in `timeZone`, as `YYYY-MM-DD`. */
export function adDayIn(instant: Date, timeZone = 'Asia/Kathmandu'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  return parts; // en-CA is YYYY-MM-DD
}

/** Today's (or any instant's) BS date as seen in Kathmandu. */
export function bsFromInstant(instant: Date, timeZone?: string): BsDate {
  return bsFromAd(adDayIn(instant, timeZone));
}

export const formatBs = ({ year, month, day }: BsDate): string =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** Month names for display (E-04 owns the calendar face and may move these into content). */
export const BS_MONTH_NAMES = [
  'Baisakh',
  'Jestha',
  'Ashar',
  'Shrawan',
  'Bhadra',
  'Asoj',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chait',
] as const;
