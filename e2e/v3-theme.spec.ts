import { test, expect, expectNoAxeViolations } from './fixtures';

const KEY = 'nihal:theme';
const html = (page: import('@playwright/test').Page) => page.locator('html');
const toggle = (page: import('@playwright/test').Page) =>
  page.locator('[data-theme-toggle]').first();

test.describe('theme toggle @V3-theme', () => {
  test('the toggle switches blue and paper, persists, and fires nihal:theme @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'blue');
    // A real switch named "light mode"; checked means the paper theme.
    await expect(toggle(page)).toHaveAttribute('role', 'switch');
    await expect(
      page.getByRole('switch', { name: 'light mode' }),
    ).toHaveAttribute('aria-checked', 'false');
    const heard = page.evaluate(
      () =>
        new Promise<string>((resolve) =>
          window.addEventListener(
            'nihal:theme',
            (e) => resolve((e as CustomEvent<{ theme: string }>).detail.theme),
            { once: true },
          ),
        ),
    );
    await toggle(page).click();
    expect(await heard).toBe('paper');
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'true');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(
      'paper',
    );
    expect(
      await page.locator('meta[name="theme-color"]').getAttribute('content'),
    ).toMatch(/^#f6f5f1$/i);
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe('rgb(246, 245, 241)');
    await toggle(page).click();
    await expect(html(page)).toHaveAttribute('data-theme', 'blue');
    await expect(toggle(page)).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(
      'blue',
    );
  });

  test('the switch never overlaps the title block text or the table, down to 320 px @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(toggle(page)).toBeVisible();
      const sw = (await toggle(page).boundingBox())!;
      const hit = (b: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) =>
        sw.x < b.x + b.width &&
        sw.x + sw.width > b.x &&
        sw.y < b.y + b.height &&
        sw.y + sw.height > b.y;
      // The text of the title block (name, kicker, sentence) and the drawing.
      for (const sel of [
        '.title-block .name',
        '.title-block-kicker',
        '.title-block-line',
        '[data-poster]',
      ]) {
        const b = (await page.locator(sel).first().boundingBox())!;
        expect(hit(b), `${sel} at ${width}`).toBe(false);
      }
    }
  });

  test('a stored choice is applied before first paint: no flash @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript((k) => localStorage.setItem(k, 'paper'), KEY);
    await page.addInitScript(() => {
      const w = window as unknown as { __themeAtBody: string | null };
      w.__themeAtBody = null;
      const mo = new MutationObserver(() => {
        if (document.body && w.__themeAtBody === null) {
          w.__themeAtBody = document.documentElement.dataset['theme'] ?? '';
          mo.disconnect();
        }
      });
      mo.observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __themeAtBody: string | null }).__themeAtBody,
      ),
    ).toBe('paper');
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');
  });

  test.describe('follows the OS until chosen', () => {
    test.use({ colorScheme: 'light' });
    test('light OS gives paper; a stored blue wins @V3-theme', async ({
      page,
      javaScriptEnabled,
    }) => {
      test.skip(!javaScriptEnabled, 'needs JS');
      await page.goto('/');
      await expect(html(page)).toHaveAttribute('data-theme', 'paper');
      await page.evaluate((k) => localStorage.setItem(k, 'blue'), KEY);
      await page.reload();
      await expect(html(page)).toHaveAttribute('data-theme', 'blue');
    });
  });

  test('paper theme has no axe violations, with the desk and the open table of contents @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript((k) => localStorage.setItem(k, 'paper'), KEY);
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');
    await expectNoAxeViolations(page, { label: '/ paper theme' });
    await page.locator('#work').scrollIntoViewIfNeeded();
    await expectNoAxeViolations(page, { label: '/ paper theme, work' });
    await page.locator('#colophon').scrollIntoViewIfNeeded();
    await expectNoAxeViolations(page, { label: '/ paper theme, colophon' });
  });
});
