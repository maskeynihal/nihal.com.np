import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const figure = (page: Page) => page.locator('[data-desk]');
const ticks = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.oledTicks());

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}

const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => h,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

test.describe('OLED texture @E-03', () => {
  test.describe.configure({ timeout: 120_000 });

  test('the OLED ticks every 500 ms while visible and stops when the tab is hidden @E-03', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await goLive(page);
    const t0 = await ticks(page);
    await expect.poll(() => ticks(page)).toBeGreaterThanOrEqual(t0 + 2);

    await setHidden(page, true);
    await page.waitForTimeout(100);
    const frozen = await ticks(page);
    await page.waitForTimeout(1400);
    expect(await ticks(page)).toBe(frozen);

    await setHidden(page, false);
    await expect.poll(() => ticks(page)).toBeGreaterThan(frozen);
  });

  test('the shown text cycles water, air and humidity values @E-03', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await goLive(page);
    const seen = new Set<string>();
    await expect
      .poll(
        async () => {
          seen.add(
            await page.evaluate(() => window.__hooks!.desk!.scene!.oledText()),
          );
          return seen.size;
        },
        { timeout: 20_000, intervals: [400] },
      )
      .toBe(3);
    expect([...seen].sort()).toEqual(['AIR 21.1C', 'RH 54%', 'WATER 18.4C']);
  });

  test('the "demo values" caption is DOM text under the screen, shown with the canvas @E-03', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const caption = page.locator('[data-oled-caption]');
    await expect(caption).toHaveText('demo values');
    await expect(caption).toBeHidden();
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    await expect(caption).toBeVisible();
    // It sits inside the drawing, near the middle where the Arduino is.
    const box = (await caption.boundingBox())!;
    const frame = (await page.locator('.desk-live').boundingBox())!;
    expect(box.x).toBeGreaterThan(frame.x + frame.width * 0.3);
    expect(box.x + box.width).toBeLessThan(frame.x + frame.width * 0.7);
    expect(box.y).toBeGreaterThan(frame.y + frame.height * 0.3);
    expect(box.y + box.height).toBeLessThan(frame.y + frame.height);
    await expectNoAxeViolations(page, { label: '/ OLED caption' });
  });

  test('no ticks run without the canvas (reduced motion, no WebGL) @E-03', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(
      !javaScriptEnabled ||
        !['reduced-motion', 'no-webgl'].includes(info.project.name),
      'poster-only projects',
    );
    await page.goto('/');
    await page.waitForTimeout(1800);
    expect(
      await page.evaluate(() => window.__hooks?.desk?.scene),
    ).toBeUndefined();
  });
});
