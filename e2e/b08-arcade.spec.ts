import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';
import { copy } from '../src/content/copy';
import { work } from '../src/content/work';

const game = work.find((w) => w.id === 'pac-man')!;
const GAME_URL = game.arcade!.href;
const panel = (page: Page) => page.locator('#work-pac-man');

/** Stand-in for the cross-origin GitHub Pages game, so the suite needs no network. */
async function stubGame(page: Page) {
  await page.route(`${GAME_URL}**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>game</title><button id="game">in the game</button>',
    }),
  );
}

async function openArcade(page: Page) {
  await stubGame(page);
  await page.goto('/');
  await page.locator('#work-pac-man [data-arcade-play]').click();
}

test.describe('arcade panel @B-08', () => {
  test('before play: no iframe in the HTML or DOM, the direct link is there @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    const html = await (await page.request.get('/')).text();
    expect(html).not.toContain('<iframe');
    await page.goto('/');
    await expect(page.locator('iframe')).toHaveCount(0);
    const link = panel(page).getByRole('link', {
      name: copy.work.openNewTab,
    });
    await expect(link).toHaveAttribute('href', GAME_URL);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    const play = panel(page).getByRole('button', { name: copy.work.play });
    // The button only exists as a control when script can run; no-js keeps just the link.
    if (javaScriptEnabled) await expect(play).toBeVisible();
    else await expect(play).toBeHidden();
    await expect(panel(page).locator('[data-arcade-stage]')).toBeHidden();
    await expectNoAxeViolations(page, { label: '/ arcade closed' });
  });

  test('play makes a titled, sandboxed, lazy iframe and focuses the region @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await openArcade(page);
    const frame = page.locator('#work-pac-man iframe');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveAttribute('src', GAME_URL);
    await expect(frame).toHaveAttribute('title', game.title);
    await expect(frame).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-same-origin',
    );
    await expect(frame).toHaveAttribute('loading', 'lazy');
    await expect(
      panel(page).getByRole('button', { name: copy.work.play }),
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page).locator('[data-arcade-stage]')).toBeFocused();
    await expect(
      panel(page).getByRole('button', { name: copy.work.leave }),
    ).toBeVisible();
    await expect(
      page.frameLocator('#work-pac-man iframe').locator('#game'),
    ).toBeVisible();
    await expectNoAxeViolations(page, { label: '/ arcade open' });
  });

  test('Escape closes, removes the iframe and returns focus to play @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await openArcade(page);
    await expect(page.locator('iframe')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(
      panel(page).getByRole('button', { name: copy.work.play }),
    ).toBeFocused();
    await expect(
      panel(page).getByRole('button', { name: copy.work.play }),
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page).locator('[data-arcade-stage]')).toBeHidden();
    // The listener is gone: Escape elsewhere does nothing, and play can open it again.
    await page.keyboard.press('Enter');
    await expect(page.locator('iframe')).toHaveCount(1);
  });

  test('the "esc to leave" button works from inside the frame, by keyboard @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await openArcade(page);
    // Focus is inside the cross-origin frame: key events no longer reach this page.
    await page.frameLocator('#work-pac-man iframe').locator('#game').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('iframe')).toHaveCount(1);
    // Shift+Tab leads out of the frame to the leave button; Enter closes.
    const leave = panel(page).getByRole('button', { name: copy.work.leave });
    await leave.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(
      panel(page).getByRole('button', { name: copy.work.play }),
    ).toBeFocused();
  });

  test('pressing play twice never makes a second iframe @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await openArcade(page);
    await panel(page).getByRole('button', { name: copy.work.play }).click();
    await panel(page).getByRole('button', { name: copy.work.play }).click();
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(panel(page).locator('[data-arcade-stage]')).toBeFocused();
  });

  test('keyboard only: Enter on play, Escape back @B-08', async ({
    page,
    javaScriptEnabled,
    isMobile,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(isMobile, 'keyboard path is a desktop concern');
    await stubGame(page);
    await page.goto('/');
    await panel(page).getByRole('button', { name: copy.work.play }).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('[data-arcade-stage]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(
      panel(page).getByRole('button', { name: copy.work.play }),
    ).toBeFocused();
  });

  test('the frame fits a 320 px phone @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.setViewportSize({ width: 320, height: 700 });
    await openArcade(page);
    await expect(page.locator('#work-pac-man iframe')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

test.describe('arcade under the production CSP @B-08', () => {
  test.use({ baseURL: 'http://localhost:4391' });

  test('opening the game raises no CSP violation @B-08', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript(() => {
      const list: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = list;
      document.addEventListener('securitypolicyviolation', (e) => {
        list.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await openArcade(page);
    await expect(
      page.frameLocator('#work-pac-man iframe').locator('#game'),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      ),
    ).toEqual([]);
  });
});
