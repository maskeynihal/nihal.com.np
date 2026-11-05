import { afterEach, describe, expect, it, vi } from 'vitest';

const inject = vi.fn();
vi.mock('@vercel/analytics', () => ({ inject }));

async function load(opts: {
  prod: boolean;
  hooks: boolean;
  dnt: string | null;
}) {
  vi.stubEnv('PROD', opts.prod);
  vi.stubEnv('PUBLIC_TEST_HOOKS', opts.hooks ? '1' : '');
  Object.defineProperty(navigator, 'doNotTrack', {
    value: opts.dnt,
    configurable: true,
  });
  await import('./analytics');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  inject.mockClear();
});

describe('analytics', () => {
  it('injects in production when Do Not Track is off', async () => {
    await load({ prod: true, hooks: false, dnt: null });
    expect(inject).toHaveBeenCalledTimes(1);
  });
  it('does nothing when Do Not Track is 1', async () => {
    await load({ prod: true, hooks: false, dnt: '1' });
    expect(inject).not.toHaveBeenCalled();
  });
  it('does nothing outside production', async () => {
    await load({ prod: false, hooks: false, dnt: null });
    expect(inject).not.toHaveBeenCalled();
  });
  it('does nothing in test-hook builds', async () => {
    await load({ prod: true, hooks: true, dnt: null });
    expect(inject).not.toHaveBeenCalled();
  });
});
