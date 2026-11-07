import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

// v3.3 T4 and T5: the phone table fits the sheet, and the phone desk has fewer objects.
// The live canvas needs SwiftShader, so those tests run in desktop-chromium at phone widths.

const figure = (page: Page) => page.locator('[data-desk]');
const ALL = [
  'arduino',
  'clock-ktm',
  'calendar',
  'ghost',
  'laptop',
  'ball-s',
  'ball-m',
  'ball-l',
  'pacman-1',
  'pacman-2',
  'letter-n',
  'letter-i',
  'letter-h',
  'letter-a',
  'letter-l',
];
const PHONE = [
  'arduino',
  'clock-ktm',
  'calendar',
  'ghost',
  'laptop',
  'ball-m',
  'ball-l',
  'pacman-1',
];

const present = (page: Page) =>
  page.evaluate(
    (ids) => ids.filter((id) => window.__hooks!.desk!.scene!.pick(id) !== null),
    ALL,
  );

const overflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

/** The table's box must sit inside the sheet border (the page minus the border inset). */
const frameInsideSheet = (page: Page) =>
  page.evaluate(() => {
    const r = document.querySelector('[data-desk]')!.getBoundingClientRect();
    const inset = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--inset'),
    );
    return {
      left: r.left,
      right: document.documentElement.clientWidth - r.right,
      inset,
    };
  });

test.describe('phone table @V3-3-table', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const width of [360, 390, 402]) {
    test(`at ${width} px the whole table is inside the sheet and only the phone objects exist @V3-3-table`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await figure(page).scrollIntoViewIfNeeded();
      await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
        timeout: 45_000,
      });
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const f = await frameInsideSheet(page);
      expect(f.left).toBeGreaterThanOrEqual(f.inset);
      expect(f.right).toBeGreaterThanOrEqual(f.inset);
      // The poster frame and the canvas share one box: no jump from poster to live.
      const frame = (await page.locator('.poster-frame').boundingBox())!;
      const live = (await page.locator('.desk-live').boundingBox())!;
      expect(Math.abs(frame.width - live.width)).toBeLessThan(0.5);
      expect(Math.abs(frame.height - live.height)).toBeLessThan(0.5);
      // Fewer objects: the small ball, the second pac-man and the letters are not drawn.
      expect((await present(page)).sort()).toEqual([...PHONE].sort());
      await expectNoAxeViolations(page, { label: `/ phone table ${width}` });
    });
  }

  test('crossing 768 px swaps the table and the object set without errors @V3-3-table', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    expect((await present(page)).sort()).toEqual([...ALL].sort());
    await expect(page.locator('.poster-wide')).toBeHidden();
    // Rotate to portrait phone: the Scene is rebuilt for it.
    await page.setViewportSize({ width: 390, height: 800 });
    await expect
      .poll(async () => (await present(page).catch(() => [])).length, {
        timeout: 45_000,
      })
      .toBe(PHONE.length);
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // And back: everything returns.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect
      .poll(async () => (await present(page).catch(() => [])).length, {
        timeout: 45_000,
      })
      .toBe(ALL.length);
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
  });

  for (const width of [320, 390, 402]) {
    test(`the phone poster at ${width} px fits and is the one that is shown @V3-3-table`, async ({
      page,
      javaScriptEnabled,
    }, info) => {
      test.skip(!javaScriptEnabled, 'needs the page');
      test.skip(
        info.project.name !== 'reduced-motion',
        'poster only, any browser',
      );
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      await expect(page.locator('svg.poster-phone')).toBeVisible();
      await expect(page.locator('svg.poster-wide')).toBeHidden();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const svg = (await page.locator('svg.poster-phone').boundingBox())!;
      const f = await frameInsideSheet(page);
      expect(svg.x).toBeGreaterThanOrEqual(f.inset);
      expect(svg.x + svg.width).toBeLessThanOrEqual(width - f.inset);
      // One accessible drawing, not two.
      await expect(
        page.getByRole('img', { name: /^Line drawing/ }),
      ).toHaveCount(1);
      await expectNoAxeViolations(page, { label: `/ phone poster ${width}` });
    });
  }
});
