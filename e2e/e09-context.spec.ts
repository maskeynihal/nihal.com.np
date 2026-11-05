import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const NOTE = "3D paused. Reload if it doesn't come back.";
const figure = (page: Page) => page.locator('[data-desk]');
const note = (page: Page) => figure(page).getByRole('status');
const scene = <T>(page: Page, fn: (s: DeskSceneHooks) => T) =>
  page.evaluate(`(${fn.toString()})(window.__hooks.desk.scene)`) as Promise<T>;

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}

test.describe('context loss and disposal @E-09', () => {
  test.describe.configure({ timeout: 120_000 });

  test('a lost context shows the poster and note; one restore brings it back; a second loss is final @E-09', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await goLive(page);
    await scene(page, (s) => s.loseContext());
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(note(page)).toHaveText(NOTE);
    await scene(page, (s) => s.restoreContext());
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live');
    await expect(note(page)).toHaveText('');
    expect(await scene(page, (s) => s.contextLost())).toBe(false);
    // The canvas draws again.
    const before = await scene(page, (s) => s.frames());
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.mouse.move(300, 300);
    await scene(page, (s) => s.quiet(false));
    await expect
      .poll(() => scene(page, (s) => s.frames()), { timeout: 10_000 })
      .toBeGreaterThan(before);

    await scene(page, (s) => s.loseContext());
    // Second loss: permanent, with no second wait. The Scene is gone, the poster and the note stay.
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'failed');
    await expect(note(page)).toHaveText(NOTE);
    await expect(page.locator('[data-desk] canvas')).toHaveCount(0);
    await expectNoAxeViolations(page, {
      label: '/ with the context lost for good',
    });
  });

  test('a restore that never comes is final after the wait @E-09', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await goLive(page);
    await scene(page, (s) => s.loseContext());
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    // Paused (poster and note, one restore pending); both this and the final state show the same.
    await expectNoAxeViolations(page, { label: '/ with the context lost' });
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'failed', {
      timeout: 10_000,
    });
    await expect(note(page)).toHaveText(NOTE);
  });

  test('unmounting disposes everything: memory is back to baseline after 5 cycles @E-09', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await goLive(page);
    const baseline = await scene(page, (s) => s.memory());
    expect(baseline!.geometries).toBeGreaterThan(0);
    for (let i = 0; i < 5; i++) {
      // Reduce motion unmounts the Scene (poster); full mounts a fresh one.
      await page.evaluate(() => {
        document.documentElement.dataset['motion'] = 'reduce';
        window.dispatchEvent(
          new CustomEvent('nihal:motion', { detail: { motion: 'reduce' } }),
        );
      });
      await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
      await expect(page.locator('[data-desk] canvas')).toHaveCount(0);
      expect(
        await page.evaluate(() => window.__hooks!.desk!.disposed()),
      ).toEqual({
        geometries: 0,
        textures: 0,
      });
      await page.evaluate(() => {
        document.documentElement.dataset['motion'] = 'full';
        window.dispatchEvent(
          new CustomEvent('nihal:motion', { detail: { motion: 'full' } }),
        );
      });
      await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
        timeout: 45_000,
      });
    }
    expect(await scene(page, (s) => s.memory())).toEqual(baseline);
  });
});

test.describe('low-end devices get the poster @E-09', () => {
  const cases: [string, (page: Page) => Promise<unknown>][] = [
    [
      'saveData',
      async (page) =>
        page.addInitScript(() => {
          Object.defineProperty(navigator, 'connection', {
            value: { saveData: true },
            configurable: true,
          });
        }),
    ],
    [
      'deviceMemory 2',
      async (page) =>
        page.addInitScript(() => {
          Object.defineProperty(navigator, 'deviceMemory', {
            value: 2,
            configurable: true,
          });
        }),
    ],
    [
      'viewport 340',
      async (page) => {
        await page.setViewportSize({ width: 340, height: 700 });
      },
    ],
  ];
  for (const [name, setup] of cases) {
    test(`${name}: poster only, no canvas, no Scene chunk @E-09`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
      await setup(page);
      const scripts: string[] = [];
      page.on('request', (r) => scripts.push(r.url()));
      await page.goto('/');
      await page.waitForFunction(() => window.__hooks?.desk !== undefined);
      await page.waitForTimeout(3000);
      await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
      await expect(page.locator('[data-desk] canvas')).toHaveCount(0);
      expect(scripts.some((u) => /Scene\./.test(u))).toBe(false);
      await expectNoAxeViolations(page, { label: `/ low-end (${name})` });
    });
  }

  test('no WebGL2: poster only @E-09', async ({ page }, info) => {
    test.skip(info.project.name !== 'no-webgl', 'no-webgl project');
    await page.goto('/');
    await page.waitForTimeout(3000);
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(page.locator('[data-desk] canvas')).toHaveCount(0);
  });
});
