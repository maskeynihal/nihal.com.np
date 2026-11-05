import { deskView, posterViewBox } from '../../assets/camera';

/**
 * Screen and world maths for the fixed, tilted, orthographic desk view (pure: no three.js, no DOM).
 * World: metres, +y up, the table centre is the origin of the table, bodies live on the z = 0
 * plane. The camera is centred on the middle of the viewport and sees that plane, so a screen
 * point maps linearly to a world point: `x = (px - w/2) / ppm`, `y = -(py - h/2) / (ppm * cos)`.
 * `ppm` is pixels per metre; it follows the width of the poster frame so the table always fills it
 * the same way (`deskView.ppm` is for a poster 1200 px wide).
 */
export const TILT = (deskView.tilt * Math.PI) / 180;
export const SIN = Math.sin(TILT);
export const COS = Math.cos(TILT);
export const TAN = Math.tan(TILT);

/** Below this viewport width the objects are drawn smaller. */
export const PHONE_MAX = 767;
export const PHONE_SCALE = 0.8;

export interface Viewport {
  width: number;
  height: number;
}

export interface Layout {
  /** Pixels per metre. */
  ppm: number;
  /** Where the table centre is on screen, px from the viewport's top left. */
  ox: number;
  oy: number;
}

/** The layout for a poster frame at `rect` (viewport px). */
export function layoutFor(rect: {
  left: number;
  top: number;
  width: number;
}): Layout {
  const k = rect.width / posterViewBox.width;
  return {
    ppm: deskView.ppm * k,
    ox: rect.left + deskView.centre[0] * k,
    oy: rect.top + deskView.centre[1] * k,
  };
}

/** The world point on the z = 0 plane that appears at screen (px, py). */
export function pxToWorld(
  px: number,
  py: number,
  vp: Viewport,
  ppm: number,
): { x: number; y: number } {
  return {
    x: (px - vp.width / 2) / ppm,
    y: -(py - vp.height / 2) / (ppm * COS),
  };
}

/** Where a world point (x, y, z) appears on screen, px. */
export function worldToPx(
  x: number,
  y: number,
  z: number,
  vp: Viewport,
  ppm: number,
): { x: number; y: number } {
  return {
    x: vp.width / 2 + x * ppm,
    y: vp.height / 2 - (y * COS - z * SIN) * ppm,
  };
}

/** The z = 0 point that appears at the same screen position as (x, y, z). */
export function atDepthZero(
  x: number,
  y: number,
  z: number,
): { x: number; y: number } {
  return { x, y: y - z * TAN };
}

export const objectScale = (viewportWidth: number): number =>
  viewportWidth <= PHONE_MAX ? PHONE_SCALE : 1;

/** The visible world rectangle on the z = 0 plane. */
export function worldBounds(
  vp: Viewport,
  ppm: number,
): { halfW: number; halfH: number } {
  return { halfW: vp.width / 2 / ppm, halfH: vp.height / 2 / (ppm * COS) };
}
