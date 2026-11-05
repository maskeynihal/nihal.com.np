import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import react from '@astrojs/react';
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
  integrations: [validateContent, react()],
  vite: { plugins: [tailwindcss()] },
});
