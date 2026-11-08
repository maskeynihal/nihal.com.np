import { test, expect, expectNoAxeViolations } from './fixtures';
import { copy } from '../src/content/copy';

test.describe('v3.2 page: footer, section art, cv ticks, index scroll @P', () => {
  test('a plain footer closes the sheet; no colophon anywhere @P3', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#colophon')).toHaveCount(0);
    const footer = page.locator('footer.sheet-footer');
    await expect(footer).toContainText(`© ${new Date().getFullYear()}`);
    await expect(
      footer.getByRole('link', { name: copy.footer.source }),
    ).toHaveAttribute('href', copy.footer.sourceHref);
    await expect(page.locator('body')).not.toContainText(/colophon/i);
    await expect(page.locator('body')).not.toContainText(
      /Built with Astro|Pull requests merged|closed without merging/,
    );
    // The sheet close rule follows the footer.
    const prev = await page
      .locator('.sheet > .sheet-close')
      .evaluate(
        (el) =>
          [...el.parentElement!.children]
            .filter((n) => n.id !== 'motion-probe')
            .at(-2)?.tagName,
      );
    expect(prev).toBe('FOOTER');
    await expectNoAxeViolations(page, { label: '/ footer' });
  });

  test('the hero sentence is the owner text @P8', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.title-block-line')).toHaveText(
      'Lead engineer at Leapfrog Technology. I lead the team building a US behavioural-health platform on AWS, under HIPAA and SOC 2. Co-founder of Daboo Spaces, a coworking space in Kathmandu.',
    );
  });

  test('cv duties have a drawn tick marker in a real list @P5', async ({
    page,
  }) => {
    await page.goto('/');
    const li = page.locator('#cv ul.cv-details li').first();
    await expect(li).toBeVisible();
    const marker = await li.evaluate((e) => {
      const b = getComputedStyle(e, '::before');
      return { content: b.content, w: b.borderBottomWidth };
    });
    expect(marker.content).not.toBe('none');
    expect(parseFloat(marker.w)).toBeGreaterThan(0);
    await expect(li).toHaveCSS('list-style-type', 'none');
  });

  for (const [width, shown] of [
    [1280, true],
    [1023, false],
  ] as const) {
    test(`section art canvas at ${width}px: ${shown ? 'fixed, no pointer events' : 'hidden'} @P6`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const art = page.locator('canvas.side-art');
      await expect(art).toHaveCount(1);
      await expect(art).toHaveAttribute('aria-hidden', 'true');
      expect(await art.locator('*').count()).toBe(0);
      expect(await page.locator('section[data-art]').count()).toBe(6);
      if (!shown) {
        await expect(art).toBeHidden();
        return;
      }
      await expect(art).toBeVisible();
      const css = await art.evaluate((el) => {
        const s = getComputedStyle(el);
        return { pe: s.pointerEvents, pos: s.position };
      });
      expect(css.pe).toBe('none');
      expect(css.pos).toBe('fixed');
    });
  }

  test('index click glides: row held, hash set, section focused @P7', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(info.project.name === 'reduced-motion', 'plain jump there');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'sheet index' });
    await page.evaluate(() => {
      const w = window as unknown as { __seen: string[] };
      w.__seen = [];
      addEventListener(
        'scroll',
        () => {
          const c = document.querySelector('.sheet-index a[aria-current]');
          const h = c?.getAttribute('href') ?? '';
          if (w.__seen.at(-1) !== h) w.__seen.push(h);
        },
        { passive: true },
      );
    });
    await nav.getByRole('link', { name: 'cv' }).click();
    // The clicked row is current at once.
    await expect(nav.locator('a[aria-current]')).toHaveAttribute('href', '#cv');
    const top = () =>
      page.evaluate(
        () =>
          document.getElementById('cv')!.getBoundingClientRect().top +
          window.scrollY,
      );
    // Mid-flight the page has not reached the target.
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(await top());
    await expect(page).toHaveURL(/#cv$/);
    await expect(page.locator('#cv')).toBeFocused();
    await expect
      .poll(async () =>
        page.evaluate(async (t) => Math.abs(window.scrollY - t), await top()),
      )
      .toBeLessThan(3);
    const seen = await page.evaluate(
      () => (window as unknown as { __seen: string[] }).__seen,
    );
    // No flicker through the rows in between.
    expect(seen.filter((h) => h !== '#cv' && h !== '#desk')).toEqual([]);
    await expectNoAxeViolations(page, { label: '/ after glide' });
  });

  test('wheel cancels the glide @P7', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(info.project.name !== 'desktop-chromium', 'wheel input');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'sheet index' })
      .getByRole('link', { name: 'contact' })
      .click();
    await page.mouse.wheel(0, -200);
    const y1 = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(900);
    const y2 = await page.evaluate(() => window.scrollY);
    const max = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    expect(Math.abs(y2 - y1)).toBeLessThan(250);
    expect(y2).toBeLessThan(max - 1);
  });

  test('reduced motion: plain anchor jump @P7', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(info.project.name !== 'reduced-motion', 'reduced motion only');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'sheet index' })
      .getByRole('link', { name: 'writing' })
      .click();
    await expect(page).toHaveURL(/#writing$/);
    await expect(page.locator('#writing')).toBeFocused();
    expect(
      await page.evaluate(
        () => document.getElementById('writing')!.getBoundingClientRect().top,
      ),
    ).toBeLessThan(3);
  });
});
