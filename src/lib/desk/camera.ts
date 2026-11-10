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
/**
 * How far the camera sits below its drawn height (m). Raising the desk for standing work is drawn
 * by dropping the floor, the chair and the legs by the rise and moving the camera down with them,
 * so the floor stays put on screen and the desk top (where every loose object lives) rises with
 * its things. The poster is the camera at 0.
 */
let drop = 0;

export function setCameraDrop(d: number): void {
  if (d === drop) return;
  drop = d;
  ready = false;
}

/** Chooses the view for the Scene about to draw. */
export function setPhoneView(on: boolean): void {
  if (phone === on) return;
  phone = on;
  ready = false;
}

export const activeView = () => (phone ? phoneCamera : heroCamera);

/** The vertical field of view in use (it follows the canvas shape, see `applyHeroCamera`). */
let currentFov: number = heroCamera.fov;

/**
 * The view's camera at the canvas's real shape. The framing is made for the poster's aspect and
 * fits the whole workstation (lamp to chair casters, with the standing-desk and walk extents) in
 * that box. A canvas as wide as the poster or wider (a short screen caps the stage's height, see
 * desk.css) keeps the *vertical* field of view, so the workstation keeps its full height and is
 * centred with more room at the sides, the way the poster's SVG letterboxes; a narrower one keeps
 * the horizontal field of view and shows more floor. Either way nothing is cropped.
 */
export function applyHeroCamera(cam: PerspectiveCamera, aspect?: number): void {
  const v = activeView();
  const nominal = phone ? phoneAspect : posterAspect;
  const a =
    aspect && Number.isFinite(aspect) && aspect > 0.3 ? aspect : nominal;
  const fov =
    a >= nominal
      ? v.fov
      : (2 *
          Math.atan((Math.tan((v.fov * Math.PI) / 360) * nominal) / a) *
          180) /
        Math.PI;
  // only the live canvas sets the lens the maths below use; the shared `heroPose` stays nominal
  if (aspect !== undefined) currentFov = fov;
  cam.fov = fov;
  cam.near = v.near;
  cam.far = v.far;
  cam.aspect = a;
  cam.position.set(v.position[0], v.position[1] - drop, v.position[2]);
  cam.lookAt(v.lookAt[0], v.lookAt[1] - drop, v.lookAt[2]);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
}

/** Vertical focal length in pixels for a canvas `height` px tall. */
export const focalPx = (height: number, fov: number = currentFov): number =>
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
