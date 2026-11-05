import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

const file = (p: string) => new URL(`../${p}`, import.meta.url);

// File-level checks; they do not touch the browser, so one project is enough.
test.describe('repo hygiene @A-11', () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== 'desktop-chromium',
      'file checks run once',
    );
  });

  test('required files exist @A-11', () => {
    for (const f of [
      'README.md',
      'CONTRIBUTING.md',
      'renovate.json',
      '.github/CODEOWNERS',
    ])
      expect(existsSync(file(f)), f).toBe(true);
  });

  test('every pnpm command the README names is a package script @A-11', () => {
    const readme = readFileSync(file('README.md'), 'utf8');
    const pkg = JSON.parse(readFileSync(file('package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const names = [...readme.matchAll(/`pnpm ([a-z:-]+)/g)].map(
      (m) => m[1] ?? '',
    );
    const builtIn = new Set(['dev', 'build', 'preview', 'test']);
    expect(names.length).toBeGreaterThan(5);
    for (const n of names)
      expect(n in pkg.scripts || builtIn.has(n), n).toBe(true);
  });

  test('the TypeScript pin is documented and enforced by Renovate @A-11', () => {
    expect(readFileSync(file('README.md'), 'utf8')).toContain(
      'Why TypeScript is pinned to 6.x',
    );
    const r = JSON.parse(readFileSync(file('renovate.json'), 'utf8')) as {
      packageRules: {
        matchPackageNames: string[];
        matchUpdateTypes?: string[];
        enabled?: boolean;
      }[];
    };
    const rule = r.packageRules.find((p) =>
      p.matchPackageNames.includes('typescript'),
    );
    expect(rule?.matchUpdateTypes).toContain('major');
    expect(rule?.enabled).toBe(false);
  });
});
