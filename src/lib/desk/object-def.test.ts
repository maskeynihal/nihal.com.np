import { describe, expect, it } from 'vitest';
import { parseObjects } from './object-def';

const good = {
  id: 'arduino',
  model: 'arduino',
  p: [0, 0, 0.02],
  q: [0, 0, 0, 1],
  collider: { kind: 'cuboid', args: [0.17, 0.03, 0.11], offset: [0, 0.03, 0] },
  mass: 1.2,
  callouts: [{ anchor: [0.16, 0.02, 0], text: 'uno r4' }],
  target: '#work-car-sensors',
};

describe('parseObjects', () => {
  it('reads a valid payload', () => {
    expect(parseObjects(JSON.stringify([good]))).toEqual([good]);
  });

  it('returns nothing for missing or broken input', () => {
    expect(parseObjects(null)).toEqual([]);
    expect(parseObjects('')).toEqual([]);
    expect(parseObjects('{nope')).toEqual([]);
    expect(parseObjects('{}')).toEqual([]);
  });

  it('drops malformed entries and keeps the rest', () => {
    const bad = { ...good, id: 'x', p: [0, 0] };
    const noTarget = { ...good, id: 'y', target: 'work' };
    const out = parseObjects(JSON.stringify([bad, good, noTarget, null, 3]));
    expect(out.map((o) => o.id)).toEqual(['arduino']);
  });
});
