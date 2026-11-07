/**
 * Copy gate (A-05). `pnpm copy-gate`.
 *
 * Input: every displayed string.
 *  1. `src/content/*` modules, imported and walked leaf by leaf (copy, client-copy,
 *     work, oss, writing, cv, objects labels, generated poster alt).
 *     `pending.ts` is skipped on purpose: it holds notes and candidates, never displayed.
 *  2. Template text and `aria-label` / `alt` / `title` / `placeholder` attributes in `src/**\/*.astro`.
 *
 * Rules (output `path: rule: match`, exit 1 on any hit):
 *  banned-word, banned-phrase (docs/specs/02-copy.md section 2), em-dash, exclamation, emoji,
 *  title-case (headings only).
 *
 * .astro scanner limits (a small hand-written parser, not the Astro compiler):
 *  - frontmatter, <script>, <style> and HTML comments are ignored;
 *  - in `{...}` expressions only quoted string literals are checked, not code and not
 *    markup nested inside the expression (e.g. text inside a `.map(() => <li>..</li>)`);
 *    `pnpm check` also runs scripts/check-dist-copy.ts over the built HTML, which sees that text;
 *  - an unbalanced quote or brace inside `{...}` or a tag is an error (exit 1, file:line);
 *  - `<script type="application/ld+json">` bodies are read (quoted values), other scripts are not;
 *  - dynamic attribute values are checked only through their quoted literals;
 *  - only the attributes in ASTRO_ATTRS are read; title-case is not checked in .astro files
 *    (the e2e spec checks rendered h1-h3 instead);
 *  - strings built at runtime, CSS `content:` and files other than .astro are not seen.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copy } from '../src/content/copy';
import { deskNote, soundLabel } from '../src/content/client-copy';
import { work } from '../src/content/work';
import { oss } from '../src/content/oss';
import { writing } from '../src/content/writing';
import { cv } from '../src/content/cv';
import { objects } from '../src/content/objects';
import { buildPosterAlt } from '../src/content/poster-alt';
import { buildPerson } from '../src/lib/jsonld';

/** Source of truth is docs/specs/02-copy.md section 2; copy-gate.test.ts asserts equality. */
export const BANNED_WORDS = [
  'passionate',
  'seamless',
  'seamlessly',
  'leverage',
  'leveraging',
  'elevate',
  'unlock',
  'delve',
  'robust',
  'cutting-edge',
  'innovative',
  'impactful',
  'journey',
  'crafting',
  'crafted',
  'empower',
  'synergy',
  'dynamic',
  'results-driven',
  'proven track record',
  'best practices',
  'exceptional',
  'state-of-the-art',
  'harness',
  'foster',
  'facilitate',
  'utilize',
  'showcase',
  'streamline',
  'scalable solution',
  'game-changing',
  'transformative',
  'revolutionize',
  'pivotal',
  'realm',
  'landscape',
  'tapestry',
  'testament',
  'meticulous',
  'meticulously',
  'vibrant',
  'multifaceted',
  'nuanced',
  'intricate',
  'comprehensive',
  'holistic',
  'bespoke',
  'world-class',
  'thought leader',
  'ninja',
  'guru',
  'rockstar',
  'wizard',
  'enthusiast',
  'tech-savvy',
  'detail-oriented',
  'self-starter',
  'team player',
  'visionary',
  'curated',
  'immersive',
  'delightful',
  'magical',
  'supercharge',
  'unleash',
  'frictionless',
  'next-level',
  'paradigm',
  'additionally',
] as const;

