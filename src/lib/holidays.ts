import type { Holiday } from '../content/schema';

/** Holidays that fall on an AD `YYYY-MM-DD`, in the order the data lists them. */
export function holidaysOn(ad: string, list: readonly Holiday[]): Holiday[] {
  return list.filter((h) => h.adDate === ad);
}

/** True when the data has rows for that AD year. A year without rows is "unknown", not "no holiday". */
export function coversYear(adYear: number, list: readonly Holiday[]): boolean {
  return list.some((h) => h.adDate.startsWith(`${adYear}-`));
}

/**
 * The holidays to show for a day: none unless the data covers its year, so the calendar never
 * implies a quiet day it has no data for.
 */
export function holidaysShownOn(
  ad: string,
  list: readonly Holiday[],
): Holiday[] {
  return coversYear(Number(ad.slice(0, 4)), list) ? holidaysOn(ad, list) : [];
}
