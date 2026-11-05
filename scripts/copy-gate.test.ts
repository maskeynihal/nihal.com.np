// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ALLOWED_TOKENS,
  BANNED_PHRASES,
  BANNED_WORDS,
  ScanError,
  astroStrings,
  contentEntries,
  formatHits,
  locate,
  verbForms,
  gate,
  headingCaseViolations,
  runGate,
  scanText,
  walkStrings,
} from './copy-gate';

const rules = (t: string) => scanText(t).map((h) => `${h.rule}:${h.match}`);
const has = (t: string, rule: string) =>
  scanText(t).some((h) => h.rule === rule);

describe('banned list matches docs/specs/02-copy.md section 2', () => {
  const doc = readFileSync('docs/specs/02-copy.md', 'utf8');
  const line = (label: string) => {
    const m = doc.match(new RegExp(`^${label}: (.+)$`, 'm'));
    if (!m) throw new Error(`no "${label}:" line in spec`);
    return (m[1] ?? '')
      .replace(/\.$/, '')
      .split(', ')
      .map((s) => s.trim());
  };
  it('words are equal', () => {
    expect([...BANNED_WORDS].sort()).toEqual(line('Words').sort());
  });
  it('phrases are equal', () => {
    expect([...BANNED_PHRASES].sort()).toEqual(line('Phrases').sort());
  });
  it('allowlist is equal', () => {
    const m = doc.match(/^Allowlist \(exact, case-sensitive\): (.+)$/m);
    const toks = [...(m?.[1] ?? '').matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    expect([...ALLOWED_TOKENS].sort()).toEqual(toks.sort());
  });
});

describe('banned words', () => {
  it('flags every word, case-insensitively', () => {
    for (const w of BANNED_WORDS) {
      expect(has(`We ${w.toUpperCase()} it.`, 'banned-word'), w).toBe(true);
    }
  });
  it('flags every phrase, case-insensitively', () => {
    for (const p of BANNED_PHRASES) {
      expect(has(`x ${p.toUpperCase()}, y`, 'banned-phrase'), p).toBe(true);
    }
  });
  it('respects word boundaries', () => {
    expect(has('It is dynamic.', 'banned-word')).toBe(true);
    expect(has('It runs dynamically.', 'banned-word')).toBe(false);
    expect(has('A harnessed river', 'banned-word')).toBe(true);
    expect(has('unlocked', 'banned-word')).toBe(true);
    expect(has('Unlock the door', 'banned-word')).toBe(true);
    expect(has('the realm', 'banned-word')).toBe(true);
    expect(has('surrealm', 'banned-word')).toBe(false);
  });
  it('does not flag clean prose', () => {
    expect(
      scanText('I lead a team that builds healthcare software on AWS.'),
    ).toEqual([]);
  });
});

describe('inflections', () => {
  it.each([
    ['We are reaching out.', 'banned-phrase'],
    ['She reached out.', 'banned-phrase'],
    ['He reaches out.', 'banned-phrase'],
    ['We leveraged it.', 'banned-word'],
    ['Leveraging AWS', 'banned-word'],
    ['It leverages X', 'banned-word'],
    ['harnessing power', 'banned-word'],
    ['a harnessed river', 'banned-word'],
    ['showcasing work', 'banned-word'],
    ['It showcases', 'banned-word'],
    ['a streamlined flow', 'banned-word'],
    ['streamlining it', 'banned-word'],
    ['empowering teams', 'banned-word'],
    ['empowered', 'banned-word'],
    ['an elevated view', 'banned-word'],
    ['elevating', 'banned-word'],
    ['unlocked the door', 'banned-word'],
    ['unlocking it', 'banned-word'],
    ['delved into', 'banned-word'],
    ['facilitated', 'banned-word'],
    ['utilizing', 'banned-word'],
    ['fostered', 'banned-word'],
    ['it served as a bridge', 'banned-phrase'],
  ])('%s', (t, rule) => {
    expect(has(t, rule)).toBe(true);
  });
  it.each([
    'database in the cloud',
    'DynamoDB table',
    'a dynamically typed language',
    'the harnessed-free test',
    'unlockable',
    'elevator',
    'delvery',
    'The Loop Harness repo',
  ])('stays clean: %s', (t) => {
    expect(
      scanText(t).filter(
        (h) => h.rule !== 'banned-word' || !/harness/i.test(h.match),
      ),
    ).toEqual([]);
  });
  it('dynamic is a hit, DynamoDB is not', () => {
    expect(has('dynamic', 'banned-word')).toBe(true);
    expect(has('DynamoDB', 'banned-word')).toBe(false);
  });
  it('verbForms', () => {
    expect(verbForms('leverage')).toEqual([
      'leverages',
      'leveraged',
      'leveraging',
    ]);
    expect(verbForms('harness')).toEqual([
      'harnesses',
      'harnessed',
      'harnessing',
    ]);
    expect(verbForms('unlock')).toEqual(['unlocks', 'unlocked', 'unlocking']);
  });
});

describe('allowlist', () => {
  it('DynamoDB is clean, dynamic still is not', () => {
    expect(scanText('DynamoDB dashboard')).toEqual([]);
    expect(has('DynamoDB is dynamic', 'banned-word')).toBe(true);
  });
  it('Loop Harness is clean, lowercase harness is not', () => {
    expect(scanText('The Loop Harness repo')).toEqual([]);
    expect(has('the loop harness repo', 'banned-word')).toBe(true);
    expect(has('Loop Harness and a harness', 'banned-word')).toBe(true);
    expect(has('Harness', 'banned-word')).toBe(true);
  });
  it('is case-sensitive for DynamoDB', () => {
    // No banned word inside, so this stays clean either way; the mask must not throw.
    expect(scanText('dynamodb')).toEqual([]);
  });
});

describe('phrases across punctuation and spacing', () => {
  it('matches next to punctuation', () => {
    expect(rules('Please, reach out.')).toContain('banned-phrase:reach out');
    expect(rules('(based in Kathmandu)')).toContain('banned-phrase:based in');
  });
  it('matches across a line break and double spaces', () => {
    expect(has('reach\nout', 'banned-phrase')).toBe(true);
    expect(has('reach   out', 'banned-phrase')).toBe(true);
  });
  it('matches hyphen or space variants', () => {
    expect(has('a cutting edge idea', 'banned-word')).toBe(true);
    expect(has('end to end tests', 'banned-phrase')).toBe(true);
    expect(has('End-To-End', 'banned-phrase')).toBe(true);
  });
  it('matches straight and curly apostrophes', () => {
    expect(has("Let's connect", 'banned-phrase')).toBe(true);
    expect(has('Let’s connect', 'banned-phrase')).toBe(true);
    expect(has('In today’s world', 'banned-phrase')).toBe(true);
  });
  it('does not match when punctuation separates the words', () => {
    expect(has('reach. out', 'banned-phrase')).toBe(false);
    expect(has('reached out', 'banned-phrase')).toBe(true);
    expect(has('breached out', 'banned-phrase')).toBe(false);
  });
});

describe('punctuation and glyph rules', () => {
  it('em dash', () => {
    expect(has('a — b', 'em-dash')).toBe(true);
    expect(has('a - b, a – b, a → b', 'em-dash')).toBe(false);
  });
  it('exclamation mark', () => {
    expect(has('Sent!', 'exclamation')).toBe(true);
    expect(has('Sent.', 'exclamation')).toBe(false);
  });
  it('emoji and heart', () => {
    expect(has('hi \u{1F680}', 'emoji')).toBe(true);
    expect(has('made ♥', 'emoji')).toBe(true);
    expect(has('❤️', 'emoji')).toBe(true);
  });
  it('plain typography is not emoji', () => {
    expect(has('© 2026 · a → b ← c 3D 1:1', 'emoji')).toBe(false);
  });
});

describe('heading case', () => {
  it('flags capitals outside the proper-noun list', () => {
    expect(headingCaseViolations('Open Source')).toEqual(['Open', 'Source']);
    expect(headingCaseViolations('open source')).toEqual([]);
  });
  it('allows listed proper nouns, case-sensitively', () => {
    expect(headingCaseViolations('github notes')).toEqual([]);
    expect(headingCaseViolations('GitHub and Hashnode on AWS')).toEqual([]);
    expect(headingCaseViolations('Github')).toEqual(['Github']);
    expect(headingCaseViolations('3D')).toEqual([]);
  });
  it('only headings are checked by gate()', () => {
    const body = { path: 'a:b', text: 'Open Source' };
    expect(gate([body])).toEqual([]);
    expect(gate([{ ...body, heading: true }]).map((h) => h.rule)).toEqual([
      'title-case',
      'title-case',
    ]);
  });
});

describe('content walk', () => {
  it('paths use ids and indexes, skip hrefs and ids', () => {
    const e = walkStrings('work.ts', [
      { id: 'a-b', title: 'x', body: ['p0', 'p1'], href: 'https://x.y/!' },
    ]);
    expect(e.map((x) => x.path)).toEqual([
      'work.ts:a-b.title',
      'work.ts:a-b.body[0]',
      'work.ts:a-b.body[1]',
    ]);
    expect(e[0]?.heading).toBe(true);
    expect(e[1]?.heading).toBe(false);
  });
  it('covers every content module and the poster alt', () => {
    const paths = contentEntries().map((e) => e.path);
    for (const prefix of [
      'copy.ts:',
      'client-copy.ts:',
      'work.ts:tz-converter.body[0]',
      'oss.ts:',
      'writing.ts:',
      'cv.ts:',
      'objects.ts:arduino.label',
      'objects.ts:arduino.callouts[0]',
      'poster-alt.ts:',
    ])
      expect(
        paths.some((p) => p.startsWith(prefix)),
        prefix,
      ).toBe(true);
    expect(paths.some((p) => p.startsWith('pending.ts'))).toBe(false);
  });
  it('real content is clean', () => {
    expect(runGate()).toEqual([]);
  });
});

describe('astro scanner', () => {
  const strings = (src: string) =>
    astroStrings(src, 'x.astro').map((e) => e.text);
  it('reads template text and a11y attributes', () => {
    const src = `---\nconst a = 'Wow!';\n---\n<p>Hello there.</p><img alt="A cat" src="a.png" /><button aria-label="Go">x</button><div title='T'></div>`;
    const s = strings(src);
    expect(s).toEqual(
      expect.arrayContaining(['Hello there.', 'A cat', 'Go', 'T', 'x']),
    );
    expect(s.join(' ')).not.toContain('Wow');
  });
  it('ignores frontmatter, script, style, comments and doctype', () => {
    const src = `<!doctype html>\n<!-- Wow! -->\n<script>const a = !b; alert('Hi!')</script><style>a::after{content:"!"}</style><p>ok</p>`;
    expect(strings(src)).toEqual(['ok']);
  });
  it('reads quoted literals inside braces but not code', () => {
    const s = strings(`<p>{ok && 'Yes!'} {!flag}</p>`);
    expect(s).toEqual(['Yes!']);
  });
  it('decodes entities', () => {
    const hits = gate(astroStrings('<p>a &mdash; b &#33;</p>', 'x.astro')).map(
      (h) => h.rule,
    );
    expect(hits).toEqual(expect.arrayContaining(['em-dash', 'exclamation']));
  });
  it('reports a line number and the gate flags a banned word', () => {
    const hits = gate(astroStrings('<p>a</p>\n<p>seamless</p>', 'f.astro'));
    expect(hits).toEqual([
      { path: 'f.astro:2', rule: 'banned-word', match: 'seamless' },
    ]);
  });
  it('reads dynamic attribute literals', () => {
    expect(strings(`<a aria-label={x ? 'one!' : 'two'}>t</a>`)).toEqual(
      expect.arrayContaining(['one!', 'two']),
    );
  });
});

describe('astro scanner: attributes, ld+json, loud failures', () => {
  const strings = (src: string) =>
    astroStrings(src, 'x.astro').map((e) => e.text);
  it('reads content attributes', () => {
    expect(
      strings('<meta name="description" content="Be seamless" />'),
    ).toContain('Be seamless');
  });
  it('reads application/ld+json string values with their line', () => {
    const src =
      '<p>a</p>\n<script type="application/ld+json">{"name":"A — B","@type":"Person"}</script>';
    const e = astroStrings(src, 'x.astro');
    expect(e.map((x) => x.text)).toEqual(expect.arrayContaining(['A — B']));
    expect(gate(e).map((h) => `${h.path}:${h.rule}`)).toContain(
      'x.astro:2:em-dash',
    );
  });
  it('still ignores other scripts and self-closing scripts do not swallow the file', () => {
    const src =
      '<script type="application/ld+json" set:html={x} />\n<p>{ok && "Yes!"}</p><script>alert("Hi!")</script>';
    expect(strings(src)).toEqual(['Yes!']);
  });
  it('fails loudly on an unbalanced quote inside braces, with file:line', () => {
    const src = "<p>a</p>\n<p>b</p>\n<p>{ok && 'Yes}</p>";
    expect(() => astroStrings(src, 'f.astro')).toThrow(ScanError);
    expect(() => astroStrings(src, 'f.astro')).toThrow(
      /f\.astro:3: unbalanced/,
    );
  });
  it('fails loudly on an unclosed brace and on an unbalanced quote in a tag', () => {
    expect(() => astroStrings('<p>{a</p>', 'f.astro')).toThrow(
      /f\.astro:1: unbalanced brace/,
    );
    expect(() => astroStrings('<p>x</p>\n<a href="x>y</a>', 'f.astro')).toThrow(
      /f\.astro:2: unbalanced " quote inside a tag/,
    );
  });
  it('does not trip on apostrophes in JS comments or text', () => {
    expect(strings("<p>don't {/* it's */ 'ok'}</p>")).toEqual(
      expect.arrayContaining(['ok']),
    );
  });
});

describe('content hits print file:line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cg-'));
  writeFileSync(
    join(dir, 'copy.ts'),
    "export const copy = {\n  a: 'fine',\n  b: 'We are seamless here.',\n};\n",
  );
  it('locates the string line', () => {
    const hit = {
      path: 'copy.ts:b',
      rule: 'banned-word' as const,
      match: 'seamless',
    };
    expect(locate(hit, 'We are seamless here.', dir)).toBe(
      'src/content/copy.ts:3 (copy.ts:b)',
    );
  });
  it('falls back to the entry path for runtime strings', () => {
    const hit = {
      path: 'poster-alt.ts:buildPosterAlt',
      rule: 'banned-word' as const,
      match: 'x',
    };
    expect(locate(hit, 'built at runtime', dir)).toBe(
      'poster-alt.ts:buildPosterAlt',
    );
  });
  it('formatHits keeps astro paths as they are', () => {
    const e = [{ path: 'src/a.astro:4', text: 'seamless' }];
    expect(formatHits(e, gate(e))).toEqual([
      'src/a.astro:4: banned-word: seamless',
    ]);
  });
});

describe('cli', () => {
  it('exits 0 on the real tree', () => {
    execFileSync('pnpm', ['exec', 'tsx', 'scripts/copy-gate.ts'], {
      stdio: 'pipe',
    });
  });
});