export const BANNED_PHRASES = [
  'digital experiences',
  'user experiences',
  'based in',
  "let's connect",
  "let's build",
  'turning ideas into reality',
  'bringing ideas to life',
  'bring ideas to life',
  'at the intersection of',
  'end-to-end',
  'from concept to',
  'welcome to my',
  "here's the thing",
  "it's worth noting",
  "in today's",
  'fast-paced',
  "let's dive",
  'stay tuned',
  'feel free to',
  "don't hesitate",
  'reach out',
  'coming soon',
  'pixel-perfect',
  'build something amazing',
  'lorem ipsum',
  'in conclusion',
  'in summary',
  "whether you're",
  'stands as',
  'serves as',
  'made with',
] as const;

/** Exact, case-sensitive tokens exempt from the banned list (spec section 2). */
export const ALLOWED_TOKENS = ['DynamoDB', 'Loop Harness'] as const;

/**
 * Proper nouns and acronyms allowed to carry capitals inside a heading
 * (spec section 1 rule 7: headings are lowercase). Exact, case-sensitive tokens.
 * Add a name here only when it is a real proper noun or product name.
 */
export const HEADING_PROPER_NOUNS = [
  '3D',
  'AWS',
  'GitHub',
  'Hashnode',
  'LinkedIn',
  'DynamoDB',
  'TypeScript',
  'JavaScript',
  'WiFi',
  'UNO',
  'Arduino',
  'Kathmandu',
  'Leapfrog',
  'Vercel',
  'Laravel',
  'Svelte',
  'macOS',
  'Chrome',
  'Firefox',
] as const;

export type Rule =
  | 'banned-word'
  | 'banned-phrase'
  | 'em-dash'
  | 'exclamation'
  | 'emoji'
  | 'title-case';

export interface Hit {
  path: string;
  rule: Rule;
  match: string;
}

export interface Entry {
  path: string;
  text: string;
  heading?: boolean;
}

const SEP = '[\\s\\-\\u2010\\u2011\\u2013]+';
const APOS = "['\\u2019]";
const LEFT = '(?<![\\p{L}\\p{N}_])';
const RIGHT = '(?![\\p{L}\\p{N}_])';

/** Case-insensitive, word-bounded, tolerant of hyphen/space/newline and curly apostrophes. */
function phraseRegex(phrase: string): RegExp {
  const body = phrase
    .split(/[\s-]+/)
    .map((part) =>
      part
        .split("'")
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join(APOS),
    )
    .join(SEP);
  return new RegExp(`${LEFT}${body}${RIGHT}`, 'giu');
}

/**
 * Banned verbs whose inflections are banned too (spec section 2 lists the base form).
 * `dynamic` and the like are not verbs and get no stem rule: `dynamically` stays clean.
 */
const VERB_ROOTS = [
  'leverage',
  'elevate',
  'unlock',
  'delve',
  'empower',
  'harness',
  'foster',
  'facilitate',
  'utilize',
  'showcase',
  'streamline',
  'revolutionize',
  'supercharge',
  'unleash',
] as const;

/** Phrases with a verb head: head -> its other forms. */
const PHRASE_INFLECTIONS: Record<string, string[]> = {
  'reach out': ['reaches out', 'reached out', 'reaching out'],
  'serves as': ['serve as', 'served as', 'serving as'],
};

export function verbForms(root: string): string[] {
  const e = root.endsWith('e');
  const stem = e ? root.slice(0, -1) : root;
  const third = /(s|sh|ch|x|z)$/.test(root) ? `${root}es` : `${root}s`;
  return [third, e ? `${root}d` : `${root}ed`, `${stem}ing`];
}

const listed = new Set<string>(BANNED_WORDS);
const WORD_FORMS = [
  ...BANNED_WORDS.map((w) => [w, w] as const),
  ...VERB_ROOTS.flatMap((r) =>
    verbForms(r)
      .filter((f) => !listed.has(f))
      .map((f) => [r, f] as const),
  ),
];
const WORD_RES = WORD_FORMS.map(([, f]) => [f, phraseRegex(f)] as const);
const PHRASE_RES = BANNED_PHRASES.flatMap((p) =>
  [p, ...(PHRASE_INFLECTIONS[p] ?? [])].map(
    (f) => [f, phraseRegex(f)] as const,
  ),
);
// ©, ® are Extended_Pictographic but are plain typography here.
const EMOJI_RE = /(?![©®])[\p{Extended_Pictographic}♥]/gu;

