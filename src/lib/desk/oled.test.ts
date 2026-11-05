import { describe, expect, it } from 'vitest';
import {
  OLED_HEIGHT,
  OLED_PAGE_TICKS,
  OLED_WIDTH,
  TRUCK,
  bits,
  frame,
  oledText,
  toAscii,
} from './oled';

describe('OLED frame(n)', () => {
  it('is 128 x 64 RGBA', () => {
    const f = frame(0);
    expect([f.width, f.height]).toEqual([OLED_WIDTH, OLED_HEIGHT]);
    expect(f.data).toHaveLength(OLED_WIDTH * OLED_HEIGHT * 4);
    for (let i = 3; i < f.data.length; i += 4) expect(f.data[i]).toBe(255);
  });

  it('is pure: the same tick gives the same bytes', () => {
    expect(Array.from(frame(5).data)).toEqual(Array.from(frame(5).data));
    expect(Array.from(frame(5).data)).not.toEqual(Array.from(frame(6).data));
  });

  it('cycles WATER, AIR and RH, then wraps', () => {
    const at = (n: number) => oledText(n).label;
    expect(at(0)).toBe('WATER');
    expect(at(OLED_PAGE_TICKS - 1)).toBe('WATER');
    expect(at(OLED_PAGE_TICKS)).toBe('AIR');
    expect(at(OLED_PAGE_TICKS * 2)).toBe('RH');
    expect(at(OLED_PAGE_TICKS * 3)).toBe('WATER');
    expect(oledText(0).value).toBe('18.4C');
    expect(oledText(OLED_PAGE_TICKS).value).toBe('21.1C');
    expect(oledText(OLED_PAGE_TICKS * 2).value).toBe('54%');
  });

  it('the truck sprite is a clean 22 x 10 rectangle of rows', () => {
    expect(TRUCK).toHaveLength(10);
    for (const row of TRUCK) expect(row).toHaveLength(22);
  });

  it('keeps every lit pixel inside the screen and the truck wraps around', () => {
    for (let n = 0; n < 40; n++)
      expect(bits(n)).toHaveLength(OLED_WIDTH * OLED_HEIGHT);
    const truckRows = (n: number) =>
      Array.from(bits(n).slice(53 * OLED_WIDTH)).some(Boolean);
    expect(truckRows(0)).toBe(false); // starts off the left edge
    expect(truckRows(5)).toBe(true);
    expect([...Array(30).keys()].some((n) => !truckRows(n + 20))).toBe(true);
  });

  it('snapshot: first page, no truck yet', () => {
    expect(toAscii(frame(0))).toMatchSnapshot();
  });

  it('snapshot: second page with the truck on screen', () => {
    expect(toAscii(frame(OLED_PAGE_TICKS + 3))).toMatchSnapshot();
  });

  it('snapshot: third page', () => {
    expect(toAscii(frame(OLED_PAGE_TICKS * 2 + 1))).toMatchSnapshot();
  });
});
