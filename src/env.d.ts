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

interface DeskHooks {
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
