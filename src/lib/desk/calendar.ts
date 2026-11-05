import { BS_MONTH_NAMES, adDayIn, bsFromInstant, formatBs } from '../bs-date';
import { holidaysShownOn } from '../holidays';
import type { Holiday } from '../../content/schema';

export interface CalendarFace {
  /** Big numeral, "20". */
  day: string;
  /** "Kartik 2083" */
  monthYear: string;
  /** "2083-07-20", exactly `formatBs`. */
  iso: string;
  /** Today's public holiday, if the data covers the year and one falls today. */
  holiday: string | undefined;
}

/**
 * What the desk calendar shows for an instant: the Kathmandu day in Bikram Sambat and, when one
 * falls on it, the public holiday from the ported data. Pure. Returns undefined when the date is
 * outside the conversion table (the face then stays blank rather than lying).
 */
export function calendarFace(
  now: Date,
  holidays: readonly Holiday[],
): CalendarFace | undefined {
  let bs;
  try {
    bs = bsFromInstant(now);
  } catch {
    return undefined;
  }
  const todays = holidaysShownOn(adDayIn(now), holidays);
  return {
    day: String(bs.day),
    monthYear: `${BS_MONTH_NAMES[bs.month - 1] ?? ''} ${bs.year}`,
    iso: formatBs(bs),
    holiday: todays[0]?.name,
  };
}
