import { test, expect } from './fixtures';
import { headingCaseViolations } from '../scripts/copy-gate';

test('page text has no em dash, exclamation mark or emoji @A-05', async ({
  page,
}) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('—');
  expect(text).not.toContain('!');
  expect(text).not.toMatch(/(?![©®])[\p{Extended_Pictographic}♥]/u);
});

test('h1 to h3 have no uppercase outside the proper-noun allowlist @A-05', async ({
  page,
}) => {
  await page.goto('/');
  const headings = await page.locator('h1, h2, h3').allInnerTexts();
  expect(headings.length).toBeGreaterThan(0);
  for (const h of headings)
    expect(headingCaseViolations(h), `heading "${h}"`).toEqual([]);
});
