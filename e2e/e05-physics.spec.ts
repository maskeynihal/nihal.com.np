import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { test, expect, expectNoAxeViolations } from './fixtures';

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
  return { x: box.x + p.x, y: box.y + p.y, box };
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

const HOME: Record<string, [number, number]> = {
  arduino: [0, 0.02],
  'clock-ktm': [-0.55, -0.3],
  calendar: [0.5, -0.24],
  ghost: [0.46, 0.3],
};

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
    expect(urls.filter((u) => /physics-world/i.test(u)).length).toBe(1);
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

  test('the OLED caption follows the board while it is held @E-05', async ({
    page,
  }) => {
    await goLive(page);
    const caption = page.locator('[data-oled-caption]');
    await expect(caption).toBeVisible();
    const before = (await caption.boundingBox())!;
    await dragTo(page, 'arduino', 160, 40);
    await expect
      .poll(async () => ((await caption.boundingBox()) ?? before).x)
      .toBeGreaterThan(before.x + 40);
    await page.mouse.up();
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
    for (const b of await bodies(page)) {
      expect(Math.abs(b.p[0]), `${b.id} x`).toBeLessThan(0.8);
      expect(Math.abs(b.p[2]), `${b.id} z`).toBeLessThan(0.6);
      expect(b.p[1], `${b.id} y`).toBeGreaterThan(-0.05);
      expect(b.p[1], `${b.id} y`).toBeLessThan(0.2);
    }
    const moved = (await bodies(page)).find((b) => b.id === 'clock-ktm')!;
    expect(Math.hypot(moved.p[0] - -0.55, moved.p[2] - -0.3)).toBeGreaterThan(
      0.05,
    );
  });

  test('a tap (no drag) goes to the object section; a drag does not @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await recordEvents(page);
    const o = await where(page, 'calendar');
    await page.mouse.move(o.x, o.y);
    await page.mouse.down();
    await page.mouse.up();
    await expect
      .poll(async () =>
        (await events(page)).filter((e) => e.type === 'nihal:navigate'),
      )
      .toEqual([{ type: 'nihal:navigate', detail: '#open-source' }]);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(300);
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest('section')?.id),
      )
      .toBe('open-source');
    await page.evaluate(() => scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);

    // A drag that ends where it began is a drag, not a tap.
    await recordEvents(page);
    const g = await where(page, 'arduino');
    await page.mouse.move(g.x, g.y);
    await page.mouse.down();
    await page.mouse.move(g.x + 60, g.y + 30, { steps: 4 });
    await page.mouse.move(g.x, g.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(
      (await events(page)).filter((e) => e.type === 'nihal:navigate'),
    ).toEqual([]);
  });

  test('the ghost looks at the pointer only while it is held @E-05', async ({
    page,
  }) => {
    await goLive(page);
    const eyes = () =>
      page.evaluate(() => window.__hooks!.desk!.scene!.ghostEyes());
    expect(await eyes()).toEqual([0, 0]);
    const o = await dragTo(page, 'ghost', 0, 0);
    await page.mouse.move(o.x - 120, o.y + 10, { steps: 6 });
    await expect.poll(() => grabbed(page), { timeout: 30_000 }).toBe('ghost');
    await expect.poll(async () => (await eyes())[0]).not.toBe(0);
    await page.mouse.up();
    await expect.poll(async () => await eyes()).toEqual([0, 0]);
  });

  test('R and the reset button put everything back, asleep @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await dragTo(page, 'arduino', 150, 90);
    await page.mouse.up();
    await settled(page);
    const away = (await bodies(page)).find((b) => b.id === 'arduino')!;
    expect(Math.hypot(away.p[0] - 0, away.p[2] - 0.02)).toBeGreaterThan(0.05);

    const atHome = async () => {
      const list = await bodies(page);
      for (const b of list) {
        const home = HOME[b.id];
        if (!home) continue;
        if (Math.hypot(b.p[0] - home[0], b.p[2] - home[1]) > 0.01) return false;
      }
      return list.every((b) => b.asleep);
    };
    // R with the desk region focused.
    await page.locator('[data-desk-reset]').focus();
    await page.keyboard.press('r');
    await expect.poll(atHome).toBe(true);

    // The button (same event).
    await dragTo(page, 'calendar', -120, 80);
    await page.mouse.up();
    await settled(page);
    await page.locator('[data-desk-reset]').click();
    await expect.poll(atHome).toBe(true);
    await expectNoAxeViolations(page, { label: '/ desk after reset' });
  });

  test('a body teleported out of bounds is respawned within 2 s @E-05', async ({
    page,
  }) => {
    await goLive(page);
    await dragTo(page, 'calendar', 10, 10);
    await page.mouse.up();
    await settled(page);
    const t0 = Date.now();
    expect(
      await page.evaluate(() =>
        window.__hooks!.desk!.scene!.teleport('calendar', 4, 0.5, 0),
      ),
    ).toBe(true);
    await expect
      .poll(
        async () => {
          const b = (await bodies(page)).find((x) => x.id === 'calendar')!;
          return Math.abs(b.p[0] - 0.5) < 0.05 && b.asleep;
        },
        { timeout: 4000, intervals: [50] },
      )
      .toBe(true);
    expect(Date.now() - t0).toBeLessThan(2000);
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
    expect(list.length).toBeLessThanOrEqual(7);
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
    if (o.y > h - 60) {
      await page.evaluate((y) => scrollBy(0, y - 200), o.y);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      await sleep(300);
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
    expect(urls.filter((u) => /physics-world/i.test(u))).toEqual([]);
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

  test('a tap goes to the section; a double tap on empty desk resets @E-05', async ({
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
    const moved = (await bodies(page)).find((b) => b.id === 'arduino')!;
    expect(Math.hypot(moved.p[0], moved.p[2] - 0.02)).toBeGreaterThan(0.05);

    const corner = { x: g.box.x + 12, y: g.box.y + 12 };
    // Sent back to back (not awaited one by one) so a loaded machine cannot stretch the gap.
    await Promise.all([
      t.start(corner.x, corner.y),
      t.end(),
      t.start(corner.x, corner.y),
      t.end(),
    ]);
    await expect
      .poll(async () => {
        const b = (await bodies(page)).find((x) => x.id === 'arduino')!;
        return Math.hypot(b.p[0], b.p[2] - 0.02) < 0.01 && b.asleep;
      })
      .toBe(true);
  });
});
