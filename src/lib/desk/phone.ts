/**
 * The phone desk (under 768 px): fewer objects, so the table is not cluttered and each one is big
 * enough to read. Plain data with no imports, shared by the build-time poster, the object list and
 * the Scene, so the poster, the live table, the physics world and the object list always agree.
 *
 * Kept (13): the workstation (chair, developer, monitor, keyboard, mouse, lamp), the mug, the
 * plant, the laptop, the board, the clock, the ghost and the large ball. Dropped: the headphones,
 * the phone, the calendar, the other balls, the pac-men and the letters N I H A L. A dropped
 * object is neither drawn nor given a body at that width.
 */
export const PHONE_QUERY = '(max-width: 767px)';

export const phoneObjectIds: ReadonlySet<string> = new Set([
  'chair',
  'dev',
  'monitor',
  'keyboard',
  'mouse',
  'lamp',
  'drawer',
  // the handset is part of the drawer's model: its button in the object list follows it
  'handset',
  'mug',
  'plant',
  'laptop',
  'arduino',
  'clock-ktm',
  'ghost',
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
