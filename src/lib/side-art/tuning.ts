/**
 * One place to set how loud the section art is. The owner's brief: quiet, never competing with the
 * text. Everything below is a multiplier or a limit, so tuning is a number change here.
 */
export const TUNE = {
  /**
   * Stroke strength at rest, 0..1: every alpha the drawings use is multiplied by this, on all five
   * lamp levels. About 0.3 to 0.4 reads as a faint pencil line; the busiest art is the quietest.
   */
  strength: { kite: 0.4, bloom: 0.38, circuit: 0.3, dog: 0.3, lamp: 0.3, climb: 0.32 },
  /**
   * Time scale of each drawing's motion (1 = the prototype). Applies to every idle sway, gait,
   * drift and pulse; scroll still moves things, but through the same slower physics.
   */
  speed: { kite: 0.5, bloom: 0.5, circuit: 0.4, dog: 0.45, lamp: 0.4, climb: 0.4 },
  /** Line width: drawings ask for 1 to 3 px; it is scaled by `scale` then held between `min` and `max` (CSS px). */
  line: { scale: 0.55, min: 0.8, max: 1.5 },
  /** Hatching is fainter than the outline it fills: extra multiplier on its alpha. */
  hatch: 0.55,
  /** A press raises that one art to this strength (never full), then it eases back at `ease` per second. */
  click: { strength: 0.6, ease: 1.2 },
  /** Butterflies on the vine: their own strength (visible against the fainter vine), size multiplier of the garden's butterfly. */
  butterfly: { strength: 0.55, size: 1.15 },
  /**
   * Bloom's root sits this far down the garden canvas (0 = top, 1 = bottom): inside the grass band
   * (the garden's flowers are planted between 0.5 and 0.82 of its height).
   */
  gardenRoot: 0.66,
} as const;
