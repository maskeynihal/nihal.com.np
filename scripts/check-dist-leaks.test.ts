// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLeaks, pendingStrings } from './check-dist-leaks';
import { PENDING_SENTINEL, pending } from '../src/content/pending';

function dist(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'leaks-'));
  for (const [name, body] of Object.entries(files)) {
    const p = join(d, name);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, body);
  }
  return d;
}

describe('check-dist-leaks', () => {
  it('passes a clean dist', () => {
    const d = dist({
      'index.html': '<h1>nihal maskey</h1>',
      '_astro/a.js': 'console.log("on","off")',
      '_astro/a.css': 'body{color:red}',
      'sitemap.xml': '<urlset/>',
      'robots.txt': 'User-agent: *',
      'data.json': '{"a":1}',
    });
    expect(checkLeaks(d)).toEqual([]);
  });

  it('flags markers, sentinel, pending strings, TODO and lorem', () => {
    const note = pending.copy[0];
    const d = dist({
      'index.html': '<p>[CONFIRM] x</p>',
      '_astro/a.js': `var a="[ASK] y";var b="${PENDING_SENTINEL}"`,
      '_astro/b.js': `var n=${JSON.stringify(note)}`,
      'x.css': '/* TODO */',
      'y.txt': 'Lorem ipsum',
    });
    const leaks = checkLeaks(d);
    const has = (file: string, match: string) =>
      leaks.some((l) => l.file === file && l.match === match);
    expect(has('index.html', '[CONFIRM')).toBe(true);
    expect(has('_astro/a.js', '[ASK')).toBe(true);
    expect(has(`_astro/a.js`, PENDING_SENTINEL)).toBe(true);
    expect(has('_astro/b.js', note)).toBe(true);
    expect(has('x.css', 'TODO')).toBe(true);
    expect(has('y.txt', 'lorem')).toBe(true);
  });

  it('flags a long pending string with no bracket marker', () => {
    const cand = pending.candidates.cruiserAltPhrase;
    const d = dist({ 'a.js': `x="${cand}"` });
    expect(checkLeaks(d).map((l) => l.match)).toContain(cand);
  });

  it('--allow-pending skips pending checks but still flags TODO', () => {
    const d = dist({
      'a.js': `"[CONFIRM] z" "${PENDING_SENTINEL}"`,
      'b.txt': 'TODO',
    });
    expect(checkLeaks(d, { allowPending: true })).toEqual([
      { file: 'b.txt', match: 'TODO' },
    ]);
  });

  it('collects only pending strings longer than 12 characters', () => {
    const all = pendingStrings();
    expect(all.length).toBeGreaterThan(5);
    expect(all.every((s) => s.length > 12)).toBe(true);
    expect(all).not.toContain(PENDING_SENTINEL.slice(0, 3));
  });
});
