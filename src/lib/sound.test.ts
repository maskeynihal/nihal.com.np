import { describe, expect, it } from 'vitest';
import { HARD_FROM, MIN_IMPACT, SOFT_BELOW, audioProbe, tapFor } from './sound';

describe('tapFor', () => {
  it('ignores a body settling', () => {
    expect(tapFor(0)).toBeNull();
    expect(tapFor(MIN_IMPACT - 0.01)).toBeNull();
    expect(tapFor(Number.NaN)).toBeNull();
  });
  it('picks the tap by impact speed', () => {
    expect(tapFor(MIN_IMPACT)?.clip).toBe('tap-1');
    expect(tapFor(SOFT_BELOW)?.clip).toBe('tap-2');
    expect(tapFor(HARD_FROM)?.clip).toBe('tap-3');
  });
  it('scales the gain with speed and caps it at 1', () => {
    const soft = tapFor(0.3)!.gain;
    const hard = tapFor(3)!.gain;
    expect(hard).toBeGreaterThan(soft);
    expect(tapFor(50)!.gain).toBe(1);
  });
});

describe('audio', () => {
  it('is null until a press has armed it', () => {
    expect(audioProbe()).toBeNull();
  });
});
