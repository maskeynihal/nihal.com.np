/**
 * Pure maths for grabbing and throwing (design 4.5, 4.6). Desk-plane coordinates are metres
 * (x right, z toward the viewer); time is milliseconds. No three.js, no DOM.
 */

/** Throw speed cap, m/s. */
export const MAX_THROW = 5;
/** A press that moves less than this (px) and ends within TAP_MS is a tap. */
export const TAP_SLOP_PX = 6;
export const TAP_MS = 250;
/** Touch: a press must hold this long, without moving more than HOLD_SLOP_PX, to grab. */
export const HOLD_MS = 180;
export const HOLD_SLOP_PX = 8;
/** Two touch taps on empty desk within this window reset the desk. */
export const DOUBLE_TAP_MS = 320;
/**
 * Kinematic follow: fraction of the remaining distance covered per physics step. The held object
 * trails the pointer by about 1 / FOLLOW steps (0.08 was the E-05 value: 12 steps, 0.2 s, which
 * lags a fast drag by 20 cm); 0.14 keeps its soft, unjittery follow with about 7 steps of lag.
 */
export const FOLLOW = 0.14;
/** Height the held object floats at, metres. */
export const LIFT = 0.06;
/** Tilt limit while dragging, 25 degrees in radians. */
export const MAX_TILT = (25 * Math.PI) / 180;
/** The table (sheet) is 1.6 x 1.2 m and has no walls: past this rim an object falls. */
export const TABLE_HALF = { x: 0.8, z: 0.6 } as const;
/** How far a dragged object may be carried: the area the canvas shows around the table. */
export const DRAG_HALF = { x: 1.1, zMin: -0.8, zMax: 0.95 } as const;
/** Only the last RING samples within RING_WINDOW_MS count towards a throw. */
const RING = 5;
const RING_WINDOW_MS = 100;
/** A pointer that stopped this long ago throws nothing. */
const STALE_MS = 80;

export interface Sample {
  x: number;
  z: number;
  t: number;
}

export class RingBuffer {
  private readonly samples: Sample[] = [];

  push(x: number, z: number, t: number): void {
    this.samples.push({ x, z, t });
    if (this.samples.length > RING) this.samples.shift();
  }

  clear(): void {
    this.samples.length = 0;
  }

  /** Mean velocity over the retained window, m/s, clamped to `max`. */
  velocity(now: number, max = MAX_THROW): { x: number; z: number } {
    const last = this.samples[this.samples.length - 1];
    if (!last || now - last.t > STALE_MS) return { x: 0, z: 0 };
    const recent = this.samples.filter((s) => last.t - s.t <= RING_WINDOW_MS);
    const first = recent[0];
    if (!first || first === last || last.t === first.t) return { x: 0, z: 0 };
    const dt = (last.t - first.t) / 1000;
    return clampSpeed((last.x - first.x) / dt, (last.z - first.z) / dt, max);
  }
}

export function clampSpeed(
  vx: number,
  vz: number,
  max = MAX_THROW,
): { x: number; z: number } {
  const s = Math.hypot(vx, vz);
  if (!Number.isFinite(s)) return { x: 0, z: 0 };
  if (s <= max) return { x: vx, z: vz };
  const k = max / s;
  return { x: vx * k, z: vz * k };
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/** Keeps a drag target inside the area the canvas shows (the table has no walls). */
export function clampToDesk(x: number, z: number): { x: number; z: number } {
  return {
    x: clamp(x, -DRAG_HALF.x, DRAG_HALF.x),
    z: clamp(z, DRAG_HALF.zMin, DRAG_HALF.zMax),
  };
}

/**
 * How far a dragged object leans: against the direction of travel, 0.12 rad per m/s,
 * never past 25 degrees. `roll` turns about z (travel along x), `pitch` about x (along z).
 */
export function tiltFor(
  vx: number,
  vz: number,
): { roll: number; pitch: number } {
  const k = 0.12;
  return {
    roll: clamp(vx * k, -MAX_TILT, MAX_TILT),
    pitch: clamp(-vz * k, -MAX_TILT, MAX_TILT),
  };
}

/** Where the ray `origin + t * dir` meets the horizontal plane at `y`, or null. */
export function planePoint(
  origin: readonly [number, number, number],
  dir: readonly [number, number, number],
  y: number,
): { x: number; z: number } | null {
  if (Math.abs(dir[1]) < 1e-9) return null;
  const t = (y - origin[1]) / dir[1];
  if (t < 0) return null;
  return { x: origin[0] + dir[0] * t, z: origin[2] + dir[2] * t };
}

export function isTap(distPx: number, ms: number): boolean {
  return distPx < TAP_SLOP_PX && ms < TAP_MS;
}

/**
 * True when a body in the table world is somewhere nothing should be (not finite, far off, or
 * deep below the table): the watchdog puts it back. A body that fell off the rim is handed to the
 * fall layer long before this; this only catches the ones no layer picked up.
 */
export function outOfBounds(p: { x: number; y: number; z: number }): boolean {
  return (
    !Number.isFinite(p.x + p.y + p.z) ||
    Math.abs(p.x) > 3 ||
    Math.abs(p.z) > 3 ||
    p.y > 3 ||
    p.y < -2.5
  );
}
