import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeVercelJson } from './write-vercel-json.ts';

/**
 * Fails when the committed vercel.json (CSP hashes of the inline scripts) differs from what the
 * current `pnpm build` output would produce. Run after `pnpm build` (not `build:e2e`). Fix by
 * committing the vercel.json the build wrote.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fresh = readFileSync(
  writeVercelJson(
    join(root, 'dist'),
    join(mkdtempSync(join(tmpdir(), 'vercel-')), 'vercel.json'),
  ),
  'utf8',
);
const committed = readFileSync(join(root, 'vercel.json'), 'utf8');
if (fresh !== committed) {
  console.error(
    'vercel.json is stale: it differs from the build output. Run `pnpm build` and commit vercel.json.',
  );
  process.exit(1);
}
console.log('check:vercel-json ok');
