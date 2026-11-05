import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  buildVercelConfig,
  inlineScriptHashes,
} from './write-vercel-json';

const h = (s: string) =>
  `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('inlineScriptHashes', () => {
  it('hashes inline classic and module scripts byte for byte', () => {
    const html = `<head><script>var a = 1;</script><script type="module">import "x";</script></head>`;
    expect(inlineScriptHashes(html)).toEqual([
      h('var a = 1;'),
      h('import "x";'),
    ]);
  });
  it('skips external, data and empty scripts', () => {
    const html = `<script src="/a.js"></script><script type="application/ld+json">{"a":1}</script><script></script>`;
    expect(inlineScriptHashes(html)).toEqual([]);
  });
  it('keeps whitespace and newlines inside the script', () => {
    const body = '\n  var a = "</b>";\n';
    expect(inlineScriptHashes(`<script>${body}</script>`)).toEqual([h(body)]);
  });
});

describe('buildCsp', () => {
  const csp = buildCsp([h('x')]);
  it('includes the spec section 9 directives', () => {
    for (const d of [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      'https://va.vercel-scripts.com',
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://formspree.io",
      'frame-src https://maskeynihal.github.io',
      "form-action 'self' https://formspree.io",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ])
      expect(csp).toContain(d);
  });
  it('never allows unsafe-eval or inline scripts without a hash', () => {
    const script =
      csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
  });
});

describe('buildVercelConfig', () => {
  it('sets cache rules for hashed assets', () => {
    const rules = buildVercelConfig([]).headers;
    const find = (s: string) =>
      rules.find((r) => r.source === s)?.headers[0]?.value;
    expect(find('/_astro/(.*)')).toContain('immutable');
    expect(find('/fonts/(.*)')).toContain('max-age=31536000');
    expect(find('/sounds/(.*)')).toBe('public, max-age=604800');
  });
});
