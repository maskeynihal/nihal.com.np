import { inject } from '@vercel/analytics';
import { testHooks } from './env';

/**
 * Vercel Web Analytics (cookieless). Production builds only: dev and the PUBLIC_TEST_HOOKS
 * e2e builds never load it, and Do Not Track visitors are not counted. `inject()` adds
 * `/_vercel/insights/script.js` (same origin, covered by script-src 'self').
 */
if (
  !testHooks &&
  import.meta.env.PROD &&
  typeof navigator !== 'undefined' &&
  navigator.doNotTrack !== '1'
)
  inject();