function mask(text: string): string {
  let out = text;
  for (const tok of ALLOWED_TOKENS) {
    const re = new RegExp(
      `${LEFT}${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${RIGHT}`,
      'gu',
    );
    out = out.replace(re, (m) => ' '.repeat(m.length));
  }
  return out;
}

export function scanText(text: string): { rule: Rule; match: string }[] {
  const hits: { rule: Rule; match: string }[] = [];
  const t = mask(text);
  for (const [, re] of WORD_RES)
    for (const m of t.matchAll(re))
      hits.push({ rule: 'banned-word', match: m[0] });
  for (const [, re] of PHRASE_RES)
    for (const m of t.matchAll(re))
      hits.push({ rule: 'banned-phrase', match: m[0] });
  if (text.includes('—')) hits.push({ rule: 'em-dash', match: '—' });
  if (text.includes('!')) hits.push({ rule: 'exclamation', match: '!' });
  for (const m of text.matchAll(EMOJI_RE))
    hits.push({ rule: 'emoji', match: m[0] });
  return hits;
}

/** Tokens of a heading that carry an uppercase letter and are not allowlisted proper nouns. */
export function headingCaseViolations(text: string): string[] {
  const allowed = new Set<string>(HEADING_PROPER_NOUNS);
  return text
    .split(/[^\p{L}\p{N}]+/u)
    .filter((tok) => /\p{Lu}/u.test(tok) && !allowed.has(tok));
}

export function gate(entries: Entry[]): Hit[] {
  const hits: Hit[] = [];
  for (const e of entries) {
    for (const h of scanText(e.text)) hits.push({ path: e.path, ...h });
    if (e.heading)
      for (const tok of headingCaseViolations(e.text))
        hits.push({ path: e.path, rule: 'title-case', match: tok });
  }
  return hits;
}

// ---------------------------------------------------------------- content walk

const SKIP_KEYS = new Set([
  'id',
  'model',
  'target',
  'selected',
  'href',
  'allHref',
  'sourceHref',
  'marker',
]);
const URL_RE = /^(https?:\/\/|mailto:)/;

/** Paths that are headings (lowercase rule): any `heading`/`headings` key, work `title`, h1 name. */
function isHeadingPath(file: string, keys: string[]): boolean {
  if (keys.includes('heading') || keys.includes('headings')) return true;
  if (file === 'work.ts' && keys[keys.length - 1] === 'title') return true;
  return file === 'copy.ts' && keys.join('.') === 'titleBlock.name';
}

export function walkStrings(
  file: string,
  value: unknown,
  keys: string[] = [],
  out: Entry[] = [],
): Entry[] {
  const path = () =>
    `${file}:${keys.join('.').replace(/\.\[/g, '[')}`.replace(/:\./, ':');
  if (typeof value === 'string') {
    if (!URL_RE.test(value))
      out.push({
        path: path(),
        text: value,
        heading: isHeadingPath(file, keys),
      });
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => {
      const id =
        v &&
        typeof v === 'object' &&
        typeof (v as { id?: unknown }).id === 'string'
          ? (v as { id: string }).id
          : undefined;
      walkStrings(file, v, [...keys, id ?? `[${i}]`], out);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value))
      if (!SKIP_KEYS.has(k)) walkStrings(file, v, [...keys, k], out);
  }
  return out;
}

/** Objects: only `label` is displayed. */
function objectEntries(): Entry[] {
  const out: Entry[] = [];
  for (const o of objects) {
    out.push({ path: `objects.ts:${o.id}.label`, text: o.label });
  }
  return out;
}

