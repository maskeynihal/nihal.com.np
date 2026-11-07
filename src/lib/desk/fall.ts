import { Vector3 } from 'three';
import type { Frame } from '../../components/desk/physics-bridge';
import { GRAVITY, HANDOFF_MIN_GRAVITY } from './materials';

/**
 * Maths for the fall layer (vectors only: no DOM and no WebGL).
 *
 * The fall world IS the table camera's frame: the camera sits at the origin looking down -z,
 * x is right, y is up. A body is handed over by expressing its world pose in that frame, which
 * leaves the picture unchanged by construction (same camera, same focal length in pixels), and
 * gravity points along -y, i.e. straight down the screen. The table camera looks about 55 degrees
 * down at the table, so in the table world a drop is mostly a move away from the viewer (shrinking
 * toward the vanishing point); in this frame it is a drop down the screen at constant size, which
 * is what falling to the bottom of the page should look like.
 *
 * A frame's principal point (where the optical axis meets the screen) is the table canvas centre
 * in viewport px. The fall camera is anchored to the principal point the canvas had when it was
 * mounted. A later handoff from a canvas that has scrolled since has a different principal point;
 * `reanchor` moves the body sideways at constant depth so its screen position and size are kept
 * (its apparent view angle changes a little, which `errPx` in the handoff log reports).
 */

/** Screen position (viewport px) and depth (m, positive) of a camera-frame point. */
export function project(
  p: Vector3,
  frame: Frame,
): { x: number; y: number; z: number } {
  const z = -p.z;
  return {
    x: frame.cx + (frame.f * p.x) / z,
    y: frame.cy - (frame.f * p.y) / z,
    z,
  };
}

/** The camera-frame point at screen (sx, sy) and depth `z`. */
export function unproject(
  sx: number,
  sy: number,
  z: number,
  frame: Frame,
  out = new Vector3(),
): Vector3 {
  return out.set(
    ((sx - frame.cx) * z) / frame.f,
    (-(sy - frame.cy) * z) / frame.f,
    -z,
  );
}

/** Screen velocity (px/s, y down) of a camera-frame point `p` moving at `v`. */
export function screenVelocity(
  p: Vector3,
  v: Vector3,
  f: number,
): [number, number] {
  const z = -p.z;
  const zd = -v.z;
  return [
    (f * (v.x * z - p.x * zd)) / (z * z),
    (-f * (v.y * z - p.y * zd)) / (z * z),
  ];
}

/**
 * Apparent downward screen acceleration (px/s^2) of a camera-frame point with velocity `v` under
 * acceleration `a` (frame axes): the second derivative of f * y / z, negated.
 */
export function screenAccelDown(
  p: Vector3,
  v: Vector3,
  a: Vector3,
  f: number,
): number {
  const z = -p.z;
  const zd = -v.z;
  const zdd = -a.z;
  const ud = (v.y * z - p.y * zd) / (z * z);
  const udd = (a.y * z - p.y * zdd) / (z * z) - (2 * zd * ud) / z;
  return -f * udd;
}

/** Gravity (m/s^2) in the camera frame: the world's down, given the world's up in that frame. */
export function gravityInCamera(worldUpInCamera: Vector3): Vector3 {
  return worldUpInCamera.clone().multiplyScalar(-GRAVITY);
}

/**
 * The fraction of real gravity the fall world should start a body with so that the apparent
 * downward acceleration at the handoff equals what the table view showed (clamped to [lo, 1]).
 * The fall world then ramps it up to 1, so the rest of the drop has real-scale gravity for the
 * object's apparent size. `aBefore` is the table view's acceleration, px/s^2.
 */
export function startGravityScale(
  p: Vector3,
  v: Vector3,
  aTable: Vector3,
  f: number,
  lo = HANDOFF_MIN_GRAVITY,
): { scale: number; aBefore: number } {
  const aBefore = screenAccelDown(p, v, aTable, f);
  const z = -p.z;
  const zd = -v.z;
  const ud = (v.y * z - p.y * zd) / (z * z);
  // In the fall world a = (0, -scale * g, 0): aBefore = -f * (-scale * g / z - 2 * zd * ud / z).
  const raw = ((aBefore / f) * z - 2 * zd * ud) / GRAVITY;
  const scale = Math.min(1, Math.max(lo, Number.isFinite(raw) ? raw : 1));
  return { scale, aBefore };
}

