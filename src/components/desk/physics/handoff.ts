import {
  PerspectiveCamera,
  Quaternion,
  Vector3,
  type Mesh,
  type Object3D,
} from 'three';
import { screenVelocity } from '../../../lib/desk/fall';
import { GRAVITY } from '../../../lib/desk/materials';
import { vecToCamera } from '../../../lib/desk/camera';
import type {
  FallApi,
  Frame,
  HandoffLog,
  HandoffState,
  Rect,
} from '../physics-bridge';
import type { RegistryEntry } from '../registry';

const _c = new Vector3();

/**
 * The screen rectangle (viewport px) of an object, through `project`: every vertex of every mesh
 * is projected, so the answer does not depend on the frame the object is axis-aligned in (a
 * bounding box would differ between the table's world frame and the fall layer's camera frame).
 */
export function screenRect(
  obj: Object3D,
  project: (p: Vector3) => { x: number; y: number },
): Rect {
  obj.updateWorldMatrix(true, true);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  obj.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || node.name.endsWith('-hull')) return;
    // Line-art strokes are instanced quads: their `position` is a unit template, the real ends
    // are `instanceStart` and `instanceEnd`.
    const g = mesh.geometry;
    const starts = g.getAttribute('instanceStart');
    const ends = g.getAttribute('instanceEnd');
    const attrs =
      starts && ends ? [starts, ends] : [g.getAttribute('position')];
    for (const pos of attrs)
      for (let i = 0; i < pos.count; i++) {
        _c.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        const s = project(_c);
        x0 = Math.min(x0, s.x);
        y0 = Math.min(y0, s.y);
        x1 = Math.max(x1, s.x);
        y1 = Math.max(y1, s.y);
      }
  });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The largest difference between two rects' corners, px. */
export function rectError(a: Rect, b: Rect): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.x + a.w - (b.x + b.w)),
    Math.abs(a.y + a.h - (b.y + b.h)),
  );
}

/** Table-canvas projection of a world point to viewport px. */
export function tableProjector(
  cam: PerspectiveCamera,
  frame: Frame,
): (p: Vector3) => { x: number; y: number } {
  const v = new Vector3();
  return (p) => {
    v.copy(p).project(cam);
    return {
      x: frame.left + ((v.x + 1) / 2) * frame.w,
      y: frame.top + ((1 - v.y) / 2) * frame.h,
    };
  };
}

/**
 * Hands one body from the table world to the fall layer in a single synchronous call: the fall
 * layer takes the object out of the table scene and puts it in its own, and both canvases are
 * asked to draw in the same task, so the next animation frame shows the swap with no gap and no
 * overlap. Returns the log entry, or null if the fall layer could not take it.
 */
export function handToFall(
  entry: RegistryEntry,
  state: HandoffState,
  frame: Frame,
  cam: PerspectiveCamera,
  api: FallApi,
): HandoffLog | null {
  const project = tableProjector(cam, frame);
  // What the last drawn frame showed: the displayed pose, not the body's (one step ahead) pose.
  entry.obj.updateWorldMatrix(true, false);
  const shownP = new Vector3();
  const shownQ = new Quaternion();
  entry.obj.getWorldPosition(shownP);
  entry.obj.getWorldQuaternion(shownQ);
  const before = screenRect(entry.obj, project);

  const pc = new Vector3(...state.p).applyMatrix4(cam.matrixWorldInverse);
  const vc = vecToCamera(cam, new Vector3(...state.v));
  const gCam = vecToCamera(cam, new Vector3(0, -GRAVITY, 0));
  const vBefore = screenVelocity(pc, vc, frame.f);

  const res = api.accept(
    {
      ...state,
      shown: {
        p: [shownP.x, shownP.y, shownP.z],
        q: [shownQ.x, shownQ.y, shownQ.z, shownQ.w],
      },
      gCam: [gCam.x, gCam.y, gCam.z],
    },
    frame,
  );
  if (!res) return null;
  return {
    at: performance.now(),
    id: entry.id,
    dir: 'down',
    before,
    after: res.after,
    vBefore,
    vAfter: res.vAfter,
    aBefore: res.aBefore,
    aAfter: res.aAfter,
    gravityScale: res.gravityScale,
    errPx: rectError(before, res.after),
  };
}
