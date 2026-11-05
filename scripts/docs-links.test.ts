import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

/** Relative markdown links in the top-level docs must point at files that exist. */
describe.each(['README.md', 'CONTRIBUTING.md'])('%s', (file) => {
  const text = readFileSync(resolve(root, file), 'utf8');
  const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1] ?? '')
    .filter((l) => !/^(https?:|mailto:|#)/.test(l));

  it('has relative links', () => {
    expect(links.length).toBeGreaterThan(0);
  });
  it.each(links)('link %s resolves', (link) => {
    const path = link.split('#')[0] ?? '';
    expect(existsSync(resolve(dirname(resolve(root, file)), path))).toBe(true);
  });
});

describe('repo hygiene files', () => {
  it('exist and parse', () => {
    for (const f of ['.github/CODEOWNERS', 'renovate.json', 'CONTRIBUTING.md'])
      expect(existsSync(resolve(root, f)), f).toBe(true);
    const r = JSON.parse(
      readFileSync(resolve(root, 'renovate.json'), 'utf8'),
    ) as {
      packageRules: { matchPackageNames: string[]; enabled?: boolean }[];
    };
    const ts = r.packageRules.find((p) =>
      p.matchPackageNames.includes('typescript'),
    );
    expect(ts?.enabled).toBe(false);
  });
  it('README documents the TypeScript pin and the real scripts', () => {
    const readme = readFileSync(resolve(root, 'README.md'), 'utf8');
    expect(readme).toMatch(/typescript-eslint/);
    const pkg = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
    };
    for (const s of ['dev', 'build', 'verify', 'review', 'test', 'lint'])
      expect(readme).toContain(`pnpm ${s}`);
    expect(Object.keys(pkg.scripts)).toContain('verify');
  });
});
