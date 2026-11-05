import { test, expect, expectNoAxeViolations } from './fixtures';
import { readFileSync } from 'node:fs';
import { bsFromAd, bsToAd } from '../src/lib/bs-date';
import { Holiday } from '../src/content/schema';

// B-09 is data and conversion only; the calendar object that shows it is E-04. The browser
// checks here are that the data stays out of the page and the bundles until then.
test.describe('Bikram Sambat date and holidays @B-09', () => {
  test('holidays.json parses against the schema with a source on every row @B-09', () => {
    const rows: unknown = JSON.parse(
      readFileSync('src/content/holidays.json', 'utf8'),
    );
    expect(Array.isArray(rows)).toBe(true);
    for (const r of rows as unknown[]) {
      const p = Holiday.safeParse(r);
      expect(p.success).toBe(true);
      if (p.success) {
        expect(bsToAd(parseBs(p.data.bsDate))).toBe(p.data.adDate);
        expect(p.data.source).toMatch(/^https:\/\//);
      }
    }
  });

  test('the conversion is deterministic across the Nepali new year @B-09', () => {
    expect(bsFromAd('2026-04-14')).toEqual({ year: 2083, month: 1, day: 1 });
    expect(bsFromAd('2026-04-13')).toEqual({ year: 2082, month: 12, day: 30 });
  });

  test('holiday and Bikram Sambat data reaches only the lazy Scene chunk, never the page or the initial scripts @B-09', async ({
    page,
  }) => {
    const urls: string[] = [];
    page.on('response', (r) => {
      const path = new URL(r.url()).pathname;
      // E-04: the desk's calendar texture reads holidays.json, so the lazy Scene chunk holds it.
      if (/\.(js|css|html)$|\/$/.test(path) && !/\/Scene\./.test(path))
        urls.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    for (const u of urls) {
      const body = await (await page.request.get(u)).text();
      expect(body, u).not.toContain('Ghatasthapana');
      expect(body, u).not.toContain('Baisakh');
    }
    await expectNoAxeViolations(page, { label: '/ with no calendar data' });
  });
});

function parseBs(s: string) {
  const [year, month, day] = s.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return { year, month, day };
}
