import { spawnSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const figure = (page: Page) => page.locator('[data-desk]');
const poster = (page: Page) => page.locator('[data-poster]');
const canvas = (page: Page) => page.locator('[data-desk] canvas');

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}

// The canvas path needs SwiftShader; only desktop-chromium has it.
const canvasProject = (name: string) => name === 'desktop-chromium';

test.describe('desk island shell @E-01', () => {
  test.describe.configure({ timeout: 90_000 });
  test('poster first: the Scene chunk is not in the document, the poster is @E-01', async ({
    page,
  }) => {
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('data-poster');
    expect(html).toContain('data-desk-state="poster"');
    expect(html).not.toMatch(/Scene\.[\w-]+\.js/);
    expect(html).not.toMatch(/modulepreload[^>]*Scene/);
    // Readable desk text is plain HTML, hidden (not removed) until the canvas is live.
    expect(html).toContain('reset the desk');
    expect(html).toContain(
      'drag things around. tap one to jump to its section.',
    );
  });

  test('initial module graph reaches no three, R3F or Scene chunk @E-01', () => {
    const r = spawnSync(
      'pnpm',
      [
        'exec',
        'tsx',
        'scripts/check-initial-graph.ts',
        'dist',
        '--allow-hooks',
      ],
      { encoding: 'utf8' },
    );
    expect(r.stdout + r.stderr).toContain('check-initial-graph: ok');
    expect(r.status).toBe(0);
  });

  test('canvas replaces the poster after idle; the poster is inert and the canvas is hidden from AT @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.goto('/');
    // Before the swap the poster is the drawing, in the accessibility tree.
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(
      page.getByRole('img', { name: /^Line drawing/ }),
    ).toBeVisible();
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    await expect(canvas(page)).toHaveCount(1);
    await expect(canvas(page)).toHaveAttribute('aria-hidden', 'true');
    expect(await poster(page).evaluate((el) => (el as HTMLElement).inert)).toBe(
      true,
    );
    // The crossfade ends with the poster out of the paint.
    await expect(poster(page)).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('.desk-live')).toHaveCSS('opacity', '1');
    await expect(figure(page).getByRole('status')).toHaveText('');
    await expectNoAxeViolations(page, { label: '/ with the live canvas' });
  });

  test('the canvas covers exactly the poster frame, in svh on phones and 3:2 from 768 @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    for (const [w, h] of [
      [390, 844],
      [820, 1100],
      [1280, 900],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await goLive(page);
      const p = await poster(page).boundingBox();
      const c = await page.locator('.desk-live').boundingBox();
      expect(p && c).toBeTruthy();
      expect(Math.abs(c!.width - p!.width)).toBeLessThan(1);
      expect(Math.abs(c!.height - p!.height)).toBeLessThan(1);
      if (w < 768)
        expect(c!.height).toBeCloseTo(
          Math.min(420, Math.max(320, 0.48 * h)),
          0,
        );
      else expect(c!.width / c!.height).toBeCloseTo(1.5, 1);
    }
  });

  test('swapping poster for canvas shifts nothing and the LCP element stays text in #desk @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.addInitScript(() => {
      const w = window as unknown as {
        __cls: number;
        __lcp: { tag: string; inDesk: boolean } | null;
      };
      w.__cls = 0;
      w.__lcp = null;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as {
          hadRecentInput: boolean;
          value: number;
        }[])
          if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const last = list.getEntries().at(-1) as unknown as {
          element: Element | null;
        };
        if (last?.element)
          w.__lcp = {
            tag: last.element.tagName,
            inDesk: !!last.element.closest('#desk'),
          };
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await goLive(page);
    await page.waitForTimeout(600);
    const { cls, lcp } = await page.evaluate(() => {
      const w = window as unknown as {
        __cls: number;
        __lcp: { tag: string; inDesk: boolean } | null;
      };
      return { cls: w.__cls, lcp: w.__lcp };
    });
    expect(cls).toBeLessThan(0.01);
    expect(lcp?.inDesk).toBe(true);
    expect(lcp?.tag).not.toBe('CANVAS');
  });

  test('hint and reset button show with the canvas; reset announces nothing new and fires the event @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.goto('/');
    const reset = page.locator('[data-desk-reset]');
    await expect(reset).toHaveCSS('visibility', 'hidden');
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    await expect(reset).toBeVisible();
    await expect(page.getByText('drag things around.')).toBeVisible();
    const fired = page.evaluate(
      () =>
        new Promise<boolean>((resolve) =>
          window.addEventListener('nihal:desk-reset', () => resolve(true), {
            once: true,
          }),
        ),
    );
    await reset.click();
    expect(await fired).toBe(true);
    expect((await reset.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

  test('desktop: the object list goes quiet until focus-within, but stays in the tab order @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    const list = page.locator('[data-object-list]');
    await page.goto('/');
    await expect(list).toHaveCSS('opacity', '1');
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    await expect(list).toHaveCSS('opacity', '0');
    await list.getByRole('link').first().focus();
    await expect(list).toHaveCSS('opacity', '1');
    await expectNoAxeViolations(page, { label: '/ object list focused' });
    // Below 1024 px it is always visible.
    await page.setViewportSize({ width: 820, height: 1100 });
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    await expect(list).toHaveCSS('opacity', '1');
  });

  test('resize is debounced: the canvas follows the frame within a second @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await goLive(page);
    const before = await page.evaluate(() =>
      window.__hooks!.desk!.scene!.size(),
    );
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(() => window.__hooks!.desk!.scene!.size().width),
      )
      .toBeLessThan(before.width);
  });

  test('switching motion off while live goes back to the poster @E-01', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await goLive(page);
    const frames = await page.evaluate(() =>
      window.__hooks!.desk!.scene!.frames(),
    );
    expect(frames).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'reduce motion' }).click();
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(poster(page)).toBeVisible();
    expect(await poster(page).evaluate((el) => (el as HTMLElement).inert)).toBe(
      false,
    );
    await expect(canvas(page)).toHaveCount(0);
    await expect(page.locator('[data-object-list]')).toHaveCSS('opacity', '1');
  });

  test('reduced motion or no WebGL: no canvas is created, the poster is the drawing @E-01', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(
      !javaScriptEnabled ||
        !['reduced-motion', 'no-webgl'].includes(info.project.name),
      'poster-only projects',
    );
    await page.goto('/');
    await page.waitForTimeout(1800);
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(canvas(page)).toHaveCount(0);
    await expect(poster(page)).toBeVisible();
    await expect(page.locator('[data-object-list]')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-desk-reset]')).toHaveCSS(
      'visibility',
      'hidden',
    );
    await expectNoAxeViolations(page, { label: '/ poster only' });
  });
});
