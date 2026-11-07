import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

// The desk (v3.1): the table canvas is in the page flow; an object pushed off the rim is handed to a
// fixed full-viewport fall canvas and settles on the bottom edge of the screen.
// Needs SwiftShader, so desktop-chromium only.

const figure = (page: Page) => page.locator('[data-desk]');
const reset = (page: Page) => page.locator('[data-desk-reset]');

async function goLive(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
  await figure(page).locator('canvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
}

const where = (page: Page, id: string) =>
  page.evaluate((i) => window.__hooks!.desk!.scene!.pick(i), id);
const physics = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.physics());

/** Presses an object (pointer events on the page, not on any canvas) and carries it to (x, y). */
async function carry(page: Page, id: string, x: number, y: number) {
  const o = (await where(page, id))!;
  await page.mouse.move(o.x, o.y);
  await page.mouse.down();
  await page.mouse.move(o.x + 14, o.y - 8, { steps: 3 });
  await expect
    .poll(async () => (await physics(page)).grabbed, { timeout: 30_000 })
    .toBe(id);
  await page.mouse.move(x, y, { steps: 10 });
  return o;
}

test.describe('falling desk @V3-desk', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });
  test.describe.configure({ timeout: 120_000 });

  const fall = (page: Page) =>
    page.evaluate(() => window.__hooks!.desk!.scene!.fall());

  test('an object pushed off the rim is handed off and ends on the bottom edge of the screen; put everything back resets @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    const home = (await where(page, 'ball-m'))!;
    await expect(reset(page)).toBeHidden();

    // Carry it past the table's right edge and let go.
    const vw = page.viewportSize()!.width;
    await carry(page, 'ball-m', vw - 50, home.y - 40);
    await page.mouse.up();
    await expect(reset(page)).toBeVisible({ timeout: 10_000 });

    // It was handed to the fall layer in one swap: same picture either side.
    await expect
      .poll(async () => (await fall(page)).state, { timeout: 30_000 })
      .toBe('ready');
    const log = (await page.evaluate(() =>
      window.__hooks!.desk!.scene!.handoffs(),
    )) as { id: string; dir: string; errPx: number }[];
    const down = log.find((h) => h.id === 'ball-m' && h.dir === 'down');
    expect(down, 'a handoff to the fall layer').toBeTruthy();
    expect(down!.errPx).toBeLessThan(6);

    await expect
      .poll(async () => (await fall(page)).bodies.every((b) => b.asleep), {
        timeout: 45_000,
      })
      .toBe(true);
    const vh = page.viewportSize()!.height;
    const b = (await fall(page)).bodies.find((x) => x.id === 'ball-m')!;
    // Rests on the bottom edge of the screen: the silhouette is within 30 px of it.
    const bottom = b.rect!.y + b.rect!.h;
    // The floor is the sheet border's inner edge (24 px on desktop), not the screen edge itself.
    expect(vh - bottom).toBeLessThanOrEqual(34);
    expect(vh - bottom).toBeGreaterThanOrEqual(16);
    expect(b.rect!.x).toBeGreaterThan(0);
    expect(b.rect!.x + b.rect!.w).toBeLessThan(vw);
    await expectNoAxeViolations(page, { label: '/ desk with a fallen object' });

    expect((await reset(page).boundingBox())!.height).toBeGreaterThanOrEqual(
      44,
    );
    await reset(page).click();
    await expect(reset(page)).toBeHidden();
    await expect
      .poll(async () => {
        const p = (await where(page, 'ball-m'))!;
        return Math.hypot(p.x - home.x, p.y - home.y);
      })
      .toBeLessThan(3);
  });

  test('the table does not move against the page on scroll; a fallen object stays on screen; R resets @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    // The table is part of the page: its document position does not change as the page scrolls.
    const docY = async () => {
      const p = (await where(page, 'arduino'))!;
      return p.y + (await page.evaluate(() => scrollY));
    };
    const y0 = await docY();
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(400);
    expect(Math.abs((await docY()) - y0)).toBeLessThan(1.5);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(400);

    const o = (await where(page, 'ball-l'))!;
    await carry(page, 'ball-l', page.viewportSize()!.width - 50, o.y - 40);
    await page.mouse.up();
    const vh = page.viewportSize()!.height;
    await expect
      .poll(async () => (await fall(page)).bodies.every((b) => b.asleep), {
        timeout: 45_000,
      })
      .toBe(true);
    // Scroll one screen: the table leaves, the fallen ball stays on the bottom of the screen.
    await page.mouse.wheel(0, vh);
    await page.waitForTimeout(1500);
    const b = (await fall(page)).bodies.find((x) => x.id === 'ball-l')!;
    expect(vh - (b.rect!.y + b.rect!.h)).toBeLessThanOrEqual(30);
    await page.mouse.wheel(0, -vh);
    await page.waitForTimeout(500);
    await page.keyboard.press('r');
    await expect(reset(page)).toBeHidden({ timeout: 10_000 });
  });

  test('a viewport that gets shorter or taller (a phone URL bar) never cuts a resting body @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    const home = (await where(page, 'ball-m'))!;
    await carry(page, 'ball-m', page.viewportSize()!.width - 50, home.y - 40);
    await page.mouse.up();
    const settled = () =>
      expect
        .poll(async () => (await fall(page)).bodies.every((b) => b.asleep), {
          timeout: 45_000,
        })
        .toBe(true);
    await settled();
    const { width } = page.viewportSize()!;
    for (const height of [1000, 1180, 1100]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(1200);
      await settled();
      const b = (await fall(page)).bodies.find((x) => x.id === 'ball-m')!;
      const gap = height - (b.rect!.y + b.rect!.h);
      // Always above the border's inner edge (never below it), and back on the floor.
      expect(gap, `height ${height}`).toBeGreaterThanOrEqual(16);
      expect(gap, `height ${height}`).toBeLessThanOrEqual(34);
    }
  });

  test('the button hides again once everything rests on the table @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    const home = (await where(page, 'ball-s'))!;
    await carry(page, 'ball-s', home.x + 30, home.y - 20);
    await page.mouse.up();
    await expect
      .poll(async () => (await physics(page)).bodies.every((b) => b.asleep), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect(reset(page)).toBeHidden({ timeout: 10_000 });
  });
});
