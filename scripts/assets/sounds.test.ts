// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sounds, toWav } from './sounds';

const dir = resolve(__dirname, '../../public/sounds');

describe('sounds', () => {
  it('has 3 taps and 1 tick, each as ogg and mp3', () => {
    expect(readdirSync(dir).sort()).toEqual(
      ['tap-1', 'tap-2', 'tap-3', 'tick'].flatMap((n) => [
        `${n}.mp3`,
        `${n}.ogg`,
      ]),
    );
    expect(Object.keys(sounds)).toHaveLength(4);
  });
  it('totals at most 20 KB', () => {
    const total = readdirSync(dir).reduce(
      (n, f) => n + statSync(resolve(dir, f)).size,
      0,
    );
    expect(total).toBeLessThanOrEqual(20 * 1024);
  });
  it('has valid container headers', () => {
    for (const f of readdirSync(dir)) {
      const b = readFileSync(resolve(dir, f));
      if (f.endsWith('.ogg')) expect(b.subarray(0, 4).toString()).toBe('OggS');
      else expect(b[0] === 0xff && (b[1]! & 0xe0) === 0xe0).toBe(true);
    }
  });
  it('wav header is well formed', () => {
    const w = toWav(new Float32Array(480));
    expect(w.subarray(0, 4).toString()).toBe('RIFF');
    expect(w.length).toBe(44 + 960);
  });
});
