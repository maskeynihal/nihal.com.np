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

/**
 * The site's motion tokens (`--ease-out`, `--ease-in-out` and the 160 / 240 / 360 ms durations in
 * `styles/tokens.css`), for the code that animates in JS: hover, reactions, the calm transitions.
 */
export const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
export const DURATION_FAST = 160;
export const DURATION_BASE = 240;
export const DURATION_SLOW = 360;

/** The ease-out curve as a function of progress 0..1 (what `EASE_OUT` draws). Pure. */
export function easeOut(u: number): number {
  const x = Math.min(Math.max(u, 0), 1);
  // cubic-bezier(0.22, 1, 0.36, 1) solved for x by bisection, y read off
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    const bx =
      3 * (1 - t) * (1 - t) * t * 0.22 + 3 * (1 - t) * t * t * 0.36 + t * t * t;
    if (bx < x) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return 3 * (1 - t) * (1 - t) * t + 3 * (1 - t) * t * t + t * t * t;
}
