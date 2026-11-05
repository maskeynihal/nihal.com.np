import { test, expect } from './fixtures';

const motionBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'reduce motion' });
const soundBtn = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'sound' });

test.describe('preferences @A-03', () => {
  test('motion attribute is set before first paint', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript(() => {
      const w = window as unknown as { __a03: Record<string, unknown> };
      w.__a03 = { changes: [] as unknown[] };
      // documentElement does not exist yet in an init script: observe the document.
      new MutationObserver(() => {
        (w.__a03['changes'] as unknown[]).push({
          t: performance.now(),
          motion: document.documentElement.dataset['motion'],
        });
      }).observe(document, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-motion'],
      });
      document.addEventListener('DOMContentLoaded', () => {
        w.__a03['atDcl'] = document.documentElement.dataset['motion'];
      });
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    const r = await page.evaluate(() => {
      const w = window as unknown as {
        __a03: { atDcl: string; changes: { t: number; motion: string }[] };
      };
      const fp = performance.getEntriesByName('first-paint')[0];
      return {
        atDcl: w.__a03.atDcl,
        changes: w.__a03.changes,
        firstPaint: fp ? fp.startTime : null,
      };
    });
    const expected = info.project.name === 'reduced-motion' ? 'reduce' : 'full';
    expect(r.atDcl).toBe(expected);
    if (expected === 'reduce') {
      // SSR default is full; the inline script must flip it before any paint.
      expect(r.changes.length).toBeGreaterThan(0);
      expect(r.changes.at(-1)!.motion).toBe('reduce');
      if (r.firstPaint !== null)
        expect(r.changes[0]!.t).toBeLessThan(r.firstPaint);
    } else {
      expect(r.changes.every((c) => c.motion === 'full')).toBe(true);
    }
  });

  test('default attributes', async ({ page, javaScriptEnabled }, info) => {
    await page.goto('/');
    const html = page.locator('html');
    const motion =
      javaScriptEnabled && info.project.name === 'reduced-motion'
        ? 'reduce'
        : 'full';
    await expect(html).toHaveAttribute('data-motion', motion);
    await expect(html).toHaveAttribute('data-sound', 'off');
  });

  test('no-js: defined state, toggles hidden', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'no-js only');
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-motion', 'full');
    await expect(html).toHaveAttribute('data-sound', 'off');
    // Inert controls are misleading, so a <noscript> style hides them.
    await expect(motionBtn(page)).toBeHidden();
    await expect(soundBtn(page)).toBeHidden();
  });

  test('motion toggle flips attribute and aria-pressed, persists', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const startReduce = info.project.name === 'reduced-motion';
    const btn = motionBtn(page);
    await expect(btn).toHaveAttribute('aria-pressed', String(startReduce));
    await btn.click();
    const flipped = startReduce ? 'full' : 'reduce';
    await expect(page.locator('html')).toHaveAttribute('data-motion', flipped);
    await expect(btn).toHaveAttribute('aria-pressed', String(!startReduce));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', flipped);
    await expect(motionBtn(page)).toHaveAttribute(
      'aria-pressed',
      String(!startReduce),
    );
  });

  test('sound toggle flips state text and aria-pressed, persists', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const btn = soundBtn(page);
    const state = btn.locator('[data-sound-state]');
    await expect(state).toHaveText('off');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(state).toHaveText('on');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
    await expect(soundBtn(page).locator('[data-sound-state]')).toHaveText('on');
    await expect(soundBtn(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('legacy fragment /#projects lands on #work without a history entry', async ({
    page,
    context,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const base = await page.evaluate(() => history.length);
    const p2 = await context.newPage();
    await p2.goto('/#projects');
    expect(await p2.evaluate(() => location.hash)).toBe('#work');
    expect(await p2.evaluate(() => history.length)).toBe(base);
    await p2.close();
  });

  test('blocked localStorage: no errors, toggles work for the session', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await page.goto('/');
    await soundBtn(page).click();
    await expect(page.locator('html')).toHaveAttribute('data-sound', 'on');
    await expect(soundBtn(page)).toHaveAttribute('aria-pressed', 'true');
    const before = await page.locator('html').getAttribute('data-motion');
    await motionBtn(page).click();
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-motion',
      before!,
    );
    // consoleGuard (auto fixture) fails the test on any console error.
  });

  test('toggles are keyboard operable (Tab, Enter, Space)', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const tabTo = async (attr: string) => {
      // WebKit does not put buttons in the Tab order by default (Safari
      // setting), so there the toggle is focused directly.
      if (info.project.name === 'mobile-webkit') {
        await page.locator(`[${attr}]`).focus();
        return;
      }
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        if (
          await page.evaluate(
            (a) => document.activeElement?.hasAttribute(a) ?? false,
            attr,
          )
        )
          return;
      }
      throw new Error(`could not Tab to [${attr}]`);
    };
    await tabTo('data-motion-toggle');
    const m = motionBtn(page);
    const m0 = await m.getAttribute('aria-pressed');
    await page.keyboard.press('Enter');
    await expect(m).not.toHaveAttribute('aria-pressed', m0!);
    await page.keyboard.press('Space');
    await expect(m).toHaveAttribute('aria-pressed', m0!);

    await tabTo('data-sound-toggle');
    const s = soundBtn(page);
    await page.keyboard.press('Enter');
    await expect(s).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(s).toHaveAttribute('aria-pressed', 'false');
  });
});
