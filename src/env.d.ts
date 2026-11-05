/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_TEST_HOOKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TestHooks {
  ready: boolean;
  longTasks: number[];
}

interface Window {
  __hooks?: TestHooks;
}
