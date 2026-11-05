import { test, expect, expectNoAxeViolations } from './fixtures';
import { copy } from '../src/content/copy';
import { endMark } from '../src/content/colophon';

const c = copy.colophon;

test.describe('colophon and sheet close @B-07', () => {
  test('colophon copy and the source link are plain HTML @B-07', async ({
    page,
  }) => {
    const html = await (await page.request.get('/')).text();
    expect(html).toContain(
      c.copyright.replace('{year}', String(new Date().getFullYear())),
    );
    await page.goto('/');
    const sec = page.locator('#colophon');
    await expect(sec.getByRole('heading', { level: 2 })).toHaveText('colophon');
    await expect(sec.getByRole('link', { name: c.source })).toHaveAttribute(
      'href',
      c.sourceHref,
    );
    // No font list, no "made with", no analytics line until the owner confirms it.
    await expect(sec).not.toContainText(/made with|analytics|font/i);
    await expectNoAxeViolations(page, { label: '/ colophon' });
  });

  test('the Nepali end mark is absent unless the content confirms it @B-07', async ({
    page,
  }) => {
    expect(endMark.confirmed).toBe(false);
    const html = await (await page.request.get('/')).text();
    expect(html).not.toContain(endMark.text);
    await page.goto('/');
    await expect(page.locator('.end-mark')).toHaveCount(0);
  });

  test('the sheet closes: the rule is last in the sheet and meets the border at the bottom @B-07', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const close = page.locator('.sheet > .sheet-close');
    await expect(close).toHaveCount(1);
    await expect(close).toHaveAttribute('aria-hidden', 'true');
    // It follows the colophon (the test-only motion probe is not content).
    const prev = await close.evaluate(
      (el) =>
        [...el.parentElement!.children]
          .filter((n) => n.id !== 'motion-probe')
          .at(-2)?.id,
    );
    expect(prev).toBe('colophon');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() => page.evaluate(() => window.innerHeight + window.scrollY))
      .toBeGreaterThanOrEqual(
        (await page.evaluate(() => document.documentElement.scrollHeight)) - 1,
      );
    const box = (await close.boundingBox())!;
    const inset = await page.evaluate(() =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--inset'),
      ),
    );
    // Rule bottom edge sits on the border's inner edge (viewport bottom minus the band).
    expect(Math.abs(box.y + box.height - (800 - inset))).toBeLessThanOrEqual(
      1.5,
    );
    // It runs out to the right border's inner edge.
    expect(Math.abs(box.x + box.width - (1280 - inset))).toBeLessThanOrEqual(
      1.5,
    );
  });

  test('on a phone the rule clears the bottom index strip @B-07', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const close = page.locator('.sheet-close');
    await expect(close).toBeInViewport();
    const box = (await close.boundingBox())!;
    const strip = (await page.locator('.sheet-index').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(strip.y + 1.5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
