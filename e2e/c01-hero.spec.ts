import { test, expect, expectNoAxeViolations } from './fixtures';

test.describe('hero paints complete, panels enter @C-01', () => {
  test('title block has no clip-path entrance, text is in the DOM, CLS 0 @C-01', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(
      info.project.name === 'reduced-motion',
      'covered by the reduced-motion test',
    );
    test.skip(!javaScriptEnabled, 'observers need JS');
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __lcp: string[] };
      w.__cls = 0;
      w.__lcp = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as unknown as {
          hadRecentInput: boolean;
          value: number;
        }[])
          if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries() as unknown as {
          element?: Element;
        }[])
          w.__lcp.push(e.element?.id || e.element?.tagName || '?');
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await page.goto('/');
    const h1 = page.locator('h1');
    // v3.2 P1: no entrance on the title block. It paints complete on the first frame, so a
    // main-thread stall can never show it half drawn.
    expect(
      await h1.evaluate((e) => {
        const cs = getComputedStyle(e);
        return [cs.animationName, cs.clipPath, cs.opacity];
      }),
    ).toEqual(['none', 'none', '1']);
    await expect(h1).toHaveText(/\S/);
    expect(
      await page
        .locator('.title-block, .title-block *')
        .evaluateAll(
          (els) => els.filter((e) => e.getAnimations().length > 0).length,
        ),
    ).toBe(0);
    await page.waitForTimeout(500);
    const { cls, lcp } = await page.evaluate(() => {
      const w = window as unknown as { __cls: number; __lcp: string[] };
      return { cls: w.__cls, lcp: w.__lcp };
    });
    expect(cls).toBe(0);
    // The h1 (or its title block) is the LCP element, not something that arrived late.
    expect(lcp.length).toBeGreaterThan(0);
    expect(lcp.at(-1)).toMatch(/^(name|P|H1)$/);
    await expectNoAxeViolations(page, { label: '/ after hero enter' });
  });

  test('motion off: no running animations on the hero or panels @C-01', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(
      info.project.name !== 'reduced-motion',
      'only meaningful with motion off',
    );
    await page.goto('/');
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const n = (a as CSSAnimation).animationName;
          return n === 'name-wipe' || n === 'heading-arrive';
        })
        .map((a) => (a as CSSAnimation).animationName),
    );
    expect(running).toEqual([]);
    await expect(page.locator('h1')).toHaveCSS('clip-path', 'none');
    expect(
      await page
        .locator('#contact .panel')
        .evaluate((e) => getComputedStyle(e).opacity),
    ).toBe('1');
  });

  test('no JS: the title block is fully shown @C-01', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'no-js project only');
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });
});
