import { describe, expect, it } from 'vitest';
import { EYE_MAX_YAW, eyeYaw } from './eyes';
import { ghostLook } from './ghost-look';

describe('eyeYaw', () => {
  it('looks straight ahead (+Z) at a point in front', () => {
    expect(eyeYaw(0, 0, 0, 1)).toBeCloseTo(0, 12);
  });
  it('turns toward +X for a point to the right and -X to the left', () => {
    expect(eyeYaw(0, 0, 0.1, 0.2)).toBeGreaterThan(0);
    expect(eyeYaw(0, 0, -0.1, 0.2)).toBeLessThan(0);
  });
  it('clamps behind and beside the ghost', () => {
    expect(eyeYaw(0, 0, 1, 0)).toBe(EYE_MAX_YAW);
    expect(eyeYaw(0, 0, -1, -1)).toBe(-EYE_MAX_YAW);
  });
});

describe('ghostLook', () => {
  it('holds a target only until it is cleared, and tells subscribers', () => {
    let calls = 0;
    const off = ghostLook.subscribe(() => calls++);
    expect(ghostLook.get()).toBeNull();
    ghostLook.set({ x: 1, z: 2 });
    expect(ghostLook.get()).toEqual({ x: 1, z: 2 });
    ghostLook.set(null);
    expect(ghostLook.get()).toBeNull();
    off();
    ghostLook.set({ x: 0, z: 0 });
    expect(calls).toBe(2);
    ghostLook.set(null);
  });
});
