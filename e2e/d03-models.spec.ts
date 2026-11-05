import { readFileSync, readdirSync, statSync } from 'node:fs';
import { test, expect } from './fixtures';

const DIR = 'src/assets/models';

/** The JSON chunk of a GLB: readable without a meshopt decoder. */
function glbJson(file: string): {
  nodes: { name: string; children?: number[]; mesh?: number }[];
} {
  const buf = readFileSync(`${DIR}/${file}`);
  expect(buf.toString('utf8', 0, 4), file).toBe('glTF');
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + len));
}

test('final GLBs fit the size budgets and expose the named nodes @D-03', () => {
  const glbs = readdirSync(DIR).filter((f) => f.endsWith('.glb'));
  const total = glbs.reduce((n, f) => n + statSync(`${DIR}/${f}`).size, 0);
  expect(total).toBeLessThanOrEqual(150 * 1024);
  expect(statSync('src/assets/poster.svg').size).toBeLessThanOrEqual(16 * 1024);

  const want: Record<string, string[]> = {
    'clock.glb': ['hand-hour', 'hand-minute'],
    'calendar.glb': ['face'],
    'ghost.glb': ['eye-l', 'eye-r'],
    'arduino.glb': ['screen'],
  };
  for (const [file, names] of Object.entries(want)) {
    const have = glbJson(file).nodes.map((n) => n.name);
    for (const n of names) expect(have, `${file} ${n}`).toContain(n);
  }
});
