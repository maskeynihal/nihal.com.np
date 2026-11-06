import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { heroCamera, posterAspect } from '../../assets/camera';

/**
 * The one camera of the table canvas, at every width: the canvas keeps the poster's aspect, so
 * a narrower page just draws the same view smaller. Pure maths, no DOM and no WebGL.
 */
export function applyHeroCamera(cam: PerspectiveCamera): void {
  cam.fov = heroCamera.fov;
  cam.near = heroCamera.near;
  cam.far = heroCamera.far;
  cam.aspect = posterAspect;
  cam.position.set(...heroCamera.position);
  cam.lookAt(...heroCamera.lookAt);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

/** Vertical focal length in pixels for a canvas `height` px tall. */
export const focalPx = (height: number, fov: number = heroCamera.fov): number =>
  height / 2 / Math.tan((fov * Math.PI) / 360);

const _cam = new PerspectiveCamera();
let ready = false;
/** The hero camera as a shared, fully updated instance (world matrices current). */
export function heroPose(): PerspectiveCamera {
  if (!ready) {
    applyHeroCamera(_cam);
    ready = true;
  }
  return _cam;
}

export interface Pose {
  p: Vector3;
  q: Quaternion;
}

/** World pose to the camera frame (x right, y up, camera looks down -z). */
export function worldToCamera(
  cam: PerspectiveCamera,
  p: Vector3,
  q: Quaternion,
): Pose {
  const inv = new Matrix4().copy(cam.matrixWorld).invert();
  const camQ = cam.getWorldQuaternion(new Quaternion());
  return {
    p: p.clone().applyMatrix4(inv),
    q: camQ.invert().multiply(q),
  };
}

/** Inverse of `worldToCamera`. */
export function cameraToWorld(
  cam: PerspectiveCamera,
  p: Vector3,
  q: Quaternion,
): Pose {
  const camQ = cam.getWorldQuaternion(new Quaternion());
  return {
    p: p.clone().applyMatrix4(cam.matrixWorld),
    q: camQ.multiply(q),
  };
}

/** Rotates a free vector (velocity, angular velocity) between world and camera frames. */
export function vecToCamera(cam: PerspectiveCamera, v: Vector3): Vector3 {
  return v
    .clone()
    .applyQuaternion(cam.getWorldQuaternion(new Quaternion()).invert());
}
export function vecToWorld(cam: PerspectiveCamera, v: Vector3): Vector3 {
  return v.clone().applyQuaternion(cam.getWorldQuaternion(new Quaternion()));
}
