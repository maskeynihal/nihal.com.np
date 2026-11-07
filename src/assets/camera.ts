/**
 * The fixed hero camera, shared by the SVG poster (`scripts/models/poster.ts`) and the R3F scene
 * so the 2D drawing and the 3D canvas frame the desk identically. Plain numbers only: no three.js
 * import, safe in the client shell and in Node scripts. World units are metres, +y up, the sheet
 * lies in the y = 0 plane and its centre is the world origin.
 *
 * It is the E-01..E-07 camera (perspective, looking down at the table from the viewer's side) with
 * the frame cropped to 1200 x 700: the table fills about 80% of the width at its front edge and
 * leaves room below and to the sides for an object that falls off before the fall layer takes it.
 */
export interface CameraDef {
  fov: number;
  near: number;
  far: number;
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

export const heroCamera: CameraDef = {
  /** Vertical field of view, degrees. */
  fov: 31,
  near: 0.5,
  far: 8,
  position: [0, 1.95, 1.5],
  lookAt: [0, 0, 0.12],
};

/** Poster viewBox. Its aspect is the aspect the camera is projected with. */
export const posterViewBox = { width: 1200, height: 700 } as const;

export const posterAspect = posterViewBox.width / posterViewBox.height;

/**
 * The portrait view for phones (under 768 px): steeper and closer than the wide view, so the whole
 * table fills the width of the sheet (about 92 %) instead of a wide drawing being scaled down or
 * pushed past the edge. Same lens, so every consumer of the field of view stays the same.
 */
export const phoneCamera: CameraDef = {
  fov: heroCamera.fov,
  near: heroCamera.near,
  far: heroCamera.far,
  position: [0, 2.77, 1.05],
  lookAt: [0, 0, 0.04],
};

export const phoneViewBox = { width: 1000, height: 880 } as const;

export const phoneAspect = phoneViewBox.width / phoneViewBox.height;
