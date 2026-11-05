import { test, expect } from './fixtures';

test('home loads @A-08', async ({ page, javaScriptEnabled }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('nihal maskey');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle(
    'Nihal Maskey · Lead Software Engineer in Kathmandu, Nepal',
  );

  const noOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
  );
  expect(noOverflow).toBe(true);

  if (javaScriptEnabled) {
    await page.waitForFunction(() => window.__hooks?.ready === true);
    expect(await page.evaluate(() => window.__hooks?.ready)).toBe(true);
  }
});
