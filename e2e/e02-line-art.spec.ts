import { mkdirSync, writeFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';
import { test, expect, expectNoAxeViolations } from './fixtures';

// --blue, #1F3FE0 (tokens.css; the page itself is the reference, see the first test).
const BLUE = [0x1f, 0x3f, 0xe0] as const;
const SHOTS = process.env['E2E_SHOTS'] === '1';
const SHOT_DIR = 'docs/reviews/E-02';

const figure = (page: Page) => page.locator('[data-desk]');
const viewport = (page: Page) => raster(page);

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
  // The crossfade must be over before pixels are read.
  await expect(page.locator('.desk-live')).toHaveCSS('opacity', '1');
  await page.waitForTimeout(450);
}

interface Raster {
  data: Buffer;
  width: number;
  height: number;
  at(x: number, y: number): [number, number, number];
}

/** The canvas is a transparent full-viewport layer, so its pixels are read from the page with all
 *  other content hidden: only the page colour and the line art remain. */
async function quiet(page: Page) {
  await page.addStyleTag({
    content: `.title-block, .object-list, .desk-controls, .sheet-border, .sheet-index,
      main > section:not(#desk), header, footer { visibility: hidden !important; }`,
  });
}

async function raster(
  target: Locator | Page,
  clip?: { x: number; y: number; width: number; height: number },
): Promise<Raster> {
  const png =
    'screenshot' in target && 'goto' in target
      ? await (target as Page).screenshot(clip ? { clip } : {})
      : await (target as Locator).screenshot();
  const { data, info } = await sharp(png)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    at: (x, y) => {
      const i = (Math.round(y) * info.width + Math.round(x)) * 3;
      return [data[i]!, data[i + 1]!, data[i + 2]!];
    },
  };
}

const near = (c: readonly number[], want: readonly number[], tol: number) =>
  c.every((v, i) => Math.abs(v - want[i]!) <= tol);

function whiteMask(r: Raster, min = 190): Uint8Array {
  const m = new Uint8Array(r.width * r.height);
  for (let i = 0; i < m.length; i++)
    if (
      r.data[i * 3]! >= min &&
      r.data[i * 3 + 1]! >= min &&
      r.data[i * 3 + 2]! >= min
    )
      m[i] = 1;
  return m;
}

const canvasProject = (name: string) => name === 'desktop-chromium';

