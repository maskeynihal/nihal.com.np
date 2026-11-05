import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { validateAll } from './src/content/validate';
import { writeVercelJson } from './scripts/write-vercel-json';

/** Fails every build and dev start on invalid content, whatever the pages import. */
const validateContent: AstroIntegration = {
  name: 'validate-content',
  hooks: {
    'astro:config:setup': () => {
      validateAll();
    },
  },
};

/**
 * Postbuild: CSP hashes and headers (spec section 9). A normal build writes the committed
 * ./vercel.json. A test-hooks build (pnpm build:e2e) has different inline scripts, so it
 * writes .astro/vercel.e2e.json instead, which the e2e header server reads.
 */
const vercelHeaders: AstroIntegration = {
  name: 'vercel-headers',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const out =
        process.env['PUBLIC_TEST_HOOKS'] === '1'
          ? './.astro/vercel.e2e.json'
          : './vercel.json';
      writeVercelJson(fileURLToPath(dir), out);
    },
  },
};

export default defineConfig({
  output: 'static',
  site: 'https://nihal.com.np',
  integrations: [
    validateContent,
    vercelHeaders,
    react(),
    // /sent and /404 are noindex pages; keep them out of the sitemap.
    sitemap({
      filter: (page) => !/\/(sent|404)\/?$/.test(new URL(page).pathname),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
