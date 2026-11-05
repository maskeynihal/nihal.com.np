import { afterEach, describe, expect, it, vi } from 'vitest';
import { installGlobalErrorReporting, isDeskSource } from './island-errors';
import { resetReported } from '../../lib/report-error';

afterEach(() => {
  vi.restoreAllMocks();
  resetReported();
});

describe('isDeskSource', () => {
  it('matches hashed desk chunks and dev paths', () => {
    expect(isDeskSource('https://x.test/_astro/Scene.BsjNig0h.js')).toBe(true);
    expect(isDeskSource('/_astro/Desk.BhZODC_F.js:1:2')).toBe(true);
    expect(isDeskSource('/_astro/desk-vendor.abc.js')).toBe(true);
    expect(isDeskSource('/src/components/desk/Scene.tsx')).toBe(true);
  });
  it('ignores other scripts', () => {
    expect(isDeskSource('/_astro/SoundToggle.astro_x.js')).toBe(false);
    expect(isDeskSource('/_astro/Description.abc.js')).toBe(false);
    expect(isDeskSource(undefined)).toBe(false);
  });
});

describe('installGlobalErrorReporting', () => {
  it('reports a desk error event, falls back and does not rethrow', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onFail = vi.fn();
    const stop = installGlobalErrorReporting(onFail);
    const ev = new ErrorEvent('error', {
      filename: 'https://x.test/_astro/Scene.abc.js',
      error: new Error('loop crashed'),
      cancelable: true,
    });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[nihal]',
      'desk',
      'global',
      'Error',
      'loop crashed',
    );
    stop();
  });

  it('leaves errors from other scripts alone', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onFail = vi.fn();
    const stop = installGlobalErrorReporting(onFail);
    const ev = new ErrorEvent('error', {
      filename: 'https://x.test/_astro/SoundToggle.abc.js',
      error: new Error('other'),
      cancelable: true,
    });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(onFail).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    stop();
  });

  it('reports a desk unhandled rejection by its stack, ignores others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onFail = vi.fn();
    const stop = installGlobalErrorReporting(onFail);
    const make = (stack: string) => {
      const reason = Object.assign(new Error('rejected'), { stack });
      const ev = new Event('unhandledrejection', { cancelable: true });
      Object.assign(ev, { reason });
      return ev;
    };
    const mine = make(
      'Error: rejected\n    at f (https://x.test/_astro/Scene.abc.js:1:1)',
    );
    window.dispatchEvent(mine);
    expect(mine.defaultPrevented).toBe(true);
    const other = make(
      'Error: rejected\n    at f (https://x.test/_astro/Other.js:1:1)',
    );
    window.dispatchEvent(other);
    expect(other.defaultPrevented).toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stops listening after cleanup', () => {
    const onFail = vi.fn();
    installGlobalErrorReporting(onFail)();
    // Swallow the event so the test runner does not see an uncaught error.
    const swallow = (e: Event) => e.preventDefault();
    window.addEventListener('error', swallow);
    window.dispatchEvent(
      new ErrorEvent('error', {
        filename: '/_astro/Scene.a.js',
        error: new Error('x'),
        cancelable: true,
      }),
    );
    window.removeEventListener('error', swallow);
    expect(onFail).not.toHaveBeenCalled();
  });
});
