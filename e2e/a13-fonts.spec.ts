import { test, expect } from './fixtures';

// Each woff2 must download once per page load: the preload has to be the request @font-face reuses.
test.describe('font preloads @A-13', () => {
  test.setTimeout(60_000);
  for (const path of ['/', '/404.html', '/sent/'])
    test(`${path} requests each woff2 once with no unused-preload warning @A-13`, async ({
      page,
      javaScriptEnabled,
    }) => {
      test.skip(!javaScriptEnabled, 'document.fonts needs JS');
      const woff2: string[] = [];
      const preloadWarnings: string[] = [];
      page.on('request', (r) => {
        if (r.url().endsWith('.woff2')) woff2.push(r.url());
      });
      page.on('console', (m) => {
        if (/preload/i.test(m.text()) && /not used|unused/i.test(m.text()))
          preloadWarnings.push(m.text());
      });
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(6000);
      expect(woff2.length).toBeGreaterThan(0);
      expect(
        woff2.filter((u, i) => woff2.indexOf(u) !== i),
        'woff2 requested more than once',
      ).toEqual([]);
      expect(preloadWarnings).toEqual([]);
    });
});
