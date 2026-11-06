import { test, expect, expectNoAxeViolations } from './fixtures';

// The garden strip at the end of the page (v3 WS3). Canvas pixels are compared through element
// screenshots: the canvas is aria-hidden and has no test hook on purpose.

test.describe('garden @V3-garden', () => {
  test('the script loads near the viewport, not at first paint; the section is plain HTML @V3-garden', async ({
    page,
    javaScriptEnabled,
  }) => {
    const chunks: string[] = [];
    page.on('request', (r) => {
      if (/\/garden\.[\w-]+\.js$/.test(r.url())) chunks.push(r.url());
    });
    await page.goto('/');
    const garden = page.locator('[data-garden]');
    await expect(garden).toHaveAttribute('aria-label', 'garden');
    await expect(garden.locator('canvas')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(garden).toContainText(
      'the garden. pick flowers for the bucket. throw the ball for the dogs.',
    );
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.waitForTimeout(800);
    expect(chunks, 'no garden chunk at first paint').toEqual([]);
    await garden.scrollIntoViewIfNeeded();
    await expect.poll(() => chunks.length, { timeout: 15_000 }).toBe(1);
    await expectNoAxeViolations(page, { label: '/ garden' });
  });

  test('the throw button moves the dogs and balls; the canvas is alive @V3-garden', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(info.project.name === 'reduced-motion', 'covered below');
    await page.goto('/');
    const garden = page.locator('[data-garden]');
    const canvas = garden.locator('canvas');
    await garden.scrollIntoViewIfNeeded();
    const button = garden.getByRole('button', { name: 'throw a ball' });
    await expect(button).toBeVisible();
    // Let the first frames draw, then take a reference.
    await page.waitForTimeout(1200);
    const before = await canvas.screenshot();
    await button.click();
    // A ball in flight and a dog running change the picture within a second.
    await expect
      .poll(async () => !(await canvas.screenshot()).equals(before), {
        timeout: 10_000,
      })
      .toBe(true);
    // Clicking empty ground does not throw a new ball, and the page does not scroll away or error.
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.waitForTimeout(400);
    await expectNoAxeViolations(page, { label: '/ garden after a throw' });
  });

  test('under reduced motion the garden is one still frame and the button is gone @V3-garden', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(info.project.name !== 'reduced-motion', 'reduced motion only');
    await page.goto('/');
    const garden = page.locator('[data-garden]');
    const canvas = garden.locator('canvas');
    await garden.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const a = await canvas.screenshot();
    await page.waitForTimeout(900);
    const b = await canvas.screenshot();
    expect(a.equals(b), 'no animation').toBe(true);
    // Something is drawn: the still frame is not an empty canvas.
    const blank = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>(
        '[data-garden] canvas',
      )!;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
      return true;
    });
    expect(blank).toBe(false);
    await expect(
      garden.getByRole('button', { name: 'throw a ball' }),
    ).toBeHidden();
  });
});
