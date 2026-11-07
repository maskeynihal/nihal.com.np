import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const SECTIONS = [
  'about',
  'projects',
  'open-source',
  'writing',
  'cv',
  'contact',
] as const;
const nav = (page: Page) =>
  page.getByRole('navigation', { name: 'sheet index' });
const strip = (page: Page) => nav(page).locator('li:not([data-phone-skip]) a');

async function scrollToMid(page: Page, id: string) {
  await page.evaluate((i) => {
    const r = document.getElementById(i)!.getBoundingClientRect();
    window.scrollTo(
      0,
      window.scrollY + r.top + r.height / 2 - window.innerHeight / 2,
    );
  }, id);
}

test.describe('side column drawings @V3-3-S1', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('every section has a drawing: aria-hidden, no text, hidden below 1024 px @V3-3-S1', async ({
    page,
  }) => {
    await page.goto('/');
    const cols = page.locator('.section-art-col');
    await expect(cols).toHaveCount(SECTIONS.length);
    for (const id of SECTIONS) {
      const col = page.locator(`#${id} .section-art-col`);
      await expect(col).toHaveAttribute('aria-hidden', 'true');
      expect(
        (await col.evaluate((e) => e.textContent ?? '')).trim(),
        `${id} art has no text`,
      ).toBe('');
      await expect(
        page.locator(`#${id} .section-art svg`).first(),
      ).toBeAttached();
    }
    await page.setViewportSize({ width: 1000, height: 800 });
    for (const id of SECTIONS)
      await expect(page.locator(`#${id} .section-art-col`)).toBeHidden();
  });

  test('the drawing stays centred in the viewport through a tall section and never leaves it @V3-3-S1', async ({
    page,
  }) => {
    await page.goto('/');
    for (const id of ['projects', 'cv'] as const) {
      const sec = page.locator(`#${id}`);
      const h = (await sec.boundingBox())!.height;
      expect(h, `${id} is taller than the viewport`).toBeGreaterThan(1200);
      // Three points: near the top, the middle, near the end.
      for (const f of [0.3, 0.5, 0.7]) {
        await page.evaluate(
          ([i, frac]) => {
            const r = document
              .getElementById(i as string)!
              .getBoundingClientRect();
            window.scrollTo(
              0,
              window.scrollY +
                r.top +
                r.height * (frac as number) -
                innerHeight / 2,
            );
          },
          [id, f],
        );
        const m = await page.evaluate((i) => {
          const s = document.getElementById(i)!.getBoundingClientRect();
          const a = document
            .querySelector(`#${i} .section-art`)!
            .getBoundingClientRect();
          return {
            artMid: (a.top + a.bottom) / 2,
            vh: innerHeight,
            inSection: a.top >= s.top - 1 && a.bottom <= s.bottom + 1,
            inView: a.top >= 0 && a.bottom <= innerHeight,
          };
        }, id);
        expect(m.inView, `${id} @${f} in view`).toBe(true);
        expect(m.inSection, `${id} @${f} inside its section`).toBe(true);
        expect(
          Math.abs(m.artMid - m.vh / 2),
          `${id} @${f} centred`,
        ).toBeLessThan(3);
      }
    }
  });

  test('a drawing never overlaps its section text or the next section @V3-3-S1', async ({
    page,
  }) => {
    await page.goto('/');
    for (const id of SECTIONS) {
      for (const f of [0, 0.5, 1]) {
        await page.evaluate(
          ([i, frac]) => {
            const r = document
              .getElementById(i as string)!
              .getBoundingClientRect();
            window.scrollTo(
              0,
              window.scrollY +
                r.top +
                (r.height - innerHeight) * (frac as number),
            );
          },
          [id, f],
        );
        const hit = await page.evaluate((i) => {
          const a = document
            .querySelector(`#${i} .section-art`)!
            .getBoundingClientRect();
          const sec = document.getElementById(i)!;
          const bad: string[] = [];
          for (const sel of ['.section-heading', '.section-body']) {
            const el = sec.querySelector(sel);
            if (!el) continue;
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let n: Node | null;
            while ((n = walker.nextNode())) {
              if (!n.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(n);
              for (const r of range.getClientRects())
                if (
                  r.width > 0 &&
                  r.left < a.right &&
                  r.right > a.left &&
                  r.top < a.bottom &&
                  r.bottom > a.top
                )
                  bad.push(`${sel}: ${n.textContent.trim().slice(0, 20)}`);
            }
          }
          return bad;
        }, id);
        expect(hit, `${id} @${f}`).toEqual([]);
      }
    }
  });

  test('motion is quiet, compositor-only and paused offscreen; reduced motion turns it off @V3-3-S1', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    const reduced = await page.evaluate(
      () =>
        document.documentElement.dataset['motion'] === 'reduce' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    for (const id of SECTIONS) {
      await page.evaluate(
        (i) => document.getElementById(i)!.scrollIntoView(),
        id,
      );
      const art = page.locator(`#${id} .section-art`);
      await expect(art).toHaveAttribute('data-run', '');
      const props = await art.evaluate((a) => {
        const out = new Set<string>();
        let count = 0;
        for (const l of a.querySelectorAll('.art-layer'))
          for (const an of l.getAnimations()) {
            count++;
            for (const kf of (an.effect as KeyframeEffect).getKeyframes())
              for (const k of Object.keys(kf))
                if (
                  !['offset', 'easing', 'composite', 'computedOffset'].includes(
                    k,
                  )
                )
                  out.add(k);
          }
        return { count, props: [...out] };
      });
      if (reduced) {
        expect(props.count, `${id} animations under reduced motion`).toBe(0);
        continue;
      }
      expect(props.count, `${id} has motion`).toBeGreaterThan(0);
      for (const p of props.props)
        expect(['transform', 'opacity'], `${id} animates ${p}`).toContain(p);
    }
    // Offscreen: the contact drawing is not running while the top of the page is shown.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#contact .section-art')).not.toHaveAttribute(
      'data-run',
      '',
    );
  });

  test('pointer: hover reacts once, parallax leans the drawing; both off under reduced motion @V3-3-S1', async ({
    page,
    javaScriptEnabled,
    hasTouch,
  }) => {
    test.skip(!javaScriptEnabled || hasTouch, 'needs JS and a mouse');
    await page.goto('/');
    const reduced = await page.evaluate(
      () =>
        document.documentElement.dataset['motion'] === 'reduce' ||
        matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    await page.evaluate(() =>
      document.getElementById('projects')!.scrollIntoView(),
    );
    const art = page.locator('#projects .section-art');
    const box = (await art.boundingBox())!;
    await page.mouse.move(box.x - 300, box.y + 10);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 6,
    });
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, {
      steps: 6,
    });
    if (reduced) {
      await expect(art).not.toHaveAttribute('data-off', '');
      await expect(page.locator('#projects .art-par')).toHaveCSS(
        'transform',
        'none',
      );
      return;
    }
    // The LEDs toggled off on hover.
    await expect(art).toHaveAttribute('data-off', '');
    // The drawing leans away from the pointer (a transform on the inner wrapper).
    await expect
      .poll(() =>
        page.locator('#projects .art-par').evaluate((e) => e.style.transform),
      )
      .toMatch(/translate3d\(-/);
    await expectNoAxeViolations(page, { label: '/ projects drawing hover' });
  });
});

