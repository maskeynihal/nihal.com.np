import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pending, PENDING_SENTINEL } from '../src/content/pending';

const TEXT_EXT = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.txt',
  '.xml',
  '.svg',
  '.webmanifest',
  '.map',
]);

export interface Leak {
  file: string;
  match: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Every string value exported by pending.ts that is longer than 12 characters. */
export function pendingStrings(value: unknown = pending, out: string[] = []) {
  if (typeof value === 'string') {
    if (value.length > 12) out.push(value);
  } else if (Array.isArray(value)) value.forEach((v) => pendingStrings(v, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => pendingStrings(v, out));
  return out;
}

/** Scan every text file under `dist`. `allowPending` is for the owner preview build only. */
export function checkLeaks(
  dist: string,
  opts: { allowPending?: boolean; pendingValues?: string[] } = {},
): Leak[] {
  const leaks: Leak[] = [];
  const always: [string, RegExp][] = [
    ['TODO', /\bTODO\b/],
    ['lorem', /lorem/i],
  ];
  const gated: [string, RegExp][] = [
    ['[CONFIRM', /\[CONFIRM/],
    ['[ASK', /\[ASK/],
    [PENDING_SENTINEL, new RegExp(PENDING_SENTINEL)],
  ];
  const values = opts.allowPending
    ? []
    : (opts.pendingValues ?? pendingStrings());
  for (const file of walk(dist)) {
    if (!TEXT_EXT.has(extname(file).toLowerCase())) continue;
    const text = readFileSync(file, 'utf8');
    const rel = relative(dist, file);
    for (const [label, re] of [...always, ...(opts.allowPending ? [] : gated)])
      if (re.test(text)) leaks.push({ file: rel, match: label });
    for (const v of values) {
      // Raw, and as it would sit inside a JSON/JS string literal.
      const escaped = JSON.stringify(v).slice(1, -1);
      if (text.includes(v) || text.includes(escaped))
        leaks.push({ file: rel, match: v });
    }
  }
  return leaks;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const allowPending = process.argv.includes('--allow-pending');
  const dist = resolve('dist');
  const leaks = checkLeaks(dist, { allowPending });
  if (leaks.length) {
    console.error(
      'check:leaks FAILED. Unconfirmed or placeholder text in dist/:',
    );
    for (const l of leaks) console.error(`  ${l.file}: ${l.match}`);
    process.exit(1);
  }
  console.log(
    `check:leaks ok (${allowPending ? 'pending allowed' : 'no pending text'})`,
  );
}
