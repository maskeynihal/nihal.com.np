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

let probe: HTMLElement | null = null;

/** Reads a colour token from the document so the canvas can never drift from the theme. The value is
 *  resolved through a probe element, so `rgb(255 255 255 / 0.85)` and `color-mix()` come back as a
 *  plain `rgb()` / `rgba()` string three.js can parse. */
export function readToken(name: TokenName): string {
  if (typeof document === 'undefined') return FALLBACK[name];
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (raw === '') return FALLBACK[name];
  if (!probe) {
    probe = document.createElement('span');
    probe.hidden = true;
    document.documentElement.appendChild(probe);
  }
  probe.style.color = '';
  probe.style.color = `var(${name})`;
  const resolved = getComputedStyle(probe).color;
  if (resolved === '') return raw;
  // three.js warns about (and ignores) an alpha component: hand it plain `rgb()`.
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(resolved);
  return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : resolved;
}

/** Window event the theme toggle dispatches after changing `data-theme` (`detail.theme`). */
export const THEME_EVENT = 'nihal:theme';
