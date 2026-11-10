import { describe, expect, it } from 'vitest';
import { Color, Euler, Object3D, Quaternion, Vector3 } from 'three';
import { createTether, endTether, stepTether } from './tether';
import { fallBridge, type FallApi } from './physics-bridge';
import type { RegistryEntry } from './registry';

const entryAt = (p: [number, number, number]): RegistryEntry => {
  const obj = new Object3D();
  const fx = new Object3D();
  return {
    id: 'thing',
    def: { p, q: [0, 0, 0, 1] },
    obj,
    pivot: new Object3D(),
    fx,
    lift: new Object3D(),
    fixed: false,
    free: false,
  } as unknown as RegistryEntry;
};

describe('tether: the reel starts from the exact pose', () => {
  const q = new Quaternion().setFromEuler(new Euler(0.4, 1.1, -0.3));

  it('keeps a table object exactly where (and how turned) it was until its line latches, then reels it home', () => {
    const entry = entryAt([0.2, 0, 0.1]);
    const from = new Vector3(0.5, 0.0, -0.3);
    const T = createTether(
      [{ entry, from, q, delay: 1 }],
      new Vector3(),
      new Color('#fff'),
    );
    for (let i = 0; i < 40; i++) {
      stepTether(T, 1 / 60); // 0.67 s: before the strand's delay
      expect(entry.fx.position.distanceTo(from)).toBeLessThan(1e-6);
      expect(entry.fx.quaternion.angleTo(q)).toBeLessThan(1e-6);
    }
    // latched (0.3 s after the delay) it has still not moved; then it comes home
    stepTether(T, 1 - 40 / 60 + 0.3);
    expect(entry.fx.position.distanceTo(from)).toBeLessThan(1e-3);
    stepTether(T, 0.4);
    const mid = entry.fx.position.length();
    expect(mid).toBeLessThan(from.length());
    stepTether(T, 2);
    expect(entry.fx.position.length()).toBe(0);
    expect(entry.fx.quaternion.angleTo(new Quaternion())).toBe(0);
    endTether(T);
  });

  it('moves a fall-layer object through the fall layer from its captured pose, and sends it home at the end', () => {
    const entry = entryAt([0.2, 0, 0.1]);
    const placed: number[][] = [];
    let homed = 0;
    fallBridge.provide({
      place: (_id: string, p: readonly number[]) => placed.push([...p]),
      home: () => homed++,
    } as unknown as FallApi);
    const from = new Vector3(0.5, -1.2, 0.8);
    const T = createTether(
      [{ entry, from, q, fall: true, delay: 0.5 }],
      new Vector3(),
      new Color('#fff'),
    );
    stepTether(T, 0.4);
    // not reeled yet: the fall layer is not asked to move it (it is frozen where it was)
    expect(placed.length).toBe(0);
    stepTether(T, 0.1 + 0.3); // latch
    const start = placed[0]!;
    expect(start[0]).toBeCloseTo(0.2 + 0.5, 3);
    expect(start[1]).toBeCloseTo(-1.2, 3);
    expect(start[2]).toBeCloseTo(0.1 + 0.8, 3);
    stepTether(T, 2);
    expect(homed).toBe(1);
    // the table-side offset is never used for it
    expect(entry.fx.position.length()).toBe(0);
    endTether(T);
    expect(homed).toBe(1);
    fallBridge.provide(null);
  });
});
