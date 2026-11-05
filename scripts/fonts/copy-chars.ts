/**
 * Glyph set derived from the site copy, so a character used in copy cannot
 * be missing from the shipped fonts (A-02 r1: U+2192 was).
 *
 * Corpus: docs/specs/02-copy.md, src/content/**, and string content in
 * src/**\/*.astro|tsx|ts (test files excluded). Every non-ASCII character
 * found there is added to the Latin base range used by build-fonts.ts.
 *
 * Deliberately NOT subset: Devanagari (U+0900-U+097F) and CJK. They are left
 * to system fallback fonts; the BS calendar Devanagari text renders with the
 * system font.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Always included, even if the corpus does not (yet) use them. */
export const REQUIRED_CODE_POINTS: readonly number[] = [
  0x2192, // →
  0x2190, // ←
  0x00b7, // ·
  0x00d7, // ×
  0x00f8, // ø
  0x2033, // ″
  0x2018,
  0x2019,
  0x201a,
  0x201c,
  0x201d, // quotes U+2018-U+201D
  0x2026, // …
  0x2014, // —
  0x2013, // –
  0x00a9, // ©
];

/**
 * Arrows exist only in JetBrains Mono (the Fraunces source lacks them), so
 * they are subset into the mono face only. Arrows in copy are set in mono
 * labels.
 */
export const MONO_ONLY_CODE_POINTS: readonly number[] = [0x2190, 0x2192];

/** Appear in the corpus but must never ship (02-copy.md bans the heart). */
const NEVER_SHIP = new Set<number>([0x2665]);

const isDevanagari = (c: number) => c >= 0x0900 && c <= 0x097f;
const isCjk = (c: number) =>
  (c >= 0x2e80 && c <= 0x2fdf) ||
  (c >= 0x3000 && c <= 0x30ff) ||
  (c >= 0x3400 && c <= 0x4dbf) ||
  (c >= 0x4e00 && c <= 0x9fff) ||
  (c >= 0xac00 && c <= 0xd7af) ||
  (c >= 0xf900 && c <= 0xfaff) ||
  (c >= 0xff00 && c <= 0xffef);
/** Emoji and other astral code points are never subset. */
const isAstral = (c: number) => c > 0xffff;

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
}

export function corpusFiles(repoRoot = root): string[] {
  const files: string[] = [];
  const copy = join(repoRoot, 'docs', 'specs', '02-copy.md');
  if (existsSync(copy)) files.push(copy);
  const src: string[] = [];
  walk(join(repoRoot, 'src'), src);
  for (const f of src) {
    if (/\.test\.[cm]?[jt]sx?$/.test(f)) continue;
    if (
      f.startsWith(join(repoRoot, 'src', 'content') + '/') ||
      /\.(astro|tsx|ts)$/.test(f)
    )
      files.push(f);
  }
  return files.sort();
}

export function copyCodePoints(repoRoot = root): number[] {
  const set = new Set<number>(REQUIRED_CODE_POINTS);
  for (const f of corpusFiles(repoRoot)) {
    for (const ch of readFileSync(f, 'utf8')) {
      const c = ch.codePointAt(0)!;
      if (c < 0x80) continue;
      set.add(c);
    }
  }
  return [...set]
    .filter(
      (c) =>
        !NEVER_SHIP.has(c) && !isDevanagari(c) && !isCjk(c) && !isAstral(c),
    )
    .sort((a, b) => a - b);
}

/** Copy code points that a given family should carry. */
export function copyCodePointsFor(
  family: 'fraunces' | 'jetbrainsMono',
  repoRoot = root,
): number[] {
  const all = copyCodePoints(repoRoot);
  return family === 'jetbrainsMono'
    ? all
    : all.filter((c) => !MONO_ONLY_CODE_POINTS.includes(c));
}
