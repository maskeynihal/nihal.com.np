/**
 * The seam between the input code (Scene chunk) and the physics layer (its own lazy chunk).
 * Types only: nothing here may import `@react-three/rapier` or rapier, or it would pull the
 * engine into whichever chunk imports this file. `pnpm check:graph` enforces the split.
 */
export interface BodyInfo {
  id: string;
  asleep: boolean;
  type: 'dynamic' | 'kinematic';
  p: [number, number, number];
}

export interface PhysicsApi {
  /** Starts holding `id`; (x, z) is the pointer on the desk plane. False if it cannot. */
  grab(id: string, x: number, z: number): boolean;
  /** The pointer moved on the desk plane. */
  move(x: number, z: number): void;
  /** Lets go, throwing with this velocity (m/s on the desk plane). */
  release(vx: number, vz: number): void;
  /** Lets go with no throw (pointer cancelled). */
  drop(): void;
  /** Every body back to its home pose, asleep. */
  reset(): void;
  grabbed(): string | null;
  /** True while the body is held or still moving (not asleep). */
  awake(id: string): boolean;
  // Test aids (PUBLIC_TEST_HOOKS builds only call these).
  bodies(): BodyInfo[];
  teleport(id: string, x: number, y: number, z: number): boolean;
}

type State = 'idle' | 'loading' | 'ready' | 'failed';

let state: State = 'idle';
let api: PhysicsApi | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const physicsBridge = {
  state: (): State => state,
  api: (): PhysicsApi | null => api,
  /** Input asks for the engine (first grab). Idempotent. */
  request(): void {
    if (state === 'idle') {
      state = 'loading';
      emit();
    }
  },
  /** The physics layer registers itself (null when it unmounts). */
  provide(next: PhysicsApi | null): void {
    api = next;
    state = next ? 'ready' : state === 'ready' ? 'idle' : state;
    emit();
  },
  /** The Scene unmounted: forget everything. */
  reset(): void {
    api = null;
    state = 'idle';
    emit();
  },
  fail(): void {
    api = null;
    state = 'failed';
    emit();
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
