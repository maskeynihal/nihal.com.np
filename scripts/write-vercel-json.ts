import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

/**
 * Postbuild (spec section 9): hash every inline script in dist/**\/*.html and write the
 * response headers (CSP included) to vercel.json. Runs from the Astro integration in
 * astro.config.ts after every build, and standalone: `tsx scripts/write-vercel-json.ts`.
 *
 * Origins for features that arrive in later tickets are already allowed so those tickets
 * need no CSP change: Formspree (B-06b), the arcade iframe on github.io (B-08), Vercel
 * analytics, blob workers and wasm for physics (E-05).
 */

export const ORIGINS = {
  analytics: 'https://va.vercel-scripts.com',
  formspree: 'https://formspree.io',
  arcade: 'https://maskeynihal.github.io',
} as const;

interface Node5 {
  nodeName: string;
  childNodes?: Node5[];
  content?: Node5;
  attrs?: { name: string; value: string }[];
  value?: string;
}

const JS_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
]);

function walk(node: Node5, visit: (n: Node5) => void): void {
  visit(node);
  for (const c of node.childNodes ?? []) walk(c, visit);
  if (node.content) walk(node.content, visit);
}

/** sha256 CSP sources for every executable inline script in one HTML document. */
export function inlineScriptHashes(html: string): string[] {
  const out: string[] = [];
  walk(parse(html) as unknown as Node5, (n) => {
    if (n.nodeName !== 'script') return;
    const attr = (name: string) => n.attrs?.find((a) => a.name === name)?.value;
    if (attr('src') !== undefined) return;
    if (!JS_TYPES.has((attr('type') ?? '').trim().toLowerCase())) return;
    const text = (n.childNodes ?? []).map((c) => c.value ?? '').join('');
    if (text === '') return;
    out.push(
      `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`,
    );
  });
  return out;
}

function htmlFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) htmlFiles(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export function collectHashes(distDir: string): string[] {
  const all = new Set<string>();
  for (const f of htmlFiles(distDir).sort())
    for (const h of inlineScriptHashes(readFileSync(f, 'utf8'))) all.add(h);
  return [...all].sort();
}

export function buildCsp(hashes: string[]): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')} ${ORIGINS.analytics}`.replace(
      / {2,}/g,
      ' ',
    ),
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${ORIGINS.formspree}`,
    `frame-src ${ORIGINS.arcade}`,
    `form-action 'self' ${ORIGINS.formspree}`,
    `worker-src 'self' blob:`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `frame-ancestors 'none'`,
  ].join('; ');
}

interface Rule {
  source: string;
  headers: { key: string; value: string }[];
}

/**
 * Build settings live here, not in the Vercel project: the project predates this rebuild and is
 * still set to Next.js, and its old production deployment is kept on v1.nihal.com.np.
 */
const BUILD = {
  framework: 'astro',
  installCommand: 'pnpm install --frozen-lockfile',
  buildCommand: 'pnpm build',
  outputDirectory: 'dist',
} as const;

export function buildVercelConfig(
  hashes: string[],
): typeof BUILD & { headers: Rule[] } {
  const immutable = 'public, max-age=31536000, immutable';
  return {
    ...BUILD,
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: buildCsp(hashes) },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/_astro/(.*)',
        headers: [{ key: 'Cache-Control', value: immutable }],
      },
      {
        source: '/fonts/(.*)',
        headers: [{ key: 'Cache-Control', value: immutable }],
      },
      {
        source: '/sounds/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ],
  };
}

/** Writes the config and returns the path written. `outFile` defaults to ./vercel.json. */
export function writeVercelJson(distDir: string, outFile: string): string {
  const config = buildVercelConfig(collectHashes(distDir));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(config, null, 2) + '\n');
  return outFile;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  console.log(
    `wrote ${writeVercelJson(join(root, 'dist'), join(root, 'vercel.json'))}`,
  );
}
