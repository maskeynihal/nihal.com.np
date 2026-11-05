import { describe, expect, it } from 'vitest';
import { cameraFor } from './camera';
import { heroCamera } from '../../assets/camera';

describe('cameraFor', () => {
  it('is the poster camera on wide desktops', () => {
    const c = cameraFor(1440);
    expect(c.fov).toBe(heroCamera.fov);
    expect(c.position).toEqual([...heroCamera.position]);
    expect(c.lookAt).toEqual([...heroCamera.lookAt]);
    expect([c.near, c.far]).toEqual([0.5, 8]);
  });
  it('backs off 15% along the view axis from 768 to 1279', () => {
    const hero = cameraFor(1440);
    const c = cameraFor(900);
    const dist = (p: readonly number[], l: readonly number[]) =>
      Math.hypot(p[0]! - l[0]!, p[1]! - l[1]!, p[2]! - l[2]!);
    expect(
      dist(c.position, c.lookAt) / dist(hero.position, hero.lookAt),
    ).toBeCloseTo(1.15, 9);
    expect(c.lookAt).toEqual(hero.lookAt);
    expect(c.fov).toBe(hero.fov);
  });
  it('uses the prototype portrait pose on phones', () => {
    const c = cameraFor(390);
    expect(c.fov).toBe(50);
    expect(c.position).toEqual([0, 1.85, 1.3]);
    expect(c.lookAt).toEqual([0, 0, 0.02]);
  });
  it('switches at 768', () => {
    expect(cameraFor(767).fov).toBe(50);
    expect(cameraFor(768).fov).toBe(35);
  });
});
