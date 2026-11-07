import { test, expect, expectNoAxeViolations } from './fixtures';
import { work } from '../src/content/work';

const panels = work.filter((w) => w.confirmed);

test.describe('work-panel marks @B-05', () => {
  test('each panel has exactly one inline decorative mark, drawn in the ink colour @B-05', async ({
    page,
  }) => {
    await page.goto('/');
    for (const w of panels) {
      const mark = page.locator(`#work-${w.id} .work-mark`);
      await expect(mark).toHaveCount(1);
      await expect(mark).toHaveAttribute('aria-hidden', 'true');
      await expect(mark.locator('svg')).toHaveAttribute('viewBox', '0 0 64 64');
      await expect(mark).toHaveCSS('color', 'rgb(10, 28, 107)');
      const box = await mark.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48);
    }
    await expect(page.locator('.work-mark')).toHaveCount(panels.length);
    // Marks are in the served HTML, not drawn by script.
    const html = await (await page.request.get('/')).text();
    expect(html.match(/class="work-mark"/g)?.length).toBe(panels.length);
  });

  test('marks are already drawn: no animation, no transition on them or their strokes @B-05', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await page.locator('#projects').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const n = await page.evaluate(
      () =>
        [...document.querySelectorAll('.work-mark')]
          .flatMap((m) => [m, ...m.querySelectorAll('*')])
          .flatMap((e) => e.getAnimations()).length,
    );
    expect(n).toBe(0);
    const dash = await page.evaluate(() =>
      [...document.querySelectorAll('.work-mark svg *')].map(
        (e) => getComputedStyle(e).strokeDashoffset,
      ),
    );
    expect(dash.every((d) => d === '0px' || d === 'normal')).toBe(true);
    await expectNoAxeViolations(page, { label: '/ work marks' });
  });
});
