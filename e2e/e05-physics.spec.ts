import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { test, expect, expectNoAxeViolations } from './fixtures';
import { objects } from '../src/content/objects';

const figure = (page: Page) => page.locator('[data-desk]');
const canvas = (page: Page) => page.locator('[data-desk] canvas');

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
  // Scroll the drawing into view so pointer coordinates are inside the viewport.
  await canvas(page).scrollIntoViewIfNeeded();
}

/** Page (viewport) coordinates of an object, for mouse and touch input. */
async function where(page: Page, id: string) {
  const p = await page.evaluate(
    (i) => window.__hooks!.desk!.scene!.pick(i),
    id,
  );
  const box = await canvas(page).boundingBox();
  if (!p || !box) throw new Error(`no position for ${id}`);
  // `pick` answers in viewport px (the canvas is in the page flow).
  return { x: p.x, y: p.y, box };
}

const bodies = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.physics().bodies);
const physicsState = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.physics().state);
const grabbed = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.physics().grabbed);
const frames = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.frames());

async function recordEvents(page: Page) {
  await page.evaluate(() => {
    const log: { type: string; detail: unknown }[] = [];
    (window as unknown as { __ev: typeof log }).__ev = log;
    for (const type of ['nihal:drag', 'nihal:navigate'])
      window.addEventListener(type, (e) =>
        log.push({ type, detail: (e as CustomEvent).detail }),
      );
  });
}
const events = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __ev: { type: string; detail: unknown }[] }).__ev,
  );

async function settled(page: Page, timeout = 30_000) {
  await expect
    .poll(async () => (await bodies(page)).every((b) => b.asleep), { timeout })
    .toBe(true);
}

/** Presses `id` and drags by (dx, dy); waits for the grab (the first one loads the engine). */
async function dragTo(page: Page, id: string, dx: number, dy: number) {
  const o = await where(page, id);
  await page.mouse.move(o.x, o.y);
  await page.mouse.down();
  await page.mouse.move(o.x + 12, o.y + 6, { steps: 2 });
  await expect.poll(() => grabbed(page), { timeout: 30_000 }).toBe(id);
  await page.mouse.move(o.x + dx / 2, o.y + dy / 2, { steps: 4 });
  await page.mouse.move(o.x + dx, o.y + dy, { steps: 4 });
  return o;
}

