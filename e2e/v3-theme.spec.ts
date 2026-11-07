import { test, expect, expectNoAxeViolations } from './fixtures';
import type { Page } from '@playwright/test';

const THEME_KEY = 'nihal:theme';
const LAMP_KEY = 'nihal:lamp';
const html = (page: Page) => page.locator('html');
const lamp = (page: Page) => page.locator('[data-lamp-control]');
const level = async (page: Page) =>
  Number(await html(page).getAttribute('data-lamp'));
const THEME_OF = ['blue', 'blue', 'paper', 'paper', 'paper'];

test.describe('hanging lamp @V3-theme', () => {
  test('is a slider named "lamp brightness" with five values and no visible words @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    // The suite runs with a dark OS scheme, so the default level is 1 (the blue sheet).
    await expect(html(page)).toHaveAttribute('data-lamp', '1');
    await expect(html(page)).toHaveAttribute('data-theme', 'blue');
    const s = page.getByRole('slider', { name: 'lamp brightness' });
    await expect(s).toBeVisible();
    await expect(s).toHaveAttribute('aria-valuemin', '0');
    await expect(s).toHaveAttribute('aria-valuemax', '4');
    await expect(s).toHaveAttribute('aria-valuenow', '1');
    await expect(s).toHaveAttribute('aria-valuetext', /blue.*1 of 4/);
    expect((await s.innerText()).trim()).toBe('');
    const box = (await s.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('a click or tap goes one level dimmer and wraps 0 to 4; each change persists and fires the events @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await page.evaluate(() => {
      const w = window as unknown as { __heard: string[] };
      w.__heard = [];
      for (const type of ['nihal:theme', 'nihal:lamp'])
        window.addEventListener(type, (e) =>
          w.__heard.push(
            `${type}:${JSON.stringify((e as CustomEvent).detail)}`,
          ),
        );
    });
    // 1 -> 0 -> 4 -> 3 -> 2 -> 1
    for (const want of [0, 4, 3, 2, 1]) {
      await lamp(page).click();
      await expect(html(page)).toHaveAttribute('data-lamp', String(want));
      await expect(html(page)).toHaveAttribute('data-theme', THEME_OF[want]!);
      await expect(lamp(page)).toHaveAttribute('aria-valuenow', String(want));
      expect(
        await page.evaluate((k) => localStorage.getItem(k), LAMP_KEY),
      ).toBe(String(want));
      expect(
        await page.evaluate((k) => localStorage.getItem(k), THEME_KEY),
      ).toBe(THEME_OF[want]);
    }
    const heard = await page.evaluate(
      () => (window as unknown as { __heard: string[] }).__heard,
    );
    // nihal:theme fires on every change (also inside one theme), then nihal:lamp.
    expect(heard).toHaveLength(10);
    expect(heard.slice(0, 4)).toEqual([
      'nihal:theme:{"theme":"blue"}',
      'nihal:lamp:{"lamp":0,"theme":"blue"}',
      'nihal:theme:{"theme":"paper"}',
      'nihal:lamp:{"lamp":4,"theme":"paper"}',
    ]);
  });

  test('level 4 is the old paper sheet, and theme-color follows the level @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript((k) => localStorage.setItem(k, '4'), LAMP_KEY);
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');
    const bg = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await bg()).toBe('rgb(246, 245, 241)');
    const color = () =>
      page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(await color()).toMatch(/^#f6f5f1$/i);
    await lamp(page).press('End');
    await lamp(page).press('Home');
    await expect(html(page)).toHaveAttribute('data-lamp', '0');
    expect(await color()).toMatch(/^#0a1348$/i);
    // The change eases colours for about 300 ms, in a window that closes again.
    await expect(html(page)).toHaveAttribute('data-lamp-fade', '');
    await expect(html(page)).not.toHaveAttribute('data-lamp-fade', '');
    // Each level has its own page colour; no two are the same.
    const seen = new Set<string>();
    for (const l of ['0', '1', '2', '3', '4']) {
      await page.evaluate((v) => {
        document.documentElement.dataset['lamp'] = v;
        document.documentElement.dataset['theme'] =
          Number(v) > 1 ? 'paper' : 'blue';
      }, l);
      seen.add(await bg());
    }
    expect(seen.size).toBe(5);
  });

  test('keyboard: arrows, Home and End move the level and stop at the ends @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await lamp(page).focus();
    await expect(lamp(page)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    expect(await level(page)).toBe(2);
    await page.keyboard.press('ArrowRight');
    expect(await level(page)).toBe(3);
    await page.keyboard.press('End');
    expect(await level(page)).toBe(4);
    await page.keyboard.press('ArrowUp');
    expect(await level(page)).toBe(4);
    await page.keyboard.press('ArrowDown');
    expect(await level(page)).toBe(3);
    await page.keyboard.press('ArrowLeft');
    expect(await level(page)).toBe(2);
    await page.keyboard.press('Home');
    expect(await level(page)).toBe(0);
    await page.keyboard.press('ArrowDown');
    expect(await level(page)).toBe(0);
    // Enter acts as a tap: dimmer, wrapping 0 to 4.
    await page.keyboard.press('Enter');
    expect(await level(page)).toBe(4);
    // The focus ring is drawn.
    const outline = await lamp(page).evaluate(
      (el) => getComputedStyle(el).outlineStyle,
    );
    expect(outline).not.toBe('none');
  });

  test('dragging the lamp down dims a step per notch and dragging up brightens @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await lamp(page).focus();
    await page.keyboard.press('End'); // level 4
    const b = (await lamp(page).boundingBox())!;
    const x = b.x + b.width / 2;
    const y = b.y + b.height * 0.8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 5 });
    await expect(html(page)).toHaveAttribute('data-lamp', '3');
    await page.mouse.move(x, y + 90, { steps: 8 });
    await expect(html(page)).toHaveAttribute('data-lamp', '1');
    await page.mouse.move(x, y + 400, { steps: 8 });
    await expect(html(page)).toHaveAttribute('data-lamp', '0'); // clamped at the end
    await page.mouse.move(x, y + 30, { steps: 8 });
    await expect(html(page)).toHaveAttribute('data-lamp', '3'); // and back up
    await page.mouse.up();
    // A drag is not also a click: the level stays where it was released.
    await page.waitForTimeout(100);
    expect(await level(page)).toBe(3);
  });

  test('a stored level is applied before first paint: no flash @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript((k) => localStorage.setItem(k, '2'), LAMP_KEY);
    await page.addInitScript(() => {
      const w = window as unknown as { __atBody: string | null };
      w.__atBody = null;
      const mo = new MutationObserver(() => {
        if (document.body && w.__atBody === null) {
          const d = document.documentElement.dataset;
          w.__atBody = `${d['lamp']}/${d['theme']}`;
          mo.disconnect();
        }
      });
      mo.observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    expect(
      await page.evaluate(
        () => (window as unknown as { __atBody: string | null }).__atBody,
      ),
    ).toBe('2/paper');
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');
  });

  test.describe('follows the OS until chosen', () => {
    test.use({ colorScheme: 'light' });
    test('light OS gives 4; a stored level wins; an old stored theme still maps @V3-theme', async ({
      page,
      javaScriptEnabled,
    }) => {
      test.skip(!javaScriptEnabled, 'needs JS');
      await page.goto('/');
      await expect(html(page)).toHaveAttribute('data-lamp', '4');
      await expect(html(page)).toHaveAttribute('data-theme', 'paper');
      await page.evaluate((k) => localStorage.setItem(k, '0'), LAMP_KEY);
      await page.reload();
      await expect(html(page)).toHaveAttribute('data-lamp', '0');
      await expect(html(page)).toHaveAttribute('data-theme', 'blue');
      await page.evaluate(
        ([l, t]) => {
          localStorage.removeItem(l!);
          localStorage.setItem(t!, 'blue');
        },
        [LAMP_KEY, THEME_KEY],
      );
      await page.reload();
      await expect(html(page)).toHaveAttribute('data-lamp', '1');
    });
  });

  test('the lamp never overlaps the title block text or the table, down to 320 px @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 720],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(lamp(page)).toBeVisible();
      const sw = (await lamp(page).boundingBox())!;
      expect(sw.width, `lamp width at ${width}`).toBeGreaterThanOrEqual(44);
      // The lamp stays inside the sheet border.
      expect(sw.x + sw.width).toBeLessThanOrEqual(width);
      // The text lines of the title block (name, kicker, sentence, rows) and the drawing.
      const hits = await page.evaluate(() => {
        const l = document
          .querySelector('[data-lamp-control]')!
          .getBoundingClientRect();
        const hit = (r: DOMRect) =>
          l.left < r.right &&
          l.right > r.left &&
          l.top < r.bottom &&
          l.bottom > r.top;
        const bad: string[] = [];
        for (const sel of [
          '.title-block .name',
          '.title-block-kicker',
          '.title-block-line',
          '.title-block-rows',
        ]) {
          const el = document.querySelector(sel);
          if (!el) {
            bad.push(`${sel} missing`);
            continue;
          }
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let n: Node | null;
          while ((n = walker.nextNode())) {
            if (!n.textContent?.trim()) continue;
            const rg = document.createRange();
            rg.selectNodeContents(n);
            if ([...rg.getClientRects()].some(hit)) bad.push(sel);
          }
        }
        const poster = document.querySelector('[data-poster]');
        if (poster && hit(poster.getBoundingClientRect())) bad.push('poster');
        return bad;
      });
      expect(hits, `overlap at ${width}`).toEqual([]);
    }
  });

  test('every level has no axe violations @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    for (const l of [4, 3, 2, 1, 0]) {
      await lamp(page).focus();
      await page.keyboard.press(l === 4 ? 'End' : 'ArrowDown');
      await expect(html(page)).toHaveAttribute('data-lamp', String(l));
      await expectNoAxeViolations(page, { label: `/ lamp level ${l}` });
    }
    await page.locator('#work').scrollIntoViewIfNeeded();
    await expectNoAxeViolations(page, { label: '/ lamp level 0, work' });
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expectNoAxeViolations(page, { label: '/ lamp level 0, contact' });
  });

  test('with no JS the lamp is not shown', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'the no-js project only');
    await page.goto('/');
    await expect(lamp(page)).toBeHidden();
  });
});

test.describe('hanging lamp, reduced motion @V3-theme', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the level still changes, with no swing and no pull @V3-theme', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-motion', 'reduce');
    await lamp(page).click();
    await expect(html(page)).toHaveAttribute('data-lamp', '0');
    await page.waitForTimeout(150);
    const state = await page.evaluate(() => ({
      swing: (document.querySelector('[data-lamp-body]') as SVGElement).style
        .transform,
      fade: document.documentElement.hasAttribute('data-lamp-fade'),
      pull: (
        document.querySelector('[data-lamp-control]') as HTMLElement
      ).style.getPropertyValue('--lamp-pull'),
    }));
    expect(state.swing).toBe('');
    expect(state.fade).toBe(false);
    expect(state.pull).toBe('');
  });
});
