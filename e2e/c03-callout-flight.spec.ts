import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const figure = (page: Page) => page.locator('[data-desk]');

interface Flight {
  added: boolean;
  ariaHidden: string | null;
  text: string;
  tops: number[];
  removedAt: number | null;
  startedAt: number;
}

/** Records the fixed flight layer: when it appears, what it holds, where it moves, when it goes. */
async function watchFlight(page: Page) {
  await page.evaluate(() => {
    const rec: Flight = {
      added: false,
      ariaHidden: null,
      text: '',
      tops: [],
      removedAt: null,
      startedAt: 0,
    };
    (window as unknown as { __flight: Flight }).__flight = rec;
    const sample = (layer: HTMLElement) => {
      const label = layer.firstElementChild as HTMLElement | null;
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(
        label?.style.transform ?? '',
      );
      if (m) rec.tops.push(Number(m[2]));
      if (layer.isConnected) requestAnimationFrame(() => sample(layer));
    };
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) {
          if (n instanceof HTMLElement && 'calloutFlight' in n.dataset) {
            rec.added = true;
            rec.startedAt = performance.now();
            rec.ariaHidden = n.getAttribute('aria-hidden');
            rec.text = n.textContent ?? '';
            sample(n);
          }
        }
        for (const n of r.removedNodes)
          if (n instanceof HTMLElement && 'calloutFlight' in n.dataset)
            rec.removedAt = performance.now();
      }
    }).observe(document.body, { childList: true });
  });
}
const flight = (page: Page) =>
  page.evaluate(() => (window as unknown as { __flight: Flight }).__flight);

test.describe('object-tap shared callout @C-03', () => {
  test.describe.configure({ timeout: 120_000 });

  test('tapping an object flies its label to the section, then removes it @C-03', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
    await page.goto('/');
    await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
      timeout: 45_000,
    });
    await page.locator('[data-desk] canvas').scrollIntoViewIfNeeded();
    await watchFlight(page);
    const hit = await page.evaluate(() =>
      window.__hooks!.desk!.scene!.pick('arduino'),
    );
    await page.mouse.click(hit!.x, hit!.y);

    await expect.poll(async () => (await flight(page)).added).toBe(true);
    const mid = await flight(page);
    expect(mid.ariaHidden).toBe('true');
    expect(mid.text).toBe('uno r4');
    await expectNoAxeViolations(page, { label: '/ during the callout flight' });

    await expect
      .poll(async () => (await flight(page)).removedAt, { timeout: 5000 })
      .not.toBeNull();
    const done = await flight(page);
    const ms = done.removedAt! - done.startedAt;
    expect(ms).toBeGreaterThanOrEqual(560);
    // 600 ms of flight; the canvas is full-viewport now and SwiftShader redraws all of it on every
    // scrolled frame, which can stretch the last frames on a loaded machine.
    expect(ms).toBeLessThan(1300);
    // It moved (the label travelled), and nothing is left behind.
    expect(new Set(done.tops).size).toBeGreaterThan(3);
    await expect(page.locator('[data-callout-flight]')).toHaveCount(0);
    // The one scroll owner focused the section heading.
    const inPanel = await page.evaluate(
      () => !!document.activeElement?.closest('#work-car-sensors'),
    );
    expect(inPanel).toBe(true);
    // The label text exists once for a screen reader: only the aria-hidden copy was extra.
    await expect(page.getByText('uno r4', { exact: true })).toHaveCount(1);
  });

  test('reduced motion: a plain jump, no copy of the label @C-03', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'reduced-motion', 'reduced-motion project');
    await page.goto('/');
    await watchFlight(page);
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('nihal:callout', {
          detail: {
            target: '#open-source',
            text: 'uno r4',
            rect: { left: 100, top: 100, width: 40, height: 12 },
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent('nihal:navigate', { detail: '#open-source' }),
      );
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest('section')?.id),
      )
      .toBe('open-source');
    await page.waitForTimeout(800);
    expect((await flight(page)).added).toBe(false);
    await expect(page.locator('[data-callout-flight]')).toHaveCount(0);
  });

  test('a navigate with no announced label does not fly anything @C-03', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'desktop only');
    await page.goto('/');
    await watchFlight(page);
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('nihal:navigate', { detail: '#open-source' }),
      ),
    );
    await page.waitForTimeout(800);
    expect((await flight(page)).added).toBe(false);
  });
});
