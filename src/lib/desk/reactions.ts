/**
 * What happens when an object is tapped. One tiny bus (no React, no three.js): the pointer code
 * and the object list `fire` an object id; whoever animates that object (the workstation, the hop
 * below) hears it. Pure data, so the Scene and the shell can share it.
 */
type Listener = (id: string) => void;
const listeners = new Set<Listener>();

export const reactions = {
  fire(id: string): void {
    for (const l of listeners) l(id);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Milliseconds a hop lasts, and its height (m). */
export const HOP_MS = 460;
const HOP_H = 0.016;
export const BUZZ_MS = 700;

const started = new Map<string, { at: number; kind: 'hop' | 'buzz' }>();

/** Starts a small hop (a ball bounces, a clock jumps) or, for the phone, a buzz. */
export function bump(id: string, now: number, kind: 'hop' | 'buzz' = 'hop') {
  started.set(id, { at: now, kind });
}

/** The offset of a hop or a buzz at `now`, and whether it is still going. Pure. */
export function bumpOffset(
  id: string,
  now: number,
): { x: number; y: number; active: boolean } {
  const s = started.get(id);
  if (!s) return { x: 0, y: 0, active: false };
  const dur = s.kind === 'buzz' ? BUZZ_MS : HOP_MS;
  const u = (now - s.at) / dur;
  if (u >= 1 || u < 0) {
    started.delete(id);
    return { x: 0, y: 0, active: false };
  }
  if (s.kind === 'buzz')
    return {
      x: Math.sin(u * 60) * 0.0028 * (1 - u),
      y: 0,
      active: true,
    };
  // two decaying bounces
  const y = Math.abs(Math.sin(u * Math.PI * 2)) * HOP_H * (1 - u);
  return { x: 0, y, active: true };
}

/** Forget every running hop (a new Scene starts clean). */
export function clearBumps(): void {
  started.clear();
}
