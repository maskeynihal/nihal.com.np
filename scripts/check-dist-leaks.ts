import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pending, PENDING_SENTINEL } from '../src/content/pending';
import { work } from '../src/content/work';
import { cv } from '../src/content/cv';
import { objects } from '../src/content/objects';

/** Binary if the first 8 KB contain a NUL byte. Everything else is scanned, whatever its name. */
export function isBinary(buf: Buffer): boolean {
  return buf.subarray(0, 8192).includes(0);
}

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

const SKIP_KEYS = new Set(['id', 'model', 'target', 'href']);

/**
 * Displayed strings of `confirmed: false` rows (work, cv, objects) that the getters filter
 * out of a plain build. Strings of 12+ characters, plus every object label and callout.
 * The cv org suffix ("for Trayt Health") lives in pending.candidates and is picked up by
 * `pendingStrings`.
 */
export function unconfirmedStrings(): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (v.length >= 12 && !/^https?:\/\//.test(v)) out.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) walk(x);
  };
  for (const row of [...work, ...cv]) if (!row.confirmed) walk(row);
  for (const o of objects) {
    if (o.confirmed) continue;
    out.add(o.label);
    for (const c of o.callouts ?? []) out.add(c.text);
  }
  return [...out];
}

const htmlEscape = (v: string) =>
  v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Scan every non-binary file under `dist`. `allowPending` is for the owner preview build only. */
export function checkLeaks(
  dist: string,
  opts: {
    allowPending?: boolean;
    pendingValues?: string[];
    unconfirmedValues?: string[];
  } = {},
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
    : [
        ...(opts.pendingValues ?? pendingStrings()),
        ...(opts.unconfirmedValues ?? unconfirmedStrings()),
      ];
  for (const file of walk(dist)) {
    const buf = readFileSync(file);
    if (isBinary(buf)) continue;
    const text = buf.toString('utf8');
    const rel = relative(dist, file);
    for (const [label, re] of [...always, ...(opts.allowPending ? [] : gated)])
      if (re.test(text)) leaks.push({ file: rel, match: label });
    for (const v of values) {
      // Raw, and as it would sit inside a JSON/JS string literal.
      const escaped = JSON.stringify(v).slice(1, -1);
      if (
        text.includes(v) ||
        text.includes(escaped) ||
        text.includes(htmlEscape(v))
      )
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
