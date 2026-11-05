import { describe, expect, it } from 'vitest';
import {
  atDepthZero,
  layoutFor,
  objectScale,
  pxToWorld,
  worldBounds,
  worldToPx,
} from './view';

const vp = { width: 1200, height: 800 };

describe('desk view maths', () => {
  it('round-trips a screen point through the z = 0 plane', () => {
    const w = pxToWorld(300, 650, vp, 500);
    const p = worldToPx(w.x, w.y, 0, vp, 500);
    expect(p.x).toBeCloseTo(300, 6);
    expect(p.y).toBeCloseTo(650, 6);
  });

  it('a point moved to depth zero keeps its screen position', () => {
    const before = worldToPx(0.3, 0.1, 0.4, vp, 500);
    const z0 = atDepthZero(0.3, 0.1, 0.4);
    const after = worldToPx(z0.x, z0.y, 0, vp, 500);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it('puts the table centre where the layout says', () => {
    const l = layoutFor({ left: 100, top: 40, width: 1200 });
    expect(l.ox).toBe(700);
    expect(l.ppm).toBeGreaterThan(0);
  });

  it('bounds match the viewport edges', () => {
    const b = worldBounds(vp, 400);
    const edge = worldToPx(b.halfW, -b.halfH, 0, vp, 400);
    expect(edge.x).toBeCloseTo(vp.width, 6);
    expect(edge.y).toBeCloseTo(vp.height, 6);
  });

  it('shrinks objects on phones only', () => {
    expect(objectScale(390)).toBeLessThan(1);
    expect(objectScale(1280)).toBe(1);
  });
});
