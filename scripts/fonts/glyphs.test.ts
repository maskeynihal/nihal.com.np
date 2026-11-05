import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { create } from 'fontkit';
import georgiaMetrics from '@capsizecss/metrics/georgia';
import { describe, expect, it } from 'vitest';
import { codepointsOf, menloMetrics } from './build-fonts';
import {
  copyCodePoints,
  copyCodePointsFor,
  REQUIRED_CODE_POINTS,
} from './copy-chars';
import manifest from '../../src/styles/fonts.manifest.json';

const root = join(import.meta.dirname, '..', '..');
const css = readFileSync(join(root, 'src/styles/fonts.generated.css'), 'utf8');

type Font = {
  hasGlyphForCodePoint(c: number): boolean;
  characterSet: number[];
  unitsPerEm: number;
  'OS/2': { xAvgCharWidth: number };
  glyphForCodePoint(c: number): { advanceWidth: number };
};
const load = (file: string) =>
  create(readFileSync(join(root, 'public/fonts', file))) as unknown as Font;

const faces = [
  ['fraunces', manifest.fraunces],
  ['jetbrainsMono', manifest.jetbrainsMono],
] as const;

describe('copy-driven glyph set', () => {
  it('always includes the required code points and skips Devanagari/CJK', () => {
    const cps = copyCodePoints();
    for (const c of REQUIRED_CODE_POINTS) expect(cps).toContain(c);
    expect(cps.some((c) => c >= 0x900 && c <= 0x97f)).toBe(false);
    expect(cps).toContain(0x2192);
    expect(cps).toEqual([...cps].sort((a, b) => a - b));
  });

  for (const [key, entry] of faces) {
    it(`${key}: every copy code point has a glyph`, () => {
      const font = load(entry.file);
      const missing = copyCodePointsFor(key).filter(
        (c) => !font.hasGlyphForCodePoint(c),
      );
      expect(missing.map((c) => 'U+' + c.toString(16))).toEqual([]);
    });

    it(`${key}: declared unicode-range matches the file`, () => {
      const font = load(entry.file);
      const re = new RegExp(
        `url\\('${entry.url}'\\)[^;]*;\\s*unicode-range: ([^;]+);`,
      );
      const declared = codepointsOf(re.exec(css)![1]!).sort((a, b) => a - b);
      const present = font.characterSet
        .filter((c) => c >= 0x20 && c !== 0xffff)
        .sort((a, b) => a - b);
      expect(declared).toEqual(present);
    });
  }
});

describe('fallback metrics', () => {
  const adjust = (name: string) =>
    parseFloat(
      new RegExp(`font-family: '${name}';[^}]*size-adjust: ([\\d.]+)%`).exec(
        css,
      )![1]!,
    ) / 100;

  it('Fraunces Fallback size-adjust is within 2% of letter-weighted widths', () => {
    // English letter frequencies (a-z) + space, the capsize-style weighting.
    // prettier-ignore
    const freq: Record<string, number> = {
      ' ': 18, e: 10.2, t: 7.5, a: 6.5, o: 6.2, i: 5.7, n: 5.7, s: 5.3,
      h: 5.0, r: 4.9, d: 3.5, l: 3.3, c: 2.2, u: 2.3, m: 2.0, w: 1.9,
      f: 1.9, g: 1.7, y: 1.6, p: 1.5, b: 1.3, v: 0.8, k: 0.6, j: 0.1,
      x: 0.1, q: 0.1, z: 0.1,
    };
    const f = load(manifest.fraunces.file);
    let sum = 0;
    let w = 0;
    for (const [ch, n] of Object.entries(freq)) {
      sum += f.glyphForCodePoint(ch.codePointAt(0)!).advanceWidth * n;
      w += n;
    }
    const primary = sum / w / f.unitsPerEm;
    const fallback = georgiaMetrics.xWidthAvg / georgiaMetrics.unitsPerEm;
    const expected = primary / fallback;
    expect(Math.abs(adjust('Fraunces Fallback') / expected - 1)).toBeLessThan(
      0.02,
    );
  });

  it('JetBrains Mono Fallback size-adjust is within 2% of the font advance', () => {
    const f = load(manifest.jetbrainsMono.file);
    const primary = f.glyphForCodePoint(0x78).advanceWidth / f.unitsPerEm;
    const fallback = menloMetrics.xWidthAvg / menloMetrics.unitsPerEm;
    const expected = primary / fallback;
    expect(
      Math.abs(adjust('JetBrains Mono Fallback') / expected - 1),
    ).toBeLessThan(0.02);
    const os2 = f['OS/2'].xAvgCharWidth / f.unitsPerEm;
    expect(Math.abs(os2 / primary - 1)).toBeLessThan(0.02);
  });
});
