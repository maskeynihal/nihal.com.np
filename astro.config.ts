import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import type { AstroIntegration, ViteUserConfig } from 'astro';
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

/**
 * Skips the preload list of a lazy import whose only static dependency is the React core chunk.
 *
 * The lazy Scene import carries a Vite preload list. While Scene's only dependency is React
 * (the island renderer and Desk loaded it long before), the extra `<link rel="modulepreload">`
 * is never "used" and WebKit warns "preloaded but not used" (a13 and a10 specs). Vite 8's
 * `build.modulePreload` options do not reach the list, so the placeholder it leaves in the chunk
 * is replaced with `undefined` here. An import with other dependencies keeps its list.
 */
type AnyVitePlugin = NonNullable<ViteUserConfig['plugins']>[number];

/** The slice of a rolldown bundle entry this plugin reads and writes. */
interface BundleEntry {
  type: string;
  code: string;
  imports: string[];
}

const noReactOnlyPreload = () => ({
  name: 'no-react-only-preload',
  enforce: 'post' as const,
  generateBundle(_options: unknown, output: unknown) {
    const bundle = output as unknown as Record<string, BundleEntry>;
    const reactCore = (file: string) => /(^|\/)react-core\./.test(file);
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk' || !chunk.code.includes('__VITE_PRELOAD__'))
        continue;
      chunk.code = chunk.code.replace(
        /import\(`\.\/([^`]+)`\),__VITE_PRELOAD__/g,
        (all: string, target: string) => {
          const dep = bundle[`_astro/${target}`] ?? bundle[target];
          const imports = dep?.type === 'chunk' ? dep.imports : undefined;
          return imports?.length && imports.every(reactCore)
            ? `import(\`./${target}\`),void 0`
            : all;
        },
      );
    }
  },
});

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
  vite: {
    plugins: [tailwindcss(), noReactOnlyPreload() as AnyVitePlugin],
    build: {
      rolldownOptions: {
        output: {
          // React core in one shared chunk (island renderer, ContactForm, Desk and the lazy
          // Scene all need it). Left to the default split, ContactForm (B-06b) made react and
          // its runtime three shared chunks that Scene's import preloaded after they were
          // already loaded, so WebKit warned "preloaded but not used" (a13/a10 specs).
          codeSplitting: {
            groups: [
              {
                name: 'react-core',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              },
            ],
          },
        },
      },
    },
  },
});
