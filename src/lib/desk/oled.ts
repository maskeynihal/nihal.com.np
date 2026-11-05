/**
 * The Arduino's 1.3" OLED (design 4.1): a 128 x 64 frame drawn with a 5 x 7 pixel font, cycling
 * "WATER 18.4C", "AIR 21.1C" and "RH 54%" with the off-road truck from the car-sensors post
 * driving along the bottom. Demo values (the DOM says so). `frame(n)` is pure: the same tick
 * number always gives the same pixels, so it is snapshot-tested and needs no canvas.
 */
export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
/** Milliseconds per tick (2 fps). */
export const OLED_TICK_MS = 500;
/** Ticks each page stays up (3 s). */
export const OLED_PAGE_TICKS = 6;

export interface OledFrame {
  width: number;
  height: number;
  /** RGBA, row-major, `width * height * 4` bytes. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

export interface OledPalette {
  background: readonly [number, number, number];
  ink: readonly [number, number, number];
}

/** --blue-ink behind white pixels, as in the prototype. */
export const OLED_PALETTE: OledPalette = {
  background: [10, 28, 107],
  ink: [255, 255, 255],
};

/** 5 x 7 glyphs, one 5-bit row per byte, bit 4 = left column. Only what the pages need. */
const FONT: Readonly<Record<string, readonly number[]>> = {
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 0x0c, 0x0c],
  '%': [0x18, 0x19, 0x02, 0x04, 0x08, 0x13, 0x03],
  '-': [0, 0, 0, 0x1f, 0, 0, 0],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a],
};

/** The truck: 22 x 10, '#' is lit. */
export const TRUCK: readonly string[] = [
  '......##########......',
  '......#...##...#......',
  '......#...##...#......',
  '..##################..',
  '.####################.',
  '.####################.',
  '..##################..',
  '...####......####.....',
  '...#..#......#..#.....',
  '...####......####.....',
];

const PAGES = [
  { label: 'WATER', value: '18.4C' },
  { label: 'AIR', value: '21.1C' },
  { label: 'RH', value: '54%' },
] as const;

export const oledPageCount = PAGES.length;

/** Text shown on the page at tick `n` (also what the e2e hook reports). */
export function oledText(n: number): { label: string; value: string } {
  const page =
    PAGES[Math.floor(Math.max(0, n) / OLED_PAGE_TICKS) % PAGES.length];
  return page ?? PAGES[0];
}

function plot(px: Uint8Array, x: number, y: number): void {
  if (x < 0 || y < 0 || x >= OLED_WIDTH || y >= OLED_HEIGHT) return;
  px[y * OLED_WIDTH + x] = 1;
}

function drawText(
  px: Uint8Array,
  text: string,
  x: number,
  y: number,
  scale: number,
): void {
  let cx = x;
  for (const ch of text) {
    const rows = FONT[ch] ?? FONT[' '] ?? [];
    rows.forEach((bits, r) => {
      for (let c = 0; c < 5; c++) {
        if (bits & (1 << (4 - c)))
          for (let dy = 0; dy < scale; dy++)
            for (let dx = 0; dx < scale; dx++)
              plot(px, cx + c * scale + dx, y + r * scale + dy);
      }
    });
    cx += 6 * scale;
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

/** The 1-bit image at tick `n` (1 = lit). */
export function bits(n: number): Uint8Array {
  const px = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);
  const { label, value } = oledText(n);
  drawText(px, label, 4, 4, 1);
  // A 1 px rule under the label, like a status bar.
  for (let x = 4; x < OLED_WIDTH - 4; x++) plot(px, x, 14);
  drawText(
    px,
    value,
    Math.round((OLED_WIDTH - textWidth(value, 3)) / 2),
    20,
    3,
  );
  // The truck drives left to right along the bottom, wrapping once it has left the screen.
  const span = OLED_WIDTH + TRUCK[0]!.length;
  const tx = ((n * 6) % span) - TRUCK[0]!.length;
  TRUCK.forEach((row, r) => {
    for (let c = 0; c < row.length; c++)
      if (row[c] === '#') plot(px, tx + c, 53 + r);
  });
  return px;
}

/** Tick `n` as RGBA pixels. Pure. */
export function frame(
  n: number,
  palette: OledPalette = OLED_PALETTE,
): OledFrame {
  const lit = bits(n);
  const data = new Uint8ClampedArray(OLED_WIDTH * OLED_HEIGHT * 4);
  for (let i = 0; i < lit.length; i++) {
    const [r, g, b] = lit[i] ? palette.ink : palette.background;
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width: OLED_WIDTH, height: OLED_HEIGHT, data };
}

/** Test aid: the frame as text, '#' for lit pixels. */
export function toAscii(
  f: OledFrame,
  palette: OledPalette = OLED_PALETTE,
): string {
  const lines: string[] = [];
  for (let y = 0; y < f.height; y++) {
    let line = '';
    for (let x = 0; x < f.width; x++) {
      const i = (y * f.width + x) * 4;
      line += f.data[i] === palette.ink[0] ? '#' : '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}
