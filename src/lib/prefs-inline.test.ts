import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import src from './prefs-inline.js?raw';
import { minifyInline } from './minify-inline';

const code = minifyInline(src);
const run = () => (0, eval)(code);
const html = document.documentElement;

function media(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: reduce && q === '(prefers-reduced-motion: reduce)',
    }),
  });
}

beforeEach(() => {
  localStorage.clear();
  delete html.dataset['motion'];
  delete html.dataset['sound'];
  media(false);
  history.replaceState(null, '', '/');
});
afterEach(() => vi.restoreAllMocks());

describe('inline prefs script', () => {
  it('stays under 1.2 KB', () => {
    expect(new TextEncoder().encode(code).length).toBeLessThan(1200);
  });
  it.each([
    [null, false, 'full'],
    [null, true, 'reduce'],
    ['reduce', false, 'reduce'],
    ['reduce', true, 'reduce'],
    ['full', true, 'full'],
    ['full', false, 'full'],
    ['bogus', true, 'reduce'],
    ['bogus', false, 'full'],
  ])('stored=%s mq=%s -> %s', (stored, mq, want) => {
    if (stored) localStorage.setItem('nihal:motion', stored);
    media(mq);
    run();
    expect(html.dataset['motion']).toBe(want);
  });
  it.each([
    [null, 'off'],
    ['on', 'on'],
    ['off', 'off'],
    ['junk', 'off'],
  ])('sound stored=%s -> %s', (stored, want) => {
    if (stored) localStorage.setItem('nihal:sound', stored);
    run();
    expect(html.dataset['sound']).toBe(want);
  });
  it('still sets attributes when localStorage getter throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    media(true);
    expect(run).not.toThrow();
    expect(html.dataset['motion']).toBe('reduce');
    expect(html.dataset['sound']).toBe('off');
  });
  it('does not throw when matchMedia is missing', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    expect(run).not.toThrow();
    expect(html.dataset['motion']).toBe('full');
  });
  it.each([
    ['#projects', '#work'],
    ['#about', '#desk'],
    ['#blog', '#writing'],
    ['#experience', '#cv'],
    ['#education', '#cv'],
    ['#skills', '#cv'],
    ['#home', '#desk'],
  ])('maps %s -> %s without a new history entry', (from, to) => {
    history.replaceState(null, '', '/' + from);
    const len = history.length;
    run();
    expect(location.hash).toBe(to);
    expect(history.length).toBe(len);
  });
  it.each(['#contact', '#work', '#nope', ''])('leaves %j untouched', (h) => {
    history.replaceState(null, '', '/' + h);
    const rs = vi.spyOn(history, 'replaceState');
    run();
    expect(location.hash).toBe(h);
    expect(rs).not.toHaveBeenCalled();
  });
  it('preserves path and query when mapping', () => {
    history.replaceState(null, '', '/x?a=1#blog');
    run();
    expect(location.pathname + location.search + location.hash).toBe(
      '/x?a=1#writing',
    );
  });
});
