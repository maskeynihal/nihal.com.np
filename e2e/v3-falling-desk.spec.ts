import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

// The falling desk (v3 WS2): a fixed full-viewport canvas, window-level grab, screen-space physics.
// Needs SwiftShader, so desktop-chromium only.

const figure = (page: Page) => page.locator('[data-desk]');
const reset = (page: Page) => page.locator('[data-desk-reset]');

async function goLive(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
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

  test('an object dropped off the table falls to the bottom of the viewport; put everything back resets @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    const home = (await where(page, 'ball-m'))!;
    // Nothing is free: the button is hidden.
    await expect(reset(page)).toBeHidden();

    // Carry it well off the table (the right margin, high up) and let go.
    await carry(page, 'ball-m', 1230, 300);
    await page.mouse.up();
    await expect(reset(page)).toBeVisible({ timeout: 10_000 });

    const vh = page.viewportSize()!.height;
    await expect
      .poll(
        async () => {
          const p = await where(page, 'ball-m');
          return p ? p.y : 0;
        },
        { timeout: 30_000 },
      )
      .toBeGreaterThan(vh - 150);
    await expect
      .poll(async () => (await physics(page)).bodies.every((b) => b.asleep), {
        timeout: 30_000,
      })
      .toBe(true);
    const rest = (await where(page, 'ball-m'))!;
    expect(rest.y).toBeLessThanOrEqual(vh);
    expect(rest.x).toBeGreaterThan(0);
    expect(rest.x).toBeLessThan(1280);
    await expectNoAxeViolations(page, { label: '/ desk with a fallen object' });

    // The button (44 px target) puts it back where it started.
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

  test('the page underneath stays clickable and scrollable, the R key resets, and free objects stay on screen while scrolling @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    // A click on a page control works through the full-screen canvas.
    await page.getByRole('button', { name: 'theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
    await page.getByRole('button', { name: 'theme' }).click();

    await carry(page, 'ball-l', 1220, 250);
    await page.mouse.up();
    const vh = page.viewportSize()!.height;
    await expect
      .poll(async () => (await where(page, 'ball-l'))!.y, { timeout: 30_000 })
      .toBeGreaterThan(vh - 150);
    // Scroll one screen: the table leaves, the fallen ball stays near the bottom of the screen.
    await page.mouse.wheel(0, vh);
    await page.waitForTimeout(1500);
    const p = (await where(page, 'ball-l'))!;
    expect(p.y).toBeGreaterThan(vh * 0.5);
    expect(p.y).toBeLessThanOrEqual(vh);
    // Back up and press R: everything returns.
    await page.mouse.wheel(0, -vh);
    await page.waitForTimeout(500);
    await page.keyboard.press('r');
    await expect(reset(page)).toBeHidden({ timeout: 10_000 });
  });

  test('the button hides again once everything rests on the table @V3-desk', async ({
    page,
  }) => {
    await goLive(page);
    const home = (await where(page, 'ball-s'))!;
    // Lift it a little and drop it back onto the table, near where it was.
    await carry(page, 'ball-s', home.x + 40, home.y - 30);
    await page.mouse.up();
    await expect
      .poll(async () => (await physics(page)).bodies.every((b) => b.asleep), {
        timeout: 30_000,
      })
      .toBe(true);
    await expect(reset(page)).toBeHidden({ timeout: 10_000 });
  });
});
