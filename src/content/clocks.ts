import type { ClockDef } from './schema';

/**
 * The contact clocks (B-06a), in page order. Kathmandu is the only confirmed city; cities 2
 * and 3 are [ASK] in docs/specs/02-copy.md, so they stay `confirmed: false` and hidden (the
 * getters filter them; `pending.ts` holds the question). Their zone is a placeholder (UTC)
 * that only an owner preview build (`PUBLIC_SHOW_UNCONFIRMED=1`) ever shows. The ids match
 * the desk clocks in `objects.ts`.
 */
export const clocks: ClockDef[] = [
  {
    id: 'clock-ktm',
    city: 'kathmandu',
    timeZone: 'Asia/Kathmandu',
    confirmed: true,
  },
  { id: 'clock-2', city: 'city two', timeZone: 'UTC', confirmed: false },
  { id: 'clock-3', city: 'city three', timeZone: 'UTC', confirmed: false },
];
