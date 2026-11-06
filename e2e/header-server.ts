import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildVercelConfig,
  collectHashes,
} from '../scripts/write-vercel-json.ts';

/**
 * Static server for dist/ that applies the same headers Vercel will (A-09). The header set is
 * built from the dist it serves, with the same functions the postbuild uses, so a missing
 * hash can never hide behind a stale vercel.json. Used by e2e specs tagged @A-09 on port 4391.
 */
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const rules = buildVercelConfig(collectHashes(dist)).headers.map((r) => ({
  re: new RegExp(`^${r.source.replace('(.*)', '.*')}$`),
  headers: r.headers,
}));
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveFile(pathname: string): string | null {
  const clean = normalize(decodeURIComponent(pathname)).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  for (const c of [clean, join(clean, 'index.html')]) {
    const p = join(dist, c);
    if (p.startsWith(dist) && existsSync(p) && statSync(p).isFile()) return p;
  }
  return null;
}

const port = Number(process.env['E2E_HEADER_PORT'] ?? '4391');

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://x');
  const file = resolveFile(pathname);
  const status = file ? 200 : 404;
  const target = file ?? join(dist, '404.html');
  for (const r of rules)
    if (r.re.test(pathname))
      for (const h of r.headers) res.setHeader(h.key, h.value);
  res.writeHead(status, {
    'Content-Type': types[extname(target)] ?? 'application/octet-stream',
  });
  createReadStream(target).pipe(res);
}).listen(port, () => console.log(`header server on http://localhost:${port}`));
