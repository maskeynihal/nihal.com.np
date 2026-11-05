import { describe, expect, it } from 'vitest';
import { flightAt } from './shared-callout';

describe('flightAt', () => {
  const from = { left: 10, top: 100 };
  const to = { left: 210, top: 500 };
  it('starts at the label and ends on the line', () => {
    expect(flightAt(from, to, 0)).toEqual(from);
    expect(flightAt(from, to, 1)).toEqual(to);
  });
  it('clamps outside 0..1', () => {
    expect(flightAt(from, to, -1)).toEqual(from);
    expect(flightAt(from, to, 2)).toEqual(to);
  });
  it('eases out: past half way at half the time', () => {
    expect(flightAt(from, to, 0.5).left).toBeGreaterThan(110);
  });
  it('follows a target that moved', () => {
    expect(flightAt(from, { left: 10, top: 0 }, 1).top).toBe(0);
  });
});
