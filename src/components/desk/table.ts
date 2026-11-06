import type { Group, PerspectiveCamera, Scene } from 'three';
import { focalPx } from '../../lib/desk/camera';
import type { Frame } from './physics-bridge';

/**
 * The table canvas's scene, camera and canvas element, shared by the Scene (builds them), the
 * pointer code (screen to world) and the physics layer (hands bodies to the fall layer). The canvas
 * sits in the page flow, so the browser scrolls it; nothing here is updated per frame. The canvas
 * rectangle is read when a pointer event or a handoff needs it, never otherwise.
 */
export const table = {
  /** The group holding the sheet and every object that is on the table. */
  group: null as Group | null,
  scene: null as Scene | null,
  camera: null as PerspectiveCamera | null,
  canvas: null as HTMLCanvasElement | null,
  invalidate: (() => {}) as () => void,
};

/** The canvas rectangle in viewport px (read on demand). */
export function canvasRect(): DOMRect | null {
  return table.canvas?.getBoundingClientRect() ?? null;
}

/** The table canvas on screen, for the camera maths; read at a handoff, never per frame. */
export function tableFrame(): Frame | null {
  const r = canvasRect();
  if (!r || r.width === 0) return null;
  return {
    left: r.left,
    top: r.top,
    w: r.width,
    h: r.height,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    f: focalPx(r.height),
  };
}
