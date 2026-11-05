// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkDistCopy, htmlPieces, scanHtml } from './check-dist-copy';

const page = (head: string, body: string) =>
  `<!doctype html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;

describe('htmlPieces', () => {
  it('collects text, attributes, meta, title and JSON-LD; skips scripts and styles', () => {
    const html = page(
      `<meta name="description" content="D"><meta property="og:title" content="O"><meta name="theme-color" content="#fff"><meta name="color-scheme" content="light"><script>var a = "SCRIPT"</script><style>.a{content:"STYLE"}</style><script type="application/ld+json">{"name":"N","url":"https://x.y","a":["L"]}</script>`,
      `<p>text</p><img alt="A" src="/a.png"><a aria-label="AL" title="T" href="/">x</a><input placeholder="P"><noscript><style>.n{}</style><p>NS</p></noscript>`,
    );
    const texts = htmlPieces(html).map((p) => p.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        't',
        'D',
        'O',
        'N',
        'L',
        'text',
        'A',
        'AL',
        'T',
        'x',
        'P',
        'NS',
      ]),
    );
    for (const skipped of [
      'SCRIPT',
      'STYLE',
      '#fff',
      'light',
      'https://x.y',
      '.n{}',
    ])
      expect(texts.join('|')).not.toContain(skipped);
  });
});

describe('scanHtml', () => {
  it('passes clean markup', () => {
    expect(scanHtml('i.html', page('', '<p>Hello there.</p>'))).toEqual([]);
  });
  it('catches a banned word in loop-rendered list text', () => {
    const items = ['fine', 'seamless flow', 'ok']
      .map((t) => `<li>${t}</li>`)
      .join('');
    expect(scanHtml('i.html', page('', `<ul>${items}</ul>`))).toEqual([
      {
        file: 'i.html',
        line: 1,
        context: 'text <li>',
        rule: 'banned-word',
        match: 'seamless',
      },
    ]);
  });
  it('catches a banned word in og:description', () => {
    const f = scanHtml(
      'i.html',
      page('<meta property="og:description" content="A robust thing">', ''),
    );
    expect(f).toEqual([
      {
        file: 'i.html',
        line: 1,
        context: 'meta og:description',
        rule: 'banned-word',
        match: 'robust',
      },
    ]);
  });
  it('catches an em dash in JSON-LD', () => {
    const f = scanHtml(
      'i.html',
      page(
        '<script type="application/ld+json">{"jobTitle":"Lead — Engineer"}</script>',
        '',
      ),
    );
    expect(f).toEqual([
      {
        file: 'i.html',
        line: 1,
        context: 'jsonld $.jobTitle',
        rule: 'em-dash',
        match: '—',
      },
    ]);
  });
  it('catches attributes and inflections, and de-duplicates', () => {
    const f = scanHtml(
      'i.html',
      page('', '<p>leveraged</p><p>leveraged</p><img alt="Wow!">'),
    );
    expect(f.map((x) => `${x.context}:${x.rule}:${x.match}`)).toEqual([
      'text <p>:banned-word:leveraged',
      'attr alt <img>:exclamation:!',
    ]);
  });
});

describe('checkDistCopy and cli', () => {
  const dist = (files: Record<string, string>) => {
    const d = mkdtempSync(join(tmpdir(), 'dc-'));
    for (const [n, b] of Object.entries(files)) {
      mkdirSync(join(d, n, '..'), { recursive: true });
      writeFileSync(join(d, n), b);
    }
    return d;
  };
  it('walks nested html and ignores other files', () => {
    const d = dist({
      'index.html': page('', '<p>ok</p>'),
      'sent/index.html': page('', '<p>harnessing</p>'),
      '_astro/a.js': 'seamless',
    });
    expect(checkDistCopy(d).map((f) => f.file)).toEqual([
      join('sent', 'index.html'),
    ]);
  });
  it('real build output is clean when dist exists', () => {
    const r = spawnSync('pnpm', ['exec', 'tsx', 'scripts/check-dist-copy.ts'], {
      encoding: 'utf8',
    });
    if (r.stderr.includes('no HTML under dist')) return;
    expect(r.status, r.stderr).toBe(0);
  });
  it('exits 1 naming file, context, rule and match', () => {
    const d = dist({ 'index.html': page('', '<ul><li>seamless</li></ul>') });
    const r = spawnSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/check-dist-copy.ts', d],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      'index.html:1: text <li>: banned-word: seamless',
    );
  });
  it('reports the HTML source line of text, attributes and meta', () => {
    const html = [
      '<!doctype html>',
      '<html><head><title>t</title>',
      '<meta name="description" content="A robust thing">',
      '</head><body>',
      '<p>fine</p>',
      '<ul>',
      '<li>ok</li>',
      '<li>seamless</li>',
      '</ul>',
      '<img',
      '  src="/a.png"',
      '  alt="leveraged">',
      '</body></html>',
    ].join('\n');
    expect(
      scanHtml('i.html', html).map((f) => `${f.line}:${f.context}:${f.match}`),
    ).toEqual([
      '3:meta description:robust',
      '8:text <li>:seamless',
      '12:attr alt <img>:leveraged',
    ]);
  });
});
