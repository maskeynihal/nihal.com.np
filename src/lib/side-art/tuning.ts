/**
 * One place to set how loud the section art is. The owner's brief: quiet, never competing with the
 * text. Everything below is a multiplier or a limit, so tuning is a number change here.
 */
export const TUNE = {
  /**
   * Stroke strength at rest, 0..1: every alpha the drawings use is multiplied by this, on all five
   * lamp levels. About 0.3 to 0.4 reads as a faint pencil line; the busiest art is the quietest.
   */
  strength: {
    kite: 0.36,
    ivy: 0.34,
    circuit: 0.27,
    dog: 0.27,
    lamp: 0.27,
    tree: 0.29,
  },
  /**
   * Time scale of each drawing's motion (1 = the prototype). Applies to every idle sway, gait,
   * drift and pulse; scroll still moves things, but through the same slower physics.
   */
  speed: {
    kite: 0.5,
    ivy: 0.45,
    circuit: 0.4,
    dog: 0.45,
    lamp: 0.4,
    tree: 0.4,
  },
  /** Line width: drawings ask for 1 to 3 px; it is scaled by `scale` then held between `min` and `max` (CSS px). */
  line: { scale: 0.55, min: 0.8, max: 1.5 },
  /** Hatching is fainter than the outline it fills: extra multiplier on its alpha. */
  hatch: 0.55,
  /** A press raises that one art to this strength (never full), then it eases back at `ease` per second. */
  click: { strength: 0.5, ease: 1.2 },
  /** Birds on the ivy (pigeons, sparrows, the distant flock): their own strength, a little above the vine so they read. */
  bird: { strength: 0.5 },
  /** Butterfly on the ivy: its own strength (visible against the fainter vine), size multiplier of the garden's butterfly. */
  butterfly: { strength: 0.5, size: 1.15 },
  /**
   * Ivy tip reaches this far down the garden canvas (0 = top, 1 = bottom): inside the grass band
   * (the garden's flowers are planted between 0.5 and 0.82 of its height).
   */
  gardenRoot: 0.66,
  /**
   * Calm: only the column of the section in view runs at full rate. Others ease toward a still frame over
   * `ease` seconds and then tick at `stillFps`. After `idle` seconds with no scroll or pointer input the
   * whole canvas holds one still frame until the next input.
   */
  calm: { ease: 0.8, stillFps: 2, idle: 20 },
} as const;
