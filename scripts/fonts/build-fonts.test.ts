import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUDGET_BYTES,
  UNICODE_RANGE,
  codepointsOf,
  fallbackFace,
} from './build-fonts';
import manifest from '../../src/styles/fonts.manifest.json';

const root = join(import.meta.dirname, '..', '..');

describe('fonts manifest', () => {
  it('has the expected shape', () => {
    for (const key of ['fraunces', 'jetbrainsMono'] as const) {
      const f = manifest[key];
      expect(f.file).toMatch(/^[a-z-]+-[0-9a-f]{8}\.woff2$/);
      expect(f.url).toBe(`/fonts/${f.file}`);
      expect(f.bytes).toBeGreaterThan(1000);
      expect(statSync(join(root, 'public/fonts', f.file)).size).toBe(f.bytes);
    }
    expect(manifest.fraunces.family).toBe('Fraunces');
    expect(manifest.jetbrainsMono.family).toBe('JetBrains Mono');
  });

  it('stays within the font budget and has no stale files', () => {
    const total = manifest.fraunces.bytes + manifest.jetbrainsMono.bytes;
    expect(total).toBeLessThanOrEqual(BUDGET_BYTES);
    expect(readdirSync(join(root, 'public/fonts')).sort()).toEqual(
      [manifest.fraunces.file, manifest.jetbrainsMono.file].sort(),
    );
  });

  it('generated css references the manifest files and fallbacks, no Inter', () => {
    const css = readFileSync(
      join(root, 'src/styles/fonts.generated.css'),
      'utf8',
    );
    expect(css).toContain(manifest.fraunces.url);
    expect(css).toContain(manifest.jetbrainsMono.url);
    expect(css).toContain("font-family: 'Fraunces Fallback'");
    expect(css).toContain("font-family: 'JetBrains Mono Fallback'");
    expect(css.match(/font-display: swap/g)).toHaveLength(2);
    expect(css).toMatch(/size-adjust: [\d.]+%/);
    expect(css).not.toMatch(/inter/i);
  });
});

describe('helpers', () => {
  it('expands the unicode range', () => {
    const cps = codepointsOf(UNICODE_RANGE);
    expect(cps).toContain(0x41);
    expect(cps).toContain(0x20ac);
    expect(cps).not.toContain(0x0100);
  });

  it('computes fallback overrides', () => {
    const { css, sizeAdjust } = fallbackFace(
      'X',
      "local('Y')",
      {
        ascent: 1000,
        descent: -250,
        lineGap: 0,
        unitsPerEm: 1000,
        xWidthAvg: 500,
      },
      {
        ascent: 900,
        descent: -200,
        lineGap: 0,
        unitsPerEm: 1000,
        xWidthAvg: 500,
      },
    );
    expect(sizeAdjust).toBe(1);
    expect(css).toContain('ascent-override: 100.00%');
    expect(css).toContain('descent-override: 25.00%');
  });
});
