import { testHooks } from './env';

export type Motion = 'reduce' | 'full';
export type Sound = 'on' | 'off';

export const MOTION_KEY = 'nihal:motion';
export const SOUND_KEY = 'nihal:sound';
export const MOTION_EVENT = 'nihal:motion';
export const SOUND_EVENT = 'nihal:sound';
export const THEME_KEY = 'nihal:theme';
export const THEME_EVENT = 'nihal:theme';
export type Theme = 'blue' | 'paper';
export const LAMP_KEY = 'nihal:lamp';
export const LAMP_EVENT = 'nihal:lamp';
/** Lamp brightness, 4 (lit, paper) down to 0 (off, night). 4, 3, 2 are paper; 1, 0 are blue. */
export type Lamp = 0 | 1 | 2 | 3 | 4;
export const LAMP_MAX: Lamp = 4;
/** `theme-color` per level; keep in step with prefs-inline.js and the page tokens. */
const LAMP_COLOR: Record<Lamp, string> = {
  0: '#0A1348',
  1: '#1F3FE0',
  2: '#B3B4C6',
  3: '#E6E4DC',
  4: '#F6F5F1',
};

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

function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // storage blocked
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

/**
 * Can this device draw the 3D desk at all (screen width, memory, data saver, WebGL2)? Motion is
 * not part of it: under reduced motion the desk is still drawn, standing still, and answers a tap
 * with a short, gentle change.
 */
export function canRunScene(): boolean {
  if (!hasWindow()) return false;
  const nav = extras();
  const mem = nav.deviceMemory;
  return (
    window.innerWidth >= 360 &&
    !nav.connection?.saveData &&
    !(typeof mem === 'number' && mem < 4) &&
    hasWebGL2()
  );
}

export function canRun3D(): boolean {
  return (
    hasWindow() &&
    document.documentElement.dataset['motion'] === 'full' &&
    canRunScene()
  );
}

/** Physics loads on the first grab only; it has no rule beyond canRunScene. */
export const canRunPhysics = (): boolean => canRunScene();

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

const OS_REDUCE = '(prefers-reduced-motion: reduce)';

/** True while the OS asks for reduced motion. */
export function osReduces(): boolean {
  if (!hasWindow() || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia(OS_REDUCE).matches;
  } catch {
    return false;
  }
}

// The visitor's choice this session (storage may be blocked).
let chosen: Motion | null = null;

/** The OS setting is a floor: reduce if stored says reduce OR the OS does. */
function effectiveMotion(): Motion {
  const stored = chosen ?? readStored(MOTION_KEY);
  return stored === 'reduce' || osReduces() ? 'reduce' : 'full';
}

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

/**
 * Only 'reduce' is persisted; 'full' clears the key. Under OS reduce the
 * attribute stays 'reduce' whatever is chosen.
 */
export function setMotion(m: Motion): void {
  if (!hasWindow()) return;
  chosen = m;
  if (m === 'reduce') writeStored(MOTION_KEY, m);
  else removeStored(MOTION_KEY);
  applyMotion(m === 'reduce' || osReduces() ? 'reduce' : 'full');
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

const isLamp = (n: unknown): n is Lamp =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= LAMP_MAX;

export const themeOfLamp = (l: Lamp): Theme => (l > 1 ? 'paper' : 'blue');

export function getTheme(): Theme {
  if (!hasWindow()) return 'blue';
  return document.documentElement.dataset['theme'] === 'paper'
    ? 'paper'
    : 'blue';
}

export function getLamp(): Lamp {
  if (!hasWindow()) return 1;
  const n = Number(document.documentElement.dataset['lamp']);
  return isLamp(n) ? n : getTheme() === 'paper' ? 4 : 1;
}

/**
 * Sets data-lamp and data-theme together, then fires `nihal:theme` (every change, so the desk and
 * garden repaint their colours even when only the level moved inside one theme) and `nihal:lamp`.
 */
function applyLamp(l: Lamp): void {
  const t = themeOfLamp(l);
  const ds = document.documentElement.dataset;
  ds['lamp'] = String(l);
  ds['theme'] = t;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta) meta.content = LAMP_COLOR[l];
  window.dispatchEvent(
    new CustomEvent<{ theme: Theme }>(THEME_EVENT, { detail: { theme: t } }),
  );
  window.dispatchEvent(
    new CustomEvent<{ lamp: Lamp; theme: Theme }>(LAMP_EVENT, {
      detail: { lamp: l, theme: t },
    }),
  );
}

/** A visitor's choice is stored (the level, and the theme it implies) and wins over the OS. */
export function setLamp(l: Lamp): void {
  if (!hasWindow() || !isLamp(l)) return;
  writeStored(LAMP_KEY, String(l));
  writeStored(THEME_KEY, themeOfLamp(l));
  applyLamp(l);
}

/** Kept for the old contract: blue is level 1, paper is level 4. */
export function setTheme(t: Theme): void {
  setLamp(t === 'paper' ? 4 : 1);
}

export function subscribeLamp(cb: (l: Lamp) => void): () => void {
  if (!hasWindow()) return () => {};
  const h = (e: Event) => cb((e as CustomEvent<{ lamp: Lamp }>).detail.lamp);
  window.addEventListener(LAMP_EVENT, h);
  return () => window.removeEventListener(LAMP_EVENT, h);
}

export function subscribeTheme(cb: (t: Theme) => void): () => void {
  if (!hasWindow()) return () => {};
  const h = (e: Event) => cb((e as CustomEvent<{ theme: Theme }>).detail.theme);
  window.addEventListener(THEME_EVENT, h);
  return () => window.removeEventListener(THEME_EVENT, h);
}

/** Until the visitor chooses, follow live OS colour-scheme changes (light gives 4, dark gives 1). */
export function followOsTheme(): void {
  if (!hasWindow() || typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', () => {
    if (readStored(THEME_KEY) || readStored(LAMP_KEY)) return;
    applyLamp(mq.matches ? 4 : 1);
  });
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
 * Follows live OS reduced-motion changes: OS reduce forces the attribute to
 * reduce (and data-motion-os tracks it); when it clears, the attribute follows
 * the stored choice. Toggles re-sync on the resulting event. Idempotent;
 * returns a disposer. Called by the toggles.
 */
export function initPrefs(): () => void {
  if (stopOs) return stopOs;
  if (!hasWindow() || typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(OS_REDUCE);
  const onChange = () => {
    const ds = document.documentElement.dataset;
    if (osReduces()) ds['motionOs'] = 'reduce';
    else delete ds['motionOs'];
    applyMotion(effectiveMotion());
  };
  mq.addEventListener('change', onChange);
  stopOs = () => {
    mq.removeEventListener('change', onChange);
    stopOs = undefined;
  };
  return stopOs;
}

/** Test seam: forget the in-memory choice. */
export function resetChoice(): void {
  chosen = null;
}
