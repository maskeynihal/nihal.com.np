/**
 * Which object the pointer is over and which one is held. Written by Interaction, read by the
 * callouts (and anything else that reacts to it); a tiny store so no React state changes on a
 * pointer move.
 */
type Listener = () => void;

interface Activity {
  hover: string | null;
  grabbed: string | null;
}

let state: Activity = { hover: null, grabbed: null };
const listeners = new Set<Listener>();

export const activity = {
  get: (): Activity => state,
  /** The object that should read as active: the held one, else the hovered one. */
  active: (): string | null => state.grabbed ?? state.hover,
  set(next: Partial<Activity>): void {
    const merged = { ...state, ...next };
    if (merged.hover === state.hover && merged.grabbed === state.grabbed)
      return;
    state = merged;
    for (const l of listeners) l();
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
