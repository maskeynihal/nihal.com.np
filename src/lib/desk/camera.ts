import { heroCamera } from '../../assets/camera';

export interface CameraPose {
  fov: number;
  near: number;
  far: number;
  position: [number, number, number];
  lookAt: [number, number, number];
}

/** Below this width the drawing is a short, near-square frame (design 8). */
export const PHONE_MAX = 767;
/** Below this width the camera backs off 15% (design 8). */
export const DESKTOP_MIN = 1280;

/** Grey-box prototype portrait framing (docs/prototype/blueprint-sneak-peek.html). */
const portrait = {
  fov: 50,
  position: [0, 1.85, 1.3],
  lookAt: [0, 0, 0.02],
} as const;

const hero: CameraPose = {
  fov: heroCamera.fov,
  near: heroCamera.near,
  far: heroCamera.far,
  position: [...heroCamera.position],
  lookAt: [...heroCamera.lookAt],
};

/** Moves the camera away from its target along the view axis by `factor` (1.15 = 15% back). */
function backOff(pose: CameraPose, factor: number): CameraPose {
  const [lx, ly, lz] = pose.lookAt;
  const [px, py, pz] = pose.position;
  return {
    ...pose,
    position: [
      lx + (px - lx) * factor,
      ly + (py - ly) * factor,
      lz + (pz - lz) * factor,
    ],
  };
}

/**
 * The fixed camera for a drawing frame. The hero camera (fov 35) is what the poster is
 * projected with, so it is used whenever the frame is the poster's 3:2. Wide frames at 768 to
 * 1279 px back off 15%. Phones (a near-square frame) use the portrait pose.
 */
export function cameraFor(viewportWidth: number): CameraPose {
  if (viewportWidth <= PHONE_MAX)
    return {
      fov: portrait.fov,
      near: heroCamera.near,
      far: heroCamera.far,
      position: [...portrait.position],
      lookAt: [...portrait.lookAt],
    };
  if (viewportWidth < DESKTOP_MIN) return backOff(hero, 1.15);
  return hero;
}
