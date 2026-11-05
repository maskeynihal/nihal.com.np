import { describe, expect, it } from 'vitest';
import { progressOf } from './sheet-index';

describe('progressOf', () => {
  it('is 0 at the top, 1 at the bottom, linear between', () => {
    expect(progressOf(0, 800, 3000)).toBe(0);
    expect(progressOf(2200, 800, 3000)).toBe(1);
    expect(progressOf(1100, 800, 3000)).toBeCloseTo(0.5);
  });
  it('clamps overscroll and handles pages shorter than the viewport', () => {
    expect(progressOf(-50, 800, 3000)).toBe(0);
    expect(progressOf(9999, 800, 3000)).toBe(1);
    expect(progressOf(0, 800, 600)).toBe(0);
  });
});
