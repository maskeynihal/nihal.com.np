import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as prefs from './prefs';

type Mq = {
  matches: boolean;
  listeners: Set<(e: MediaQueryListEvent) => void>;
};

function setProp(obj: object, key: string, value: unknown) {
  Object.defineProperty(obj, key, {
    value,
    configurable: true,
    writable: true,
  });
}
function delProp(obj: object, key: string) {
  Reflect.deleteProperty(obj, key);
}

const mqs = new Map<string, Mq>();
function stubMatchMedia(initial: Record<string, boolean> = {}) {
  mqs.clear();
  for (const [q, v] of Object.entries(initial))
    mqs.set(q, { matches: v, listeners: new Set() });
  setProp(window, 'matchMedia', (q: string) => {
    let m = mqs.get(q);
    if (!m) {
      m = { matches: false, listeners: new Set() };
      mqs.set(q, m);
    }
    const entry = m;
    return {
      get matches() {
        return entry.matches;
      },
      media: q,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        entry.listeners.add(cb),
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) =>
        entry.listeners.delete(cb),
    };
  });
}
function fireMq(q: string, matches: boolean) {
  const m = mqs.get(q)!;
  m.matches = matches;
  for (const cb of [...m.listeners])
    cb({ matches } as unknown as MediaQueryListEvent);
}

let loseContext: ReturnType<typeof vi.fn>;
let getContext: ReturnType<typeof vi.fn>;
function stubWebGL(available: boolean) {
  loseContext = vi.fn();
  getContext = vi.fn(() =>
    available ? { getExtension: () => ({ loseContext }) } : null,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    getContext as never,
  );
}

beforeEach(() => {
  localStorage.clear();
  prefs.resetCapabilityCache();
  prefs.resetChoice();
  document.documentElement.dataset['motion'] = 'full';
  document.documentElement.dataset['sound'] = 'off';
  stubMatchMedia({ '(pointer: coarse)': false });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const k of ['deviceMemory', 'connection', 'hardwareConcurrency'])
    delProp(navigator, k);
  delProp(window, 'requestIdleCallback');
  delProp(globalThis, 'requestIdleCallback');
});

describe('canRun3D matrix', () => {
  const motions = ['full', 'reduce'] as const;
  const gls = [true, false];
  const mems = [undefined, 2, 3.99, 4, 8];
  const saves = [true, false, undefined];
  const widths = [320, 359, 360, 1024];

  for (const motion of motions)
    for (const gl of gls)
      for (const mem of mems)
        for (const save of saves)
          for (const width of widths) {
            const name = `motion=${motion} gl=${gl} mem=${mem} save=${save} w=${width}`;
            it(name, () => {
              document.documentElement.dataset['motion'] = motion;
              stubWebGL(gl);
              setProp(navigator, 'deviceMemory', mem);
              setProp(
                navigator,
                'connection',
                save === undefined ? undefined : { saveData: save },
              );
              setProp(window, 'innerWidth', width);
              const want3D =
                motion === 'full' &&
                gl &&
                (mem === undefined || mem >= 4) &&
                save !== true &&
                width >= 360;
              expect(prefs.canRun3D()).toBe(want3D);
              expect(prefs.canRunPhysics()).toBe(want3D);
            });
          }
});

describe('dprFor (literal table)', () => {
  // [hardwareConcurrency, coarse pointer, expected dpr]
  const table: [number | undefined, boolean, number][] = [
    [undefined, false, 1],
    [undefined, true, 1],
    [1, false, 1],
    [2, false, 1],
    [4, false, 1],
    [4, true, 1],
    [5, false, 1.5],
    [8, false, 1.5],
    [8, true, 1],
    [16, false, 1.5],
    [16, true, 1],
  ];
  it.each(table)('cores=%s coarse=%s -> %s', (hc, coarse, want) => {
    stubMatchMedia({ '(pointer: coarse)': coarse });
    setProp(navigator, 'hardwareConcurrency', hc);
    expect(prefs.dprFor()).toBe(want);
  });
});

describe('canRun3D boundaries', () => {
  const base = () => {
    stubWebGL(true);
    setProp(window, 'innerWidth', 1024);
    setProp(navigator, 'deviceMemory', undefined);
  };
  it.each([
    [3.99, false],
    [4, true],
  ])('deviceMemory %s -> %s', (mem, want) => {
    base();
    setProp(navigator, 'deviceMemory', mem);
    expect(prefs.canRun3D()).toBe(want);
  });
  it.each([
    [359, false],
    [360, true],
  ])('width %s -> %s', (w, want) => {
    base();
    setProp(window, 'innerWidth', w);
    expect(prefs.canRun3D()).toBe(want);
  });
});

describe('hasWebGL2', () => {
  it('memoises the probe', () => {
    stubWebGL(true);
    expect(prefs.hasWebGL2()).toBe(true);
    expect(prefs.hasWebGL2()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(1);
  });
  it('releases the context', () => {
    stubWebGL(true);
    prefs.hasWebGL2();
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
  it('returns false when getContext throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => {
        throw new Error('no');
      },
    );
    expect(prefs.hasWebGL2()).toBe(false);
  });
  it('sets failIfMajorPerformanceCaveat true without test hooks', () => {
    stubWebGL(true);
    prefs.hasWebGL2(false);
    expect(getContext).toHaveBeenCalledWith('webgl2', {
      failIfMajorPerformanceCaveat: true,
    });
  });
  it('sets failIfMajorPerformanceCaveat false when software is allowed', () => {
    stubWebGL(true);
    prefs.hasWebGL2(true);
    expect(getContext).toHaveBeenCalledWith('webgl2', {
      failIfMajorPerformanceCaveat: false,
    });
  });
  it.each([
    ['1', false],
    ['', true],
  ])('default flag follows PUBLIC_TEST_HOOKS=%j', async (env, expected) => {
    vi.stubEnv('PUBLIC_TEST_HOOKS', env);
    vi.resetModules();
    const fresh = await import('./prefs');
    stubWebGL(true);
    fresh.hasWebGL2();
    expect(getContext).toHaveBeenCalledWith('webgl2', {
      failIfMajorPerformanceCaveat: expected,
    });
  });
});