test.describe('phone clutter @V3-3-S3', () => {
  for (const width of [320, 390]) {
    test(`strip has four rows, no sideways scroll, and the title block is compact at ${width} @V3-3-S3`, async ({
      page,
      javaScriptEnabled,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      const links = strip(page);
      await expect(links).toHaveText(['about', 'projects', 'cv', 'contact']);
      // The other three links are hidden, not clipped.
      await expect(
        nav(page).locator('li[data-phone-skip] a').first(),
      ).toBeHidden();
      const m = await page.evaluate(() => {
        const list = document.querySelector('.sheet-index-list')!;
        const de = document.documentElement;
        return {
          listOverflow: list.scrollWidth - list.clientWidth,
          pageOverflow: de.scrollWidth - innerWidth,
          overflowX: getComputedStyle(list).overflowX,
        };
      });
      expect(m.listOverflow).toBe(0);
      expect(m.pageOverflow).toBeLessThanOrEqual(0);
      expect(m.overflowX).toBe('visible');
      for (const l of await links.all()) {
        const b = (await l.boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(width);
      }

      // Title block: no rev line, one quiet preferences row, the rest in place.
      const block = page.locator('.title-block');
      await expect(block.locator('.title-block-rev')).toBeHidden();
      await expect(block.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(block.locator('.title-block-kicker')).toBeVisible();
      await expect(block.locator('.title-block-line')).toBeVisible();
      await expect(block.getByRole('link', { name: /@/ })).toBeVisible();
      await expect(
        block.getByRole('link', { name: /see the projects/ }),
      ).toBeVisible();
      await expect(block.locator('[data-live-time]')).toBeVisible();
      const prefs = block.locator('.pref-toggle');
      await expect(prefs).toHaveCount(2);
      const ys = await prefs.evaluateAll((l) =>
        l.map((e) => Math.round(e.getBoundingClientRect().y)),
      );
      expect(new Set(ys).size, 'both preferences share one row').toBe(1);
      const deskTop = await page.evaluate(
        () =>
          document.querySelector('[data-desk]')!.getBoundingClientRect().top,
      );
      // Was 794 at 320 and 671 at 390 before S3.
      expect(deskTop).toBeLessThan(width === 320 ? 660 : 620);
      await expectNoAxeViolations(page, { label: `/ phone ${width}` });

      // Footer: tidy, on screen, clear of the strip.
      await page.locator('.sheet-footer').scrollIntoViewIfNeeded();
      const f = await page.evaluate(() => {
        const r = document
          .querySelector('.sheet-footer')!
          .getBoundingClientRect();
        const s = document
          .querySelector('.sheet-index')!
          .getBoundingClientRect();
        return { right: r.right, bottom: r.bottom, stripTop: s.top };
      });
      expect(f.right).toBeLessThanOrEqual(width);
      expect(f.bottom).toBeLessThanOrEqual(f.stripTop + 1);
      void javaScriptEnabled;
    });
  }

  test('an omitted section leaves the nearest earlier row current; the desk leaves none @V3-3-S3', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/');
    const current = nav(page).locator('a[aria-current]');
    const want: [string, string | null][] = [
      ['about', 'about'],
      ['open-source', 'projects'],
      ['writing', 'projects'],
      ['cv', 'cv'],
      ['contact', 'contact'],
    ];
    for (const [id, row] of want) {
      await scrollToMid(page, id);
      if (row) await expect(current).toHaveText(row);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(current).toHaveCount(0);
    // Crossing 768 px brings all seven rows back, with the section on screen current.
    await scrollToMid(page, 'writing');
    await expect(current).toHaveText('projects');
    await page.setViewportSize({ width: 800, height: 700 });
    await expect(nav(page).getByRole('link')).toHaveCount(7);
    for (const l of await nav(page).getByRole('link').all())
      await expect(l).toBeVisible();
    await expect(current).toHaveText('writing');
    await page.setViewportSize({ width: 390, height: 700 });
    await expect(current).toHaveText('projects');
  });
});
