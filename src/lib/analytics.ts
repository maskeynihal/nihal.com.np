import { inject } from '@vercel/analytics';
import { site } from '../content/site';
import { testHooks } from './env';

/** The only host where `/_vercel/insights/script.js` exists (Vercel serves it). Elsewhere (local
 * previews, Lighthouse CI, other static hosts) the script 404s and logs a console error. */
const productionHost = new URL(site.url).hostname;

/**
 * Vercel Web Analytics (cookieless). Production builds only: dev and the PUBLIC_TEST_HOOKS
 * e2e builds never load it, and Do Not Track visitors are not counted. `inject()` adds
 * `/_vercel/insights/script.js` (same origin, covered by script-src 'self'). It only runs when
 * `location.hostname` is the production host from `content/site.ts`.
 */
if (
  !testHooks &&
  import.meta.env.PROD &&
  typeof location !== 'undefined' &&
  location.hostname === productionHost &&
  typeof navigator !== 'undefined' &&
  navigator.doNotTrack !== '1'
)
  inject();
