/**
 * The fixed hero camera, shared by the SVG poster (D-01, `scripts/models/poster.ts`) and the
 * R3F scene (E-02) so the 2D drawing and the 3D canvas frame the desk identically.
 * Plain numbers only: no three.js import, safe in the client shell and in Node scripts.
 * Values come from the grey-box prototype (docs/prototype/blueprint-sneak-peek.html) and
 * docs/specs/01-design-spec.md section 4.2 (35 degrees, near 0.5, far 8). World units are metres,
 * +y up, the sheet lies in the y = 0 plane.
 */
export const heroCamera = {
  /** Vertical field of view, degrees. */
  fov: 35,
  near: 0.5,
  far: 8,
  position: [0, 2.05, 1.55],
  lookAt: [0, 0, -0.05],
} as const;

/** Poster viewBox. Its aspect is the aspect the camera is projected with. */
export const posterViewBox = { width: 1200, height: 800 } as const;

export const posterAspect = posterViewBox.width / posterViewBox.height;
