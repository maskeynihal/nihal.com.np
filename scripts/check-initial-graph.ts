import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { init, parse } from 'es-module-lexer';

const FORBIDDEN_NAME = /desk-vendor|physics/;
const FORBIDDEN_CONTENT = /REVISION|rapier/;

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

function htmlEntries(html: string): string[] {
  const out: string[] = [];
  const scriptRe = /<script\b[^>]*>/gi;
  for (const m of html.matchAll(scriptRe)) {
    const tag = m[0];
    if (/type=["']module["']/i.test(tag)) {
      const src = /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1];
      if (src) out.push(src);
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (/rel=["']modulepreload["']/i.test(tag)) {
      const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1];
      if (href) out.push(href);
    }
  }
  for (const m of html.matchAll(
    /\b(?:component-url|renderer-url)=["']([^"']+)["']/gi,
  )) {
    if (m[1]) out.push(m[1]);
  }
  return out;
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
    for (const spec of htmlEntries(html)) {
      const file = resolveUrl(dist, htmlFile, spec, true);
      if (file) queue.push({ file, chain: [rel(htmlFile), rel(file)] });
    }
    while (queue.length > 0) {
      const { file, chain } = queue.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (!existsSync(file)) continue;
      const code = readFileSync(file, 'utf8');
      if (FORBIDDEN_NAME.test(file) || FORBIDDEN_CONTENT.test(code)) {
        failures.push(`forbidden code in initial graph: ${chain.join(' -> ')}`);
        continue;
      }
      if (!/\.m?js$/.test(file)) continue;
      const [imports] = parse(code);
      for (const imp of imports) {
        if (imp.type !== 'static' && imp.type !== 'reexport-star') continue; // dynamic imports and import.meta are not followed
        if (!imp.specifier) continue;
        const next = resolveUrl(dist, file, imp.specifier, false);
        if (next) queue.push({ file: next, chain: [...chain, rel(next)] });
      }
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
