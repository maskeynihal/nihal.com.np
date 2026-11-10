import { describe, expect, it } from 'vitest';
import { EGGS, KONAMI, feedCode } from './eggs';
import { localDate } from './calendar';

describe('the drawer', () => {
  it('has four or five finds, each with plain words and no exclamation mark', () => {
    expect(EGGS.length).toBeGreaterThanOrEqual(4);
    expect(EGGS.length).toBeLessThanOrEqual(5);
    for (const e of EGGS) {
      expect(e.say.length).toBeGreaterThan(5);
      expect(e.say).not.toMatch(/[!—]/);
      for (const l of e.lines) expect(l).not.toMatch(/[!—]/);
      if (e.href) expect(e.href).toMatch(/^https:\/\//);
    }
    expect(EGGS[0]?.say).toMatch(/thank you for visiting/i);
    // each find is a different thing that comes out
    expect(new Set(EGGS.map((e) => e.item)).size).toBe(EGGS.length);
    for (const e of EGGS) if (e.tap) expect(e.tap).not.toMatch(/[!—]/);
  });

  it('matches the sticky note code, and starts again after a slip', () => {
    let progress = 0;
    let done = false;
    for (const k of KONAMI) {
      const r = feedCode(KONAMI, progress, k);
      progress = r.progress;
      done = r.done;
    }
    expect(done).toBe(true);
    // a wrong key resets, unless it is the first key of the code
    expect(feedCode(KONAMI, 3, 'x')).toEqual({ progress: 0, done: false });
    expect(feedCode(KONAMI, 3, 'ArrowUp')).toEqual({
      progress: 1,
      done: false,
    });
    // letters are matched in either case
    expect(feedCode(KONAMI, 8, 'B').progress).toBe(9);
    expect(feedCode(['b'], 0, 'B').done).toBe(true);
  });
});

describe('the calendar', () => {
  it("shows the visitor's own day, weekday and month", () => {
    const d = localDate(new Date(2026, 10, 8, 12, 0, 0));
    expect(d.day).toBe('8');
    expect(d.weekday).toBe('sunday');
    expect(d.monthYear).toBe('november 2026');
  });
});
