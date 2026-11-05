import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';
import { clocks } from '../src/content/clocks';
import { copy } from '../src/content/copy';
import { formatClock } from '../src/lib/time';

const shown = clocks.filter((c) => c.confirmed);
const email = copy.titleBlock.email;

/** Capture clipboard writes without needing browser permissions (WebKit has no grant API). */
const stubClipboard = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __copied: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (t: string) => {
          w.__copied.push(t);
          return Promise.resolve();
        },
      },
    });
  });

test.describe('copy email and clocks @B-06a', () => {
  test('the address is a real mailto link in the served HTML @B-06a', async ({
    page,
  }) => {
    const html = await (await page.request.get('/')).text();
    expect(html.split(`href="mailto:${email}"`).length - 1).toBe(2);
    await page.goto('/');
    for (const link of await page.getByRole('link', { name: email }).all()) {
      await expect(link).toHaveAttribute('href', `mailto:${email}`);
    }
  });

  test('clicking copies the address, says copied for 1.6 s, then restores @B-06a', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await stubClipboard(page);
    await page.goto('/');
    const link = page.locator('#contact [data-copy-email]');
    const status = page.locator('#contact [data-copy-status]');
    await link.scrollIntoViewIfNeeded();
    await expect(status).toHaveAttribute('role', 'status');
    await link.click();
    expect(
      await page.evaluate(
        () => (window as unknown as { __copied: string[] }).__copied,
      ),
    ).toEqual([email]);
    await expect(link).toHaveText(copy.contact.copied);
    await expect(status).toHaveText(copy.contact.copied);
    await expectNoAxeViolations(page, { label: '/ copied state' });
    await expect(link).toHaveText(email, { timeout: 3000 });
    await expect(status).toHaveText('');
    await expect(page).toHaveURL(/\/$/);
  });

  test('keyboard activation copies too @B-06a', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await stubClipboard(page);
    await page.goto('/');
    const link = page.locator('#contact [data-copy-email]');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(link).toHaveText(copy.contact.copied);
  });

  test('without the clipboard API it selects the text and uses copy @B-06a', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: undefined,
      });
      const w = window as unknown as { __selected: string[] };
      w.__selected = [];
      document.execCommand = (cmd: string) => {
        w.__selected.push(`${cmd}:${window.getSelection()?.toString() ?? ''}`);
        return true;
      };
    });
    await page.goto('/');
    const link = page.locator('#contact [data-copy-email]');
    await link.click();
    await expect(link).toHaveText(copy.contact.copied);
    expect(
      await page.evaluate(
        () => (window as unknown as { __selected: string[] }).__selected,
      ),
    ).toEqual([`copy:${email}`]);
  });

  test('a modified click is left to the browser @B-06a', async ({
    page,
    javaScriptEnabled,
    browserName,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(
      browserName !== 'chromium',
      'modifier-click is checked in Chromium',
    );
    await stubClipboard(page);
    await page.goto('/');
    const link = page.locator('#contact [data-copy-email]');
    // Observe on document (after the page script), then cancel so the test does not navigate.
    const prevented = await link.evaluate((a) => {
      let seen = true;
      document.addEventListener(
        'click',
        (e) => {
          seen = e.defaultPrevented;
          e.preventDefault();
        },
        { once: true },
      );
      a.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
      return seen;
    });
    expect(prevented).toBe(false);
    expect(
      await page.evaluate(
        () => (window as unknown as { __copied: string[] }).__copied,
      ),
    ).toEqual([]);
  });

  test('clocks: confirmed cities only, zone names in the HTML @B-06a', async ({
    page,
  }) => {
    const html = await (await page.request.get('/')).text();
    for (const c of shown) expect(html).toContain(c.city);
    for (const c of clocks.filter((x) => !x.confirmed))
      expect(html).not.toContain(`>${c.city}<`);
    await page.goto('/');
    await expect(page.locator('#contact [data-clock]')).toHaveCount(
      shown.length,
    );
    const first = page.locator('#contact [data-clock]').first();
    await expect(first.locator('.clock-city')).toHaveText('kathmandu');
    await expect(first.locator('[data-clock-offset]')).toHaveText('utc+5:45');
    await expect(first.locator('time')).toHaveText(/^\d\d:\d\d$/);
    await expect(first.locator('time')).toHaveAttribute(
      'datetime',
      /^\d{4}-\d\d-\d\dT/,
    );
    await expect(first.locator('.clock-reading')).toHaveCSS(
      'font-variant-numeric',
      /tabular-nums/,
    );
    await expect(first.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expectNoAxeViolations(page, { label: '/ contact clocks' });
  });

  test('clocks show current Kathmandu time and the hands agree @B-06a', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.clock.install({ time: new Date('2026-11-05T09:00:20Z') });
    await page.goto('/');
    const t = page.locator('#contact [data-clock-time]');
    await expect(t).toHaveText(formatClock(new Date('2026-11-05T09:00:20Z')));
    await expect(t).toHaveText('14:45');
    const hands = async () =>
      page
        .locator('#contact [data-clock] [data-hand]')
        .evaluateAll((h) => h.map((x) => x.getAttribute('transform')));
    expect(await hands()).toEqual(['rotate(82.5 50 50)', 'rotate(270 50 50)']);
    // 40 s later the minute boundary passes: 14:46.
    await page.clock.runFor(41_000);
    await expect(t).toHaveText('14:46');
    expect(await hands()).toEqual(['rotate(83 50 50)', 'rotate(276 50 50)']);
  });

  test('no JS: address and clock zone names still read @B-06a', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'no-js project only');
    await page.goto('/');
    const c = page.locator('#contact');
    await expect(c.getByRole('link', { name: email })).toHaveAttribute(
      'href',
      `mailto:${email}`,
    );
    await expect(c).toContainText('kathmandu');
    await expect(c).toContainText('utc+5:45');
    await expect(c.locator('time').first()).toHaveText(/^\d\d:\d\d$/);
  });
});
