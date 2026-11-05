/** True only in `pnpm build:e2e` builds (PUBLIC_TEST_HOOKS=1). Direct compare so plain builds dead-code-eliminate hook code. */
export const testHooks: boolean = import.meta.env.PUBLIC_TEST_HOOKS === '1';
