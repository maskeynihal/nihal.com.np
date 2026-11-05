import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const allowlist = readFileSync(
  new URL('./console-allowlist.txt', import.meta.url),
  'utf8',
)
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l !== '' && !l.startsWith('#'))
  .map((l) => new RegExp(l));

const allowed = (text: string) => allowlist.some((re) => re.test(text));

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('console', (msg) => {
        const type = msg.type();
        if ((type === 'error' || type === 'warning') && !allowed(msg.text())) {
          problems.push(`console.${type}: ${msg.text()}`);
        }
      });
      page.on('pageerror', (err) => {
        if (!allowed(err.message)) problems.push(`pageerror: ${err.message}`);
      });
      await use();
      expect(problems, 'unexpected console output').toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * Accessibility helper (A-13). EVERY new spec must call `expectNoAxeViolations` on each page
 * state it adds (open panels, error states, focused states) so a11y is checked per ticket.
 *
 * WCAG tags fail the test. `best-practice` findings never fail; they are attached as test
 * annotations (type `axe-best-practice`). Documented exceptions live in `axe-allowlist.json`
 * as `{ id, selector, reason, expires: 'YYYY-MM-DD' }`, where `selector` must EXACTLY equal one
 * node target string axe reports (for example `#main > img:nth-child(2)`; no substrings or globs); an expired entry fails the test.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface AllowEntry {
  id: string;
  selector: string;
  reason: string;
  expires: string;
}

function loadAxeAllowlist(): AllowEntry[] {
  const raw: unknown = JSON.parse(
    readFileSync(new URL('./axe-allowlist.json', import.meta.url), 'utf8'),
  );
  if (!Array.isArray(raw))
    throw new Error('axe-allowlist.json must be an array');
  return raw.map((e: Partial<AllowEntry>, i) => {
    for (const k of ['id', 'selector', 'reason', 'expires'] as const)
      if (typeof e[k] !== 'string' || e[k] === '')
        throw new Error(`axe-allowlist.json[${i}] needs a non-empty "${k}"`);
    return e as AllowEntry;
  });
}

/** Exact match: the entry selector must equal one reported target string. */
export function isAllowlisted(
  entries: Pick<AllowEntry, 'id' | 'selector'>[],
  id: string,
  targets: string[],
): boolean {
  return entries.some((e) => e.id === id && targets.includes(e.selector));
}

interface AxeOptions {
  include?: string[];
  exclude?: string[];
  /** Names the page state in failure output, e.g. "/ after Tab to skip link". */
  label: string;
}

export async function expectNoAxeViolations(
  page: Page,
  { include = [], exclude = [], label }: AxeOptions,
): Promise<void> {
  const scanPage = (target: Page, tags: string[]) => {
    let b = new AxeBuilder({ page: target }).withTags(tags);
    for (const i of include) b = b.include(i);
    for (const x of exclude) b = b.exclude(x);
    return b.analyze();
  };
  // axe is injected through page.evaluate, which hangs while script execution is disabled
  // (the no-js project). There the page's serialized DOM is scanned in a sibling JS-enabled
  // context with its <script> elements removed and its <noscript> blocks unwrapped, which
  // reproduces what a no-script visitor gets (injected nodes included). Focus is not carried.
  const noJs = test.info().project.use.javaScriptEnabled === false;
  let wcag, best;
  if (noJs) {
    const browser = page.context().browser();
    if (!browser) throw new Error('no browser handle for the no-js axe scan');
    const ctx = await browser.newContext({
      viewport: page.viewportSize(),
      javaScriptEnabled: true,
    });
    try {
      await ctx.route('**/*', (route) =>
        route.request().resourceType() === 'script'
          ? route.abort()
          : route.continue(),
      );
      const p2 = await ctx.newPage();
      // The serialized DOM keeps any state the test built (injected nodes included).
      const base = `<base href="${page.url()}">`;
      const headOpen = /<head\b[^>]*>/i;
      const source = await page.content();
      if (!headOpen.test(source))
        throw new Error('no-js axe scan: no <head> tag to inject <base> into');
      const html = source
        .replace(
          /<script\b(?![^>]*application\/ld\+json)[^>]*>[\s\S]*?<\/script>/gi,
          '',
        )
        .replace(headOpen, (m) => m + base);
      await p2.setContent(html, { waitUntil: 'load' });
      await p2.evaluate(() => {
        for (const n of document.querySelectorAll('noscript'))
          n.outerHTML = n.textContent ?? '';
      });
      [wcag, best] = [
        await scanPage(p2, WCAG_TAGS),
        await scanPage(p2, ['best-practice']),
      ];
    } finally {
      await ctx.close();
    }
  } else {
    [wcag, best] = [
      await scanPage(page, WCAG_TAGS),
      await scanPage(page, ['best-practice']),
    ];
  }

  const today = new Date().toISOString().slice(0, 10);
  const entries = loadAxeAllowlist();
  const expired = entries.filter((e) => e.expires < today);
  const live = entries.filter((e) => e.expires >= today);
  const allowed = (id: string, targets: string[]) =>
    isAllowlisted(live, id, targets);

  const lines: string[] = [];
  for (const v of wcag.violations) {
    const nodes = v.nodes.filter((n) => !allowed(v.id, n.target.map(String)));
    if (nodes.length === 0) continue;
    lines.push(
      `${v.id} (${v.impact ?? 'n/a'}): ${v.help}\n  ${v.helpUrl}\n` +
        nodes.map((n) => `  target: ${n.target.join(' ')}`).join('\n'),
    );
  }
  for (const e of expired)
    lines.push(`allowlist entry expired ${e.expires}: ${e.id} ${e.selector}`);

  for (const v of best.violations)
    test.info().annotations.push({
      type: 'axe-best-practice',
      description: `${label}: ${v.id} (${v.impact ?? 'n/a'}) ${v.helpUrl} ${v.nodes
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
    });

  expect(lines, `axe violations on ${label}\n${lines.join('\n')}`).toEqual([]);
}

export { expect };
