/**
 * What is in the drawer. Each time it is opened it shows the next of these, in order, and says it
 * in the page (a status toast, so a screen reader hears it too). Plain data, no three.js.
 *
 *  - `item`: what comes out of the tray and how it is drawn (`finds.ts`, `Workstation.tsx`): the
 *    paper card with `lines` on it, the rubber duck (squeaks when sound is on), the sticky note that
 *    sticks to the monitor, the floppy disk, the fortune cookie.
 *  - `say`: the sentence for the toast and the status line. `href` adds a link to it.
 */
export interface Egg {
  item: 'card' | 'duck' | 'note' | 'floppy' | 'cookie';
  lines: string[];
  say: string;
  /** Said when the find itself is tapped (the cookie cracks, the duck squeaks, the floppy opens its link). */
  tap?: string;
  href?: string;
  linkLabel?: string;
}

export const EGGS: readonly Egg[] = [
  {
    item: 'card',
    lines: ['thank you', 'for visiting'],
    say: 'Thank you for visiting.',
  },
  {
    item: 'duck',
    lines: [],
    say: 'A rubber duck. It has heard every bug. Tap it.',
    tap: 'Squeak.',
  },
  {
    item: 'note',
    lines: ['up up down down', 'left right left right', 'b a'],
    say: 'A sticky note: up, up, down, down, left, right, left, right, b, a. Try it on the keyboard.',
  },
  {
    item: 'floppy',
    lines: ['floppy disk', 'v1 of this site'],
    say: 'A floppy disk marked v1 of this site. Tap it to open the old site.',
    tap: 'Opening v1 of this site.',
    href: 'https://v1.nihal.com.np',
    linkLabel: 'v1.nihal.com.np',
  },
  {
    item: 'cookie',
    lines: ['fortune', 'it works on', 'my machine'],
    say: 'A fortune cookie. Tap it to crack it open.',
    tap: 'The fortune says: it works on my machine.',
  },
];

/** The code on the sticky note, as `KeyboardEvent.key` values (letters lower case). */
export const KONAMI: readonly string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/** Feeds one key to a code matcher: returns the new progress, and whether the code is complete. */
export function feedCode(
  code: readonly string[],
  progress: number,
  key: string,
): { progress: number; done: boolean } {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k === code[progress]) {
    const next = progress + 1;
    return next === code.length
      ? { progress: 0, done: true }
      : { progress: next, done: false };
  }
  // a wrong key may still be the start of the code
  return { progress: k === code[0] ? 1 : 0, done: false };
}