export function contentEntries(): Entry[] {
  return [
    ...walkStrings('copy.ts', copy),
    ...walkStrings('client-copy.ts', soundLabel),
    ...walkStrings('client-copy.ts', deskNote),
    ...walkStrings('work.ts', work),
    ...walkStrings('oss.ts', oss),
    ...walkStrings('writing.ts', writing),
    ...walkStrings('cv.ts', cv),
    ...objectEntries(),
    // JSON-LD Person, as rendered in the head (URLs are skipped by walkStrings).
    ...walkStrings('jsonld', buildPerson()),
    // All objects, so the not-yet-confirmed cruiser phrase is gated before it is confirmed.
    { path: 'poster-alt.ts:buildPosterAlt', text: buildPosterAlt(objects) },
  ];
}

// ---------------------------------------------------------------- .astro scan

const ASTRO_ATTRS = [
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'alt',
  'title',
  'placeholder',
  'content',
];

function blank(s: string): string {
  return s.replace(/[^\n]/g, ' ');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&mdash;/gi, '—')
    .replace(/&excl;/gi, '!')
    .replace(/&hearts;/gi, '♥')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/gi, '&');
}

export class ScanError extends Error {}

const lineOf = (src: string, i: number) => src.slice(0, i).split('\n').length;

/** Index just after the `}` that closes the `{` at `start`, honoring quotes and JS comments. */
function closeBrace(src: string, start: number, file: string): number {
  let depth = 0;
  let quote = '';
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) break;
      i = end + 1;
    } else if (c === '/' && src[i + 1] === '/' && src[i - 1] !== ':') {
      const end = src.indexOf('\n', i);
      if (end < 0) break;
      i = end;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  throw new ScanError(
    `${file}:${lineOf(src, start)}: unbalanced ${quote ? `${quote} quote` : 'brace'} inside {...}`,
  );
}

function literalsIn(expr: string): string[] {
  const out: string[] = [];
  // Comments may hold apostrophes; they are not displayed.
  const code = expr.replace(/\/\*[\s\S]*?\*\//g, blank);
  for (const m of code.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g))
    out.push(m[2] ?? '');
  return out;
}

export function astroStrings(source: string, file: string): Entry[] {
  let src = source;
  const out: Entry[] = [];
  // JSON-LD bodies: their quoted values are displayed to crawlers. Keep them before scripts are blanked.
  for (const m of source.matchAll(
    /<script\b(?=(?:[^>/]|\/(?!>))*\btype=["']application\/ld\+json["'])(?:[^>/]|\/(?!>))*>([\s\S]*?)<\/script>/gi,
  )) {
    const at = (m.index ?? 0) + m[0].indexOf(m[1] ?? '');
    for (const lit of literalsIn(m[1] ?? ''))
      if (!URL_RE.test(lit) && lit.trim())
        out.push({
          path: `${file}:${lineOf(source, at)}`,
          text: decodeEntities(lit),
        });
  }
  src = src.replace(/^---\r?\n[\s\S]*?\r?\n---/, blank);
  src = src.replace(/<!--[\s\S]*?-->/g, blank);
  // Self-closing first (`<script ... />`), or the lazy match below would run into the next script.
  src = src.replace(/<(script|style)\b(?:[^>/]|\/(?!>))*\/>/gi, blank);
  src = src.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, blank);
  const lineAt = (i: number) => src.slice(0, i).split('\n').length;
  const push = (i: number, text: string) => {
    const t = decodeEntities(text).trim();
    if (t) out.push({ path: `${file}:${lineAt(i)}`, text: t });
  };
  const attrRe = new RegExp(
    `(?:^|\\s)(${ASTRO_ATTRS.join('|')})\\s*=\\s*("([^"]*)"|'([^']*)'|\\{)`,
    'g',
  );
  let i = 0;
  let textStart = 0;
  const flushText = (end: number) => {
    if (end > textStart) push(textStart, src.slice(textStart, end));
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '{') {
      flushText(i);
      const end = closeBrace(src, i, file);
      for (const lit of literalsIn(src.slice(i, end))) push(i, lit);
      i = textStart = end;
    } else if (c === '<' && src[i + 1] === '!') {
      // <!doctype ...> declaration (comments were blanked above).
      flushText(i);
      const end = src.indexOf('>', i);
      i = textStart = end < 0 ? src.length : end + 1;
    } else if (c === '<' && /[A-Za-z/]/.test(src[i + 1] ?? '')) {
      flushText(i);
      // Find end of tag, skipping quoted values and braces.
      let j = i + 1;
      while (j < src.length && src[j] !== '>') {
        if (src[j] === '"' || src[j] === "'") {
          const q = src[j] as string;
          const end = src.indexOf(q, j + 1);
          if (end < 0)
            throw new ScanError(
              `${file}:${lineAt(j)}: unbalanced ${q} quote inside a tag`,
            );
          j = end;
        } else if (src[j] === '{') j = closeBrace(src, j, file) - 1;
        j++;
      }
      const tag = src.slice(i, j);
      attrRe.lastIndex = 0;
      for (let m = attrRe.exec(tag); m; m = attrRe.exec(tag)) {
        if (m[2] === '{') {
          const start = tag.indexOf('{', m.index + m[0].length - 1);
          const end = closeBrace(tag, start, `${file}:${lineAt(i)}`);
          for (const lit of literalsIn(tag.slice(start, end))) push(i, lit);
          attrRe.lastIndex = end;
        } else push(i, m[3] ?? m[4] ?? '');
      }
      i = textStart = j + 1;
    } else i++;
  }
  flushText(src.length);
  return out;
}

