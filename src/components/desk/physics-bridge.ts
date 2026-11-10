/**
 * The seam between the input code (Scene chunk) and the physics layer (its own lazy chunk).
 * Types and plain state only: nothing here may import `@react-three/rapier` or rapier, or it
 * would pull the engine into whichever chunk imports this file. `pnpm check:graph` enforces the
 * split.
 *
 * There are two physics worlds. The table world lives in the table canvas (3D, the table is a
 * slab with no walls). The fall world lives in a second, fixed, full-viewport canvas that exists
 * only while something has left the table. An object moves from one to the other with
 * `HandoffState`, a complete world-space snapshot, and nothing else changes.
 */
export interface BodyInfo {
  id: string;
  asleep: boolean;
  type: 'dynamic' | 'kinematic';
  p: [number, number, number];
  /** Fall layer only: where the object's origin is on screen, viewport px. */
  screen?: [number, number];
  /** Fall layer only: the object's silhouette on screen, viewport px. */
  rect?: Rect;
}

/** An object's full state in the table's world frame (metres, m/s, rad/s). */
export interface HandoffState {
  id: string;
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  w: [number, number, number];
  /** Table to fall only: the pose the last drawn frame showed (the body is one step ahead of it). */
  shown?: { p: [number, number, number]; q: [number, number, number, number] };
  /** Table to fall only: gravity in the table camera's frame, m/s^2. */
  gCam?: [number, number, number];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What the fall layer reports back after taking a body over (for the handoff log). */
export interface AcceptResult {
  after: Rect;
  vAfter: [number, number];
  aBefore: number;
  aAfter: number;
  gravityScale: number;
}

/** Where the table canvas is on screen: the camera's principal point and focal length, px. */
export interface Frame {
  cx: number;
  cy: number;
  f: number;
  /** Canvas size, CSS px. */
  w: number;
  h: number;
  /** Canvas top left in the viewport, CSS px. */
  left: number;
  top: number;
}

export interface HandoffLog {
  at: number;
  id: string;
  dir: 'down' | 'up';
  /** Screen rect of the object (viewport px) just before and just after the swap. */
  before: Rect;
  after: Rect;
  /** Screen velocity (px/s) of the object's centre, before and after. */
  vBefore: [number, number];
  vAfter: [number, number];
  /** Apparent downward acceleration (px/s^2) before, and in the fall world right after. */
  aBefore: number;
  aAfter: number;
  /** Gravity scale the body starts with in the fall world. */
  gravityScale: number;
  /** Largest corner difference between the two rects, px. */
  errPx: number;
}

/** Pointer positions are on the horizontal plane at drag height, metres (x right, z toward the viewer). */
export interface PhysicsApi {
  /** Starts holding `id`; (x, z) is the pointer. False if it cannot. */
  grab(id: string, x: number, z: number): boolean;
  /** The pointer moved. */
  move(x: number, z: number): void;
  /** Lets go, throwing with this velocity (m/s). */
  release(vx: number, vz: number): void;
  /** Lets go with no throw (pointer cancelled). */
  drop(): void;
  /**
   * Every object back on the table at its home pose (the fall layer's too), except the `keep`
   * ids: those stay where they are in the fall layer (frozen) for the tether to reel home.
   */
  reset(keep?: readonly string[]): void;
  /** A body arrives from the fall layer (released over the table). */
  receive(state: HandoffState): void;
  grabbed(): string | null;
  /** True while the body is held or still moving (not asleep). */
  awake(id: string): boolean;
  // Test aids (PUBLIC_TEST_HOOKS builds only call these).
  bodies(): BodyInfo[];
  teleport(
    id: string,
    x: number,
    y: number,
    z: number,
    v?: [number, number, number],
  ): boolean;
  /** Test aid: stop stepping on its own, and advance by `n` fixed steps at a time. */
  hold(on: boolean): void;
  step(n: number): void;
  handoffs(): HandoffLog[];
}

/** The fall layer's side. Pointer positions are viewport px. */
export interface FallApi {
  /** A body from the table world. */
  accept(state: HandoffState, frame: Frame): AcceptResult | null;
  /** The free object under this viewport point, or null. */
  pick(cx: number, cy: number): string | null;
  grab(id: string, cx: number, cy: number): boolean;
  move(cx: number, cy: number): void;
  /** Lets go with this screen velocity (px/s). */
  release(vx: number, vy: number, cx: number, cy: number): void;
  drop(): void;
  /** Every free object goes back to the table group at its home pose, and the world empties (except `keep`). */
  reset(keep?: readonly string[]): void;
  /** The pose (table world) of a free object as drawn now, mapped back through the table camera; null if unknown. */
  capture(id: string): {
    p: [number, number, number];
    q: [number, number, number, number];
  } | null;
  /** Holds a free object still where it is (kinematic, no steps move it) until `home` or `reset`. */
  freeze(id: string): boolean;
  /** Puts a frozen free object at a table-world pose (the tether's reel). */
  place(
    id: string,
    p: readonly [number, number, number],
    q: readonly [number, number, number, number],
  ): void;
  /** A frozen free object arrives home: back on the table at its rest pose. */
  home(id: string): void;
  /** A page scroll of `dy` px: free objects get a small hop. */
  jolt(dy: number): void;
  grabbed(): string | null;
  bodies(): BodyInfo[];
  count(): number;
  hold(on: boolean): void;
  step(n: number): void;
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

type FallState = 'off' | 'mounting' | 'ready';
let fallState: FallState = 'off';
let fallApi: FallApi | null = null;
let fallFrame: Frame | null = null;
const fallListeners = new Set<() => void>();
const fallEmit = () => fallListeners.forEach((l) => l());

/** The second canvas: mounted on demand, ready once its world is up, off again when empty. */
export const fallBridge = {
  state: (): FallState => fallState,
  api: (): FallApi | null => fallApi,
  /** The table frame the fall camera is anchored to (fixed for one mount). */
  frame: (): Frame | null => fallFrame,
  /** Something is about to leave the table: mount the canvas (idempotent). */
  request(frame: Frame): void {
    if (fallState !== 'off') return;
    fallFrame = frame;
    fallState = 'mounting';
    fallEmit();
  },
  provide(next: FallApi | null): void {
    fallApi = next;
    if (next) fallState = 'ready';
    fallEmit();
  },
  /** Nothing is free any more: unmount the canvas. */
  release(): void {
    fallApi = null;
    fallFrame = null;
    fallState = 'off';
    fallEmit();
  },
  subscribe(l: () => void): () => void {
    fallListeners.add(l);
    return () => fallListeners.delete(l);
  },
};

/** Test aid (PUBLIC_TEST_HOOKS builds): keep both worlds from stepping on their own, also in a canvas mounted later. */
export const testControl = { hold: false };
