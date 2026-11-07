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
    // No words in view: the controls are icons with names for assistive tech, the count is for screen readers.
    await expect(garden.locator('.garden-caption')).toHaveCount(0);
    for (const name of ['pick a flower', 'throw a ball'])
      await expect(garden.getByRole('button', { name })).toHaveText('');
    await expect(garden.locator('[data-garden-count]')).toHaveClass(/sr-only/);
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

  test.describe('pick, bucket, bouquet and ball @V3-garden', () => {
    type Hooks = NonNullable<Window['__hooks']>;
    const garden = (page: import('@playwright/test').Page) => {
      const root = page.locator('[data-garden]');
      return {
        root,
        count: root.locator('[data-garden-count]'),
        newBouquet: root.getByRole('button', { name: 'start a new bouquet' }),
        // The state the page keeps, read through the test hook (a plain build has none).
        bucket: () =>
          page.evaluate(() => {
            const g = (window.__hooks as Hooks).garden!;
            return g.bucket();
          }),
        flowers: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.flowers()),
        balls: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.balls()),
      };
    };
    const ready = async (
      page: import('@playwright/test').Page,
      javaScriptEnabled: boolean,
      info: { project: { name: string } },
    ) => {
      test.skip(!javaScriptEnabled, 'needs JS');
      test.skip(info.project.name === 'reduced-motion', 'covered by tap');
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/');
      const g = garden(page);
      await g.root.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () => (window.__hooks as Hooks | undefined)?.garden !== undefined,
        undefined,
        { timeout: 15_000 },
      );
      // Flowers sprout over the first seconds; wait for grown ones.
      await expect
        .poll(async () => (await g.flowers()).length, { timeout: 20_000 })
        .toBeGreaterThan(2);
      return g;
    };

    test('pick a flower, drop it in the bucket, start a new bouquet @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      const g = await ready(page, javaScriptEnabled, info);
      expect((await g.bucket()).count).toBe(0);
      await expect(g.count).toHaveText('the bucket is empty');
      await expect(g.newBouquet).toBeHidden();
      const f = (await g.flowers())[0]!;
      const bucket = await g.bucket();
      await page.mouse.move(f.x, f.y);
      await page.mouse.down();
      // The flower follows the pointer to the bucket and drops in.
      await page.mouse.move((f.x + bucket.x) / 2, f.y - 20, { steps: 8 });
      await page.mouse.move(bucket.x, bucket.y - 40, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => (await g.bucket()).count).toBe(1);
      await expect(g.count).toHaveText('1 flower in the bucket');
      await expect(g.newBouquet).toBeVisible();
      // A plain tap on another flower sends it straight there.
      const next = (await g.flowers())[0]!;
      await page.mouse.click(next.x, next.y);
      await expect.poll(async () => (await g.bucket()).count).toBe(2);
      await expect(g.count).toHaveText('2 flowers in the bucket');
      await expectNoAxeViolations(page, { label: '/ garden with a bouquet' });
      await g.newBouquet.click();
      await expect.poll(async () => (await g.bucket()).count).toBe(0);
      // The live region says what happened; the control is gone with the flowers.
      await expect(g.count).toHaveText('started a new bouquet');
      await expect(g.newBouquet).toBeHidden();
    });

    test('the pick a flower button adds one for the keyboard @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      const g = await ready(page, javaScriptEnabled, info);
      const pick = g.root.getByRole('button', { name: 'pick a flower' });
      await pick.focus();
      await page.keyboard.press('Enter');
      // The flower flies to the bucket first.
      await expect
        .poll(async () => (await g.bucket()).count, { timeout: 15_000 })
        .toBe(1);
      await expect(g.count).toHaveText('1 flower in the bucket');
    });

    test('a ball can be grabbed, carried and thrown with the flick speed @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      const g = await ready(page, javaScriptEnabled, info);
      await g.root.getByRole('button', { name: 'throw a ball' }).click();
      // A thrown ball lands and rests on the grass; wait for one that is free and still.
      let ball = { x: 0, y: 0 };
      await expect
        .poll(
          async () => {
            const b = (await g.balls()).find(
              (o) => !o.held && !o.grabbed && o.speed < 5,
            );
            if (b) ball = b;
            return !!b;
          },
          { timeout: 20_000 },
        )
        .toBe(true);
      const box = (await g.root.locator('canvas').boundingBox())!;
      await page.mouse.move(ball.x, ball.y);
      await page.mouse.down();
      await expect
        .poll(async () => (await g.balls()).some((b) => b.grabbed))
        .toBe(true);
      // Carried: it follows the pointer.
      await page.mouse.move(ball.x + 60, ball.y - 10, { steps: 6 });
      await page.mouse.move(ball.x + 160, ball.y - 10, { steps: 6 });
      // Watch the speed from the page itself (a polled read can miss a fast ball on a busy machine).
      await page.evaluate(() => {
        const w = window as unknown as { __top: number };
        w.__top = 0;
        const g = (window.__hooks as Hooks).garden!;
        const t = window.setInterval(() => {
          for (const b of g.balls())
            if (!b.grabbed) w.__top = Math.max(w.__top, b.speed);
          if (w.__top > 30) window.clearInterval(t);
        }, 8);
        window.setTimeout(() => window.clearInterval(t), 4000);
      });
      // A flick: a fast move, released while still moving.
      for (let i = 1; i <= 6; i++) {
        await page.mouse.move(
          Math.min(ball.x + 160 + i * 40, box.x + box.width - 10),
          ball.y - 10,
        );
        await page.waitForTimeout(12);
      }
      await page.mouse.up();
      // Let go: no ball is grabbed, and one leaves with real speed.
      await expect
        .poll(async () => (await g.balls()).some((b) => b.grabbed))
        .toBe(false);
      await page.waitForTimeout(600);
      const fastest = await page.evaluate(
        () => (window as unknown as { __top: number }).__top,
      );
      // A ball at rest or carried reads under 5; a flick leaves with real speed. The exact figure
      // depends on how fast the machine delivers the pointer events, so the bar is low.
      expect(fastest).toBeGreaterThan(30);
    });

    test('three flowers bring wrapping paper; wrap, vase, pin to the edge and take back @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      const g = await ready(page, javaScriptEnabled, info);
      const hooks = {
        paper: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.paper()),
        bouquets: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.bouquets()),
        vase: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.vase()),
        pins: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.pins()),
      };
      const pick = g.root.getByRole('button', { name: 'pick a flower' });
      for (let i = 1; i <= 3; i++) {
        await pick.click();
        await expect
          .poll(async () => (await g.bucket()).count, { timeout: 15_000 })
          .toBe(i);
      }
      // Paper lies by the bucket; no words, a control for the keyboard.
      await expect.poll(hooks.paper).not.toBeNull();
      const wrap = g.root.getByRole('button', { name: 'wrap the bouquet' });
      await expect(wrap).toBeVisible();
      await expect(g.count).toContainText('wrapping paper is ready');
      // Drag the paper onto the bucket.
      await expect.poll(async () => (await hooks.paper())?.t).toBe(1);
      const paper = (await hooks.paper())!;
      const bucket = await g.bucket();
      await page.mouse.move(paper.x, paper.y);
      await page.mouse.down();
      await page.mouse.move(bucket.x, bucket.y - 30, { steps: 10 });
      await page.mouse.up();
      await expect.poll(async () => (await g.bucket()).count).toBe(0);
      await expect
        .poll(async () => (await hooks.bouquets()).map((b) => b.mode), {
          timeout: 10_000,
        })
        .toEqual(['lie']);
      await expect(g.count).toHaveText('wrapped the flowers into a bouquet');
      // The vase takes it.
      await g.root
        .getByRole('button', { name: 'put the bouquet in the vase' })
        .click();
      await expect.poll(async () => (await hooks.vase()).full).toBe(true);
      // Take it out by drag, and pin it to the right edge of the screen.
      await g.root
        .getByRole('button', { name: 'take the bouquet out of the vase' })
        .click();
      await g.root
        .getByRole('button', { name: 'pin the bouquet to the edge' })
        .click();
      await expect.poll(async () => (await hooks.pins()).length).toBe(1);
      const pin = (await hooks.pins())[0]!;
      const vp = page.viewportSize()!;
      // Inside the sheet, clear of the lamp (top right 120 px) and the left index.
      expect(pin.x).toBeGreaterThan(120 + 24);
      expect(pin.x + pin.width).toBeLessThanOrEqual(vp.width);
      expect(pin.y).toBeGreaterThanOrEqual(120);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      expect((await hooks.pins())[0]!.y).toBe(pin.y);
      await expectNoAxeViolations(page, {
        label: '/ garden with a pinned bouquet',
      });
      await page
        .getByRole('button', { name: 'take the bouquet back into the garden' })
        .click();
      await expect.poll(async () => (await hooks.pins()).length).toBe(0);
      await expect.poll(async () => (await hooks.bouquets()).length).toBe(1);
    });

    test('the dog meets the ball with its mouth, carries it and sets it down @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      const g = await ready(page, javaScriptEnabled, info);
      await g.root.getByRole('button', { name: 'throw a ball' }).click();
      const dogs = () =>
        page.evaluate(() => (window.__hooks as Hooks).garden!.dogs());
      // Sample until a dog has taken hold: the mouth is at the ball, not the body.
      let gap = 1e9;
      await expect
        .poll(
          async () => {
            const d = (await dogs()).find((o) => o.state === 'grab' && o.ball);
            if (d)
              gap = Math.hypot(d.mouth[0] - d.ball!.x, d.mouth[1] - d.ball!.y);
            return !!d;
          },
          { timeout: 20_000, intervals: [30] },
        )
        .toBe(true);
      expect(gap).toBeLessThan(16);
      // It carries it, then sets it down and the ball rests on the grass, free to take again.
      await expect
        .poll(async () => (await dogs()).some((o) => o.ball?.held), {
          timeout: 10_000,
        })
        .toBe(true);
      await expect
        .poll(async () => (await dogs()).every((o) => !o.ball), {
          timeout: 25_000,
        })
        .toBe(true);
      await expect
        .poll(async () => (await g.balls()).some((b) => !b.held && !b.grabbed))
        .toBe(true);
    });
  });
});
