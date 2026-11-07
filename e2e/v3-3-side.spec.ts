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

test.describe('side column art @V3-3-S1', () => {
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
      await expect(page.locator(`#${id} .section-art .art-mid`)).toBeAttached();
    }
    await page.setViewportSize({ width: 1000, height: 800 });
    for (const id of SECTIONS)
      await expect(page.locator(`#${id} .section-art-col`)).toBeHidden();
  });

  test('the art fills its whole column at every width, scrolls with the page and is not sticky @V3-3-S5', async ({
    page,
  }) => {
    await page.goto('/');
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of SECTIONS) {
        const m = await page.evaluate((i) => {
          const col = document
            .querySelector(`#${i} .section-art-col`)!
            .getBoundingClientRect();
          const art = document.querySelector(`#${i} .section-art`)!;
          const a = art.getBoundingClientRect();
          const q = (s: string) =>
            art.querySelector(s)!.getBoundingClientRect();
          const top = q('.art-top');
          const bot = q('.art-bot');
          const mid = q('.art-mid');
          const cs = getComputedStyle(art);
          return {
            colTop: col.top,
            colBottom: col.bottom,
            top: a.top,
            bottom: a.bottom,
            topPiece: top.top,
            botPiece: bot.bottom,
            midH: mid.height,
            gap:
              Math.abs(top.bottom - mid.top) + Math.abs(mid.bottom - bot.top),
            position: cs.position,
            events: cs.pointerEvents,
            repeat: getComputedStyle(art.querySelector('.art-mid')!).maskRepeat,
            ratio: bot.width / bot.height,
          };
        }, id);
        const msg = `${id} @${width}`;
        expect(m.position, `${msg} not sticky`).toBe('absolute');
        expect(
          Math.abs(m.top - m.colTop),
          `${msg} starts at the section top`,
        ).toBeLessThan(1);
        expect(
          Math.abs(m.bottom - m.colBottom),
          `${msg} ends at the section bottom`,
        ).toBeLessThan(1);
        expect(m.topPiece, `${msg} top piece anchored`).toBeCloseTo(
          m.colTop,
          0,
        );
        expect(m.botPiece, `${msg} bottom piece anchored`).toBeCloseTo(
          m.colBottom,
          0,
        );
        expect(m.gap, `${msg} no blank between pieces`).toBeLessThan(1);
        expect(m.midH, `${msg} has a repeating middle`).toBeGreaterThan(40);
        expect(m.repeat, `${msg} repeats down`).toContain('repeat');
        expect(m.events, `${msg} never blocks clicks`).toBe('none');
        expect(m.ratio, `${msg} bottom piece is not distorted`).toBeGreaterThan(
          1,
        );
      }
    }
    // Scrolling does not move the art relative to its section.
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const id of ['projects', 'cv'] as const) {
      const rel = async () =>
        page.evaluate((i) => {
          const s = document.getElementById(i)!.getBoundingClientRect();
          const a = document
            .querySelector(`#${i} .section-art`)!
            .getBoundingClientRect();
          return [a.top - s.top, a.bottom - s.bottom];
        }, id);
      await page.evaluate(
        (i) => document.getElementById(i)!.scrollIntoView(),
        id,
      );
      const first = await rel();
      for (const dy of [300, 700, 1100]) {
        await page.evaluate((y) => window.scrollBy(0, y), dy);
        const now = await rel();
        expect(
          Math.abs(now[0]! - first[0]!),
          `${id} top after +${dy}`,
        ).toBeLessThan(1);
        expect(
          Math.abs(now[1]! - first[1]!),
          `${id} bottom after +${dy}`,
        ).toBeLessThan(1);
      }
      expect(
        await page.evaluate((i) => {
          const s = document.getElementById(i)!.getBoundingClientRect();
          return s.height;
        }, id),
        `${id} is taller than the viewport`,
      ).toBeGreaterThan(1200);
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
        for (const l of a.querySelectorAll(
          '.art-layer, .art-dot, .art-dot > i',
        ))
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

  test('pointer: a soft light follows the pointer, a click ripples and toggles the LEDs; off under reduced motion @V3-3-S5', async ({
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
    const cx = box.x + box.width / 2;
    const cy = Math.max(box.y, 0) + 300;
    await page.mouse.move(cx - 400, cy);
    await page.mouse.move(cx, cy, { steps: 6 });
    await page.mouse.move(cx + 20, cy + 20, { steps: 4 });
    await page.mouse.click(cx + 20, cy + 20);
    if (reduced) {
      await expect(art).not.toHaveAttribute('data-off', '');
      await expect(page.locator('#projects .art-spot')).toHaveCount(0);
      await expect(page.locator('#projects .art-ripple')).toHaveCount(0);
      return;
    }
    await expect(page.locator('#projects .art-spot[data-on]')).toHaveCount(1);
    await expect(page.locator('#projects .art-ripple').first()).toBeAttached();
    await expect(art).toHaveAttribute('data-off', '');
    // The window and its copy move by transform only.
    expect(
      await page
        .locator('#projects .art-spot')
        .evaluate((e) => e.style.transform),
    ).toMatch(/translate3d/);
    // Leaving the art switches the light off; the art never took the pointer.
    await page.mouse.move(box.x - 300, cy, { steps: 4 });
    await expect(page.locator('#projects .art-spot[data-on]')).toHaveCount(0);
    await expectNoAxeViolations(page, { label: '/ projects art hover' });
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
