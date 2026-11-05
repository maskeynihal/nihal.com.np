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
    await expect(toggle(page)).toContainText('blue');
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
    await expect(toggle(page)).toContainText('paper');
    await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
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
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(
      'blue',
    );
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
