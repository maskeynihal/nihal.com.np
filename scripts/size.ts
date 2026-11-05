import { spawnSync } from 'node:child_process';
import { globSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

/**
 * Budgets (F-02) live in .size-limit.json. A budget whose chunk is not built yet (desk-vendor and
 * physics arrive with E-tickets) is reported as skipped instead of failing size-limit's
 * "can't find files"; once the chunk exists the budget is enforced with no change here.
 * Run after `pnpm build`.
 */
interface Entry {
  name: string;
  path: string | string[];
  [k: string]: unknown;
}

const entries = JSON.parse(readFileSync('.size-limit.json', 'utf8')) as Entry[];
const active: Entry[] = [];
for (const e of entries) {
  const patterns = ([] as string[]).concat(e.path);
  const positive = patterns.filter((p) => !p.startsWith('!'));
  const found = positive.some((p) => globSync(p).length > 0);
  if (found) active.push(e);
  else console.log(`skipped (not built yet): ${e.name}`);
}

// size-limit resolves paths against the config file's folder, so the filtered copy sits at the root.
const config = '.size-limit.active.json';
writeFileSync(config, JSON.stringify(active));
const r = spawnSync('pnpm', ['exec', 'size-limit', '--config', config], {
  stdio: 'inherit',
});
rmSync(config, { force: true });
process.exit(r.status ?? 1);
