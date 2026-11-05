import { testHooks } from './env';
import { getSound, subscribeSound } from './prefs';

/**
 * Sound (design 4.7): wood taps on impact, one clock tick a minute. Nothing here runs unless the
 * visitor turned sound on: the AudioContext is created from a user press while sound is on
 * (`armSound`), never on load, and `audio` goes back to null when sound goes off. Muted
 * (suspended) while the tab is hidden. Files are ogg/opus where the browser plays it, else mp3.
 */

type Clip = 'tap-1' | 'tap-2' | 'tap-3' | 'tick';

/** One entry per started clip; read by e2e through `__hooks.desk.audio`. */
export interface Played {
  clip: Clip;
  gain: number;
}

interface AudioWindow {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

let audio: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<Clip, AudioBuffer>();
const played: Played[] = [];
let teardown: (() => void) | null = null;
let lastTap = 0;
let lastTick = 0;

/** Min gap between two taps and between two ticks, ms. */
const TAP_GAP_MS = 60;
const TICK_GAP_MS = 5_000;
/** Impact speeds (m/s) that pick the soft, medium and hard tap. */
export const SOFT_BELOW = 0.7;
export const HARD_FROM = 1.8;
/** Slower than this is a body settling, not a drop. */
export const MIN_IMPACT = 0.25;

/** Which tap and how loud, from the speed at impact. Pure. */
export function tapFor(speed: number): { clip: Clip; gain: number } | null {
  if (!(speed >= MIN_IMPACT)) return null;
  const clip: Clip =
    speed < SOFT_BELOW ? 'tap-1' : speed < HARD_FROM ? 'tap-2' : 'tap-3';
  return { clip, gain: Math.min(1, 0.18 + speed * 0.22) };
}

/** ogg/opus where it plays, else mp3 (Safari before 18.4). */
export function codec(): 'ogg' | 'mp3' {
  try {
    return document.createElement('audio').canPlayType('audio/ogg; codecs=opus')
      ? 'ogg'
      : 'mp3';
  } catch {
    return 'mp3';
  }
}

async function load(ctx: AudioContext, clip: Clip): Promise<void> {
  try {
    const res = await fetch(`/sounds/${clip}.${codec()}`);
    if (!res.ok) return;
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    if (audio === ctx) buffers.set(clip, buffer);
  } catch {
    // A clip that does not load is a silent clip; the page is unaffected.
  }
}

function close(): void {
  teardown?.();
  teardown = null;
  const ctx = audio;
  audio = null;
  master = null;
  buffers.clear();
  played.length = 0;
  if (ctx) void ctx.close().catch(() => {});
}

function create(): void {
  const w = window as unknown as AudioWindow;
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  audio = ctx;
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  void ctx.resume().catch(() => {});
  for (const clip of ['tap-1', 'tap-2', 'tap-3', 'tick'] as const)
    void load(ctx, clip);

  const onVisibility = () => {
    if (!audio) return;
    if (document.hidden) void audio.suspend().catch(() => {});
    else if (getSound() === 'on') void audio.resume().catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribe = subscribeSound((s) => {
    if (s === 'off') close();
  });
  teardown = () => {
    document.removeEventListener('visibilitychange', onVisibility);
    unsubscribe();
  };
}

/**
 * Call from a user press (pointerdown, toggle click). Creates the AudioContext the first time,
 * only while sound is on; a context left suspended by the browser is resumed. No-op otherwise.
 */
export function armSound(): void {
  if (typeof window === 'undefined' || getSound() !== 'on') return;
  if (document.hidden) return;
  if (!audio) create();
  else if (audio.state === 'suspended') void audio.resume().catch(() => {});
}

function start(clip: Clip, gain: number): void {
  const ctx = audio;
  const buffer = buffers.get(clip);
  if (!ctx || !master || !buffer || document.hidden) return;
  if (getSound() !== 'on') return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start();
  if (testHooks) played.push({ clip, gain });
}

/** A body hit something at `speed` m/s. */
export function playImpact(speed: number): void {
  if (!audio) return;
  const tap = tapFor(speed);
  const now = performance.now();
  if (!tap || now - lastTap < TAP_GAP_MS) return;
  lastTap = now;
  start(tap.clip, tap.gain);
}

/** The minute changed on a clock. Several clocks tick at once; one tick is played. */
export function playTick(): void {
  if (!audio) return;
  const now = performance.now();
  if (now - lastTick < TICK_GAP_MS) return;
  lastTick = now;
  start('tick', 0.35);
}

/** `null` while sound is off; otherwise the context state and what has played (tests only). */
export function audioProbe(): { state: string; played: Played[] } | null {
  return audio ? { state: audio.state, played: [...played] } : null;
}
