import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import {
  heroCamera,
  phoneAspect,
  phoneCamera,
  posterAspect,
} from '../../assets/camera';

/**
 * The one camera of the table canvas at each width: the wide view, or below 768 px the portrait
 * view (`assets/camera.ts`). The canvas keeps its poster's aspect, so a different width just draws
 * the same view at another size. The view is chosen when a Scene mounts (the shell remounts the
 * Scene when the page crosses 768 px). Pure maths, no DOM and no WebGL.
 */
let phone = false;
let ready = false;

/** Chooses the view for the Scene about to draw. */
export function setPhoneView(on: boolean): void {
  if (phone === on) return;
  phone = on;
  ready = false;
}

export const activeView = () => (phone ? phoneCamera : heroCamera);

export function applyHeroCamera(cam: PerspectiveCamera): void {
  const v = activeView();
  cam.fov = v.fov;
  cam.near = v.near;
  cam.far = v.far;
  cam.aspect = phone ? phoneAspect : posterAspect;
  cam.position.set(...v.position);
  cam.lookAt(...v.lookAt);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

/** Vertical focal length in pixels for a canvas `height` px tall. */
export const focalPx = (height: number, fov: number = heroCamera.fov): number =>
  height / 2 / Math.tan((fov * Math.PI) / 360);

const _cam = new PerspectiveCamera();
/** The table camera as a shared, fully updated instance (world matrices current). */
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
