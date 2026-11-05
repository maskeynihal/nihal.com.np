import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = import.meta.dirname;
const read = (f: string) => readFileSync(join(dir, f), 'utf8');

const decls = (css: string) => {
  const out: Record<string, string> = {};
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!] = m[2]!.replace(/\s+/g, ' ').trim();
  }
  return out;
};

describe('tokens.css', () => {
  const t = decls(read('tokens.css'));

  it('defines exactly the design 2.1 values', () => {
    expect(t['--blue']).toBe('#1f3fe0');
    expect(t['--blue-deep']).toBe('#142fb8');
    expect(t['--blue-ink']).toBe('#0a1c6b');
    expect(t['--paper']).toBe('#f6f5f1');
    expect(t['--white']).toBe('#ffffff');
    expect(t['--line-2']).toBe('#ded9fa');
    expect(t['--mist']).toBe('rgb(255 255 255 / 0.12)');
    expect(t['--mist-strong']).toBe('rgb(255 255 255 / 0.3)');
    expect(t['--ok']).toBe('#9bf6c4');
    expect(t['--warn']).toBe('#ffd56b');
    expect(t['--bad']).toBe('#ff8a8a');
    expect(t['--radius']).toBe('6px');
  });

  it('defines font stacks with fallbacks and no Inter', () => {
    expect(t['--font-display']).toMatch(/^'Fraunces', 'Fraunces Fallback'/);
    expect(t['--font-body']).toMatch(/^'Fraunces', 'Fraunces Fallback'/);
    expect(t['--font-mono']).toMatch(
      /^'JetBrains Mono', 'JetBrains Mono Fallback'/,
    );
    expect(read('tokens.css')).not.toMatch(/inter/i);
  });
});

describe('global.css', () => {
  const css = read('global.css');

  it('has no literal hex colours', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('has no literal rgb()/hsl() colours', () => {
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  it('exposes tokens through @theme inline by reference', () => {
    expect(css).toMatch(/@theme inline/);
    expect(css).toContain('--color-blue: var(--blue)');
    expect(css).toContain('--color-line-2: var(--line-2)');
  });

  it('never removes the outline without replacement', () => {
    expect(css).not.toMatch(/outline:\s*none/);
  });
});
