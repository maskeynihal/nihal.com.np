import { testHooks } from './env';

export type Motion = 'reduce' | 'full';
export type Sound = 'on' | 'off';

export const MOTION_KEY = 'nihal:motion';
export const SOUND_KEY = 'nihal:sound';
export const MOTION_EVENT = 'nihal:motion';
export const SOUND_EVENT = 'nihal:sound';

interface NavigatorExtras {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

const hasWindow = () => typeof window !== 'undefined';
const extras = (): NavigatorExtras =>
  typeof navigator === 'undefined' ? {} : (navigator as NavigatorExtras);

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: the choice lasts for this page session only
  }
}

// ---- capability -----------------------------------------------------------

let cached: boolean | undefined;

/** Test seam: forget the memoised WebGL2 probe. */
export function resetCapabilityCache(): void {
  cached = undefined;
}

/**
 * WebGL2 probe, memoised; the throwaway context is released at once (Safari
 * allows ~16). `failIfMajorPerformanceCaveat` rejects software renderers, so it
 * is off in test-hooks builds (SwiftShader).
 */
export function hasWebGL2(allowSoftware: boolean = testHooks): boolean {
  if (cached !== undefined) return cached;
  if (!hasWindow()) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2', {
      failIfMajorPerformanceCaveat: !allowSoftware,
    });
    cached = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

export function canRun3D(): boolean {
  if (!hasWindow()) return false;
  const nav = extras();
  const mem = nav.deviceMemory;
  return (
    document.documentElement.dataset['motion'] === 'full' &&
    window.innerWidth >= 360 &&
    !nav.connection?.saveData &&
    !(typeof mem === 'number' && mem < 4) &&
    hasWebGL2()
  );
}

/** Physics loads on the first grab only; it has no rule beyond canRun3D. */
export const canRunPhysics = (): boolean => canRun3D();

export function dprFor(): number {
  if (!hasWindow()) return 1;
  const cores = extras().hardwareConcurrency ?? 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return cores <= 4 || coarse ? 1 : 1.5;
}

export function onIdle(cb: () => void, timeout = 1500): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => cb(), { timeout });
  } else {
    setTimeout(cb, 1);
  }
}

// ---- preferences ----------------------------------------------------------

export function getMotion(): Motion {
  if (!hasWindow()) return 'full';
  return document.documentElement.dataset['motion'] === 'reduce'
    ? 'reduce'
    : 'full';
}

function applyMotion(m: Motion): void {
  document.documentElement.dataset['motion'] = m;
  window.dispatchEvent(
    new CustomEvent<{ motion: Motion }>(MOTION_EVENT, {
      detail: { motion: m },
    }),
  );
}

export function setMotion(m: Motion): void {
  if (!hasWindow()) return;
  writeStored(MOTION_KEY, m);
  applyMotion(m);
}

export function getSound(): Sound {
  if (!hasWindow()) return 'off';
  return document.documentElement.dataset['sound'] === 'on' ? 'on' : 'off';
}

export function setSound(s: Sound): void {
  if (!hasWindow()) return;
  writeStored(SOUND_KEY, s);
  document.documentElement.dataset['sound'] = s;
  window.dispatchEvent(
    new CustomEvent<{ sound: Sound }>(SOUND_EVENT, { detail: { sound: s } }),
  );
}

export function subscribeMotion(cb: (m: Motion) => void): () => void {
  if (!hasWindow()) return () => {};
  const h = (e: Event) =>
    cb((e as CustomEvent<{ motion: Motion }>).detail.motion);
  window.addEventListener(MOTION_EVENT, h);
  return () => window.removeEventListener(MOTION_EVENT, h);
}

export function subscribeSound(cb: (s: Sound) => void): () => void {
  if (!hasWindow()) return () => {};
  const h = (e: Event) => cb((e as CustomEvent<{ sound: Sound }>).detail.sound);
  window.addEventListener(SOUND_EVENT, h);
  return () => window.removeEventListener(SOUND_EVENT, h);
}

let stopOs: (() => void) | undefined;

/**
 * Follows live OS reduced-motion changes unless the user stored an explicit
 * choice. Idempotent; returns a disposer. Called by the toggles.
 */
export function initPrefs(): () => void {
  if (stopOs) return stopOs;
  if (!hasWindow() || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onChange = (e: MediaQueryListEvent) => {
    if (readStored(MOTION_KEY) !== null) return;
    applyMotion(e.matches ? 'reduce' : 'full');
  };
  mq.addEventListener('change', onChange);
  stopOs = () => {
    mq.removeEventListener('change', onChange);
    stopOs = undefined;
  };
  return stopOs;
}
