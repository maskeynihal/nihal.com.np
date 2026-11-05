import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('./report-error');

async function load(hooks: boolean): Promise<Mod> {
  vi.resetModules();
  vi.stubEnv('PUBLIC_TEST_HOOKS', hooks ? '1' : '');
  if (hooks) window.__hooks = { ready: true, longTasks: [], errors: [] };
  else delete window.__hooks;
  return import('./report-error');
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete window.__hooks;
});

describe('reportError (plain build)', () => {
  it('warns once with the stable prefix, island and phase', async () => {
    const m = await load(false);
    m.reportError(new TypeError('boom'), { island: 'scene', phase: 'render' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[nihal]',
      'scene',
      'render',
      'TypeError',
      'boom',
    );
  });

  it('dedupes repeats of the same failure but not different ones', async () => {
    const m = await load(false);
    const ctx = { island: 'scene', phase: 'render' } as const;
    m.reportError(new Error('a'), ctx);
    m.reportError(new Error('a'), ctx);
    m.reportError(new Error('b'), ctx);
    m.reportError(new Error('a'), { island: 'desk', phase: 'render' });
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('truncates long messages and keeps no stack or component text', async () => {
    const m = await load(false);
    m.reportError(new Error('x'.repeat(5000)), {
      island: 'desk',
      phase: 'render',
    });
    const args = warn.mock.calls[0] as string[];
    expect(args.join(' ').length).toBeLessThan(300);
    expect(args.join(' ')).not.toMatch(/\bat \w/);
  });

  it('never throws, whatever it is given', async () => {
    const m = await load(false);
    const hostile = [
      undefined,
      null,
      'a string',
      42,
      Symbol('s'),
      Object.create(null),
      new Proxy(
        {},
        {
          get() {
            throw new Error('trap');
          },
        },
      ),
      {
        get name(): string {
          throw new Error('getter');
        },
      },
    ];
    for (const h of hostile)
      expect(() =>
        m.reportError(h, { island: 'desk', phase: 'global' }),
      ).not.toThrow();
  });

  it('never throws when console.warn itself throws', async () => {
    const m = await load(false);
    warn.mockImplementation(() => {
      throw new Error('console is broken');
    });
    expect(() =>
      m.reportError(new Error('x'), { island: 'desk', phase: 'render' }),
    ).not.toThrow();
  });

  it('sends nothing off the device', async () => {
    const m = await load(false);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const beacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beacon,
      configurable: true,
    });
    m.reportError(new Error('x'), { island: 'desk', phase: 'render' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('keeps the dedupe set bounded', async () => {
    const m = await load(false);
    for (let i = 0; i < 500; i++)
      m.reportError(new Error(`e${i}`), { island: 'desk', phase: 'render' });
    expect(warn).toHaveBeenCalledTimes(500);
  });

  it('markIntentional is inert without hooks', async () => {
    const m = await load(false);
    const e = m.markIntentional(new Error('t'));
    m.reportError(e, { island: 'desk', phase: 'render' });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('reportError (hooks build)', () => {
  it('pushes one record to __hooks.errors', async () => {
    const m = await load(true);
    const ctx = { island: 'scene', phase: 'chunk' } as const;
    m.reportError(new Error('x'), ctx);
    m.reportError(new Error('x'), ctx);
    expect(window.__hooks?.errors).toEqual([
      { island: 'scene', phase: 'chunk', name: 'Error', message: 'x' },
    ]);
  });

  it('warns for accidental errors but not for intentional ones', async () => {
    const m = await load(true);
    m.reportError(new Error('accident'), { island: 'desk', phase: 'render' });
    expect(warn).toHaveBeenCalledTimes(1);
    m.reportError(m.markIntentional(new Error('on purpose')), {
      island: 'desk',
      phase: 'render',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(window.__hooks?.errors).toHaveLength(2);
  });
});
