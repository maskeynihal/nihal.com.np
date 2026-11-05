// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { box } from './geom';
import { partToGlb } from './export';

describe('asset pipeline', () => {
  it('writes byte-identical GLBs for identical input', async () => {
    const a = await partToGlb('t', box({ c: [0, 0.5, 0], s: [1, 1, 1] }));
    const b = await partToGlb('t', box({ c: [0, 0.5, 0], s: [1, 1, 1] }));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
});
