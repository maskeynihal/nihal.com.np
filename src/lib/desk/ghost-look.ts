/**
 * Where the ghost's eyes look, in desk-plane metres, or null (eyes forward). The physics layer
 * (E-05) sets it from the pointer only while the ghost is grabbed and clears it on release;
 * there is no idle following. A tiny store so the Scene needs no React state for pointer moves.
 */
type Listener = () => void;

let target: { x: number; z: number } | null = null;
const listeners = new Set<Listener>();

export const ghostLook = {
  get(): { x: number; z: number } | null {
    return target;
  },
  set(next: { x: number; z: number } | null): void {
    target = next;
    for (const l of listeners) l();
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
