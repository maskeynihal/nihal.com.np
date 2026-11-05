import type { Locator, Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const figure = (page: Page) => page.locator('[data-desk]');
const canvas = (page: Page) => page.locator('[data-desk] canvas');
const tips = (page: Page) => page.locator('[data-desk] [role="tooltip"]');
const tip = (page: Page, id: string) =>
  page.locator(`[data-desk] [role="tooltip"][data-callout="${id}"]`);

const NOTES: Record<string, string> = {
  arduino: 'uno r4',
  'clock-ktm': 'ktm',
  calendar: 'bikram sambat',
  ghost: 'canvas, 2020',
};

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
  await canvas(page).scrollIntoViewIfNeeded();
}

const opacity = (l: Locator) =>
  l.evaluate((el) => Number(getComputedStyle(el).opacity));
const duration = (l: Locator) =>
  l.evaluate((el) => getComputedStyle(el).transitionDuration);
const lines = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.callouts());

async function where(page: Page, id: string) {
  const p = await page.evaluate(
    (i) => window.__hooks!.desk!.scene!.pick(i),
    id,
  );
  const box = await canvas(page).boundingBox();
  if (!p || !box) throw new Error(`no position for ${id}`);
  return { x: box.x + p.x, y: box.y + p.y, box };
}

test.describe('callouts @E-06', () => {
  test.describe.configure({ timeout: 120_000 });
  // Playwright needs the destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });

  test('every confirmed object has a tooltip label at half strength, inside the drawing @E-06', async ({
    page,
  }) => {
    await goLive(page);
    await page.mouse.move(2, 2);
    await expect(tips(page)).toHaveCount(4);
    const texts = await tips(page).allTextContents();
    expect([...texts].sort()).toEqual(Object.values(NOTES).sort());
    for (const [id, text] of Object.entries(NOTES)) {
      const l = tip(page, id);
      await expect(l).toHaveText(text);
      expect(await opacity(l)).toBeCloseTo(0.5, 2);
    }
    // Real DOM nodes, not canvas text, and inside the canvas box.
    const box = (await canvas(page).boundingBox())!;
    for (const id of Object.keys(NOTES)) {
      const b = (await tip(page, id).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(b.y).toBeGreaterThanOrEqual(box.y - 1);
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(box.y + box.height + 1);
    }
    for (const l of await lines(page)) {
      expect(l.lineOpacity).toBeCloseTo(0.5, 2);
      expect(l.active).toBe(false);
    }
    await expectNoAxeViolations(page, { label: '/ desk with callouts' });
  });

  test('hovering an object brings its label to full strength in 160 ms, and back in 240 ms @E-06', async ({
    page,
  }) => {
    await goLive(page);
    const o = await where(page, 'arduino');
    await page.mouse.move(o.x, o.y);
    const l = tip(page, 'arduino');
    await expect.poll(() => opacity(l)).toBeCloseTo(1, 2);
    expect(await duration(l)).toBe('0.16s');
    expect(await opacity(tip(page, 'ghost'))).toBeCloseTo(0.5, 2);
    await expect
      .poll(
        async () =>
          (await lines(page)).find((x) => x.id === 'arduino')!.lineOpacity,
      )
      .toBeCloseTo(1, 2);

    await page.mouse.move(o.box.x + 3, o.box.y + 3);
    await expect.poll(() => opacity(l)).toBeCloseTo(0.5, 2);
    expect(await duration(l)).toBe('0.24s');
    await expect
      .poll(
        async () =>
          (await lines(page)).find((x) => x.id === 'arduino')!.lineOpacity,
      )
      .toBeCloseTo(0.5, 2);
  });

  test('a held object keeps its label at full strength and the label follows it @E-06', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await goLive(page);
    const o = await where(page, 'ghost');
    // The label is placed on the first drawn frame.
    await expect
      .poll(async () => (await tip(page, 'ghost').boundingBox())?.x ?? 0)
      .toBeGreaterThan(50);
    const before = (await tip(page, 'ghost').boundingBox())!;
    await page.mouse.move(o.x, o.y);
    await page.mouse.down();
    await page.mouse.move(o.x - 8, o.y + 4, { steps: 2 });
    await expect
      .poll(
        () =>
          page.evaluate(() => window.__hooks!.desk!.scene!.physics().grabbed),
        {
          timeout: 30_000,
        },
      )
      .toBe('ghost');
    await page.mouse.move(o.x - 160, o.y + 20, { steps: 6 });
    await expect.poll(() => opacity(tip(page, 'ghost'))).toBeCloseTo(1, 2);
    await expect
      .poll(async () => ((await tip(page, 'ghost').boundingBox()) ?? before).x)
      .toBeLessThan(before.x - 60);
    await page.mouse.up();
    // Let go and park the pointer elsewhere: back to half strength.
    await page.mouse.move(o.box.x + 3, o.box.y + 3);
    await expect
      .poll(() => opacity(tip(page, 'ghost')), { timeout: 15_000 })
      .toBeCloseTo(0.5, 2);
  });
});

test.describe('callouts, reduced motion @E-06', () => {
  test('reduced motion shows the poster only: no labels @E-06', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'reduced-motion', 'reduced motion only');
    await page.goto('/');
    await page.waitForTimeout(1800);
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(tips(page)).toHaveCount(0);
  });
});
