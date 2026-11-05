/**
 * Dist-HTML copy gate (A-06). `pnpm check:dist-copy`.
 *
 * Parses every `dist/**\/*.html` with parse5 and runs copy-gate's `scanText` over everything a
 * visitor, a screen reader or a crawler can read:
 *  - text nodes outside <script> and <style> (including loop-rendered text the .astro scanner
 *    cannot see), and <title>;
 *  - attributes `alt`, `title`, `placeholder` and every `aria-*`;
 *  - <meta content> for name/property `description`, `og:*`, `twitter:*`;
 *  - string values of <script type="application/ld+json"> (URLs skipped).
 * Output `file: context: rule: match`, exit 1 on any hit. Heading case is not checked here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { scanText } from './copy-gate';

export interface Finding {
  file: string;
  context: string;
  rule: string;
  match: string;
}

interface Node {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  content?: Node;
}

export interface Piece {
  context: string;
  text: string;
}

const META_NAME = /^(description|og:.+|twitter:.+)$/i;
const URL_RE = /^(https?:\/\/|mailto:)/;

function jsonStrings(value: unknown, path: string, out: Piece[]) {
  if (typeof value === 'string') {
    if (!URL_RE.test(value))
      out.push({ context: `jsonld ${path}`, text: value });
  } else if (Array.isArray(value))
    value.forEach((v, i) => jsonStrings(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value))
      jsonStrings(v, `${path}.${k}`, out);
}

/** Every readable string in one HTML document, with a context label. */
export function htmlPieces(html: string): Piece[] {
  const out: Piece[] = [];
  // scriptingEnabled false: <noscript> content is parsed into elements, so its text is seen.
  const doc = parse(html, { scriptingEnabled: false }) as unknown as Node;
  const walk = (n: Node, parent: string) => {
    const tag = n.tagName;
    if (n.nodeName === '#text') {
      const text = (n.value ?? '').trim();
      if (text && parent !== 'script' && parent !== 'style')
        out.push({
          context: parent === 'title' ? 'title' : `text <${parent}>`,
          text,
        });
      return;
    }
    if (!tag) {
      for (const c of n.childNodes ?? []) walk(c, parent);
      return;
    }
    const attrs = new Map((n.attrs ?? []).map((a) => [a.name, a.value]));
    for (const [name, value] of attrs)
      if (
        name === 'alt' ||
        name === 'title' ||
        name === 'placeholder' ||
        name.startsWith('aria-')
      )
        out.push({ context: `attr ${name} <${tag}>`, text: value });
    if (tag === 'meta') {
      const key = attrs.get('name') ?? attrs.get('property') ?? '';
      if (META_NAME.test(key))
        out.push({ context: `meta ${key}`, text: attrs.get('content') ?? '' });
    }
    if (tag === 'script' && attrs.get('type') === 'application/ld+json') {
      const body = (n.childNodes ?? []).map((c) => c.value ?? '').join('');
      try {
        jsonStrings(JSON.parse(body), '$', out);
      } catch {
        out.push({ context: 'jsonld', text: body });
      }
      return;
    }
    if (tag === 'script' || tag === 'style') return;
    const kids =
      tag === 'template' && n.content ? [n.content] : (n.childNodes ?? []);
    for (const c of kids) walk(c, tag);
  };
  walk(doc, '#document');
  return out.filter((p) => p.text.trim() !== '');
}

export function scanHtml(file: string, html: string): Finding[] {
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const p of htmlPieces(html))
    for (const h of scanText(p.text)) {
      const key = `${p.context}|${h.rule}|${h.match}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ file, context: p.context, rule: h.rule, match: h.match });
    }
  return findings;
}

function walkHtml(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

export function checkDistCopy(dist: string): Finding[] {
  return walkHtml(dist).flatMap((f) =>
    scanHtml(relative(dist, f), readFileSync(f, 'utf8')),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = resolve(process.argv[2] ?? 'dist');
  const files = walkHtml(dist);
  if (files.length === 0) {
    console.error(
      'check:dist-copy FAILED: no HTML under dist/ (run pnpm build)',
    );
    process.exit(1);
  }
  const findings = checkDistCopy(dist);
  if (findings.length) {
    console.error('check:dist-copy FAILED:');
    for (const f of findings)
      console.error(`${f.file}: ${f.context}: ${f.rule}: ${f.match}`);
    process.exit(1);
  }
  console.log(`check:dist-copy ok (${files.length} pages)`);
}
