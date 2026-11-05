import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';
import { copy } from '../src/content/copy';
import { objects } from '../src/content/objects';
import { buildPosterAlt } from '../src/content/poster-alt';
import { formatClock } from '../src/lib/time';

// The default build shows confirmed objects only (content/index.ts getObjects).
const shown = objects.filter((o) => o.confirmed);
const list = (page: Page) => page.locator('[data-object-list] a');

test.describe('title block and poster @B-03', () => {
  test('h1 is the one real-text name, and the sentence and rows are text @B-03', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('nihal maskey');
    expect(await page.locator('h1').innerText()).toBe('nihal maskey');
    await expect(page.locator('#desk h1')).toHaveCSS('opacity', '1');
    const block = page.locator('.title-block');
    await expect(block).toContainText(
      copy.titleBlock.options[copy.titleBlock.selected],
    );
    await expect(
      block.getByRole('link', { name: copy.titleBlock.email }),
    ).toHaveAttribute('href', `mailto:${copy.titleBlock.email}`);
    await expect(block).toContainText(copy.titleBlock.timeLabel);
    await expectNoAxeViolations(page, { label: '/ title block' });
  });

  test('rev, sheet and scale come from the content template and the build @B-03', async ({
    page,
  }) => {
    await page.goto('/');
    const row = page.locator('.title-block-rows li').last();
    await expect(row).toHaveText(
      /^rev \d{4}\.(0[1-9]|1[0-2]) · sheet 1 of 1 · scale 1:1$/,
    );
  });

  test('the live time is Kathmandu time, filled in by script only @B-03', async ({
    page,
    javaScriptEnabled,
  }) => {
    await page.goto('/');
    const t = page.locator('[data-live-time]');
    if (!javaScriptEnabled) {
      await expect(t).toHaveText('');
      return;
    }
    await expect(t).toHaveText(/^\d\d:\d\d$/);
    const shownTime = (await t.textContent()) ?? '';
    const now = Date.now();
    const ok = [0, 60_000].map((d) => formatClock(new Date(now - d)));
    expect(ok).toContain(shownTime);
    await expect(t).toHaveAttribute('datetime', /^\d{4}-\d\d-\d\dT/);
  });

  test('the poster is inline SVG, role img, described from the shown objects, no JS needed @B-03', async ({
    page,
  }) => {
    await page.goto('/');
    const poster = page.locator('#desk svg.poster');
    await expect(poster).toHaveCount(1);
    await expect(poster).toHaveAttribute('role', 'img');
    await expect(poster).toHaveAttribute('aria-label', buildPosterAlt(shown));
    await expect(poster).toBeVisible();
    const box = await poster.boundingBox();
    expect(box!.width).toBeGreaterThan(200);
    expect(box!.height).toBeGreaterThan(100);
    // It is in the served HTML (not drawn by script).
    const html = await (await page.request.get('/')).text();
    expect(html).toMatch(/<svg class="poster" role="img"/);
  });

  test('phone order: title block, then the drawing, then the object list @B-03', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const y = async (sel: string) =>
      (await page.locator(sel).first().boundingBox())!.y;
    const title = await y('.title-block');
    const drawing = await y('[data-desk]');
    const objects = await y('[data-object-list]');
    expect(title).toBeLessThan(drawing);
    expect(drawing).toBeLessThan(objects);
    // DOM order matches (one list node for every viewport).
    await expect(page.locator('[data-object-list]')).toHaveCount(1);
    const order = await page
      .locator('.desk-stage > :not(script)')
      .evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
    expect(order).toEqual(['paper', 'desk', 'label']);
  });

  test('desktop: title block beside the drawing, list under it, nothing covers the poster @B-03', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const tb = (await page.locator('.title-block').boundingBox())!;
    const dk = (await page.locator('[data-desk]').boundingBox())!;
    const ls = (await page.locator('[data-object-list]').boundingBox())!;
    expect(tb.x + tb.width).toBeLessThanOrEqual(dk.x + 1);
    expect(ls.y).toBeGreaterThanOrEqual(dk.y + dk.height - 1);
  });

  test('the object list is real links derived from the shown objects @B-03', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(list(page)).toHaveCount(shown.length);
    const hrefs = await list(page).evaluateAll((a) =>
      a.map((x) => x.getAttribute('href')),
    );
    expect(hrefs).toEqual(shown.map((o) => o.target));
    const texts = await list(page).allTextContents();
    for (const [i, o] of shown.entries())
      expect(texts[i]).toMatch(new RegExp(`^${o.label} → `));
    // Section targets exist here; the #work-<id> panel anchors are asserted in @B-04.
    for (const h of hrefs.filter((x) => !x!.startsWith('#work-')))
      await expect(page.locator(h!)).toHaveCount(1);
  });

  test('object links navigate, with or without JS or WebGL @B-03', async ({
    page,
  }) => {
    await page.goto('/');
    const n = await list(page).count();
    for (let i = 0; i < n; i++) {
      const a = list(page).nth(i);
      const href = (await a.getAttribute('href'))!;
      await a.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      // #work-<id> panels arrive in B-04, which asserts they scroll into view.
      if (!href.startsWith('#work-'))
        await expect(page.locator(href)).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  });

  test('object links are 44 px targets and keyboard reachable @B-03', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    for (const b of await list(page).all())
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await list(page).first().focus();
    await expect(list(page).first()).toBeFocused();
    await expectNoAxeViolations(page, { label: '/ object list focused' });
  });

  test('the poster goes inert while the canvas is live and comes back after @B-03', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await page.waitForFunction(() => window.__hooks !== undefined);
    const set = (state: string) =>
      page.evaluate(
        (s) =>
          (document.querySelector<HTMLElement>('[data-desk]')!.dataset[
            'deskState'
          ] = s),
        state,
      );
    const inert = () =>
      page.locator('[data-poster]').evaluate((e) => (e as HTMLElement).inert);
    await set('live');
    await expect.poll(inert).toBe(true);
    await set('failed');
    await expect.poll(inert).toBe(false);
    await set('poster');
    await expect.poll(inert).toBe(false);
  });

  test('the largest contentful paint is text inside #desk @B-03', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(
      info.project.name === 'mobile-webkit',
      'WebKit has no largest-contentful-paint entries',
    );
    await page.addInitScript(() => {
      const w = window as unknown as { __lcp: string[] };
      w.__lcp = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          const el = (e as unknown as { element: Element | null }).element;
          w.__lcp.push(
            el
              ? `${el.tagName}|${el.closest('#desk') ? 'desk' : 'elsewhere'}|${(e as unknown as { url: string }).url}`
              : 'none',
          );
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    // LCP candidates are finalised on first input or page hide.
    await page.keyboard.press('Tab');
    const last = await page.evaluate(() =>
      (window as unknown as { __lcp: string[] }).__lcp.at(-1),
    );
    expect(last, 'an LCP entry').toBeDefined();
    const [tag, where, url] = last!.split('|');
    expect(where).toBe('desk');
    expect(['H1', 'P', 'LI', 'A']).toContain(tag);
    expect(url).toBe('');
  });
});
