import { KATHMANDU, formatClock } from '../time';

export interface HandAngles {
  /** Clockwise from 12, radians. */
  hour: number;
  minute: number;
}

const TAU = Math.PI * 2;

/**
 * Hand angles for a clock in `timeZone`, from the same `formatClock` the title block prints, so
 * the drawn hands and the "14:32" can never disagree. The hands step once a minute (a hand
 * between two minutes would not match the digits). Pure.
 */
export function handAngles(
  date: Date,
  timeZone: string = KATHMANDU,
): HandAngles {
  const [h = 0, m = 0] = formatClock(date, timeZone).split(':').map(Number);
  return {
    minute: (m / 60) * TAU,
    hour: (((h % 12) + m / 60) / 12) * TAU,
  };
}

/**
 * Pivot rotation for an angle clockwise from above: the GLB rest pose points at 12 (-Z), so
 * `rotation.y = -angle` (docs/process/assets.md).
 */
export const pivotY = (angle: number): number => -angle;

/** IANA zone per clock object. Cities 2 and 3 come from the owner (unconfirmed, hidden). */
export function clockZone(id: string): string {
  return id === 'clock-ktm' ? KATHMANDU : KATHMANDU; // replaced when the owner names cities 2 and 3
}
