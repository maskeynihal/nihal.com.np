import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';

const figure = (page: Page) => page.locator('[data-desk]');
const soundBtn = (page: Page) => page.getByRole('button', { name: 'sound' });

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}
/** A press on a drawn object (the only press the desk hears; the canvas takes no clicks). */
async function pressObject(page: Page) {
  const o = await page.evaluate(() =>
    window.__hooks!.desk!.scene!.pick('arduino'),
  );
  await page.mouse.click(o!.x, o!.y);
}
const audio = (page: Page) =>
  page.evaluate(() => window.__hooks!.desk!.scene!.audio());
/** Only the taps: a real minute change can add a tick while the test runs. */
const taps = async (page: Page) =>
  ((await audio(page))?.played ?? []).filter((p) => p.clip.startsWith('tap-'));

/** Starts the engine, drops `id` from `y` metres and waits for it to settle. */
async function drop(page: Page, id: string, y: number) {
  await page.evaluate(() => window.__hooks!.desk!.scene!.requestPhysics());
  await expect
    .poll(
      () => page.evaluate(() => window.__hooks!.desk!.scene!.physics().state),
      { timeout: 30_000 },
    )
    .toBe('ready');
  await page.evaluate(
    ([i, h]) =>
      window.__hooks!.desk!.scene!.teleport(i as string, 0, h as number, 0),
    [id, y],
  );
}

test.describe('sound @E-08', () => {
  test.describe.configure({ timeout: 120_000 });
  // Playwright needs the destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });

  test('no AudioContext while off; the toggle press creates it; off again drops it @E-08', async ({
    page,
  }) => {
    await goLive(page);
    expect(await audio(page)).toBeNull();
    // A press on the canvas with sound off does not create one either.
    // The canvas is a click-through layer: a press on a drawn object is the press.
    await pressObject(page);
    expect(await audio(page)).toBeNull();
    await soundBtn(page).click();
    await expect(soundBtn(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await audio(page)).not.toBeNull();
    await expectNoAxeViolations(page, { label: '/ with sound on' });
    await soundBtn(page).click();
    await expect(soundBtn(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await audio(page)).toBeNull();
  });

  test('a stored "on" still waits for a press: nothing is created on load @E-08', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('nihal:sound', 'on'));
    await goLive(page);
    expect(await audio(page)).toBeNull();
    // The canvas is a click-through layer: a press on a drawn object is the press.
    await pressObject(page);
    expect(await audio(page)).not.toBeNull();
  });

  test('a drop plays a tap, and a harder drop is louder @E-08', async ({
    page,
  }) => {
    await goLive(page);
    await soundBtn(page).click();
    const asleep = () =>
      page.evaluate(() =>
        window.__hooks!.desk!.scene!.physics().bodies.every((b) => b.asleep),
      );
    // Learn where the floor is: let it fall from high in the right margin and settle.
    await drop(page, 'arduino', 1.2);
    await page.evaluate(() =>
      window.__hooks!.desk!.scene!.teleport('arduino', 1.1, 1.2, 0),
    );
    await expect.poll(asleep, { timeout: 30_000 }).toBe(true);
    const floor = await page.evaluate(
      () =>
        window
          .__hooks!.desk!.scene!.physics()
          .bodies.find((b) => b.id === 'arduino')!.p[1],
    );
    const seen = async () => (await taps(page)).length;
    const hop = async (h: number) => {
      const n = await seen();
      await page.evaluate(
        ([y]) => window.__hooks!.desk!.scene!.teleport('arduino', 1.1, y!, 0),
        [floor + h],
      );
      await expect.poll(seen, { timeout: 20_000 }).toBeGreaterThan(n);
      await expect.poll(asleep, { timeout: 30_000 }).toBe(true);
      return (await taps(page))[n]!;
    };
    const soft = await hop(0.15);
    expect(soft.clip).toMatch(/^tap-[123]$/);
    const hard = await hop(1.2);
    expect(hard.gain).toBeGreaterThan(soft.gain);
  });

  test('hidden tab suspends the context; visible resumes it @E-08', async ({
    page,
  }) => {
    await goLive(page);
    await soundBtn(page).click();
    await expect.poll(async () => (await audio(page))?.state).toBe('running');
    const setHidden = (hidden: boolean) =>
      page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', {
          configurable: true,
          get: () => h,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    await expect.poll(async () => (await audio(page))?.state).toBe('suspended');
    await setHidden(false);
    await expect.poll(async () => (await audio(page))?.state).toBe('running');
  });

  test('codec: ogg/opus when it can play, else mp3 @E-08', async ({
    page,
    browser,
  }) => {
    const files: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/sounds/')) files.push(new URL(r.url()).pathname);
    });
    await goLive(page);
    await soundBtn(page).click();
    await expect.poll(() => files.length).toBe(4);
    expect(files.every((f) => f.endsWith('.ogg'))).toBe(true);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    const mp3: string[] = [];
    p2.on('request', (r) => {
      if (r.url().includes('/sounds/')) mp3.push(new URL(r.url()).pathname);
    });
    await p2.addInitScript(() => {
      HTMLMediaElement.prototype.canPlayType = () => '';
    });
    await goLive(p2);
    await p2.getByRole('button', { name: 'sound' }).click();
    await expect.poll(() => mp3.length).toBe(4);
    expect(mp3.every((f) => f.endsWith('.mp3'))).toBe(true);
    await ctx.close();
  });

  test('the clock ticks once when the minute changes @E-08', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-05T10:00:10Z') });
    await goLive(page);
    await soundBtn(page).click();
    await expect.poll(async () => (await audio(page))?.state).toBe('running');
    await page.waitForTimeout(1500);
    expect(
      (await audio(page))!.played.filter((p) => p.clip === 'tick'),
    ).toHaveLength(0);
    await page.clock.runFor(60_000);
    await expect
      .poll(
        async () =>
          (await audio(page))!.played.filter((p) => p.clip === 'tick').length,
      )
      .toBe(1);
  });
});
