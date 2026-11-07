// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkLeaks,
  isBinary,
  pendingStrings,
  unconfirmedStrings,
} from './check-dist-leaks';
import { objects } from '../src/content/objects';
import { work } from '../src/content/work';
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
  it('reports each file and match once, whatever the number of forms and sources', () => {
    const v = 'A pending sentence here';
    const d = dist({
      'index.html': `<p>${v}</p><script>var a="${v}"</script> TODO TODO`,
    });
    const leaks = checkLeaks(d, {
      pendingValues: [v, v],
      unconfirmedValues: [v],
    });
    expect(leaks).toEqual([
      { file: 'index.html', match: 'TODO' },
      { file: 'index.html', match: v },
    ]);
  });

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

  it('scans extensionless and unusual-extension text files', () => {
    const d = dist({ LICENSE: 'TODO fix', 'a.cjs': 'x = "lorem"' });
    expect(checkLeaks(d).map((l) => l.file)).toEqual(['LICENSE', 'a.cjs']);
  });

  it('skips binary files (NUL in the first 8 KB) and sniffs content, not name', () => {
    const d = mkdtempSync(join(tmpdir(), 'leaks-'));
    writeFileSync(
      join(d, 'font.woff2'),
      Buffer.from([0, 1, 2, 84, 79, 68, 79]),
    );
    writeFileSync(join(d, 'noext'), Buffer.from('TODO'));
    expect(isBinary(Buffer.from([65, 0, 66]))).toBe(true);
    expect(isBinary(Buffer.from('abc'))).toBe(false);
    expect(checkLeaks(d).map((l) => l.file)).toEqual(['noext']);
  });

  describe('unconfirmed rows', () => {
    const unconfirmedObject = objects.find((o) => !o.confirmed)!;
    const trayt = work.find((w) => !w.confirmed)!;

    it('collects unconfirmed work text and every unconfirmed label', () => {
      const all = unconfirmedStrings();
      expect(all).toContain(trayt.title);
      expect(all).toContain(trayt.body[0]);
      expect(all).toContain(unconfirmedObject.label);
      for (const o of objects.filter((o) => o.confirmed))
        expect(all).not.toContain(o.label);
      expect(all.some((s) => s.startsWith('http'))).toBe(false);
    });

    it('flags an unconfirmed object label in a .js file and an extensionless file', () => {
      const label = unconfirmedObject.label;
      const d = dist({
        '_astro/chunk.js': `var l=${JSON.stringify(label)}`,
        'meta/asset': `<li>${label}</li>`,
      });
      const leaks = checkLeaks(d);
      expect(leaks).toEqual(
        expect.arrayContaining([
          { file: '_astro/chunk.js', match: label },
          { file: 'meta/asset', match: label },
        ]),
      );
    });

    it('flags an HTML-escaped unconfirmed work body', () => {
      const d = dist({
        'index.html': `<p>${(trayt.body[1] ?? '').replace(/'/g, '&#39;')}</p>`,
      });
      expect(checkLeaks(d).map((l) => l.match)).toContain(trayt.body[1]);
    });

    it('--allow-pending skips them', () => {
      const d = dist({ 'a.js': unconfirmedObject.label + trayt.title });
      expect(checkLeaks(d, { allowPending: true })).toEqual([]);
    });

    it('does not flag confirmed labels', () => {
      const d = dist({ 'index.html': '<a>arduino water monitor</a>' });
      expect(checkLeaks(d)).toEqual([]);
    });
  });
});
