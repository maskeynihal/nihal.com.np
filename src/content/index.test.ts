import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCv, getObjects, getWork } from './index';
import { cv } from './cv';
import { objects } from './objects';
import { work } from './work';

afterEach(() => vi.unstubAllEnvs());

describe('visibility rule', () => {
  it('hides confirmed:false by default', () => {
    expect(getWork().every((w) => w.confirmed)).toBe(true);
    expect(getWork().map((w) => w.id)).not.toContain('trayt');
    expect(getObjects().map((o) => o.id)).not.toContain('cruiser');
    expect(getObjects().every((o) => o.confirmed)).toBe(true);
    expect(getCv().every((r) => r.confirmed)).toBe(true);
  });

  it('shows everything with PUBLIC_SHOW_UNCONFIRMED=1', () => {
    vi.stubEnv('PUBLIC_SHOW_UNCONFIRMED', '1');
    expect(getWork()).toHaveLength(work.length);
    expect(getObjects()).toHaveLength(objects.length);
    expect(getCv()).toHaveLength(cv.length);
  });

  it('ignores other flag values', () => {
    vi.stubEnv('PUBLIC_SHOW_UNCONFIRMED', 'true');
    expect(getObjects().map((o) => o.id)).not.toContain('cruiser');
  });
});
