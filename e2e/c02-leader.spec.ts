import { test, expect, expectNoAxeViolations } from './fixtures';

test.describe('ledger leader lines @C-02', () => {
  test('hover underlines the repo name along its text, tints it and slides in an arrow in 160 ms @C-02', async ({
    page,
    hasTouch,
  }, info) => {
    test.skip(hasTouch, 'hover needs a pointer');
    await page.goto('/');
    const row = page.locator('.revision-table tbody tr').first();
    const a = row.locator('th a');
    await row.scrollIntoViewIfNeeded();
    const style = () =>
      a.evaluate((e) => {
        const s = getComputedStyle(e);
        const after = getComputedStyle(e, '::after');
        return [
          s.backgroundSize,
          s.transitionDuration,
          s.boxDecorationBreak,
          s.display,
          after.opacity,
          s.color,
        ];
      });
    const before = await style();
    expect(before[0]).toBe('0% 1px');
    expect(before[2]).toBe('clone');
    // Inline, so a wrapped name gets the underline on every line; arrow hidden until hover.
    expect(before[3]).toBe('inline');
    expect(before[4]).toBe('0');
    // No margin leader on the table any more.
    expect(
      await row
        .locator('th')
        .evaluate((e) => getComputedStyle(e, '::before').content),
    ).toBe('none');
    // Motion off keeps only opacity transitions: the line then appears at once.
    if (info.project.name !== 'reduced-motion') expect(before[1]).toBe('0.16s');
    await row.hover();
    await expect.poll(async () => (await style())[0]).toBe('100% 1px');
    await expect.poll(async () => (await style())[4]).toBe('1');
    expect((await style())[5]).not.toBe(before[5]);
    await page
      .locator('#open-source .panel')
      .first()
      .screenshot({
        path: info.outputPath('hover.png'),
        animations: 'disabled',
      });
    await info.attach('leader-hover', {
      path: info.outputPath('hover.png'),
      contentType: 'image/png',
    });
  });

  test('keyboard focus shows the same underline, on the table and list ledgers @C-02', async ({
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
            const link = r.querySelector(r.matches('tr') ? 'th a' : 'a')!;
            return getComputedStyle(link).backgroundSize;
          }, row),
        )
        .toBe('100% 1px');
      await page.locator(`${panel} .panel`).screenshot({
        path: info.outputPath(`focus-${panel.slice(1)}.png`),
        animations: 'disabled',
      });
      await expectNoAxeViolations(page, { label: `${panel} leader focused` });
    }
  });
});
