/**
 * Pure maths for grabbing and throwing (design 4.5, 4.6). Desk-plane coordinates are metres
 * (x right, z toward the viewer); time is milliseconds. No three.js, no DOM.
 */

/** Throw speed cap, m/s. */
export const MAX_THROW = 4;
/** A press that moves less than this (px) and ends within TAP_MS is a tap. */
export const TAP_SLOP_PX = 6;
export const TAP_MS = 250;
/** Touch: a press must hold this long, without moving more than HOLD_SLOP_PX, to grab. */
export const HOLD_MS = 180;
export const HOLD_SLOP_PX = 8;
/** Two touch taps on empty desk within this window reset the desk. */
export const DOUBLE_TAP_MS = 320;
/** Kinematic follow: fraction of the remaining distance covered per physics step. */
export const FOLLOW = 0.08;
/** Height the held object floats at, metres. */
export const LIFT = 0.06;
/** Tilt limit while dragging, 25 degrees in radians. */
export const MAX_TILT = (25 * Math.PI) / 180;
/** Half the usable desk, metres (inside the walls; see physics-world). */
export const DESK_HALF = { x: 0.76, z: 0.56 } as const;
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

/** Keeps a drag target inside the walls (a kinematic body ignores them). */
export function clampToDesk(
  x: number,
  z: number,
  margin = 0.12,
): { x: number; z: number } {
  return {
    x: clamp(x, -(DESK_HALF.x - margin), DESK_HALF.x - margin),
    z: clamp(z, -(DESK_HALF.z - margin), DESK_HALF.z - margin),
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

/** True when the object is outside the desk volume (design 4.5 watchdog) or not finite. */
export function outOfBounds(p: { x: number; y: number; z: number }): boolean {
  return (
    !Number.isFinite(p.x + p.y + p.z) ||
    Math.abs(p.x) > 1.2 ||
    Math.abs(p.z) > 0.8 ||
    p.y > 1 ||
    p.y < -0.2
  );
}
