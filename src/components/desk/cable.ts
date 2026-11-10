import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { Vector3 } from 'three';
import type { LineArt } from './line-art';

/**
 * The cable from the laptop to the monitor. The laptop can be dragged and thrown, so the cable is
 * drawn live: a sagging curve on the desk that straightens as the laptop moves away, lifts with it,
 * and lets go (is not drawn) when the laptop is pulled too far; it is back when the laptop is.
 */
export const CABLE_SLACK = 0.62;
export const CABLE_MAX = 0.85;
const POINTS = 16;

export function buildCable(art: LineArt): LineSegments2 {
  const line = new LineSegments2(new LineSegmentsGeometry(), art.line);
  line.raycast = () => {};
  line.frustumCulled = false;
  line.visible = false;
  return line;
}

const _m = new Vector3();
const _c = new Vector3();
const _p = new Vector3();

/** The segments of the cable from `a` (the laptop's port) to `b` (the monitor's), or null when it has come out. */
export function cableSegments(a: Vector3, b: Vector3): number[] | null {
  const d = a.distanceTo(b);
  if (d > CABLE_MAX) return null;
  _m.addVectors(a, b).multiplyScalar(0.5);
  _c.copy(_m);
  if (d < CABLE_SLACK) {
    // slack: it bows sideways across the desk, towards the viewer
    const h = Math.min(0.22, Math.sqrt(CABLE_SLACK * CABLE_SLACK - d * d) / 2);
    let px = -(b.z - a.z);
    let pz = b.x - a.x;
    const l = Math.hypot(px, pz) || 1;
    px /= l;
    pz /= l;
    if (pz < 0) {
      px = -px;
      pz = -pz;
    }
    _c.x += px * h;
    _c.z += pz * h;
  }
  _c.y = Math.max(0.004, _m.y - 0.01);
  const out: number[] = [];
  let prev: Vector3 | null = null;
  for (let i = 0; i < POINTS; i++) {
    const u = i / (POINTS - 1);
    _p.set(
      (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * _c.x + u * u * b.x,
      (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * _c.y + u * u * b.y,
      (1 - u) * (1 - u) * a.z + 2 * u * (1 - u) * _c.z + u * u * b.z,
    );
    _p.y = Math.max(_p.y, 0.004);
    if (prev) out.push(prev.x, prev.y, prev.z, _p.x, _p.y, _p.z);
    prev = (prev ?? new Vector3()).copy(_p);
  }
  return out;
}
