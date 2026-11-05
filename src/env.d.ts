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
