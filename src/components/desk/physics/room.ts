import { floorPad, sidePads } from '../../../lib/desk/fall';

/**
 * Where the fall layer's room sits inside the viewport, in px from each edge: the sheet border's
 * inner edge (plus the index strip below the floor at phone and tablet widths) and, from 1024 px,
 * the right margin the reset button occupies. Read from the page's own tokens and the button's
 * box, so the room follows the CSS rather than a copy of it. Not cached: the button's place
 * depends on the viewport, and this runs when the room is built (see `roomPadsAt` for the cached one).
 */
export function readRoomPads(vw: number): {
  bottom: number;
  left: number;
  right: number;
} {
  const css = getComputedStyle(document.documentElement);
  const px = (name: string, fallback: number) => {
    const n = parseFloat(css.getPropertyValue(name));
    return Number.isFinite(n) ? n : fallback;
  };
  const inset = px('--inset', 12);
  const reset = document.querySelector('[data-desk-reset]');
  const resetLeft = reset ? reset.getBoundingClientRect().left : null;
  const sides = sidePads(vw, inset, resetLeft);
  return {
    bottom: floorPad(vw, inset, px('--strip-h', 44)),
    left: sides.left,
    right: sides.right,
  };
}

let cachedFor = -1;
let cached: ReturnType<typeof readRoomPads> | null = null;

/** `readRoomPads`, remembered per viewport width: for code that asks every step. */
export function roomPadsAt(vw: number): ReturnType<typeof readRoomPads> {
  if (cached === null || cachedFor !== vw) {
    cached = readRoomPads(vw);
    cachedFor = vw;
  }
  return cached;
}
