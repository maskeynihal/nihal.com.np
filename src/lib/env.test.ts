import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('testHooks', () => {
  it('is false when PUBLIC_TEST_HOOKS is unset', async () => {
    vi.stubEnv('PUBLIC_TEST_HOOKS', '');
    expect((await import('./env')).testHooks).toBe(false);
  });
  it('is true when PUBLIC_TEST_HOOKS is 1', async () => {
    vi.stubEnv('PUBLIC_TEST_HOOKS', '1');
    expect((await import('./env')).testHooks).toBe(true);
  });
});
