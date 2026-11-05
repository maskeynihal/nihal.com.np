import { test, expect, expectNoAxeViolations } from './fixtures';
import { readFileSync } from 'node:fs';
import { copy } from '../src/content/copy';

test('title block option A comes from content @A-04', async ({ page }) => {
  const sentence = copy.titleBlock.options[copy.titleBlock.selected];
  expect(copy.titleBlock.selected).toBe('A');
  expect(sentence).toMatch(/^I'm a software engineer in Kathmandu\./);

  // Not hard-coded in the page source.
  const src = readFileSync('src/pages/index.astro', 'utf8');
  expect(src).not.toContain("I'm a software engineer in Kathmandu");
  expect(src).not.toContain('healthcare software on AWS');

  await page.goto('/');
  await expect(page.locator('main')).toContainText(sentence);
  await expect(page.locator('h1')).toHaveText(copy.titleBlock.name);
  // No unresolved bracket text reaches the page.
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/\[(CONFIRM|ASK)/);
  await expectNoAxeViolations(page, { label: '/ content' });
});

test('no script or stylesheet the page loads contains unconfirmed notes @A-04', async ({
  page,
  baseURL,
}) => {
  await page.goto('/');
  const urls = await page.evaluate(() => {
    const out = new Set<string>();
    document
      .querySelectorAll<HTMLScriptElement>('script[src]')
      .forEach((s) => out.add(s.src));
    document
      .querySelectorAll<HTMLLinkElement>(
        'link[rel~="stylesheet"], link[rel~="modulepreload"]',
      )
      .forEach((l) => out.add(l.href));
    performance.getEntriesByType('resource').forEach((r) => out.add(r.name));
    return [...out];
  });
  const origin = new URL(baseURL ?? page.url()).origin;
  const same = urls.filter(
    (u) => new URL(u).origin === origin && /\.(js|mjs|css)(\?|$)/.test(u),
  );
  expect(same.length).toBeGreaterThan(0);
  for (const u of same) {
    const res = await page.request.get(u);
    const text = await res.text();
    expect(text, u).not.toContain('[CONFIRM');
    expect(text, u).not.toContain('[ASK');
  }
});
