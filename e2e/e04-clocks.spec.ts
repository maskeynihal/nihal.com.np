import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';
import { formatClock, KATHMANDU } from '../src/lib/time';
import { bsFromInstant, formatBs, BS_MONTH_NAMES } from '../src/lib/bs-date';
import { handAngles } from '../src/lib/desk/clock';

const figure = (page: Page) => page.locator('[data-desk]');
const scene = <T>(page: Page, f: () => T) => page.evaluate(f);

async function goLive(page: Page) {
  await page.goto('/');
  await expect(figure(page)).toHaveAttribute('data-desk-state', 'live', {
    timeout: 45_000,
  });
}

const deg = (r: number) => ((((r * 180) / Math.PI) % 360) + 360) % 360;

test.describe('clocks, calendar, ghost @E-04', () => {
  test.describe.configure({ timeout: 120_000 });
  // Playwright needs the destructuring pattern for the fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop-chromium', 'needs SwiftShader');
  });

  test('clock hands read the same Kathmandu time as the title block @E-04', async ({
    page,
  }) => {
    await goLive(page);
    // The hands step on a 1 s timer; sample around it so a minute rollover cannot flake.
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = formatClock(new Date(), KATHMANDU);
      const clocks = await scene(page, () =>
        window.__hooks!.desk!.scene!.clocks(),
      );
      const after = formatClock(new Date(), KATHMANDU);
      if (before !== after) {
        await page.waitForTimeout(1500);
        continue;
      }
      expect(clocks.map((c) => c.id)).toEqual(['clock-ktm']);
      const [h, m] = before.split(':').map(Number) as [number, number];
      expect(deg(clocks[0]!.minute)).toBeCloseTo(m * 6, 3);
      expect(deg(clocks[0]!.hour)).toBeCloseTo(((h % 12) + m / 60) * 30, 3);
      // And the title block on the same page shows that same minute.
      const dom = await page.locator('[data-live-time]').textContent();
      expect([
        before,
        formatClock(new Date(Date.now() - 60_000), KATHMANDU),
      ]).toContain(dom);
      const expected = handAngles(new Date(), KATHMANDU);
      expect(deg(clocks[0]!.minute)).toBeCloseTo(deg(expected.minute), 3);
      return;
    }
    throw new Error('minute rolled over three times');
  });

  test('the hands keep time: they move to the next minute without a reload @E-04', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-11-05T08:00:30Z') });
    await goLive(page);
    const read = () =>
      scene(page, () => window.__hooks!.desk!.scene!.clocks()[0]!);
    const a = await read();
    await page.clock.runFor(61_000);
    await expect.poll(async () => (await read()).minute).not.toBe(a.minute);
    const b = await read();
    expect(deg(b.minute)).toBeCloseTo((deg(a.minute) + 6) % 360, 3);
  });

  test('the calendar shows the BS date for today in Kathmandu @E-04', async ({
    page,
  }) => {
    await goLive(page);
    const face = (await scene(page, () =>
      window.__hooks!.desk!.scene!.calendar(),
    )) as {
      day: string;
      monthYear: string;
      iso: string;
      holiday?: string;
    };
    const now = new Date();
    const alt = new Date(now.getTime() - 5_000);
    const options = [now, alt].map((d) => {
      const bs = bsFromInstant(d);
      return {
        day: String(bs.day),
        monthYear: `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`,
        iso: formatBs(bs),
      };
    });
    expect(options.some((o) => o.iso === face.iso)).toBe(true);
    const want = options.find((o) => o.iso === face.iso)!;
    expect(face.day).toBe(want.day);
    expect(face.monthYear).toBe(want.monthYear);
  });

  test('the calendar names a public holiday on the day it falls @E-04', async ({
    page,
  }) => {
    const holidays = JSON.parse(
      readFileSync('src/content/holidays.json', 'utf8'),
    ) as { adDate: string; name: string }[];
    const h =
      holidays.find((x) => x.adDate.startsWith('2026-')) ?? holidays.at(-1)!;
    await page.clock.install({ time: new Date(`${h.adDate}T06:00:00Z`) });
    await goLive(page);
    const face = (await scene(page, () =>
      window.__hooks!.desk!.scene!.calendar(),
    )) as {
      holiday?: string;
    };
    expect(face.holiday).toBe(h.name);
  });

  test('the ghost looks ahead at rest, follows only while grabbed, and lets go @E-04', async ({
    page,
  }) => {
    await goLive(page);
    const eyes = () =>
      scene(page, () => window.__hooks!.desk!.scene!.ghostEyes());
    expect(await eyes()).toEqual([0, 0]);
    // Pointer moves over the page do nothing: no idle following.
    await page.mouse.move(200, 200);
    await page.mouse.move(900, 500);
    await page.waitForTimeout(200);
    expect(await eyes()).toEqual([0, 0]);
    // A grab (E-05 sets the target) turns both eyes toward it.
    await page.evaluate(() =>
      window.__hooks!.desk!.scene!.ghostLook(-0.3, 0.1),
    );
    const [l, r] = await eyes();
    expect(l).toBeLessThan(0);
    expect(r).toBeLessThan(0);
    await page.evaluate(() => window.__hooks!.desk!.scene!.ghostLook(0.9, 0.6));
    const [l2, r2] = await eyes();
    expect(l2).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(0);
    await page.evaluate(() => window.__hooks!.desk!.scene!.ghostRelease());
    expect(await eyes()).toEqual([0, 0]);
    await expectNoAxeViolations(page, { label: '/ desk after ghost look' });
  });
});
