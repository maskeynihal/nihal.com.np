/**
 * The furniture the loose objects must not pass through, as boxes (half sizes) in each model's own
 * frame. Pure data: the physics layer turns them into fixed colliders at the model's pose. The
 * desk top is where every loose object lives and it stays at y = 0 (a raised desk is drawn by
 * dropping the floor and the camera), so what stands on it never moves. The chair is the one thing
 * on the floor that matters: it rolls aside when the sitter stands, so its seat is a kinematic box
 * that follows it, and so is the open drawer's tray.
 */
export type V3 = [number, number, number];

export interface Box {
  /** Centre, in the model's frame. */
  c: V3;
  /** Half sizes. */
  h: V3;
}

/** Fixed boxes by model, for what stands on the desk. */
export const STANDING_BOXES: Record<string, Box[]> = {
  // the stand's foot and neck, and the panel
  monitor: [
    { c: [0, 0.006, 0], h: [0.12, 0.006, 0.08] },
    { c: [0, 0.075, -0.03], h: [0.0225, 0.0625, 0.013] },
    { c: [0, 0.31, 0], h: [0.32, 0.185, 0.014] },
  ],
  lamp: [{ c: [0, 0.008, 0], h: [0.06, 0.008, 0.06] }],
  keyboard: [{ c: [0, 0.012, 0], h: [0.21, 0.012, 0.07] }],
};

/** The seat of the chair, relative to the chair's axis (the desk-top plane is y = 0). */
export const CHAIR_SEAT: Box = { c: [0, -0.215, 0.02], h: [0.18, 0.03, 0.17] };

/** The open drawer's tray (a floor and low walls, as one box), relative to the desk centre. */
export const TRAY_BOX: Box = {
  c: [-0.5, -0.14, 0.375],
  h: [0.21, 0.004, 0.225],
};
/** The tray slides out this far when open, and counts as there once it is out by `TRAY_MIN`. */
export const TRAY_SLIDE = 0.3;
export const TRAY_MIN = 0.08;
