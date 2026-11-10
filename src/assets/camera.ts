/**
 * The fixed hero camera, shared by the SVG poster (`scripts/models/poster.ts`) and the R3F scene
 * so the 2D drawing and the 3D canvas frame the desk identically. Plain numbers only: no three.js
 * import, safe in the client shell and in Node scripts. World units are metres, +y up, the sheet
 * lies in the y = 0 plane and its centre is the world origin.
 *
 * A three-quarter view from the front right and above, framed on the whole workstation: the desk
 * with the monitor at its back, the chair pulled up to the front edge with the developer in it, and
 * the five-star base on the floor. The frame is 1200 x 840 (10:7): the workstation sits in the lower
 * 60% and a little right of centre, and the top 40% is left calm for the title text laid over it.
 * It still has room for the desk at standing height (everything on it 0.24 m higher, the sitter on
 * their feet, arms up in a stretch) and for a walk past the right end of the desk, and both sides
 * are free for an object that falls off before the fall layer takes it. The sitter faces the monitor, so the camera sees the screen over their shoulder.
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
  far: 10,
  position: [1.744, 3.084, 3.877],
  lookAt: [0, 0.4, 0.3],
};

/** Poster viewBox. Its aspect is the aspect the camera is projected with. */
export const posterViewBox = { width: 1200, height: 840 } as const;

export const posterAspect = posterViewBox.width / posterViewBox.height;

/**
 * The portrait view for phones (under 768 px): steeper and nearer the front than the wide view, so
 * the desk, the chair and the developer fill the sheet (about 85 % of its width) instead of a wide
 * drawing being scaled down or pushed past the edge. Same lens, so every consumer of the field
 * of view stays the same.
 */
export const phoneCamera: CameraDef = {
  fov: heroCamera.fov,
  near: heroCamera.near,
  far: heroCamera.far,
  position: [0.553, 2.47, 2.903],
  lookAt: [0, -0.1, 0.3],
};

export const phoneViewBox = { width: 1000, height: 880 } as const;

export const phoneAspect = phoneViewBox.width / phoneViewBox.height;
