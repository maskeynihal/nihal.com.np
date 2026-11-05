import { test, expect, expectNoAxeViolations, isAllowlisted } from './fixtures';

test.describe('axe @A-13', () => {
  for (const path of ['/', '/404.html', '/sent/'])
    test(`${path} has no WCAG violations @A-13`, async ({ page }) => {
      await page.goto(path);
      await expectNoAxeViolations(page, { label: path });
    });

  test('/ with the skip link focused @A-13', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(
      browserName === 'webkit' && isMobile,
      'Tab order is checked on desktop engines',
    );
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await expectNoAxeViolations(page, { label: '/ skip link focused' });
  });

  test('/ after toggling reduce motion and sound @A-13', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'toggles need JS');
    await page.goto('/');
    // Under OS reduce the motion toggle is aria-disabled by design (A-03), so it is not clicked.
    if (info.project.name !== 'reduced-motion') {
      await page.locator('[data-motion-toggle]').click();
      await expectNoAxeViolations(page, { label: '/ after motion toggle' });
    }
    await page.locator('[data-sound-toggle]').click();
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
    await expectNoAxeViolations(page, { label: '/ after sound toggle' });
  });

  test('allowlist selectors match the target string exactly @A-13', () => {
    const entries = [{ id: 'image-alt', selector: 'img' }];
    expect(isAllowlisted(entries, 'image-alt', ['img'])).toBe(true);
    expect(isAllowlisted(entries, 'image-alt', ['#imgfoo'])).toBe(false);
    expect(isAllowlisted(entries, 'image-alt', ['main > img'])).toBe(false);
    expect(isAllowlisted(entries, 'color-contrast', ['img'])).toBe(false);
  });

  test('self-test: an image without alt is reported as image-alt @A-13', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const img = document.createElement('img');
      // A data URI keeps the console clean (a missing file would log a 404).
      img.src =
        'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAACAkQBADs=';
      document.querySelector('main')?.append(img);
    });
    await expect(
      expectNoAxeViolations(page, { label: 'seeded img without alt' }),
    ).rejects.toThrow(/image-alt/);
  });
});
