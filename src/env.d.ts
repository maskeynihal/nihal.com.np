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