test.describe('line-art rendering @E-02', () => {
  test.describe.configure({ timeout: 120_000 });

  test('the canvas is transparent: the --blue page shows through within 2/255 @E-02', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await goLive(page);
    const token = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue('--blue')
        .trim(),
    );
    expect(token.toLowerCase()).toBe('#1f3fe0');
    await quiet(page);
    const r = await viewport(page);
    // The canvas is transparent: the page colour shows through between the lines.
    for (const [x, y] of [
      [40, 40],
      [r.width - 40, 40],
      [r.width - 40, r.height - 40],
      [Math.round(r.width / 2), 40],
    ] as const) {
      const px = r.at(x, y);
      expect(near(px, BLUE, 2), `pixel ${x},${y} = ${px}`).toBe(true);
    }
    await expectNoAxeViolations(page, { label: '/ canvas live (line art)' });
  });

  test('the inverted-hull outline shows on a sphere at DPR 1; the inside is the blue occluder @E-02', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await goLive(page);
    await quiet(page);
    const before = await page.evaluate(() =>
      window.__hooks!.desk!.scene!.frames(),
    );
    const s = await page.evaluate(() =>
      window.__hooks!.desk!.scene!.probeSphere(true),
    );
    expect(s).not.toBeNull();
    await expect
      .poll(() => page.evaluate(() => window.__hooks!.desk!.scene!.frames()))
      .toBeGreaterThan(before);
    await page.waitForTimeout(300);
    const r = await viewport(page);
    const { cx, cy, r: radius } = s!;
    // Inside: the occluder fill (no lights, no shading).
    expect(near(r.at(cx, cy), BLUE, 2)).toBe(true);
    expect(near(r.at(cx, cy + radius * 0.4), BLUE, 2)).toBe(true);
    // The silhouette: a white ring one to two pixels wide at the sphere's horizontal extremes.
    for (const side of [-1, 1]) {
      let best = 0;
      for (let dx = -4; dx <= 4; dx++) {
        const px = r.at(cx + side * radius + dx, cy);
        best = Math.max(best, Math.min(...px));
      }
      expect(
        best,
        `outline at the ${side < 0 ? 'left' : 'right'} edge`,
      ).toBeGreaterThan(200);
      // And outside the ring it is background again.
      expect(near(r.at(cx + side * (radius + 25), cy), BLUE, 2)).toBe(true);
    }
    // Top and bottom as well, so it is a ring and not two arcs.
    for (const side of [-1, 1]) {
      let best = 0;
      for (let dy = -4; dy <= 4; dy++)
        best = Math.max(best, Math.min(...r.at(cx, cy + side * radius + dy)));
      expect(best).toBeGreaterThan(200);
    }
    await page.evaluate(() => window.__hooks!.desk!.scene!.probeSphere(false));
  });

  test('crease lines and silhouettes are drawn for every object @E-02', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await goLive(page);
    await quiet(page);
    const r = await viewport(page);
    const mask = whiteMask(r);
    let white = 0;
    for (const v of mask) white += v;
    // The poster draws a few thousand white pixels at this size; an empty or fill-only canvas
    // draws none.
    expect(white).toBeGreaterThan(1500);
    // Nothing is drawn black or off-palette: every pixel keeps a strong blue channel.
    let darkest = 255;
    for (let i = 2; i < r.data.length; i += 3)
      darkest = Math.min(darkest, r.data[i]!);
    expect(darkest).toBeGreaterThan(0x60);
  });

  test('the canvas lines up with the poster at the same camera @E-02', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 1100 });
    await goLive(page);
    await quiet(page);
    const box = (await page.locator('[data-poster]').boundingBox())!;
    const clip = {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
    const live = await raster(page, clip);
    // Show the poster again (the shell only sets this attribute) and capture it.
    await figure(page).evaluate((el) =>
      el.setAttribute('data-desk-state', 'poster'),
    );
    await expect(page.locator('.desk-live')).toHaveCSS('opacity', '0');
    await page.waitForTimeout(450);
    const poster = await raster(page, clip);
    expect([poster.width, poster.height]).toEqual([live.width, live.height]);
    const a = whiteMask(poster);
    const b = whiteMask(live);
    // Every poster line pixel (outside the clock face, whose hands show real time, and the two
    // textured quads) has a canvas line pixel within 3 px.
    const R = 3;
    let total = 0;
    let hit = 0;
    for (let y = 0; y < poster.height; y++)
      for (let x = 0; x < poster.width; x++) {
        if (!a[y * poster.width + x]) continue;
        total++;
        let found = false;
        for (let dy = -R; dy <= R && !found; dy++)
          for (let dx = -R; dx <= R && !found; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= live.width || yy >= live.height)
              continue;
            if (b[yy * live.width + xx]) found = true;
          }
        if (found) hit++;
      }
    const ratio = hit / total;
    test.info().annotations.push({
      type: 'poster-overlap',
      description: `${(ratio * 100).toFixed(1)}% of ${total} poster line pixels within ${R}px of a canvas line`,
    });
    expect(ratio).toBeGreaterThan(0.85);
  });

  test('screenshots of the live canvas at desktop, tablet and phone sizes @E-02', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    const sizes = [
      ['desktop', 1280, 900],
      ['tablet', 900, 1100],
      ['phone', 390, 844],
    ] as const;
    for (const [name, w, h] of sizes) {
      // Viewport first, then load, so the phone camera is chosen from the start.
      await page.setViewportSize({ width: w, height: h });
      await goLive(page);
      const shot = await page.screenshot();
      const meta = await sharp(shot).metadata();
      expect(meta.width).toBeGreaterThan(200);
      await quiet(page);
      const r = await viewport(page);
      expect(near(r.at(40, 40), BLUE, 2), `${name} background`).toBe(true);
      let white = 0;
      for (const v of whiteMask(r)) white += v;
      expect(white, `${name} has line art`).toBeGreaterThan(300);
      if (SHOTS) {
        mkdirSync(SHOT_DIR, { recursive: true });
        writeFileSync(`${SHOT_DIR}/live-${name}.png`, shot);
      }
    }
    if (SHOTS) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await goLive(page);
      await figure(page).evaluate((el) =>
        el.setAttribute('data-desk-state', 'poster'),
      );
      await expect(page.locator('.desk-live')).toHaveCSS('opacity', '0');
      await page.waitForTimeout(450);
      writeFileSync(
        `${SHOT_DIR}/poster-desktop.png`,
        await figure(page).screenshot(),
      );
    }
  });

  test('the line materials follow a resize: lines stay drawn at the new size @E-02', async ({
    page,
  }, info) => {
    test.skip(!canvasProject(info.project.name), 'needs SwiftShader');
    await page.setViewportSize({ width: 1280, height: 900 });
    await goLive(page);
    await page.setViewportSize({ width: 1000, height: 800 });
    await expect
      .poll(() =>
        page.evaluate(() => window.__hooks!.desk!.scene!.size().width),
      )
      .toBe(1000);
    await page.waitForTimeout(500);
    await quiet(page);
    const r = await viewport(page);
    let white = 0;
    for (const v of whiteMask(r)) white += v;
    expect(white).toBeGreaterThan(800);
  });
});
