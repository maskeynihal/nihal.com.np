import { describe, expect, it } from 'vitest';
import { easeInOutCubic, progressOf, scrollDuration } from './sheet-index';

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

describe('scrollDuration', () => {
  it('is 450 ms for no distance, grows with distance and caps at 700 ms', () => {
    expect(scrollDuration(0)).toBe(450);
    expect(scrollDuration(-2000)).toBe(575);
    expect(scrollDuration(4000)).toBe(700);
    expect(scrollDuration(1_000_000)).toBe(700);
  });
});

describe('easeInOutCubic', () => {
  it('runs 0 to 1, symmetric about the middle, clamped outside', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });
});
