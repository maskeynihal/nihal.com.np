import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bsFromAd, formatBs } from '../src/lib/bs-date.ts';

/**
 * Ports the Nepal holiday data from the owner's spatie/holidays pull request into
 * `src/content/holidays.json` (B-09). Run: `pnpm exec tsx scripts/port-holidays.ts`.
 *
 * Source: https://github.com/spatie/holidays/pull/247 (merged 2024-10-19, merge commit
 * 608ed0df1d353a9783d70204145591b07ea7f3b9), file `src/Calendars/NepaliCalendar.php`, which
 * lists each holiday's Gregorian date for the years it covers: 2024 and 2025 (BS 2081 to 2082).
 * The PR keys every date by Gregorian year, so `adDate` is exactly the PR's value and `bsDate`
 * is derived with bs-date.ts. International Labor Day (05-01) and Christmas (12-25) come from
 * the PR's `holidayAccordingToGregorianCalendar`, which applies to every year; they are listed
 * for the two covered years only, so "covered" means the same thing for every row.
 *
 * The data does not cover 2026 (BS 2083). The site shows no holiday for a year without rows.
 */
const SOURCE =
  'https://github.com/spatie/holidays/blob/608ed0df1d353a9783d70204145591b07ea7f3b9/src/Calendars/NepaliCalendar.php';

/** [label, Gregorian year, MM-DD], in the PR file's order. */
const FROM_PR: readonly (readonly [string, number, string])[] = [
  ['Nepali New Year', 2024, '04-13'],
  ['National Republic Day', 2024, '05-28'],
  ['Prithivi Jayanti', 2025, '01-11'],
  ["Martyrs' Day", 2025, '01-29'],
  ['Democracy Day', 2025, '02-19'],
  ['Constitution Day', 2024, '09-19'],
  ['Makar Sankranti', 2025, '01-14'],
  ['Ghatasthapana (Dashain)', 2024, '10-03'],
  ['Fulpati (Dashain)', 2024, '10-11'],
  ['Maha Nawami (Dashain)', 2024, '10-12'],
  ['Maha Asthami (Dashain)', 2024, '10-12'],
  ['Vijaya Dashami (Dashain)', 2024, '10-13'],
  ['Ekadashi (Dashain)', 2024, '10-14'],
  ['Laxmi Puja (Tihar)', 2024, '11-01'],
  ['Govardhan Puja / Mha Puja (Tihar)', 2024, '11-02'],
  ['Bhai Tika (Tihar)', 2024, '11-03'],
  ['Chhat Parva', 2024, '11-07'],
  ['Tamu Loshar', 2024, '12-30'],
  ['Sonam Losar', 2025, '01-30'],
  ['Gyalpo Loshar', 2025, '02-28'],
  ['Udhauli Parva', 2024, '12-15'],
  ['Maha Shivaratri', 2025, '02-26'],
  ['Holi / Fagu Purnima', 2025, '03-13'],
];

const GREGORIAN: readonly (readonly [string, string])[] = [
  ['International Labor Day', '05-01'],
  ['Christmas', '12-25'],
];

export function buildHolidays() {
  const rows = [
    ...FROM_PR,
    ...[2024, 2025].flatMap((y) =>
      GREGORIAN.map(([label, md]) => [label, y, md] as const),
    ),
  ].map(([name, year, md]) => {
    const adDate = `${year}-${md}`;
    return { bsDate: formatBs(bsFromAd(adDate)), adDate, name, source: SOURCE };
  });
  return rows.sort(
    (a, b) => a.adDate.localeCompare(b.adDate) || a.name.localeCompare(b.name),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  writeFileSync(
    new URL('../src/content/holidays.json', import.meta.url),
    `${JSON.stringify(buildHolidays(), null, 2)}\n`,
  );
