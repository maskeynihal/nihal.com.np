import { formatClock } from './time';

/**
 * Helpers for the contact clock faces (B-06a). `Intl` only, no zone tables, and no import
 * from the content modules so the client script stays small.
 */

/** Hand angles in degrees (clockwise from 12) for the wall time in `timeZone`. */
export function handAngles(
  date: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const [h = '0', m = '0'] = formatClock(date, timeZone).split(':');
  const hours = Number(h) % 12;
  const minutes = Number(m);
  return { hour: hours * 30 + minutes * 0.5, minute: minutes * 6 };
}

/** "utc+5:45", "utc-8", "utc". Follows DST because it is read for the given instant. */
export function utcOffsetLabel(date: Date, timeZone: string): string {
  const name =
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name);
  if (!m || m[1] === undefined || (m[2] === '00' && m[3] === '00'))
    return 'utc';
  const hours = String(Number(m[2]));
  const minutes = m[3] === '00' ? '' : `:${m[3]}`;
  return `utc${m[1]}${hours}${minutes}`;
}
