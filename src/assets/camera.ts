/**
 * The fixed desk view, shared by the SVG poster (`scripts/models/poster.ts`) and the R3F scene
 * so the 2D drawing and the 3D canvas frame the table identically. Plain numbers only: no three.js
 * import, safe in the client shell and in Node scripts.
 *
 * The camera is orthographic with a fixed tilt, so a screen point maps linearly to a world point
 * on any horizontal or vertical plane. World units are metres, +y up, the table lies in the
 * y = 0 plane and its centre is the world origin. Looking down from the viewer's side (+z) at
 * `tilt` degrees above the horizon, a world point (x, y, z) lands at screen
 * `(x, y * cos(tilt) - z * sin(tilt))` metres from the table centre, +up.
 */
export const deskView = {
  /** Angle of the view direction above the horizon, degrees. */
  tilt: 42,
  /** Pixels per metre in a poster viewBox that is 1200 px wide. */
  ppm: 600,
  /** Where the table centre sits in the poster viewBox, px. */
  centre: [600, 365],
} as const;

/** Poster viewBox. The `#desk` figure has this aspect at every width. */
export const posterViewBox = { width: 1200, height: 700 } as const;

export const posterAspect = posterViewBox.width / posterViewBox.height;
