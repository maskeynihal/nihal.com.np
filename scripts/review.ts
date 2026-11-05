import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { isTicketId } from './review-id.ts';

const id = process.argv[2];
const run = (args: string[]) => spawnSync('pnpm', args, { stdio: 'inherit' });

if (id === '--all') {
  // fall through to full suite
} else if (!id || !isTicketId(id)) {
  console.error('usage: pnpm review <ID>   (e.g. A-08)   |   pnpm review:all');
  process.exit(2);
}

const build = run(['build:e2e']);
if (build.status !== 0) process.exit(build.status ?? 1);

const pw = run([
  'exec',
  'playwright',
  'test',
  ...(id && id !== '--all' ? ['--grep', `@${id}`] : []),
]);
console.log(`\nHTML report: ${resolve('playwright-report', 'index.html')}`);
process.exit(pw.status ?? 1);
