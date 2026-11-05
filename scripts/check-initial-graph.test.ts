import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, 'check-initial-graph.ts');
const run = (dir: string) =>
  spawnSync(
    'pnpm',
    ['exec', 'tsx', script, resolve(import.meta.dirname, '__fixtures__', dir)],
    {
      encoding: 'utf8',
    },
  );

describe('check-initial-graph', () => {
  it('passes when heavy chunks are only dynamically imported', () => {
    const r = run('clean');
    expect(r.status).toBe(0);
  });
  it('fails and prints the chain when a heavy chunk is statically reachable', () => {
    const r = run('leaky');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      'entry.js -> assets/mid.js -> assets/desk-vendor-abc.js'.replace(
        'entry.js',
        'assets/entry.js',
      ),
    );
  });
  it('fails when the leak is reached only through an inline module script', () => {
    const r = run('leaky-inline');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      'index.html#inline-module-1 -> assets/mid.js -> assets/desk-vendor-abc.js',
    );
  });
}, 60_000);
