/** Fallbacks for the blue theme; `readToken` prefers the live custom property. */
const FALLBACK = {
  '--blue': '#1f3fe0',
  '--blue-ink': '#0a1c6b',
  '--paper': '#f6f5f1',
  '--line-2': '#ded9fa',
  '--white': '#ffffff',
  '--page': '#1f3fe0',
  '--ink': '#ffffff',
  '--stroke': '#ffffff',
} as const;

export type TokenName = keyof typeof FALLBACK;

/** Reads a colour token from the document so the canvas can never drift from the theme. */
export function readToken(name: TokenName): string {
  if (typeof document === 'undefined') return FALLBACK[name];
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v === '' ? FALLBACK[name] : v;
}

/** Window event the theme toggle dispatches after changing `data-theme` (`detail.theme`). */
export const THEME_EVENT = 'nihal:theme';
