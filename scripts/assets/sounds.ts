/**
 * Sound synthesis (D-04). Three desk "taps" and one minute "tick", generated from maths, no
 * samples: licence is self-made, CC0 (docs/research/asset-sources.md).
 * `pnpm sounds` writes public/sounds/{tap-1,tap-2,tap-3,tick}.{ogg,mp3}. The PCM is
 * deterministic (seeded noise); encoding shells out to ffmpeg (libopus in Ogg, libmp3lame),
 * so the encoded bytes depend on the ffmpeg build. The files are committed.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RATE = 48000;
export const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../public/sounds',
);

/** mulberry32, so the noise burst is identical on every run. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

interface Voice {
  /** body frequency, Hz */
  freq: number;
  /** body decay time constant, s */
  decay: number;
  /** noise click decay, s */
  click: number;
  clickGain: number;
  length: number;
  seed: number;
}

/** A damped sine (the body) plus a short low-passed noise burst (the contact). */
function synth(v: Voice): Float32Array {
  const n = Math.round(v.length * RATE);
  const out = new Float32Array(n);
  const rand = rng(v.seed);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // body pitch drops a touch as it rings out
    const f = v.freq * (1 + 0.12 * Math.exp(-t / 0.01));
    const body = Math.sin(2 * Math.PI * f * t) * Math.exp(-t / v.decay);
    lp += 0.35 * (rand() - lp);
    const click = lp * Math.exp(-t / v.click) * v.clickGain;
    // 1 ms attack so the first sample is not a step
    const attack = Math.min(1, t / 0.001);
    out[i] = (body * 0.8 + click) * attack;
  }
  // fade the last 5 ms to zero
  const fade = Math.round(0.005 * RATE);
  for (let i = 0; i < fade; i++) out[n - 1 - i]! *= i / fade;
  // normalise to -3 dBFS
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  for (let i = 0; i < n; i++) out[i] = (out[i]! / peak) * 0.708;
  return out;
}

export const sounds: Record<string, Voice> = {
  'tap-1': {
    freq: 180,
    decay: 0.03,
    click: 0.004,
    clickGain: 0.5,
    length: 0.11,
    seed: 1,
  },
  'tap-2': {
    freq: 240,
    decay: 0.026,
    click: 0.004,
    clickGain: 0.45,
    length: 0.1,
    seed: 2,
  },
  'tap-3': {
    freq: 320,
    decay: 0.022,
    click: 0.003,
    clickGain: 0.4,
    length: 0.09,
    seed: 3,
  },
  tick: {
    freq: 1800,
    decay: 0.012,
    click: 0.002,
    clickGain: 0.6,
    length: 0.06,
    seed: 4,
  },
};

/** 16-bit mono PCM WAV. */
export function toWav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function encode(wav: string, out: string, codecArgs: string[]) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      wav,
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-flags:a',
      '+bitexact',
      ...codecArgs,
      out,
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error('ffmpeg failed; is it installed?');
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const tmp = mkdtempSync(resolve(tmpdir(), 'sounds-'));
  try {
    for (const [name, voice] of Object.entries(sounds)) {
      const wav = resolve(tmp, `${name}.wav`);
      writeFileSync(wav, toWav(synth(voice)));
      encode(wav, resolve(OUT_DIR, `${name}.ogg`), [
        '-c:a',
        'libopus',
        '-b:a',
        '24k',
        '-vbr',
        'on',
        '-application',
        'audio',
        '-serial_offset',
        '0',
        '-f',
        'ogg',
      ]);
      encode(wav, resolve(OUT_DIR, `${name}.mp3`), [
        '-c:a',
        'libmp3lame',
        '-b:a',
        '48k',
        '-ar',
        '44100',
        '-write_xing',
        '0',
        '-id3v2_version',
        '0',
        '-f',
        'mp3',
      ]);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
