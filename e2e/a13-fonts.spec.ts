import { test, expect } from './fixtures';

// No font preloads (engines disagree on crossorigin). Each woff2 must still download exactly once
// per page load, fonts must actually load, and a slow font must not shift layout.
test.describe('font loading without preloads @A-13', () => {
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
      const loaded = await page.evaluate(async () => {
        await document.fonts.ready;
        await document.fonts.load('16px Fraunces');
        await document.fonts.load('12px "JetBrains Mono"');
        return [
          document.fonts.check('16px Fraunces'),
          document.fonts.check('12px "JetBrains Mono"'),
        ];
      });
      await page.waitForTimeout(6000);
      expect(loaded, 'Fraunces and JetBrains Mono loaded').toEqual([
        true,
        true,
      ]);
      expect(woff2.length).toBeGreaterThan(0);
      expect(
        woff2.filter((u, i) => woff2.indexOf(u) !== i),
        'woff2 requested more than once',
      ).toEqual([]);
      expect(preloadWarnings).toEqual([]);
    });

  test('/ has zero layout shift with woff2 delayed 400 ms @A-13', async ({
    page,
    javaScriptEnabled,
  }, testInfo) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'layout-shift entries are only asserted in desktop-chromium',
    );
    await page.route('**/*.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!e.hadRecentInput)
            (window as unknown as { __cls: number }).__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    expect(cls).toBe(0);
  });
});
