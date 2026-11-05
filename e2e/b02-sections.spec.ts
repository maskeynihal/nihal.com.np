import { test, expect, expectNoAxeViolations } from './fixtures';
import type { Page } from '@playwright/test';

const IDS = [
  'desk',
  'work',
  'open-source',
  'writing',
  'cv',
  'contact',
  'colophon',
];

/** Text nodes holding -> or <- whose nearest element is not set in JetBrains Mono. */
async function arrowsOutsideMono(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bad: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!/[→←]/.test(n.textContent ?? '')) continue;
      const el = n.parentElement;
      if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const first = getComputedStyle(el)
        .fontFamily.split(',')[0]
        ?.trim()
        .replace(/['"]/g, '');
      if (first !== 'JetBrains Mono')
        bad.push(`${el.tagName}.${el.className}: ${n.textContent}`);
    }
    return bad;
  });
}

test.describe('sections and panels @B-02', () => {
  test('seven headed sections in order, each a labelled region @B-02', async ({
    page,
  }) => {
    await page.goto('/');
    const ids = await page
      .locator('main > section')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids).toEqual(IDS);
    for (const id of IDS) {
      const s = page.locator(`#${id}`);
      await expect(s).toHaveAttribute('aria-labelledby', /.+/);
      const labelId = (await s.getAttribute('aria-labelledby')) ?? '';
      await expect(page.locator(`#${labelId}`)).not.toBeEmpty();
    }
    await expect(page.locator('h1')).toHaveCount(1);
    await expectNoAxeViolations(page, { label: '/ sections' });
  });

  test('sections alternate sides on a 12-column grid, never centred @B-02', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const x = async (id: string) => {
      const b = await page.locator(`#${id}-heading`).boundingBox();
      return b!.x;
    };
    const work = await x('work');
    const oss = await x('open-source');
    const writing = await x('writing');
    const cv = await x('cv');
    expect(oss).toBeGreaterThan(work + 150);
    expect(Math.abs(writing - work)).toBeLessThan(2);
    expect(Math.abs(cv - oss)).toBeLessThan(2);
    expect(work).toBeGreaterThan(200); // column 2, not the margin
  });

  test('rhythm is 160 px on desktop and 96 px on phones @B-02', async ({
    page,
  }) => {
    const gap = () =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('#work')!);
        return (
          parseFloat(cs.paddingBlockStart) + parseFloat(cs.paddingBlockEnd)
        );
      });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    expect(await gap()).toBe(160);
    await page.setViewportSize({ width: 375, height: 800 });
    expect(await gap()).toBe(96);
  });

  for (const width of [320, 375, 768, 1024, 1280])
    test(`no horizontal scroll at ${width}px @B-02`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');
      const w = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(w[0]).toBeLessThanOrEqual(w[1]!);
      // Evidence for the visual review (baselines arrive with F-01).
      await info.attach(`sheet-${width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });

  test('panels below the fold fade in with opacity only @B-02', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/');
    const panel = page.locator('#contact .panel');
    const style = () =>
      panel.evaluate((e) => {
        const cs = getComputedStyle(e);
        return {
          op: cs.opacity,
          prop: cs.transitionProperty,
          tf: cs.transform,
        };
      });
    expect((await style()).prop).toBe('opacity');
    expect((await style()).tf).toBe('none');
    if (!javaScriptEnabled || info.project.name === 'reduced-motion') {
      // No JS or motion off: never hidden.
      expect((await style()).op).toBe('1');
      return;
    }
    await expect.poll(async () => (await style()).op).toBe('0');
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toHaveCSS('opacity', '1');
    await expectNoAxeViolations(page, { label: '/ contact panel shown' });
  });

  test('every rendered arrow is set in JetBrains Mono @B-02', async ({
    page,
  }) => {
    await page.goto('/');
    expect(await arrowsOutsideMono(page)).toEqual([]);
  });

  test('self-test: the arrow guard catches a Fraunces arrow @B-02', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.textContent = 'a → b';
      document.querySelector('main')?.append(p);
      const q = document.createElement('p');
      q.className = 'label';
      q.textContent = 'a ← b';
      document.querySelector('main')?.append(q);
    });
    const bad = await arrowsOutsideMono(page);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain('→');
  });
});
