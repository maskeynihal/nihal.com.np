import { test, expect, expectNoAxeViolations } from './fixtures';
import { objects } from '../src/content/objects';
import { work } from '../src/content/work';
import { oss } from '../src/content/oss';
import { writing } from '../src/content/writing';
import { cv } from '../src/content/cv';
import { copy } from '../src/content/copy';

// The default build shows confirmed rows only (content/index.ts).
const panels = work.filter((w) => w.confirmed);
const rows = cv.filter((r) => r.confirmed);

test.describe('work, open source, writing, cv @B-04', () => {
  test('one panel per confirmed work item with the anchor, heading, date line and text @B-04', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#work article')).toHaveCount(panels.length);
    // Trayt stays out until the owner confirms the client name.
    await expect(page.locator('#work-trayt')).toHaveCount(0);
    for (const w of panels) {
      const p = page.locator(`#work-${w.id}`);
      await expect(p).toHaveCount(1);
      await expect(
        p.getByRole('heading', { level: 3, name: w.title }),
      ).toBeVisible();
      for (const para of w.body) await expect(p).toContainText(para);
      const t = p.locator('.work-date time');
      await expect(t).toHaveAttribute('datetime', /^\d{4}-\d{2}$/);
      for (const l of w.links)
        await expect(p.getByRole('link', { name: l.label })).toHaveAttribute(
          'href',
          l.href,
        );
    }
  });

  test('every desk object points at a panel or section that exists, and the poster, list and panels agree @B-04', async ({
    page,
  }) => {
    await page.goto('/');
    const shown = objects.filter((o) => o.confirmed);
    const links = page.locator('[data-object-list] a');
    await expect(links).toHaveCount(shown.length);
    for (const [i, o] of shown.entries()) {
      await expect(links.nth(i)).toHaveAttribute('href', o.target);
      await expect(page.locator(o.target)).toHaveCount(1);
      await links.nth(i).click();
      await expect(page.locator(o.target)).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  });

  test('revision table: caption, column headers, one row per PR, dates as time @B-04', async ({
    page,
  }) => {
    await page.goto('/');
    const table = page.locator('#open-source table');
    await expect(table.locator('caption')).toHaveText(copy.openSource.intro);
    await expect(table.locator('thead th')).toHaveText([
      ...copy.openSource.columns,
    ]);
    await expect(table.locator('tbody tr')).toHaveCount(oss.length);
    for (const [i, r] of oss.entries()) {
      const link = table.locator('tbody tr').nth(i).getByRole('link');
      await expect(link).toHaveText(r.repo);
      await expect(link).toHaveAttribute('href', r.href);
    }
    // Month values are <time datetime>; ranges and bare years are plain text.
    await expect(table.locator('tbody time').first()).toHaveAttribute(
      'datetime',
      '2023-06',
    );
    await expect(table.locator('tfoot')).toContainText(
      /^\d+ merged, \d+ closed without merging, as of \d{4}-\d\d-\d\d\.$/,
    );
    await expect(table.locator('tfoot time')).toHaveAttribute(
      'datetime',
      /^\d{4}-\d\d-\d\d$/,
    );
    await expectNoAxeViolations(page, { label: '/ revision table' });
  });

  test('writing list: five posts, linked titles, time elements, link to all @B-04', async ({
    page,
  }) => {
    await page.goto('/');
    const items = page.locator('#writing .writing-list li');
    await expect(items).toHaveCount(writing.length);
    for (const [i, p] of writing.entries()) {
      await expect(items.nth(i).locator('time')).toHaveAttribute(
        'datetime',
        p.date,
      );
      await expect(
        items.nth(i).getByRole('link', { name: p.title }),
      ).toHaveAttribute('href', p.href);
      await expect(items.nth(i)).toContainText(p.summary);
    }
    await expect(
      page.locator('#writing').getByRole('link', { name: copy.writing.all }),
    ).toHaveAttribute('href', copy.writing.allHref);
  });

  test('cv is a table named by its heading, a row per role, date as row header @B-04', async ({
    page,
  }) => {
    await page.goto('/');
    const table = page.getByRole('table', { name: copy.headings.cv });
    await expect(table.locator('tr')).toHaveCount(rows.length);
    for (const [i, r] of rows.entries()) {
      const tr = table.locator('tr').nth(i);
      await expect(tr.locator('th[scope="row"]')).toHaveText(r.when);
      await expect(tr.locator('td').nth(0)).toHaveText(r.role);
      await expect(tr.locator('td').nth(1)).toHaveText(r.org);
    }
    await expect(page.locator('#cv')).toContainText(copy.cv.note);
  });

  test('headings are ordered and external links are https with rel @B-04', async ({
    page,
  }) => {
    await page.goto('/');
    const levels = await page
      .locator('main :is(h1,h2,h3,h4)')
      .evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
    let prev = 0;
    for (const l of levels) {
      expect(l - prev, `heading jump ${prev} to ${l}`).toBeLessThanOrEqual(1);
      prev = l;
    }
    const bad = await page
      .locator('#work a, #open-source a, #writing a')
      .evaluateAll((as) =>
        as
          .map((a) => a as HTMLAnchorElement)
          .filter(
            (a) => !a.href.startsWith('https://') || !/noopener/.test(a.rel),
          )
          .map((a) => a.href),
      );
    expect(bad).toEqual([]);
    await expectNoAxeViolations(page, { label: '/ work, writing, cv' });
  });

  test('no horizontal scroll with the tables at 320 px @B-04', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/');
    const w = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      innerWidth,
    ]);
    expect(w[0]).toBeLessThanOrEqual(w[1]!);
  });
});
