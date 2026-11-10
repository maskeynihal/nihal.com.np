import { readFileSync, statSync } from 'node:fs';
import { test, expect } from './fixtures';

const ids = [
  'trayt',
  'tz-converter',
  'sprintnudge',
  'underhood',
  'space-hog',
  'car-sensors',
  'pac-man',
];

test('poster, marks and nib exist and are well formed @D-01', () => {
  expect(statSync('src/assets/poster.svg').size).toBeLessThanOrEqual(16 * 1024);
  const poster = readFileSync('src/assets/poster.svg', 'utf8');
  expect(poster).toMatch(/^<svg [^>]*viewBox="0 0 1200 700"/);
  expect(poster).not.toMatch(/NaN/);
  for (const id of ids) {
    const svg = readFileSync(`src/assets/marks/${id}.svg`, 'utf8');
    expect(svg, id).toMatch(/^<svg [^>]*viewBox="0 0 64 64"/);
  }
  expect(readFileSync('src/assets/nib.svg', 'utf8')).toMatch(/^<svg /);
});
