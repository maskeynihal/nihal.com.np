/**
 * `pnpm assets`: regenerate every model GLB plus the shared line data (D-06).
 * Output is deterministic: run twice, get identical bytes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { partToGlb } from './export';
import { bounds, triCount } from './geom';
import { models } from './models';

export const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/assets/models',
);

export interface BuiltAssets {
  glbs: Map<string, Uint8Array>;
  /** `lines.json` text: per object, flat xyz-pairs in the object's local frame (metres). */
  linesJson: string;
  stats: { file: string; tris: number; bytes: number; lineSegments: number }[];
}

export async function buildAssets(): Promise<BuiltAssets> {
  const glbs = new Map<string, Uint8Array>();
  const lines: Record<string, number[]> = {};
  const stats: BuiltAssets['stats'] = [];
  for (const m of models) {
    const part = m.build();
    const glb = await partToGlb(m.name, part);
    glbs.set(`${m.file}.glb`, glb);
    lines[m.file] = part.lines;
    stats.push({
      file: `${m.file}.glb`,
      tris: triCount(part),
      bytes: glb.byteLength,
      lineSegments: part.lines.length / 6,
    });
  }
  const linesJson = `${JSON.stringify(lines)}\n`;
  return { glbs, linesJson, stats };
}

export { bounds };

async function main() {
  const out = await buildAssets();
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [name, bytes] of out.glbs)
    writeFileSync(resolve(OUT_DIR, name), bytes);
  writeFileSync(resolve(OUT_DIR, 'lines.json'), out.linesJson);
  for (const s of out.stats) {
    console.log(
      `${s.file.padEnd(14)} ${String(s.tris).padStart(4)} tris  ${String(s.lineSegments).padStart(4)} segs  ${String(s.bytes).padStart(6)} B`,
    );
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main();
}
