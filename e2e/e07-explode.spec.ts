import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const figure = (page: Page) => page.locator('[data-desk]');
const canvas = (page: Page) => page.locator('[data-desk] canvas');

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}

const state = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.explode());
const offset = (page: Page, id: string) =>
  page.evaluate((i) => window.__hooks!.desk!.scene!.explodeOffset(i), id);
const frames = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.frames());
const scrollToFraction = async (page: Page, f: number) => {
  const { range } = await state(page);
  await page.evaluate((y) => scrollTo(0, y), Math.round(range * f));
};

test.describe('exploded view @E-07', () => {
  test.describe.configure({ timeout: 120_000 });
  // Playwright needs the destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });

  test('at half the hero scroll the factor is about 0.5, at the top 0, past it 1 @E-07', async ({
    page,
  }) => {
    await goLive(page);
    expect((await state(page)).factor).toBe(0);
    await scrollToFraction(page, 0.5);
    await expect
      .poll(async () => (await state(page)).target)
      .toBeCloseTo(0.5, 2);
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBeCloseTo(0.5, 2);
    // The arduino's def offset is [0, 0.42, 0]: half of it is on the object.
    const o = await offset(page, 'arduino');
    expect(o[1]).toBeCloseTo(0.21, 2);
    expect(o[0]).toBeCloseTo(0, 3);

    // Past the hero. (Far beyond it the canvas pauses, by design, and the factor holds.)
    await scrollToFraction(page, 1);
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBe(1);
    expect((await offset(page, 'arduino'))[1]).toBeCloseTo(0.42, 3);

    await page.evaluate(() => scrollTo(0, 0));
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBe(0);
    expect(await offset(page, 'arduino')).toEqual([0, 0, 0]);
  });

  test('leader lines run from rest to the exploded pose and fade with the factor @E-07', async ({
    page,
  }) => {
    await goLive(page);
    const leaders = () =>
      page.evaluate(() => window.__hooks!.desk!.scene!.explodeLeaders());
    expect((await leaders()).some((l) => l.visible)).toBe(false);
    await scrollToFraction(page, 1);
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBe(1);
    const shown = (await leaders()).filter((l) => l.visible);
    expect(shown.map((l) => l.id).sort()).toEqual([
      'arduino',
      'calendar',
      'clock-ktm',
      'ghost',
    ]);
    for (const l of shown) expect(l.opacity).toBeCloseTo(1, 2);
    await page.evaluate(() => scrollTo(0, 0));
    await expect
      .poll(async () => (await leaders()).some((l) => l.visible), {
        timeout: 45_000,
      })
      .toBe(false);
  });

  test('the loop converges: no frames once the factor has settled @E-07', async ({
    page,
  }) => {
    await goLive(page);
    await scrollToFraction(page, 0.5);
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBe(0.5);
    // The OLED and clocks have timers of their own; keep them off the counter.
    await page.evaluate(() => window.__hooks!.desk!.scene!.quiet(true));
    await page.mouse.move(2, 2);
    await page.waitForTimeout(800);
    const a = await frames(page);
    await page.waitForTimeout(2000);
    expect(await frames(page)).toBe(a);
    await expectNoAxeViolations(page, { label: '/ desk exploded' });
  });

  test('a scroll does not block the main thread for more than 50 ms @E-07', async ({
    page,
  }) => {
    await goLive(page);
    await page.evaluate(() => {
      window.__hooks!.longTasks.length = 0;
    });
    for (let i = 0; i < 24; i++) {
      await page.mouse.wheel(0, 40);
      await page.waitForTimeout(40);
    }
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBe((await state(page)).target);
    const long = await page.evaluate(() => window.__hooks!.longTasks);
    expect(Math.max(0, ...long), `long tasks: ${long.join(', ')}`).toBeLessThan(
      50,
    );
  });

  test('an awake body is skipped, and eases back in once it sleeps @E-07', async ({
    page,
  }) => {
    await goLive(page);
    // Grab the arduino at the top, then scroll half way: it stays put while held.
    const pick = async () => {
      const p = await page.evaluate(() =>
        window.__hooks!.desk!.scene!.pick('arduino'),
      );
      const box = (await canvas(page).boundingBox())!;
      return { x: box.x + p!.x, y: box.y + p!.y };
    };
    await canvas(page).scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    const o = await pick();
    await page.mouse.move(o.x, o.y);
    await page.mouse.down();
    await page.mouse.move(o.x + 14, o.y + 6, { steps: 2 });
    await expect
      .poll(
        () =>
          page.evaluate(() => window.__hooks!.desk!.scene!.physics().grabbed),
        { timeout: 30_000 },
      )
      .toBe('arduino');
    await page.mouse.wheel(0, 300);
    await expect
      .poll(async () => (await state(page)).factor, { timeout: 45_000 })
      .toBeGreaterThan(0.1);
    expect(await offset(page, 'arduino')).toEqual([0, 0, 0]);
    expect((await offset(page, 'ghost'))[1]).toBeGreaterThan(0.01);
    await page.mouse.up();
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            window
              .__hooks!.desk!.scene!.physics()
              .bodies.every((b) => b.asleep),
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    // Settled: the arduino's offset equals its def offset times the live factor.
    await expect
      .poll(
        async () => {
          const f = (await state(page)).factor;
          return (await offset(page, 'arduino'))[1] - 0.42 * f;
        },
        { timeout: 45_000 },
      )
      .toBeCloseTo(0, 3);
  });
});

test.describe('exploded view, reduced motion @E-07', () => {
  test('reduced motion keeps the poster: nothing explodes @E-07', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'reduced-motion', 'reduced motion only');
    await page.goto('/');
    await page.waitForTimeout(1800);
    await page.evaluate(() => scrollTo(0, 400));
    await page.waitForTimeout(300);
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    expect(await canvas(page).count()).toBe(0);
  });
});
