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
  /** Asks for the physics chunk as a first grab would. */
  requestPhysics(): void;
  /** Moves a body (waking it); false while physics is not loaded. */
  teleport(id: string, x: number, y: number, z: number): boolean;
  /** Canvas CSS px of a point inside the object, or null. */
  pick(id: string): { x: number; y: number } | null;
  hovered(): string | null;
  /** Hover lift of the model root, metres. */
  hoverLift(id: string): number;
  /** Idle timers (OLED, clocks, calendar) stop requesting frames while on. */
  quiet(on: boolean): void;
}

interface DeskHooks {
  scene?: DeskSceneHooks;
  /** Triggers one failure path on purpose; the resulting error is marked intentional. */
  fail(kind: DeskFailKind): void;
  /** 'poster' (default), 'live' (Scene mounted) or 'failed'. */
  state(): string;
}

interface TestHooks {
  ready: boolean;
  longTasks: number[];
  errors: ErrorRecord[];
  desk?: DeskHooks;
}

interface Window {
  __hooks?: TestHooks;
}

declare module '*.glb?url&no-inline' {
  const url: string;
  export default url;
}
