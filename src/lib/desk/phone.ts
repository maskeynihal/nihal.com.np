/**
 * The phone desk (under 768 px): fewer objects, so the table is not cluttered and each one is big
 * enough to read. Plain data with no imports, shared by the build-time poster, the object list and
 * the Scene, so the poster, the live table, the physics world and the object list always agree.
 *
 * Kept (8): the board, the laptop, the clock, the calendar, the ghost, one pac-man, the medium and
 * the large ball. Dropped: the small ball, the second pac-man and the letters N I H A L. A dropped
 * object is neither drawn nor given a body at that width.
 */
export const PHONE_QUERY = '(max-width: 767px)';

export const phoneObjectIds: ReadonlySet<string> = new Set([
  'arduino',
  'laptop',
  'clock-ktm',
  'calendar',
  'ghost',
  'pacman-1',
  'ball-m',
  'ball-l',
]);

/** True when the page is at phone width right now (false without a DOM). */
export function isPhoneWidth(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(PHONE_QUERY).matches
  );
}
