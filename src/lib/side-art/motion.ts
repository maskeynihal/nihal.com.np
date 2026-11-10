/**
 * Motion constants shared by the drawings and the engine; they mirror the tokens in styles/tokens.css
 * (ease-out, ease-in-out, 160 / 240 / 360 ms) so the canvas moves like the rest of the page.
 */
export const EASE_OUT: readonly [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];
export const EASE_IN_OUT: readonly [number, number, number, number] = [
  0.65, 0, 0.35, 1,
];
/** Durations in seconds. */
export const DUR = { fast: 0.16, base: 0.24, slow: 0.36 } as const;

/** A CSS cubic-bezier(x1, y1, x2, y2) as a function of progress 0..1 (solved by bisection on x). */
export function bezier([x1, y1, x2, y2]: readonly [
  number,
  number,
  number,
  number,
]): (t: number) => number {
  const cx = (u: number, a: number, b: number): number =>
    3 * a * (1 - u) * (1 - u) * u + 3 * b * (1 - u) * u * u + u * u * u;
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (cx(mid, x1, x2) < t) lo = mid;
      else hi = mid;
    }
    return cx((lo + hi) / 2, y1, y2);
  };
}
export const easeOut = bezier(EASE_OUT);
export const easeInOut = bezier(EASE_IN_OUT);
