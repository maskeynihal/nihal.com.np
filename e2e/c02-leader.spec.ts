import { test, expect, expectNoAxeViolations } from './fixtures';

const leaderWidth = (el: Element, sel: string) =>
  getComputedStyle(el, sel).transform;

test.describe('ledger leader lines @C-02', () => {
  test('hover extends a 24 px leader in 160 ms @C-02', async ({
    page,
    hasTouch,
  }, info) => {
    test.skip(hasTouch, 'hover needs a pointer');
    await page.goto('/');
    const row = page.locator('.revision-table tbody tr').first();
    const th = row.locator('th');
    await row.scrollIntoViewIfNeeded();
    expect(await th.evaluate(leaderWidth, '::before')).toBe(
      'matrix(0, 0, 0, 1, 0, 0)',
    );
    const css = await th.evaluate((e) => {
      const s = getComputedStyle(e, '::before');
      return [s.width, s.transitionDuration, s.transitionProperty];
    });
    expect(css[0]).toBe('24px');
    // Motion off keeps only opacity transitions: the leader then appears at once.
    if (info.project.name !== 'reduced-motion')
      expect(css).toEqual(['24px', '0.16s', 'transform']);
    await row.hover();
    await expect
      .poll(() => th.evaluate(leaderWidth, '::before'))
      .toBe('matrix(1, 0, 0, 1, 0, 0)');
    await expect(row.locator('..').locator('..')).toBeVisible();
    await page.locator('#open-source .panel').screenshot({
      path: info.outputPath('hover.png'),
      animations: 'disabled',
    });
    await info.attach('leader-hover', {
      path: info.outputPath('hover.png'),
      contentType: 'image/png',
    });
  });

  test('keyboard focus shows the same leader, on the table and list ledgers @C-02', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name === 'mobile-webkit',
      'WebKit Tab skips links by default; Chromium projects cover focus-visible',
    );
    await page.goto('/');
    for (const [panel, link, row] of [
      ['#open-source', '.revision-table tbody a', 'tr'],
      ['#writing', '.writing-list a', 'li'],
    ] as const) {
      const a = page.locator(`${panel} ${link}`).first();
      await a.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(a).toBeFocused();
      await expect
        .poll(() =>
          a.evaluate((e, rowSel) => {
            const r = e.closest(rowSel)!;
            const el = r.matches('tr') ? r.querySelector('th')! : r;
            return getComputedStyle(el, '::before').transform;
          }, row),
        )
        .toBe('matrix(1, 0, 0, 1, 0, 0)');
      await page.locator(`${panel} .panel`).screenshot({
        path: info.outputPath(`focus-${panel.slice(1)}.png`),
        animations: 'disabled',
      });
      await expectNoAxeViolations(page, { label: `${panel} leader focused` });
    }
  });
});
