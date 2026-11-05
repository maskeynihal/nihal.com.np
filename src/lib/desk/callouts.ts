/**
 * Callout labels and leader lines (design 4.3, 4.6). Pure helpers; no three.js, no DOM.
 * Labels sit at 0.5 opacity at rest so a screenshot is legible, go to 1.0 while their object is
 * hovered or held (160 ms in), and fall back to 0.5 (240 ms out). Reduced motion: no fade.
 */
export const REST_OPACITY = 0.5;
export const ACTIVE_OPACITY = 1;
export const FADE_IN_MS = 160;
export const FADE_OUT_MS = 240;
/** Length of a leader line from its anchor to its label, metres. */
export const LEADER_LENGTH = 0.16;

export function fadeMs(toActive: boolean, motionFull: boolean): number {
  if (!motionFull) return 0;
  return toActive ? FADE_IN_MS : FADE_OUT_MS;
}

/** Opacity `elapsed` ms into a fade from `from` to `to` lasting `ms` (ease-out). */
export function fadeAt(
  from: number,
  to: number,
  elapsed: number,
  ms: number,
): number {
  if (ms <= 0 || elapsed >= ms) return to;
  const p = Math.max(0, elapsed) / ms;
  const eased = 1 - (1 - p) * (1 - p);
  return from + (to - from) * eased;
}

/**
 * The unit direction (x, z on the desk plane) a leader line leaves its anchor in: away from the
 * object's centre, so the label never sits on top of the object. Straight out along +x when the
 * anchor is at the centre.
 */
export function leaderDirection(anchor: readonly [number, number, number]): {
  x: number;
  z: number;
} {
  const len = Math.hypot(anchor[0], anchor[2]);
  if (len < 1e-6) return { x: 1, z: 0 };
  return { x: anchor[0] / len, z: anchor[2] / len };
}

/** Which side of its end point a label sits on, for the CSS transform that places it. */
export function labelPlacement(dir: { x: number; z: number }): {
  tx: '0' | '-50%' | '-100%';
  ty: '0' | '-50%' | '-100%';
} {
  const tx = dir.x > 0.35 ? '0' : dir.x < -0.35 ? '-100%' : '-50%';
  // z grows toward the viewer: a leader going away (z < 0) puts the label above its end point.
  const ty = dir.z < -0.35 ? '-100%' : dir.z > 0.35 ? '0' : '-50%';
  return { tx, ty };
}
