import { getSound } from './prefs';

/**
 * The rubber duck. Two short rising chirps from an oscillator, and only when the visitor has sound
 * on (the context is made from a press, never on load). Silent otherwise, and silent where the
 * browser has no Web Audio.
 */
let ctx: AudioContext | null = null;

export function playSqueak(): void {
  if (getSound() !== 'on' || typeof window === 'undefined') return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    for (const at of [0, 0.17]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(760, t0 + at);
      osc.frequency.exponentialRampToValueAtTime(1500, t0 + at + 0.1);
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.07, t0 + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.13);
    }
  } catch {
    // no audio: the duck stays quiet
  }
}

/** The drawer's wood: a short low knock (an oscillator that drops in pitch), only with sound on. */
export function playClunk(): void {
  if (getSound() !== 'on' || typeof window === 'undefined') return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.09);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.15);
  } catch {
    // no audio: the drawer is quiet
  }
}
