import { spawnSync } from 'node:child_process';
import { globSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { initialJsFiles } from './check-initial-graph.ts';

/**
 * Budgets (F-02) live in .size-limit.json. Run after `pnpm build`.
 *
 * - The path `@initial-graph` means the real initial JS: the files the browser loads on first paint,
 *   found by the same walk as `pnpm check:graph` (scripts, modulepreloads, island entries and their
 *   static imports), not a filename glob.
 * - A budget whose files do not exist is an error, never a skip: a renamed or missing chunk must not
 *   silently leave its budget unchecked.
 */
interface Entry {
  name: string;
  path: string | string[];
  [k: string]: unknown;
}

const entries = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Entry[];
const initial = (await initialJsFiles(resolve('dist'))).map((f) =>
  relative(process.cwd(), f),
);
const missing: string[] = [];
const active: Entry[] = [];
for (const e of entries) {
  const patterns = ([] as string[]).concat(e.path);
  const expanded = patterns.flatMap((p) =>
    p === '@initial-graph' ? initial : [p],
  );
  const positive = expanded.filter((p) => !p.startsWith('!'));
  if (positive.length === 0 || positive.some((p) => globSync(p).length === 0)) {
    missing.push(e.name);
    continue;
  }
  active.push({ ...e, path: expanded });
}
if (missing.length > 0) {
  for (const n of missing)
    console.error(`FAIL size budget matches no file: ${n}`);
  process.exit(1);
}
console.log(`initial JS files (${initial.length}):`);
for (const f of initial) console.log(`  ${f}`);

// size-limit resolves paths against the config file's folder, so the filtered copy sits at the root.
const config = '.size-limit.active.json';
writeFileSync(config, JSON.stringify(active));
const r = spawnSync('pnpm', ['exec', 'size-limit', '--config', config], {
  stdio: 'inherit',
});
rmSync(config, { force: true });
process.exit(r.status ?? 1);
