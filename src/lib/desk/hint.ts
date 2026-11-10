/**
 * The first-visit nudges on the 3D desk: a line that says it can be touched, and one soft pulse on
 * the drawer and the handset. Both are remembered (storage may be blocked: then they repeat).
 */
const HINT_KEY = 'nihal:desk-hint';
const PULSE_KEY = 'nihal:desk-pulse';

function seen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function remember(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // blocked: the nudge may come back on the next visit
  }
}

export const hintSeen = (): boolean => seen(HINT_KEY);
export const markHintSeen = (): void => remember(HINT_KEY);
export const pulseSeen = (): boolean => seen(PULSE_KEY);
export const markPulseSeen = (): void => remember(PULSE_KEY);
