import type { BodyDef } from './schema';
import { pending } from './pending';

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];

/**
 * Build-time alt text for the SVG poster, derived from the objects actually shown.
 * Pass `getObjects()`. Imports pending.ts for the not-yet-confirmed Land Cruiser
 * phrase, so it must only run at build time (never in a client script).
 */
export function buildPosterAlt(shown: readonly BodyDef[]): string {
  const ids = new Set(shown.map((o) => o.id));
  const clocks = shown.filter((o) => o.id.startsWith('clock')).length;
  const parts: string[] = [];
  if (ids.has('arduino'))
    parts.push('an Arduino board with a small OLED screen');
  if (clocks > 0)
    parts.push(
      clocks === 1
        ? 'a desk clock'
        : `${NUMBER_WORDS[clocks] ?? String(clocks)} desk clocks`,
    );
  if (ids.has('calendar')) parts.push('a Nepali desk calendar');
  if (ids.has('ghost')) parts.push('a Pac-Man ghost');
  // Candidate phrase: only when the cruiser is in the shown set (confirmed or preview build).
  if (ids.has('cruiser')) parts.push(pending.candidates.cruiserAltPhrase);
  const list =
    parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
      : (parts[0] ?? 'nothing');
  return `Line drawing of ${list} laid out on blueprint paper.`;
}
