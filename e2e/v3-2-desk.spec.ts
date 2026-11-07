import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

// v3.2 desk: no visible instructions (D1: an unprompted nudge instead), scroll motion (D3) and the
// one-source feel (D2, the numbers themselves are measured, not asserted here). SwiftShader, so
// desktop-chromium only.

const figure = (page: Page) => page.locator('[data-desk]');

/** Samples the springs every 16 ms for `ms`; the largest |shift| (m) per object id. */
function sample(page: Page, ms: number) {
  return page.evaluate(
    (total) =>
      new Promise<Record<string, number>>((resolve) => {
        const peak: Record<string, number> = {};
        const t0 = performance.now();
        const id = setInterval(() => {
          for (const s of window.__hooks!.desk!.scene!.motion())
            peak[s.id] = Math.max(peak[s.id] ?? 0, Math.abs(s.x));
          if (performance.now() - t0 > total) {
            clearInterval(id);
            resolve(peak);
          }
        }, 16);
      }),
    ms,
  );
}

async function live(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}

test.describe('desk v3.2 @V3-2-desk', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });
  test.describe.configure({ timeout: 120_000 });

  test('no instruction text; one small ball rocks once per visit without loading physics @V3-2-desk', async ({
    page,
  }) => {
    await live(page);
    await expect(page.getByText('pick something up')).toHaveCount(0);
    const peak = await sample(page, 7000);
    // About 8 px of travel: a few millimetres to a centimetre in the table's units.
    expect(peak['ball-s'] ?? 0).toBeGreaterThan(0.004);
    expect(peak['ball-s'] ?? 0).toBeLessThan(0.02);
    // Nothing else moved on its own, and the engine was not asked for.
    expect(peak['laptop'] ?? 0).toBe(0);
    expect(
      await page.evaluate(() => window.__hooks!.desk!.scene!.physics().state),
    ).toBe('idle');
    // Once per visit: a reload in the same tab does not nudge again.
    await page.reload();
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    const again = await sample(page, 4500);
    expect(again['ball-s'] ?? 0).toBeLessThan(0.0005);
  });

  test('scroll sways the objects: light ones more than heavy ones, back to rest, no physics, no drift @V3-2-desk', async ({
    page,
  }) => {
    await live(page);
    await page.evaluate(() => sessionStorage.setItem('nihal:desk-nudge', '1'));
    await figure(page).locator('canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const pos = async () =>
      (await page.evaluate(() => window.__hooks!.desk!.scene!.pick('ball-m')))!;
    const y0 = (await pos()).y + (await page.evaluate(() => scrollY));
    const done = sample(page, 1500);
    // Scroll events arrive about every 150 ms under SwiftShader, so a wheel step of 380 px is a
    // fast scroll (about 2500 px/s). Alternate directions so the table stays on screen.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, i % 2 ? -380 : 380);
      await page.waitForTimeout(40);
    }
    const peak = await done;
    expect(peak['pacman-1'] ?? 0).toBeGreaterThan(0.001);
    // A few px at most: never more than 0.01 m (6 px) for any object.
    for (const v of Object.values(peak)) expect(v).toBeLessThan(0.01);
    expect(peak['pacman-1'] ?? 0).toBeGreaterThan((peak['laptop'] ?? 0) * 2);
    await page.waitForTimeout(1500);
    const rest = await page.evaluate(() =>
      window.__hooks!.desk!.scene!.motion(),
    );
    for (const s of rest) expect(Math.abs(s.x)).toBeLessThan(0.0005);
    const y1 = (await pos()).y + (await page.evaluate(() => scrollY));
    // The table itself did not move against the page; only its objects swayed, and they are back.
    expect(Math.abs(y1 - y0)).toBeLessThan(1.5);
    expect(
      await page.evaluate(() => window.__hooks!.desk!.scene!.physics().state),
    ).toBe('idle');
  });

  test('a hard sideways throw is handed to the fall layer at the canvas edge: no jump back inside @V3-2-desk', async ({
    page,
  }) => {
    await live(page);
    await page.locator('[data-desk] canvas').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const o = (await page.evaluate(() =>
      window.__hooks!.desk!.scene!.pick('ball-m'),
    ))!;
    await page.mouse.move(o.x, o.y);
    await page.mouse.down();
    await page.mouse.move(o.x + 14, o.y - 8, { steps: 3 });
    await expect
      .poll(
        () =>
          page.evaluate(() => window.__hooks!.desk!.scene!.physics().grabbed),
        { timeout: 30_000 },
      )
      .toBe('ball-m');
    // Carried near the rim: the fall canvas is asked for and comes up.
    await page.mouse.move(1180, o.y - 60, { steps: 10 });
    await expect
      .poll(
        () => page.evaluate(() => window.__hooks!.desk!.scene!.fall().state),
        { timeout: 30_000 },
      )
      .toBe('ready');
    // Whatever the carried ball pushed on the way has been handed over and settled by now.
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__hooks!.desk!.scene!.hold(true));
    const log = await page.evaluate(() => {
      const s = window.__hooks!.desk!.scene!;
      // 5 m/s (the throw cap) from the far side of the drag area.
      s.teleport('ball-m', 1.05, 0.06, -0.1, [5, 0, 0]);
      for (let i = 0; i < 200; i++) {
        s.stepWorlds(1);
        if ((s.handoffs() as { id: string }[]).some((x) => x.id === 'ball-m'))
          break;
      }
      return s.handoffs() as {
        id: string;
        before: { x: number; w: number };
        errPx: number;
      }[];
    });
    const h = log.find((x) => x.id === 'ball-m')!;
    expect(h, 'a handoff of ball-m').toBeTruthy();
    // Handed over while its picture was still inside the screen, and unchanged by the swap.
    expect(h.before.x + h.before.w / 2).toBeLessThan(1280);
    expect(h.errPx).toBeLessThan(6);
  });
});