describe('onIdle', () => {
  it('uses requestIdleCallback with the timeout when present', () => {
    const ric = vi.fn((cb: () => void) => cb());
    setProp(globalThis, 'requestIdleCallback', ric);
    const cb = vi.fn();
    prefs.onIdle(cb);
    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 1500 });
    expect(cb).toHaveBeenCalledTimes(1);
    prefs.onIdle(cb, 50);
    expect(ric).toHaveBeenLastCalledWith(expect.any(Function), { timeout: 50 });
  });
  it('falls back to setTimeout', () => {
    vi.useFakeTimers();
    delProp(globalThis, 'requestIdleCallback');
    const cb = vi.fn();
    prefs.onIdle(cb);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5);
    expect(cb).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('motion and sound', () => {
  it('defaults', () => {
    expect(prefs.getMotion()).toBe('full');
    expect(prefs.getSound()).toBe('off');
  });
  it('setMotion persists, updates attribute, dispatches', () => {
    const seen: string[] = [];
    const un = prefs.subscribeMotion((m) => seen.push(m));
    prefs.setMotion('reduce');
    expect(prefs.getMotion()).toBe('reduce');
    expect(document.documentElement.dataset['motion']).toBe('reduce');
    expect(localStorage.getItem('nihal:motion')).toBe('reduce');
    expect(seen).toEqual(['reduce']);
    un();
    prefs.setMotion('full');
    expect(seen).toEqual(['reduce']);
    expect(prefs.getMotion()).toBe('full');
  });
  it('setSound persists, updates attribute, dispatches', () => {
    const seen: string[] = [];
    const un = prefs.subscribeSound((s) => seen.push(s));
    prefs.setSound('on');
    expect(prefs.getSound()).toBe('on');
    expect(localStorage.getItem('nihal:sound')).toBe('on');
    expect(seen).toEqual(['on']);
    un();
    prefs.setSound('off');
    expect(seen).toEqual(['on']);
  });
  it('event detail carries the value', () => {
    const h = vi.fn();
    window.addEventListener('nihal:motion', h);
    prefs.setMotion('reduce');
    expect((h.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      motion: 'reduce',
    });
    window.removeEventListener('nihal:motion', h);
  });
  it('blocked storage leaves defaults, never throws, still toggles', () => {
    const spy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    expect(() => prefs.setMotion('reduce')).not.toThrow();
    expect(prefs.getMotion()).toBe('reduce');
    expect(() => prefs.setSound('on')).not.toThrow();
    expect(prefs.getSound()).toBe('on');
    spy.mockRestore();
  });
});

describe('initPrefs OS follow (OS reduce is a floor)', () => {
  const Q = '(prefers-reduced-motion: reduce)';
  type Stored = null | 'reduce' | 'full' | 'throw';
  const stores: Stored[] = [null, 'reduce', 'full', 'throw'];
  const initialOs = [true, false];

  for (const stored of stores)
    for (const os0 of initialOs)
      it(`stored=${stored} os0=${os0}: live changes`, () => {
        stubMatchMedia({ '(pointer: coarse)': false, [Q]: os0 });
        let spy: { mockRestore(): void } | undefined;
        if (stored === 'throw') {
          spy = vi
            .spyOn(window, 'localStorage', 'get')
            .mockImplementation(() => {
              throw new DOMException('denied', 'SecurityError');
            });
        } else if (stored) localStorage.setItem('nihal:motion', stored);
        const stop = prefs.initPrefs();
        const reduces = stored === 'reduce';
        // OS switches to reduce: always reduce
        fireMq(Q, true);
        expect(prefs.getMotion()).toBe('reduce');
        // OS switches back: follows stored (only 'reduce' counts)
        fireMq(Q, false);
        expect(prefs.getMotion()).toBe(reduces ? 'reduce' : 'full');
        // and again
        fireMq(Q, true);
        expect(prefs.getMotion()).toBe('reduce');
        stop();
        spy?.mockRestore();
      });

  it('stored full + OS reduce: setMotion(full) stays reduce', () => {
    stubMatchMedia({ '(pointer: coarse)': false, [Q]: true });
    prefs.setMotion('full');
    expect(prefs.getMotion()).toBe('reduce');
    expect(prefs.osReduces()).toBe(true);
  });
  it('session choice survives OS flip with blocked storage', () => {
    const spy = vi
      .spyOn(window, 'localStorage', 'get')
      .mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
    const stop = prefs.initPrefs();
    prefs.setMotion('reduce');
    fireMq(Q, true);
    fireMq(Q, false);
    expect(prefs.getMotion()).toBe('reduce');
    stop();
    spy.mockRestore();
  });
  it('choosing full after reduce restores full when OS allows', () => {
    const stop = prefs.initPrefs();
    prefs.setMotion('reduce');
    prefs.setMotion('full');
    fireMq(Q, true);
    fireMq(Q, false);
    expect(prefs.getMotion()).toBe('full');
    stop();
  });
  it('is idempotent and disposable', () => {
    const a = prefs.initPrefs();
    const b = prefs.initPrefs();
    expect(a).toBe(b);
    expect(mqs.get(Q)!.listeners.size).toBe(1);
    a();
    expect(mqs.get(Q)!.listeners.size).toBe(0);
  });
});
