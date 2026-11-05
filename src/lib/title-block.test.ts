import { describe, expect, it } from 'vitest';
import { revLine, revOf } from './title-block';
import { copy } from '../content/copy';

describe('rev line', () => {
  it('uses the build month', () => {
    expect(revOf(new Date('2026-11-05T09:00:00Z'))).toBe('2026.11');
    expect(revOf(new Date('2027-01-01T00:00:00Z'))).toBe('2027.01');
  });
  it('is UTC, not the build machine zone', () => {
    expect(revOf(new Date('2026-11-30T23:59:59Z'))).toBe('2026.11');
    expect(revOf(new Date('2026-12-01T00:00:00Z'))).toBe('2026.12');
  });
  it('fills the copy template', () => {
    expect(revLine(copy.titleBlock.revLine, new Date('2026-11-05Z'))).toBe(
      'rev 2026.11 · sheet 1 of 1 · scale 1:1',
    );
  });
});
