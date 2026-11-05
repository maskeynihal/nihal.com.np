import { describe, expect, it } from 'vitest';
import {
  MAX_THROW,
  MAX_TILT,
  RingBuffer,
  clampSpeed,
  clampToDesk,
  isTap,
  outOfBounds,
  planePoint,
  tiltFor,
} from './drag';

describe('RingBuffer', () => {
  it('is zero with fewer than two samples', () => {
    const r = new RingBuffer();
    expect(r.velocity(0)).toEqual({ x: 0, z: 0 });
    r.push(0, 0, 0);
    expect(r.velocity(10)).toEqual({ x: 0, z: 0 });
  });

  it('measures speed over the window in m/s', () => {
    const r = new RingBuffer();
    r.push(0, 0, 0);
    r.push(0.01, 0, 16);
    r.push(0.02, 0, 32);
    const v = r.velocity(40);
    expect(v.x).toBeCloseTo(0.02 / 0.032, 5);
    expect(v.z).toBe(0);
  });

  it('clamps to 4 m/s', () => {
    const r = new RingBuffer();
    r.push(0, 0, 0);
    r.push(1, 1, 16);
    const v = r.velocity(20);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(MAX_THROW, 5);
  });

  it('throws nothing when the pointer stopped before release', () => {
    const r = new RingBuffer();
    r.push(0, 0, 0);
    r.push(0.2, 0, 16);
    expect(r.velocity(500)).toEqual({ x: 0, z: 0 });
  });

  it('keeps only the last five samples', () => {
    const r = new RingBuffer();
    for (let i = 0; i < 10; i++) r.push(i * 0.02, 0, i * 10);
    const v = r.velocity(95);
    expect(v.x).toBeCloseTo(2, 5);
  });
});

describe('helpers', () => {
  it('clampSpeed keeps direction and survives NaN', () => {
    const v = clampSpeed(6, 8, 4);
    expect(v.x).toBeCloseTo(2.4);
    expect(v.z).toBeCloseTo(3.2);
    expect(clampSpeed(NaN, 1)).toEqual({ x: 0, z: 0 });
  });

  it('clampToDesk stays inside the walls', () => {
    const c = clampToDesk(5, -5);
    expect(c.x).toBeLessThan(0.76);
    expect(c.z).toBeGreaterThan(-0.56);
  });

  it('tilt leans against travel and never exceeds 25 degrees', () => {
    expect(tiltFor(1, 0).roll).toBeGreaterThan(0);
    expect(tiltFor(0, 1).pitch).toBeLessThan(0);
    expect(Math.abs(tiltFor(40, 0).roll)).toBe(MAX_TILT);
  });

  it('planePoint intersects a ray with a horizontal plane', () => {
    expect(planePoint([0, 2, 0], [1, -1, 0], 0)).toEqual({ x: 2, z: 0 });
    expect(planePoint([0, 2, 0], [0, 1, 0], 0)).toBeNull();
    expect(planePoint([0, 2, 0], [1, 0, 0], 0)).toBeNull();
  });

  it('isTap needs a short, still press', () => {
    expect(isTap(2, 100)).toBe(true);
    expect(isTap(7, 100)).toBe(false);
    expect(isTap(2, 300)).toBe(false);
  });

  it('outOfBounds matches the watchdog rule', () => {
    expect(outOfBounds({ x: 0, y: 0, z: 0 })).toBe(false);
    expect(outOfBounds({ x: 1.3, y: 0, z: 0 })).toBe(true);
    expect(outOfBounds({ x: 0, y: 0, z: 0.9 })).toBe(true);
    expect(outOfBounds({ x: 0, y: 1.1, z: 0 })).toBe(true);
    expect(outOfBounds({ x: 0, y: -0.3, z: 0 })).toBe(true);
    expect(outOfBounds({ x: NaN, y: 0, z: 0 })).toBe(true);
  });
});
