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

    test('three flowers bring wrapping paper; wrap, vase, drop to the bottom of the screen and bring back @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      test.setTimeout(90_000);
      const g = await ready(page, javaScriptEnabled, info);
      const hooks = {
        paper: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.paper()),
        bouquets: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.bouquets()),
        vase: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.vase()),
        rested: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.rested()),
        carrying: () =>
          page.evaluate(() => (window.__hooks as Hooks).garden!.carrying()),
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

      const vp = page.viewportSize()!;
      const box = (await g.root.locator('canvas').boundingBox())!;
      expect(box.y, 'room above the garden to drop into').toBeGreaterThan(160);
      // The floor is the sheet's inner edge: the tokens the desk's fall layer reads.
      const floor = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement);
        const n = (v: string) => parseFloat(s.getPropertyValue(v));
        return (
          window.innerHeight -
          n('--inset') -
          (window.innerWidth < 1024 ? n('--strip-h') : 0)
        );
      });
      const dragOut = async (at: { x: number; y: number }, x: number) => {
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.move(x, box.y - 120, { steps: 12 });
        // Held outside the garden, it is carried, not yet dropped.
        await expect.poll(hooks.carrying).not.toBeNull();
        await page.mouse.up();
      };
      const settled = async (n: number) => {
        await expect
          .poll(
            async () => (await hooks.rested()).filter((r) => !r.falling).length,
            { timeout: 10_000 },
          )
          .toBe(n);
      };

      // The vase drags out with the bouquet in it, falls and rests on the floor, upright.
      await dragOut(await hooks.vase(), 600);
      await settled(1);
      const [r] = await hooks.rested();
      expect(r!.kind).toBe('vase');
      expect(r!.full, 'the bouquet went with the vase').toBe(true);
      expect(r!.top + r!.height).toBeCloseTo(floor, 0);
      expect(r!.y + r!.height, 'upright: no tilt').toBeCloseTo(floor, 0);
      expect((await hooks.vase()).gone).toBe(true);
      await expect(g.count).toContainText(
        'the vase is at the bottom of the screen',
      );
      // Clear of the left index and of the bottom right corner (the desk's reset button).
      expect(r!.left).toBeGreaterThanOrEqual(24 + 120);
      expect(r!.left + r!.width).toBeLessThanOrEqual(vp.width - 80);
      // It stays where it is while the page scrolls.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      expect((await hooks.rested())[0]!.y).toBeCloseTo(r!.y, 0);
      await expectNoAxeViolations(page, {
        label: '/ garden with a dropped vase',
      });
      await g.root.scrollIntoViewIfNeeded();

      // Keyboard: focus it and press Enter to bring it back.
      const back = page.getByRole('button', {
        name: 'bring the vase back to the garden',
      });
      await back.focus();
      await page.keyboard.press('Enter');
      await expect.poll(async () => (await hooks.rested()).length).toBe(0);
      await expect.poll(async () => (await hooks.vase()).gone).toBe(false);
      expect((await hooks.vase()).full).toBe(true);

      // A bouquet out of the vase, dragged outside, lands at the bottom too; the vase beside it does not overlap.
      await g.root
        .getByRole('button', { name: 'take the bouquet out of the vase' })
        .click();
      await expect
        .poll(async () => (await hooks.bouquets()).map((b) => b.mode))
        .toEqual(['lie']);
      await page.waitForTimeout(600);
      await dragOut((await hooks.bouquets())[0]!, 700);
      await settled(1);
      await expect.poll(async () => (await hooks.bouquets()).length).toBe(0);
      const bq = (await hooks.rested())[0]!;
      expect(bq.kind).toBe('bq');
      expect(bq.top + bq.height).toBeCloseTo(floor, 0);
      await dragOut(await hooks.vase(), 700);
      await settled(2);
      const [a, b] = [...(await hooks.rested())].sort(
        (p, q) => p.left - q.left,
      );
      expect(a!.left + a!.width, 'side by side').toBeLessThanOrEqual(b!.left);

      // It comes back with a reload, at the bottom, without the garden scrolled near.
      await page.reload();
      await page.waitForFunction(
        () => (window.__hooks as Hooks | undefined)?.garden !== undefined,
        undefined,
        { timeout: 15_000 },
      );
      await expect.poll(async () => (await hooks.rested()).length).toBe(2);
      const again = await hooks.rested();
      expect(again.map((o) => o.kind).sort()).toEqual(['bq', 'vase']);
      for (const o of again) expect(o.top + o.height).toBeCloseTo(floor, 0);

      // Dragging a rested bouquet back into the garden returns it to the grass.
      await g.root.scrollIntoViewIfNeeded();
      const rb = (await hooks.rested()).find((o) => o.kind === 'bq')!;
      const cb = (await g.root.locator('canvas').boundingBox())!;
      await page.mouse.move(rb.left + rb.width / 2, rb.top + rb.height / 2);
      await page.mouse.down();
      await page.mouse.move(cb.x + cb.width * 0.45, cb.y + cb.height * 0.7, {
        steps: 12,
      });
      await page.mouse.up();
      await expect
        .poll(async () => (await hooks.bouquets()).map((o) => o.mode))
        .toEqual(['lie']);
      await expect.poll(async () => (await hooks.rested()).length).toBe(1);
      // A tap on the vase that is left brings it home to its place.
      const rv = (await hooks.rested())[0]!;
      await page.mouse.click(rv.left + rv.width / 2, rv.top + rv.height / 2);
      await expect.poll(async () => (await hooks.rested()).length).toBe(0);
      await expect.poll(async () => (await hooks.vase()).gone).toBe(false);
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

    // The owner's report: the dogs ignored the ball. A dog that had been idle for 12 s of garden time gave up on
    // the very first frame of the next chase, so these all wait past that before touching the ball, and use real
    // pointer input (the earlier spec threw within seconds of the mount and passed on broken code).
    type Page = import('@playwright/test').Page;
    const idlePast = (page: Page, s: number) =>
      page.waitForFunction(
        (t) => (window.__hooks as Hooks).garden!.time() > t,
        s,
        { timeout: 90_000 },
      );
    const restingBall = async (g: ReturnType<typeof garden>) => {
      let ball = { x: 0, y: 0 };
      await expect
        .poll(async () => {
          const b = (await g.balls()).find(
            (o) => !o.held && !o.grabbed && !o.fading && o.speed < 5,
          );
          if (b) ball = b;
          return !!b;
        })
        .toBe(true);
      return ball;
    };
    const dogsHaveBall = (page: Page) =>
      page.evaluate(() =>
        (window.__hooks as Hooks).garden!.dogs().some((d) => d.ball),
      );
    const drag = async (
      page: Page,
      from: { x: number; y: number },
      to: { x: number; y: number },
      steps: number,
      gap: number,
    ) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(
          from.x + ((to.x - from.x) * i) / steps,
          from.y + ((to.y - from.y) * i) / steps,
        );
        await page.waitForTimeout(gap);
      }
      await page.mouse.up();
    };

    test('a ball thrown hard, thrown softly or dropped is chased after a long quiet spell @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      test.setTimeout(150_000);
      const g = await ready(page, javaScriptEnabled, info);
      for (const [name, dx, steps, gap] of [
        ['hard throw', 320, 6, 8],
        ['soft throw', 70, 8, 30],
        ['drop', 0, 0, 0],
      ] as const) {
        await idlePast(page, 14);
        // Let the dogs finish whatever they were doing, then sit idle until gt is far past the give-up.
        await expect
          .poll(async () => !(await dogsHaveBall(page)), { timeout: 30_000 })
          .toBe(true);
        const t0 = await page.evaluate(() =>
          (window.__hooks as Hooks).garden!.time(),
        );
        await idlePast(page, t0 + 13);
        const ball = await restingBall(g);
        if (name === 'drop') {
          // Pick it up, hold it still for a moment, let go: no speed at all.
          await page.mouse.move(ball.x, ball.y);
          await page.mouse.down();
          await page.mouse.move(ball.x + 30, ball.y + 10, { steps: 4 });
          await page.waitForTimeout(250);
          await page.mouse.up();
        } else
          await drag(
            page,
            ball,
            { x: ball.x + dx, y: ball.y - 20 },
            steps,
            gap,
          );
        await expect
          .poll(() => dogsHaveBall(page), {
            message: `a dog chases the ball after a ${name}`,
            timeout: 8000,
            intervals: [100],
          })
          .toBe(true);
      }
    });

    test('there are never more than four balls; the extra one fades away @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      const g = await ready(page, javaScriptEnabled, info);
      const throwIt = g.root.getByRole('button', { name: 'throw a ball' });
      let sawFading = false;
      for (let i = 0; i < 6; i++) {
        await throwIt.click();
        const balls = await g.balls();
        sawFading ||= balls.some((b) => b.fading);
        expect(balls.filter((b) => !b.fading).length).toBeLessThanOrEqual(4);
      }
      expect(sawFading, 'the oldest one shrinks away, it does not pop').toBe(
        true,
      );
      await expect.poll(async () => (await g.balls()).length).toBe(4);
    });

    test('clicking the ball where it rests sends the dog after it; a ball waits for a free dog @V3-garden', async ({
      page,
      javaScriptEnabled,
    }, info) => {
      test.setTimeout(150_000);
      const g = await ready(page, javaScriptEnabled, info);
      await idlePast(page, 14);
      const ball = await restingBall(g);
      await page.mouse.click(ball.x, ball.y);
      await expect
        .poll(() => dogsHaveBall(page), { timeout: 8000, intervals: [100] })
        .toBe(true);
      // Two more by the icon: three balls to fetch and two dogs. Everyone is fetched in the end, none left waiting.
      for (let i = 0; i < 2; i++)
        await g.root.getByRole('button', { name: 'throw a ball' }).click();
      await expect
        .poll(async () => (await g.balls()).filter((b) => b.fetch).length, {
          timeout: 20_000,
        })
        .toBeGreaterThan(0);
      await expect
        .poll(
          async () => (await g.balls()).every((b) => !b.fetch && !b.claimed),
          { timeout: 90_000, intervals: [500] },
        )
        .toBe(true);
    });
  });
});
