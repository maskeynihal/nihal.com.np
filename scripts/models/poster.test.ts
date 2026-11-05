// @vitest-environment node
import { readFileSync } from 'node:fs';
import { optimize } from 'svgo';
import { describe, expect, it } from 'vitest';
import { posterViewBox } from '../../src/assets/camera';
import { buildPoster } from './poster';

const poster = buildPoster();

describe('poster', () => {
  it('is deterministic and matches the committed file', () => {
    expect(buildPoster()).toBe(poster);
    expect(readFileSync('src/assets/poster.svg', 'utf8')).toBe(poster);
  });
  it('fits the 16 KB budget', () => {
    expect(Buffer.byteLength(poster)).toBeLessThanOrEqual(16 * 1024);
  });
  it('is valid SVG with the shared viewBox and no bad numbers', () => {
    // svgo parses strictly: invalid XML throws
    expect(() => optimize(poster)).not.toThrow();
    expect(poster).toMatch(
      new RegExp(
        `^<svg [^>]*viewBox="0 0 ${posterViewBox.width} ${posterViewBox.height}"`,
      ),
    );
    expect(poster).not.toMatch(/NaN|Infinity|undefined/);
    expect(poster).toContain('stroke-width="1.5"');
    expect(poster).toContain('stroke-opacity=".55"'); // secondary, 1 px by default
  });
  it('draws more with unconfirmed objects shown', () => {
    expect(buildPoster({ includeUnconfirmed: true }).length).toBeGreaterThan(
      poster.length,
    );
  });
});
