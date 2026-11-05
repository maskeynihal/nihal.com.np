const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export interface DatePart {
  /** Machine-readable `YYYY-MM`, for `<time datetime>`. */
  datetime: string;
  /** The text as written, e.g. "nov 2026". */
  text: string;
}

/**
 * Splits a work date line ("nov 2026 · 0.8.1 ...", "jan 2025 → · lead engineer") into its
 * leading month-year, which becomes a `<time>`, and the rest, which stays text.
 * Returns `date: null` when the line does not start with a month and a year.
 */
export function splitDateLine(line: string): {
  date: DatePart | null;
  rest: string;
} {
  const m = /^([a-z]{3}) (\d{4})(?=\s|$)/.exec(line);
  const month = m ? MONTHS.indexOf(m[1] as (typeof MONTHS)[number]) : -1;
  if (!m || month < 0) return { date: null, rest: line };
  return {
    date: {
      datetime: `${m[2]}-${String(month + 1).padStart(2, '0')}`,
      text: m[0],
    },
    rest: line.slice(m[0].length),
  };
}

/** True for a valid month string (`2023-06`) or date string (`2026-10-26`): safe for `datetime`. */
export function isDatetime(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/.test(value);
}

/** The `YYYY-MM-DD` part of an ISO timestamp. */
export function dayOf(iso: string): string {
  return iso.slice(0, 10);
}
