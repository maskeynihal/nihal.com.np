import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const NOTE = "3D paused. Reload if it doesn't come back.";
const KINDS = ['scene', 'shell', 'chunk', 'async'] as const;
const PHASE = {
  scene: 'render',
  shell: 'render',
  chunk: 'chunk',
  async: 'async',
} as const;

const figure = (page: Page) => page.locator('[data-desk]');
const poster = (page: Page) => page.getByRole('img', { name: /^Line drawing/ });
const note = (page: Page) => figure(page).getByRole('status');

async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__hooks?.desk !== undefined);
}

test.describe('error boundary and island isolation @A-10', () => {
  test('the poster is in the HTML and the Scene chunk is not in the initial document', async ({
    page,
  }) => {
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('role="img"');
    expect(html).not.toMatch(/Scene\.[\w-]+\.js/);
  });

  test('no JS: poster visible, no note, state stays poster', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'no-js project only');
    await page.goto('/');
    await expect(poster(page)).toBeVisible();
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    await expect(page.getByText(NOTE)).toHaveCount(0);
    await expectNoAxeViolations(page, { label: '/ with JS off' });
  });

  test('healthy page: no note, no errors; Scene mounts where 3D can run', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await ready(page);
    await expect(poster(page)).toBeVisible();
    await expect(note(page)).toHaveText('');
    if (info.project.name === 'desktop-chromium') {
      // The Scene chunk is about 1 MB; under load it takes longer than the default 5 s.
      await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
        timeout: 20_000,
      });
    } else if (
      info.project.name === 'reduced-motion' ||
      info.project.name === 'no-webgl'
    ) {
      // Motion off or no WebGL2: the Scene is never requested (poster only).
      await page.waitForTimeout(1800);
      await expect(figure(page)).toHaveAttribute('data-desk-state', 'poster');
    }
    expect(await page.evaluate(() => window.__hooks?.errors)).toEqual([]);
  });

  for (const kind of KINDS) {
    test(`fail('${kind}'): poster visible, note announced, one report, others unaffected`, async ({
      page,
      javaScriptEnabled,
    }) => {
      test.skip(!javaScriptEnabled, 'needs JS');
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      await ready(page);

      await page.evaluate((k) => window.__hooks?.desk?.fail(k), kind);

      await expect(figure(page)).toHaveAttribute('data-desk-state', 'failed');
      await expect(poster(page)).toBeVisible();
      // The same persistent live region carries the note (polite, atomic by default).
      await expect(note(page)).toHaveText(NOTE);
      await expect(note(page)).toBeVisible();
      expect(await note(page).evaluate((el) => el.getAttribute('role'))).toBe(
        'status',
      );

      const errors = await page.evaluate(() => window.__hooks?.errors);
      expect(errors).toHaveLength(1);
      expect(errors?.[0]?.phase).toBe(PHASE[kind]);

      // Failing again does not add a second entry or a second note.
      await page.evaluate((k) => window.__hooks?.desk?.fail(k), kind);
      expect(await page.evaluate(() => window.__hooks?.errors.length)).toBe(1);

      // Isolation: the sound toggle (a separate script) still works.
      const sound = page.getByRole('button', { name: /^sound/ });
      await expect(sound).toHaveAttribute('aria-pressed', 'false');
      await sound.click();
      await expect(sound).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
      // The motion toggle too, unless the OS pins it.
      const motion = page.getByRole('button', { name: 'reduce motion' });
      if ((await motion.getAttribute('aria-disabled')) !== 'true') {
        const before = await page.locator('html').getAttribute('data-motion');
        await motion.click();
        await expect(page.locator('html')).not.toHaveAttribute(
          'data-motion',
          before ?? '',
        );
      }

      await expectNoAxeViolations(page, { label: `/ after fail('${kind}')` });
      expect(pageErrors).toEqual([]);
    });
  }

  test('a global error from a desk chunk is reported and falls back; the page keeps working', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await ready(page);
    // A script served under a desk chunk name that throws from a timer.
    await page.route('**/_astro/Scene.a10fake.js', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: 'setTimeout(function () { throw new Error("scene loop crashed"); }, 0);',
      }),
    );
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.src = '/_astro/Scene.a10fake.js';
      document.head.append(s);
    });
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'failed');
    await expect(note(page)).toHaveText(NOTE);
    const errors = await page.evaluate(() => window.__hooks?.errors);
    expect(errors).toHaveLength(1);
    expect(errors?.[0]).toMatchObject({
      island: 'desk',
      phase: 'global',
      message: 'scene loop crashed',
    });
    const sound = page.getByRole('button', { name: /^sound/ });
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
  });
});