test.describe('physics, drag, throw, touch @E-05', () => {
  test.describe.configure({ timeout: 120_000 });
  // Playwright needs the destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });

  test('the engine loads on the first grab, not before; the drag is announced @E-05', async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await goLive(page);
    await recordEvents(page);
    await page.waitForTimeout(1500);
    expect(await physicsState(page)).toBe('idle');
    expect(urls.filter((u) => /physics|rapier/i.test(u))).toEqual([]);

    // Hover is not a press.
    const o = await where(page, 'arduino');
    await page.mouse.move(o.x, o.y);
    await page.waitForTimeout(300);
    expect(await physicsState(page)).toBe('idle');

    await page.mouse.down();
    await page.mouse.move(o.x + 40, o.y + 20, { steps: 5 });
    await expect.poll(() => grabbed(page), { timeout: 30_000 }).toBe('arduino');
    expect(urls.filter((u) => /\/physics\.[\w-]+\.js/i.test(u)).length).toBe(1);
    await page.mouse.up();
    await expect.poll(() => grabbed(page)).toBeNull();
    const drag = (await events(page)).filter((e) => e.type === 'nihal:drag');
    expect(drag.map((e) => e.detail)).toEqual([
      { active: true },
      { active: false },
    ]);
    await settled(page);
    await expectNoAxeViolations(page, { label: '/ desk after a drag' });
  });

  test('hover lifts the model 4 mm, not the body @E-05', async ({ page }) => {
    await goLive(page);
    const o = await where(page, 'arduino');
    await page.mouse.move(o.x, o.y);
    await expect
      .poll(() => page.evaluate(() => window.__hooks!.desk!.scene!.hovered()))
      .toBe('arduino');
    await expect
      .poll(() =>
        page.evaluate(() => window.__hooks!.desk!.scene!.hoverLift('arduino')),
      )
      .toBeCloseTo(0.004, 4);
    await page.mouse.move(o.box.x + 4, o.box.y + 4);
    await expect
      .poll(() =>
        page.evaluate(() => window.__hooks!.desk!.scene!.hoverLift('arduino')),
      )
      .toBe(0);
  });

  test('a fast throw stays inside the walls and everything goes back to sleep @E-05', async ({
    page,
  }) => {
    await goLive(page);
    const o = await dragTo(page, 'clock-ktm', 0, 0);
    // A hard flick to the right, and then another to the front-left.
    await page.mouse.move(o.x + 400, o.y - 20, { steps: 3 });
    await page.mouse.up();
    await expect.poll(() => grabbed(page)).toBeNull();
    const c = await dragTo(page, 'calendar', 0, 0);
    await page.mouse.move(c.x - 500, c.y + 300, { steps: 3 });
    await page.mouse.up();
    await settled(page);
    // Everything stays on the screen (the walls, floor and ceiling are the viewport).
    const vp = page.viewportSize()!;
    for (const b of await bodies(page)) {
      const at = await where(page, b.id);
      expect(at.x, `${b.id} x`).toBeGreaterThan(0);
      expect(at.x, `${b.id} x`).toBeLessThan(vp.width);
      expect(at.y, `${b.id} y`).toBeGreaterThan(0);
      expect(at.y, `${b.id} y`).toBeLessThanOrEqual(vp.height);
    }
    const now = await where(page, 'clock-ktm');
    expect(Math.hypot(now.x - o.x, now.y - o.y)).toBeGreaterThan(10);
  });

  test('R and the reset button put everything back @E-05', async ({ page }) => {
    await goLive(page);
    const homes = {
      arduino: await where(page, 'arduino'),
      calendar: await where(page, 'calendar'),
    };
    const atHome = async () => {
      for (const [id, h] of Object.entries(homes)) {
        const p = await where(page, id);
        if (Math.hypot(p.x - h.x, p.y - h.y) > 3) return false;
      }
      return true;
    };
    await dragTo(page, 'arduino', 150, 90);
    await page.mouse.up();
    await settled(page);
    expect(await atHome()).toBe(false);
    // R with the desk region focused.
    await page.locator('[data-desk-reset]').focus();
    await page.keyboard.press('r');
    await expect.poll(atHome).toBe(true);

    // The button (same event), once something is off the table.
    await dragTo(page, 'calendar', 170, -40);
    await page.mouse.up();
    await settled(page);
    await expect(page.locator('[data-desk-reset]')).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-desk-reset]').click();
    await expect.poll(atHome).toBe(true);
    await expectNoAxeViolations(page, { label: '/ desk after reset' });
  });

  test('a body teleported far off the table is taken by a layer: the fall layer, or home by the watchdog @E-05', async ({
    page,
  }) => {
    await goLive(page);
    const home = await where(page, 'calendar');
    await dragTo(page, 'calendar', 10, 10);
    await page.mouse.up();
    await settled(page);
    expect(
      await page.evaluate(() =>
        window.__hooks!.desk!.scene!.teleport('calendar', 9, 0.5, 0),
      ),
    ).toBe(true);
    // The table has no side walls: it falls off and the fall layer takes it (a second canvas has to
    // come up first), or the watchdog sends it home. It is never left flying.
    await expect
      .poll(
        async () => {
          const f = await page.evaluate(() =>
            window.__hooks!.desk!.scene!.fall(),
          );
          if (f.bodies.some((b) => b.id === 'calendar')) return 'fall';
          const p = await where(page, 'calendar');
          return Math.hypot(p.x - home.x, p.y - home.y) < 3 ? 'home' : 'none';
        },
        { timeout: 20_000, intervals: [100] },
      )
      .not.toBe('none');
  });

  test('asleep bodies cost no frames @E-05', async ({ page }) => {
    await goLive(page);
    await dragTo(page, 'arduino', 20, 20);
    await page.mouse.up();
    await settled(page);
    // The OLED and the clocks have their own timers; hold those off the counter.
    await page.evaluate(() => window.__hooks!.desk!.scene!.quiet(true));
    await page.mouse.move(2, 2);
    await page.waitForTimeout(800);
    const a = await frames(page);
    await page.waitForTimeout(2000);
    expect(await frames(page)).toBe(a);
  });

  test('loading physics does not change a pixel of the drawing @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await page.evaluate(() => window.__hooks!.desk!.scene!.quiet(true));
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1000);
    const before = await canvas(page).screenshot();
    await page.evaluate(() => window.__hooks!.desk!.scene!.requestPhysics());
    await expect
      .poll(() => physicsState(page), { timeout: 30_000 })
      .toBe('ready');
    await page.waitForTimeout(1500);
    const after = await canvas(page).screenshot();
    const a = await sharp(before).raw().toBuffer({ resolveWithObject: true });
    const b = await sharp(after).raw().toBuffer({ resolveWithObject: true });
    expect(b.info.width).toBe(a.info.width);
    const ch = a.info.channels;
    let diff = 0;
    for (let i = 0; i < a.data.length; i += ch) {
      let d = 0;
      for (let c = 0; c < 3; c++)
        d = Math.max(d, Math.abs(a.data[i + c]! - b.data[i + c]!));
      if (d > 16) diff++;
    }
    const ratio = diff / (a.data.length / ch);
    expect(ratio).toBeLessThan(0.005);
    // Bodies are in, asleep and nothing moved.
    const list = await bodies(page);
    // One body per drawn object (the confirmed ones, letters and balls included).
    expect(list.length).toBe(objects.filter((o) => o.confirmed).length);
    expect(list.every((x) => x.asleep)).toBe(true);
  });
});

