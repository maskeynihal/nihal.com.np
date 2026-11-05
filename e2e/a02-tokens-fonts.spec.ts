import { test, expect } from './fixtures';

test.describe('tokens and fonts @A-02', () => {
  test('body background is the blue token', async ({ page }) => {
    await page.goto('/');
    const bg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bg).toBe('rgb(31, 63, 224)');
  });

  test('h1 resolves to Fraunces and has no Inter', async ({ page }) => {
    await page.goto('/');
    const ff = await page
      .locator('h1')
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(ff.split(',')[0]!.replace(/['"]/g, '').trim()).toBe('Fraunces');
    expect(ff.toLowerCase()).not.toContain('inter');
  });

  test('no requests to Google Fonts', async ({ page }) => {
    const bad: string[] = [];
    page.on('request', (r) => {
      if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(r.url()))
        bad.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(bad).toEqual([]);
    const html = await page.content();
    expect(html).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  test('both font files are preloaded with crossorigin', async ({ page }) => {
    await page.goto('/');
    const links = await page
      .locator('link[rel="preload"][as="font"]')
      .evaluateAll((els) =>
        els.map((e) => ({
          href: e.getAttribute('href'),
          type: e.getAttribute('type'),
          cross: e.hasAttribute('crossorigin'),
        })),
      );
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.href).join()).toMatch(
      /fraunces-.*jetbrains-mono-/,
    );
    for (const l of links) {
      expect(l.type).toBe('font/woff2');
      expect(l.cross).toBe(true);
    }
  });

  test('Fraunces and JetBrains Mono load', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const res = await page.evaluate(async () => {
      await document.fonts.ready;
      await document.fonts.load('16px Fraunces');
      await document.fonts.load('12px "JetBrains Mono"');
      return [
        document.fonts.check('16px Fraunces'),
        document.fonts.check('12px "JetBrains Mono"'),
      ];
    });
    expect(res).toEqual([true, true]);
  });

  test('focus ring is visible on the link after Tab', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'keyboard focus is a desktop path');
    await page.goto('/');
    const link = page.locator('a[href^="mailto:"]');
    // The A-03 preference toggles precede the link in tab order.
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      if (await link.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(link).toBeFocused();
    const o = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        focusVisible: el.matches(':focus-visible'),
        width: parseFloat(s.outlineWidth),
        style: s.outlineStyle,
        color: s.outlineColor,
      };
    });
    expect(o.focusVisible).toBe(true);
    expect(o.width).toBeGreaterThanOrEqual(2);
    expect(o.style).toBe('solid');
    // inside .paper the ring is --blue
    expect(o.color).toBe('rgb(31, 63, 224)');
  });

  test('CLS is 0 on load', async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript(() => {
      (window as unknown as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[]) {
          if (!e.hadRecentInput)
            (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    expect(cls).toBe(0);
  });

  test('no horizontal scroll at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    const ok = await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    );
    expect(ok).toBe(true);
  });

  test('reduced motion caps transition duration', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(info.project.name !== 'reduced-motion', 'reduced-motion only');
    await page.goto('/');
    const probe = page.locator('#motion-probe');
    test.skip(
      (await probe.count()) === 0,
      'probe exists in test-hooks builds only',
    );
    const d = await probe.evaluate(
      (el) => getComputedStyle(el).transitionDuration,
    );
    for (const part of d.split(',')) {
      expect(parseFloat(part)).toBeLessThanOrEqual(0.2);
    }
  });
});
