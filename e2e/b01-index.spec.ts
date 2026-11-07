import { test, expect, expectNoAxeViolations } from './fixtures';
import type { Page } from '@playwright/test';

const IDS = [
  'desk',
  'about',
  'work',
  'open-source',
  'writing',
  'cv',
  'contact',
];
const nav = (page: Page) =>
  page.getByRole('navigation', { name: 'sheet index' });
const current = (page: Page) => nav(page).locator('a[aria-current]');

/** Scrolls so the viewport midline sits in the middle of a section (clamped by the page). */
async function scrollToMid(page: Page, id: string) {
  await page.evaluate((i) => {
    const el = document.getElementById(i)!;
    const r = el.getBoundingClientRect();
    window.scrollTo(
      0,
      window.scrollY + r.top + r.height / 2 - window.innerHeight / 2,
    );
  }, id);
}

test.describe('sheet border and index @B-01', () => {
  test('index is a labelled nav of real in-page links, no JS needed @B-01', async ({
    page,
  }) => {
    await page.goto('/');
    const links = nav(page).getByRole('link');
    await expect(links).toHaveCount(7);
    expect(
      await links.evaluateAll((l) => l.map((a) => a.getAttribute('href'))),
    ).toEqual(IDS.map((i) => `#${i}`));
    expect(await links.allTextContents()).toEqual([
      'desk',
      'about',
      'work',
      'open source',
      'writing',
      'cv',
      'contact',
    ]);
    await links.nth(4).click();
    await expect(page).toHaveURL(/#writing$/);
    await expect(page.locator('#writing')).toBeFocused();
    await expectNoAxeViolations(page, { label: '/ after index link' });
  });

  test('the border is drawn and passes clicks through @B-01', async ({
    page,
  }) => {
    await page.goto('/');
    const b = page.locator('.sheet-border');
    const s = await b.evaluate((e) => {
      const cs = getComputedStyle(e);
      const after = getComputedStyle(e, '::after');
      return {
        pe: cs.pointerEvents,
        pos: cs.position,
        w: cs.borderTopWidth,
        line: after.borderTopWidth,
        color: after.borderTopColor,
      };
    });
    expect(s.pe).toBe('none');
    expect(s.pos).toBe('fixed');
    expect(s.line).toBe('1px');
    // The border line is the --stroke token (white at 85% in blue mode).
    expect(s.color).toBe('rgba(255, 255, 255, 0.85)');
    const size = page.viewportSize()!.width >= 1024 ? '24px' : '12px';
    expect(s.w).toBe(size);
  });

  test('left margin from 1024 px, bottom strip below @B-01', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    const boxes = await nav(page)
      .getByRole('link')
      .evaluateAll((l) =>
        l.map((a) => {
          const b = a.getBoundingClientRect();
          return [b.x, b.y];
        }),
      );
    expect(new Set(boxes.map((b) => Math.round(b[0]!))).size).toBe(1);
    expect(new Set(boxes.map((b) => Math.round(b[1]!))).size).toBe(7);
    const main = await page
      .locator('main')
      .evaluate((e) => parseFloat(getComputedStyle(e).paddingInlineStart));
    const right = await nav(page).evaluate(
      (e) => e.getBoundingClientRect().right,
    );
    expect(right).toBeLessThanOrEqual(main);
    await page.setViewportSize({ width: 800, height: 800 });
    const strip = await nav(page).boundingBox();
    expect(strip!.y + strip!.height).toBeGreaterThan(800 - 14);
    expect(strip!.height).toBeLessThanOrEqual(48);
    const ys = await nav(page)
      .getByRole('link')
      .evaluateAll((l) =>
        l.map((a) => Math.round(a.getBoundingClientRect().y)),
      );
    expect(new Set(ys).size).toBe(1);
    // Rows are touch targets.
    const h = await nav(page).getByRole('link').first().boundingBox();
    expect(h!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test('aria-current follows the midline, including tall sections @B-01', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto('/');
    await expect(current(page)).toHaveCount(1);
    for (const id of IDS) {
      await scrollToMid(page, id);
      const expected = await page.evaluate(() => {
        const bottom =
          scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
        // Indexed sections only: the garden and footer have no row, so contact stays current.
        const secs = [
          ...document.querySelectorAll<HTMLElement>('main > section[id]'),
        ];
        if (bottom) return secs[secs.length - 1]!.id;
        const above = secs.filter(
          (s) => s.getBoundingClientRect().top <= innerHeight / 2,
        );
        return above[above.length - 1]!.id;
      });
      await expect(current(page)).toHaveAttribute('href', `#${expected}`);
      await expect(current(page)).toHaveAttribute('aria-current', 'location');
      await expect(current(page)).toHaveCount(1);
    }
    // Through the garden and the footer, contact stays the current row.
    await page.evaluate(() =>
      document
        .querySelector('[data-garden]')!
        .scrollIntoView({ block: 'center' }),
    );
    await expect(current(page)).toHaveAttribute('href', '#contact');
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await expect(current(page)).toHaveAttribute('href', '#contact');
    // Back at the top the first row is current again.
    await page.evaluate(() => scrollTo(0, 0));
    await expect(current(page)).toHaveAttribute('href', '#desk');
    await expectNoAxeViolations(page, { label: '/ index with a current row' });
  });

  test('keyboard reaches every row and follows it @B-01', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(
      browserName === 'webkit' && isMobile,
      'Tab order is checked on desktop engines',
    );
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.keyboard.press('Tab'); // skip link
    const seen: string[] = [];
    for (let i = 0; i < 14 && seen.length < 7; i++) {
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() => {
        const a = document.activeElement;
        return a?.closest('[data-sheet-index]') ? a.getAttribute('href') : null;
      });
      if (href) seen.push(href);
    }
    expect(seen).toEqual(IDS.map((i) => `#${i}`));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter'); // work row
    await expect(page).toHaveURL(/#(work|open-source|writing|cv|contact)$/);
    await expectNoAxeViolations(page, {
      label: '/ index row activated by keyboard',
    });
  });

  /** scaleY of the lit clip rect against the real scroll ratio. */
  const scaleMatches = (page: Page) =>
    page.evaluate(() => {
      const m = getComputedStyle(
        document.querySelector('.sheet-rule-fill')!,
      ).transform;
      const y =
        m === 'none'
          ? NaN
          : parseFloat(m.replace('matrix(', '').split(',')[3] ?? 'NaN');
      const max = document.documentElement.scrollHeight - innerHeight;
      return [y, max > 0 ? scrollY / max : 0];
    });

  async function checkProgress(page: Page) {
    for (const frac of [0, 0.4, 1]) {
      await page.evaluate(
        (f) =>
          scrollTo(
            0,
            f * (document.documentElement.scrollHeight - innerHeight),
          ),
        frac,
      );
      await expect
        .poll(async () => {
          const [y, want] = await scaleMatches(page);
          return Math.abs(y! - want!) < 0.03;
        })
        .toBe(true);
    }
  }

  test('progress rule fills with scroll (native timeline where supported) @B-01', async ({
    page,
    javaScriptEnabled,
  }, info) => {
    test.skip(
      !javaScriptEnabled,
      'the rule is CSS, but the check needs evaluate',
    );
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/');
    await checkProgress(page);
    const timeline = await page.evaluate(() =>
      document.getAnimations().map((a) => a.timeline?.constructor.name),
    );
    if (info.project.name === 'reduced-motion') expect(timeline).toEqual([]);
    else if (
      await page.evaluate(() => CSS.supports('animation-timeline: scroll()'))
    )
      expect(timeline).toContain('ScrollTimeline');
  });

  test('progress rule: JS fallback with the timeline off (reduced motion) @B-01', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    // Motion off removes the animation, so sheet-index.ts owns --progress: the fallback path.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await checkProgress(page);
    const v = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--progress'),
    );
    expect(parseFloat(v)).toBeCloseTo(1, 1);
  });

  test('index dims to 40% while a body is dragged @B-01', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await expect(nav(page)).toHaveCSS('opacity', '1');
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('nihal:drag', { detail: { active: true } }),
      ),
    );
    await expect(nav(page)).toHaveCSS('opacity', '0.4');
    await expect(nav(page)).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('nihal:drag', { detail: { active: false } }),
      ),
    );
    await expect(nav(page)).toHaveCSS('opacity', '1');
  });
});