// ---- touch (Pixel-class emulation over CDP) --------------------------------------------------

test.describe('touch @E-05', () => {
  test.describe.configure({ timeout: 120_000 });
  test.use({
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });

  interface Touch {
    start(x: number, y: number): Promise<unknown>;
    move(x: number, y: number): Promise<unknown>;
    end(): Promise<unknown>;
  }
  async function touch(page: Page): Promise<Touch> {
    const cdp = await page.context().newCDPSession(page);
    const send = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      pts: { x: number; y: number }[],
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 1 })),
      });
    return {
      start: (x, y) => send('touchStart', [{ x, y }]),
      move: (x, y) => send('touchMove', [{ x, y }]),
      end: () => send('touchEnd', []),
    };
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function visibleAt(page: Page, id: string) {
    await page.evaluate(() => scrollTo(0, 0));
    const o = await where(page, id);
    const h = page.viewportSize()!.height;
    if (o.y > h - 120) {
      await page.evaluate((y) => scrollBy(0, y - 200), o.y);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      await sleep(700);
      return {
        ...(await where(page, id)),
        scroll: await page.evaluate(() => scrollY),
      };
    }
    return { ...o, scroll: 0 };
  }

  test('a swipe over the drawing scrolls the page and grabs nothing @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await recordEvents(page);
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    const o = await visibleAt(page, 'arduino');
    const t = await touch(page);
    const y0 = await page.evaluate(() => scrollY);
    await t.start(o.x, o.y);
    for (let i = 1; i <= 15; i++) {
      await t.move(o.x, o.y - i * 20);
      await sleep(30);
    }
    await t.end();
    await expect
      .poll(() => page.evaluate(() => scrollY), { timeout: 10_000 })
      .toBeGreaterThan(y0 + 40);
    expect(await grabbed(page)).toBeNull();
    expect(await physicsState(page)).toBe('idle');
    expect(urls.filter((u) => /\/physics\.[\w-]+\.js/i.test(u))).toEqual([]);
    expect((await events(page)).filter((e) => e.type === 'nihal:drag')).toEqual(
      [],
    );
  });

  test('press-hold grabs, a drag does not scroll, and let-go throws inside the walls @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await recordEvents(page);
    const o = await visibleAt(page, 'arduino');
    const t = await touch(page);
    const y0 = await page.evaluate(() => scrollY);
    await t.start(o.x, o.y);
    await sleep(320);
    await expect.poll(() => grabbed(page), { timeout: 30_000 }).toBe('arduino');
    for (let i = 1; i <= 12; i++) {
      await t.move(o.x - i * 5, o.y - i * 12);
      await sleep(16);
    }
    expect(await page.evaluate(() => scrollY)).toBe(y0);
    expect(
      (await events(page)).filter((e) => e.type === 'nihal:drag')[0]?.detail,
    ).toEqual({ active: true });
    await t.end();
    await expect.poll(() => grabbed(page)).toBeNull();
    expect(await page.evaluate(() => scrollY)).toBe(y0);
    await settled(page);
    for (const b of await bodies(page)) {
      expect(Math.abs(b.p[0])).toBeLessThan(0.8);
      expect(Math.abs(b.p[2])).toBeLessThan(0.6);
    }
    await expectNoAxeViolations(page, { label: '/ phone after a touch drag' });
  });

  test('a tap goes to the section; a hold-drag moves a body and R puts it back @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await recordEvents(page);
    const o = await visibleAt(page, 'calendar');
    const t = await touch(page);
    // Back to back, so a loaded machine cannot stretch a tap past the 250 ms limit.
    await Promise.all([t.start(o.x, o.y), t.end()]);
    await expect
      .poll(async () =>
        (await events(page)).filter((e) => e.type === 'nihal:navigate'),
      )
      .toEqual([{ type: 'nihal:navigate', detail: '#open-source' }]);

    await page.evaluate(() => scrollTo(0, 0));
    await sleep(600);
    // Move something with a hold-drag, then double-tap a corner of the sheet.
    const g = await visibleAt(page, 'arduino');
    await t.start(g.x, g.y);
    await sleep(320);
    await expect.poll(() => grabbed(page), { timeout: 30_000 }).toBe('arduino');
    for (let i = 1; i <= 10; i++) {
      await t.move(g.x + i * 8, g.y + i * 4);
      await sleep(16);
    }
    await t.end();
    await settled(page);
    const moved = await where(page, 'arduino');
    expect(Math.hypot(moved.x - g.x, moved.y - g.y)).toBeGreaterThan(10);

    // There is no double-tap reset any more: the button and the R key are the way back.
    await page.keyboard.press('r');
    await expect
      .poll(async () => {
        const p = await where(page, 'arduino');
        return Math.hypot(p.x - g.x, p.y - g.y) < 3;
      })
      .toBe(true);
  });
});
