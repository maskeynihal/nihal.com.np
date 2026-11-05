import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';

// Scene is the lazy 3D chunk (A-10): reaching it statically defeats the island split.
const FORBIDDEN_NAME = /desk-vendor|physics|(?:^|\/)Scene[.-]/;
// `REVISION` can be mangled out of a minified three; `__THREE__` (the window.__THREE__ duplicate check) survives.
const FORBIDDEN_CONTENT = /REVISION|__THREE__|rapier/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Resolve a URL found in HTML/JS to a file under dist. */
function resolveUrl(
  dist: string,
  fromFile: string,
  spec: string,
  isHtml: boolean,
): string | null {
  if (/^(https?:)?\/\//.test(spec) || spec.startsWith('data:')) return null;
  const clean = spec.split(/[?#]/)[0] ?? spec;
  if (clean.startsWith('/')) return join(dist, clean);
  if (clean.startsWith('.')) return resolve(dirname(fromFile), clean);
  return isHtml ? resolve(dirname(fromFile), clean) : null; // bare specifier in JS
}

function htmlEntries(html: string): { urls: string[]; inline: string[] } {
  const out: string[] = [];
  const inline: string[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? '';
    if (!/type=["']module["']/i.test(attrs)) continue;
    const src = /\bsrc=["']([^"']+)["']/i.exec(attrs)?.[1];
    if (src) out.push(src);
    else if (m[2]) inline.push(m[2]);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (/rel=["']modulepreload["']/i.test(tag)) {
      const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
      if (href) out.push(href);
    }
  }
  for (const m of html.matchAll(
    /\b(?:component-url|renderer-url|before-hydration-url)=["']([^"']+)["']/gi,
  )) {
    if (m[1]) out.push(m[1]);
  }
  return { urls: out, inline };
}

export async function checkGraph(
  dist: string,
  opts: { expectNoHooks: boolean },
): Promise<string[]> {
  await init();
  const failures: string[] = [];
  const rel = (f: string) => relative(dist, f);

  const htmlFiles = walk(dist).filter((f) => f.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const html = readFileSync(htmlFile, 'utf8');
    const queue: { file: string; chain: string[] }[] = [];
    const seen = new Set<string>();
    const entries = htmlEntries(html);
    const enqueueImports = (code: string, from: string, chain: string[]) => {
      const [imports] = parse(code);
      for (const imp of imports) {
        if (imp.type !== 'static' && imp.type !== 'reexport-star') continue; // dynamic imports and import.meta are not followed
        if (!imp.specifier) continue;
        const next = resolveUrl(dist, from, imp.specifier, false);
        if (next) queue.push({ file: next, chain: [...chain, rel(next)] });
      }
    };
    for (const spec of entries.urls) {
      const file = resolveUrl(dist, htmlFile, spec, true);
      if (file) queue.push({ file, chain: [rel(htmlFile), rel(file)] });
    }
    entries.inline.forEach((body, i) => {
      const label = `${rel(htmlFile)}#inline-module-${i + 1}`;
      if (FORBIDDEN_CONTENT.test(body)) {
        failures.push(`forbidden code in initial graph: ${label}`);
        return;
      }
      enqueueImports(body, htmlFile, [label]);
    });
    while (queue.length > 0) {
      const { file, chain } = queue.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (!existsSync(file)) {
        failures.push(`missing file in initial graph: ${chain.join(' -> ')}`);
        continue;
      }
      const code = readFileSync(file, 'utf8');
      if (FORBIDDEN_NAME.test(rel(file)) || FORBIDDEN_CONTENT.test(code)) {
        failures.push(`forbidden code in initial graph: ${chain.join(' -> ')}`);
        continue;
      }
      if (!/\.m?js$/.test(file)) continue;
      enqueueImports(code, file, chain);
    }
  }

  if (opts.expectNoHooks) {
    for (const f of walk(dist)) {
      if (
        /\.(html|m?js|css|json|map)$/.test(f) &&
        readFileSync(f, 'utf8').includes('__hooks')
      ) {
        failures.push(`__hooks found in non-e2e build: ${rel(f)}`);
      }
    }
  }
  return failures;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const allowHooks = args.includes('--allow-hooks');
  const dist = resolve(args.find((a) => !a.startsWith('--')) ?? 'dist');
  if (!existsSync(dist)) {
    console.error(
      `check-initial-graph: ${dist} not found; run pnpm build first`,
    );
    return 1;
  }
  const failures = await checkGraph(dist, { expectNoHooks: !allowHooks });
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL ${f}`);
    return 1;
  }
  console.log('check-initial-graph: ok');
  return 0;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  process.exit(await main());
}