function walkAstro(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkAstro(p, out);
    else if (e.name.endsWith('.astro')) out.push(p);
  }
  return out;
}

export function astroEntries(root = resolve('src')): Entry[] {
  const cwd = process.cwd();
  return walkAstro(root).flatMap((f) =>
    astroStrings(readFileSync(f, 'utf8'), relative(cwd, f)),
  );
}

export function runGate(): Hit[] {
  return gate([...contentEntries(), ...astroEntries()]);
}

/**
 * `src/content/<file>:<line>` for a content entry path such as `copy.ts:titleBlock.name`:
 * the line holding the string (whole text, else its first 30 characters, else the match).
 * Falls back to the entry path when the string is built at runtime (poster alt, JSON-LD).
 */
export function locate(
  hit: Hit,
  text: string,
  srcDir = resolve('src/content'),
): string {
  const [file] = hit.path.split(':');
  if (!file || /:\d+$/.test(hit.path)) return hit.path;
  let source: string;
  try {
    source = readFileSync(join(srcDir, file), 'utf8');
  } catch {
    return hit.path;
  }
  const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const needles = [text, esc(text), text.slice(0, 30), esc(text.slice(0, 30))];
  for (const n of needles) {
    const at = n ? source.indexOf(n) : -1;
    if (at >= 0) {
      const line = source.slice(0, at).split('\n').length;
      // A long string may wrap: point at the line holding the match when it is nearby.
      return `src/content/${file}:${line} (${hit.path})`;
    }
  }
  return hit.path;
}

export function formatHits(entries: Entry[], hits: Hit[]): string[] {
  const text = new Map(entries.map((e) => [e.path, e.text]));
  return hits.map(
    (h) => `${locate(h, text.get(h.path) ?? '')}: ${h.rule}: ${h.match}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const entries = [...contentEntries(), ...astroEntries()];
    const hits = gate(entries);
    if (hits.length) {
      console.error('copy-gate FAILED:');
      for (const line of formatHits(entries, hits)) console.error(line);
      process.exit(1);
    }
    console.log('copy-gate ok');
  } catch (e) {
    if (e instanceof ScanError) {
      console.error(`copy-gate FAILED: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}
