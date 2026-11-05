import { test, expect } from './fixtures';
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
});