/**
 * Moves a camera-frame state from one principal point to another at constant depth, keeping the
 * screen position, screen velocity and apparent size. Mutates `p` and `v`.
 */
export function reanchor(p: Vector3, v: Vector3, from: Frame, to: Frame): void {
  const z = -p.z;
  const dx = ((from.cx - to.cx) * z) / from.f;
  const dy = (-(from.cy - to.cy) * z) / from.f;
  const zd = -v.z;
  v.x += (dx * zd) / z;
  v.y += (dy * zd) / z;
  p.x += dx;
  p.y += dy;
}

/** The fall world's boundaries, in the camera frame. */
export interface Bounds {
  /** y of the floor plane at the nearest depth. */
  floorY: number;
  /** dy per metre of depth: the floor plane is y = floorSlope * depth, so at every depth it meets the viewport's bottom edge. */
  floorSlope: number;
  /** Nearest and farthest depth (m, positive) a free body may have. */
  zNear: number;
  zFar: number;
  /** Slopes dx/dz of the viewport's left and right edges (x = slope * depth). */
  left: number;
  right: number;
}

/**
 * The floor is the plane through the camera that meets the viewport's bottom edge (`padBottom` px above it): at any
 * depth it projects to the same screen line, so whatever lands rests on the bottom of the screen. It slopes away from
 * the camera; bodies keep a fixed depth so the slope never moves them.
 */
export function boundsFor(
  frame: Frame,
  vw: number,
  vh: number,
  zNear: number,
  zFar: number,
  padBottom: number,
): Bounds {
  return {
    floorY: (-(vh - padBottom - frame.cy) * zNear) / frame.f,
    floorSlope: -(vh - padBottom - frame.cy) / frame.f,
    zNear,
    zFar,
    left: (0 - frame.cx) / frame.f,
    right: (vw - frame.cx) / frame.f,
  };
}

/** Moves a camera-frame body's depth velocity into x and y so its screen velocity is unchanged, then zeroes it. */
export function foldDepthVelocity(p: Vector3, v: Vector3): void {
  const d = Math.max(-p.z, 0.1);
  v.x += (p.x * v.z) / d;
  v.y += (p.y * v.z) / d;
  v.z = 0;
}

/**
 * Distance (px) from the viewport's bottom edge to the floor: the sheet border's inner edge, plus the
 * index strip below 1024 px (it is the sheet's bottom edge there). Read from the page's own tokens
 * (`--inset`, `--strip-h`) so the floor follows the CSS, not a copy of it.
 */
export function floorPad(
  vw: number,
  inset: number,
  strip: number,
  stripFrom = 1024,
): number {
  return inset + (vw < stripFrom ? strip : 0);
}

/**
 * How far (m, up) to lift a body when the room is rebuilt for a new viewport height, so a body that
 * was resting on the old floor still rests on the new one (a phone's URL bar showing again raises the
 * floor; without this a resting body would sit inside it). Bodies more than `reach` above the old
 * floor are in the air and are left alone. Zero when the floor went down: they simply fall.
 */
export function liftForFloor(
  prev: Pick<Bounds, 'floorSlope'>,
  next: Pick<Bounds, 'floorSlope'>,
  y: number,
  depth: number,
  reach = 0.6,
): number {
  if (y - prev.floorSlope * depth > reach) return 0;
  return Math.max(0, (next.floorSlope - prev.floorSlope) * depth);
}

/** How far inside the viewport's side edges (m, at the body's depth) a handed-over body is kept. */
export const WALL_MARGIN = 0.1;

/**
 * True when a body flying beyond the table's rim is about to leave the part of the screen the table
 * canvas shows (or the viewport), so it must be handed to the fall layer now, while its picture is
 * still inside it: the fall world keeps bodies inside the viewport's edges, and a body handed over
 * outside them is moved back in, which is a visible jump. `sx` and `svx` are the centre's screen x
 * (px) and screen speed (px/s), `depth` its distance from the camera (m), `lead` how far ahead to
 * look (s). The margin is the fall world's own wall margin in px at that depth, plus the lead.
 */
export function leavingView(
  sx: number,
  svx: number,
  depth: number,
  f: number,
  box: { left: number; right: number },
  lead: number,
): boolean {
  const margin = (WALL_MARGIN * f) / depth + 6;
  const ahead = sx + svx * lead;
  return ahead < box.left + margin || ahead > box.right - margin;
}
