import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';

const allowlist = readFileSync(
  new URL('./console-allowlist.txt', import.meta.url),
  'utf8',
)
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l !== '' && !l.startsWith('#'))
  .map((l) => new RegExp(l));

const allowed = (text: string) => allowlist.some((re) => re.test(text));

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        const type = msg.type();
        if ((type === 'error' || type === 'warning') && !allowed(msg.text())) {
          problems.push(`console.${type}: ${msg.text()}`);
        }
      });
      page.on('pageerror', (err) => {
        if (!allowed(err.message)) problems.push(`pageerror: ${err.message}`);
      });
      await use();
      expect(problems, 'unexpected console output').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
