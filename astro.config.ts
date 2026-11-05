import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { validateAll } from './src/content/validate';

/** Fails every build and dev start on invalid content, whatever the pages import. */
const validateContent: AstroIntegration = {
  name: 'validate-content',
  hooks: {
    'astro:config:setup': () => {
      validateAll();
    },
  },
};

export default defineConfig({
  output: 'static',
  site: 'https://nihal.com.np',
  integrations: [
    validateContent,
    react(),
    // /sent and /404 are noindex pages; keep them out of the sitemap.
    sitemap({
      filter: (page) => !/\/(sent|404)\/?$/.test(new URL(page).pathname),
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
