import { describe, expect, it } from 'vitest';
import {
  BUZZ_MS,
  HOP_MS,
  bump,
  bumpOffset,
  clearBumps,
  reactions,
} from './reactions';

describe('reactions', () => {
  it('tells every listener which object was tapped, until it unsubscribes', () => {
    const heard: string[] = [];
    const off = reactions.subscribe((id) => heard.push(id));
    reactions.fire('lamp');
    off();
    reactions.fire('mug');
    expect(heard).toEqual(['lamp']);
  });

  it('a hop rises and is gone after its time', () => {
    clearBumps();
    bump('ball-l', 1000);
    expect(bumpOffset('ball-l', 1000 + HOP_MS * 0.125).y).toBeGreaterThan(
      0.005,
    );
    expect(bumpOffset('ball-l', 1000 + HOP_MS * 0.5).y).toBeLessThan(1e-9);
    const done = bumpOffset('ball-l', 1000 + HOP_MS + 1);
    expect(done).toEqual({ x: 0, y: 0, active: false });
    // and it is forgotten: nothing keeps the frames coming
    expect(bumpOffset('ball-l', 1000 + HOP_MS * 0.1).active).toBe(false);
  });

  it('a buzz shakes sideways and never lifts', () => {
    clearBumps();
    bump('phone', 0, 'buzz');
    let max = 0;
    for (let t = 0; t < BUZZ_MS; t += 5) {
      const o = bumpOffset('phone', t);
      max = Math.max(max, Math.abs(o.x));
      expect(o.y).toBe(0);
    }
    expect(max).toBeGreaterThan(0.001);
  });
});
