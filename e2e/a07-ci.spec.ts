import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// File-level checks (no page): the CI workflow keeps the commands the carry-overs require.
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const budgets = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as {
  name: string;
  limit: string;
}[];

test.describe('CI workflow and budgets @A-07', () => {
  test('workflow runs the required commands @A-07', () => {
    for (const cmd of [
      'pnpm exec playwright install --with-deps chromium webkit',
      'pnpm review:all',
      'pnpm lhci',
      'pnpm check:vercel-json',
      'pnpm assets',
      'git diff --exit-code src/assets',
      'pnpm size',
      'pnpm copy-gate',
      'pnpm check:graph',
    ])
      expect(ci, cmd).toContain(cmd);
  });

  test('size budgets match F-02 @A-07', () => {
    const byName = (s: string) => budgets.find((b) => b.name.startsWith(s));
    expect(byName('initial JS')?.limit).toBe('100 KB');
    expect(byName('desk-vendor')?.limit).toBe('320 KB');
    expect(byName('models')?.limit).toBe('150 KB');
    expect(byName('physics')?.limit).toBe('620 KB');
    expect(byName('fonts')?.limit).toBe('130 KB');
  });

  test('lighthouse SEO assertion is scoped to the home page @A-07', () => {
    const rc = readFileSync('lighthouserc.cjs', 'utf8');
    expect(rc).toMatch(
      /matchingUrlPattern[^\n]*index[^\n]*\n[\s\S]*categories:seo/,
    );
  });
});
