/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TEST_HOOKS?: string;
  readonly PUBLIC_SHOW_UNCONFIRMED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ErrorRecord {
  island: string;
  phase: string;
  name: string;
  message: string;
}

type DeskFailKind = 'scene' | 'shell' | 'chunk' | 'async';

interface DeskSceneHooks {
  /** Frames the canvas has rendered. */
  frames(): number;
  /** OLED ticks so far (500 ms each, only while visible and motion is full). */
  oledTicks(): number;
  oledText(): string;
  /** Hand angles of each clock, radians clockwise from 12. */
  clocks(): { id: string; hour: number; minute: number }[];
  calendar(): unknown;
  ghostLook(x: number, z: number): void;
  ghostRelease(): void;
  /** `rotation.y` of the eye pivots. */
  ghostEyes(): number[];
  /** Canvas size in CSS px. */
  size(): { width: number; height: number };
  /** Swaps the desk for one lit sphere; returns its screen circle in canvas CSS px. */
  probeSphere(on: boolean): { cx: number; cy: number; r: number } | null;
  /** The physics layer: 'idle' until the first grab, then 'loading', 'ready' or 'failed'. */
  physics(): {
    state: 'idle' | 'loading' | 'ready' | 'failed';
    grabbed: string | null;
    bodies: {
      id: string;
      asleep: boolean;
      type: 'dynamic' | 'kinematic';
      p: [number, number, number];
    }[];
  };
  /** The fall layer (second canvas): 'off' until something leaves the table. */
  fall(): {
    state: 'off' | 'mounting' | 'ready';
    grabbed: string | null;
    frames: number;
    bodies: {
      id: string;
      asleep: boolean;
      type: 'dynamic' | 'kinematic';
      p: [number, number, number];
      screen?: [number, number];
      rect?: { x: number; y: number; w: number; h: number };
    }[];
  };
  /** Every table-to-fall handoff so far: screen rects, velocities, accelerations (see HandoffLog). */
  handoffs(): unknown[];
  /** Stops both worlds stepping on their own, or lets them go again. */
  hold(on: boolean): void;
  /** Advances both worlds by `n` fixed steps (only while held) and draws. */
  stepWorlds(n: number): void;
  /** Asks for the physics chunk as a first grab would. */
  requestPhysics(): void;
  /** Moves a body (waking it); false while physics is not loaded. */
  teleport(
    id: string,
    x: number,
    y: number,
    z: number,
    v?: [number, number, number],
  ): boolean;
  /** Viewport px of a point inside the object, or null. */
  pick(id: string): { x: number; y: number } | null;
  hovered(): string | null;
  /** Hover lift of the model root, metres. */
  hoverLift(id: string): number;
  /** The scroll springs: shift (m) and speed per object that has one. */
  motion(): { id: string; x: number; v: number }[];
  /** One entry per leader line and label (DOM `role=tooltip`), with the line's opacity. */
  callouts(): {
    id: string;
    text: string;
    active: boolean;
    lineOpacity: number;
  }[];
  /** `null` while sound is off or no press has armed it; else the context state and clips started. */
  audio(): { state: string; played: { clip: string; gain: number }[] } | null;
  /** `renderer.info.memory` of the live canvas, or null. */
  memory(): { geometries: number; textures: number } | null;
  /** Forces a WebGL context loss / restore through WEBGL_lose_context. */
  loseContext(): void;
  restoreContext(): void;
  contextLost(): boolean;
  /** Idle timers (OLED, clocks, calendar) stop requesting frames while on. */
  quiet(on: boolean): void;
}

interface DeskHooks {
  scene?: DeskSceneHooks;
  /** Triggers one failure path on purpose; the resulting error is marked intentional. */
  fail(kind: DeskFailKind): void;
  /** 'poster' (default), 'live' (Scene mounted) or 'failed'. */
  state(): string;
  /** What the renderer still held after the last Scene unmount freed everything; null before one. */
  disposed(): { geometries: number; textures: number } | null;
}

interface TestHooks {
  ready: boolean;
  longTasks: number[];
  errors: ErrorRecord[];
  desk?: DeskHooks;
  garden?: GardenHooks;
}

interface GardenHooks {
  balls(): {
    x: number;
    y: number;
    held: boolean;
    grabbed: boolean;
    speed: number;
    /** Dogs go for it. */
    fetch: boolean;
    claimed: boolean;
    /** Being removed (a fifth ball pushes out the oldest). */
    fading: boolean;
  }[];
  /** Garden clock, seconds of stepped frames (not wall time). */
  time(): number;
  flowers(): { x: number; y: number }[];
  bucket(): { x: number; y: number; count: number };
  paper(): { x: number; y: number; t: number } | null;
  bouquets(): { mode: string; wrap: number; x: number; y: number }[];
  vase(): { x: number; y: number; full: boolean; gone: boolean };
  /** Bouquets and the vase dropped to the bottom of the screen. */
  rested(): {
    kind: 'bq' | 'vase';
    falling: boolean;
    full: boolean;
    /** Bounding box on screen, and the untilted box's top left. */
    x: number;
    y: number;
    width: number;
    height: number;
    left: number;
    top: number;
  }[];
  carrying(): 'bq' | 'vase' | null;
  dogs(): {
    x: number;
    y: number;
    f: number;
    size: number;
    state: string;
    mouth: [number, number];
    ball: { x: number; y: number; held: boolean } | null;
  }[];
}

interface Window {
  __hooks?: TestHooks;
}

declare module '*.glb?url&no-inline' {
  const url: string;
  export default url;
}
