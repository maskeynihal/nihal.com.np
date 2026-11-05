/** Largest turn of an eye away from straight ahead, radians. */
export const EYE_MAX_YAW = (35 * Math.PI) / 180;

/**
 * Yaw (about +Y) that points an eye at the ground point `(tx, tz)`, given where the eye is
 * (`ex`, `ez`, desk plane) and that the ghost faces +Z. Clamped so the pupils stay in the eyes.
 */
export function eyeYaw(ex: number, ez: number, tx: number, tz: number): number {
  const yaw = Math.atan2(tx - ex, tz - ez);
  return Math.max(-EYE_MAX_YAW, Math.min(EYE_MAX_YAW, yaw));
}
