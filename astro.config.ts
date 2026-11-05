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
 * Trims the preload list of every lazy import to the chunks that are not loaded yet.
 *
 * Vite gives each dynamic import (`Desk` -> `Scene`, `Scene` -> `physics-world`) a preload list
 * holding the target's whole static closure. Most of that closure (the React core, prefs, time,
 * the runtime) is already running when the import fires, so the `<link rel="modulepreload">`
 * elements for it are never "used" and WebKit warns "preloaded but not used" (a13 and a10
 * specs). Here the placeholder Vite leaves in the chunk is replaced with the closure minus
 * (a) everything statically reachable from a chunk nobody imports (the page's own scripts and
 * islands) and (b) the importing chunk's own closure. The heavy new chunk (`desk-vendor`) stays
 * in the list so it still loads in parallel with `Scene`; an empty list becomes `undefined`.
 * Vite 8's `build.modulePreload` options do not reach this list.
 */
type AnyVitePlugin = NonNullable<ViteUserConfig['plugins']>[number];

/** The slice of a rolldown bundle entry this plugin reads and writes. */
interface BundleEntry {
  type: string;
  fileName: string;
  code: string;
  imports: string[];
  dynamicImports: string[];
}

const trimLazyPreloads = () => ({
  name: 'trim-lazy-preloads',
  enforce: 'post' as const,
  generateBundle(_options: unknown, output: unknown) {
    const bundle = output as unknown as Record<string, BundleEntry>;
    const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
    const byName = new Map(chunks.map((c) => [c.fileName, c]));
    const closure = (starts: Iterable<string>): Set<string> => {
      const seen = new Set<string>();
      const walk = (name: string) => {
        if (seen.has(name) || !byName.has(name)) return;
        seen.add(name);
        for (const dep of byName.get(name)?.imports ?? []) walk(dep);
      };
      for (const s of starts) walk(s);
      return seen;
    };
    const imported = new Set(
      chunks.flatMap((c) => [...c.imports, ...c.dynamicImports]),
    );
    const roots = chunks.filter((c) => !imported.has(c.fileName));
    const early = closure(roots.map((c) => c.fileName));
    for (const host of chunks) {
      if (!/__VITE_PRELOAD__|__vite__mapDeps\(\[/.test(host.code)) continue;
      const loaded = new Set([...early, ...closure([host.fileName])]);
      host.code = host.code.replace(
        /import\(`\.\/([^`]+)`\)((?:\.then\([^)]*\))?),(?:__VITE_PRELOAD__|__vite__mapDeps\(\[[\d,]*\]\))/g,
        (all: string, target: string, then: string) => {
          const dep = [...byName.keys()].find(
            (n) => n === target || n.endsWith(`/${target}`),
          );
          if (!dep) return all;
          const list = [...closure([dep])].filter((n) => !loaded.has(n));
          return `import(\`./${target}\`)${then},${list.length ? JSON.stringify(list) : 'void 0'}`;
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
    plugins: [tailwindcss(), trimLazyPreloads() as AnyVitePlugin],
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
              // three and the R3F stack, loaded only with the lazy Scene (never in the initial
              // graph, check:graph enforces it). Physics (rapier) stays its own chunk.
              {
                name: 'desk-vendor',
                test: /node_modules[\\/](three|@react-three[\\/](fiber|drei)|three-stdlib|meshopt[^\\/]*|its-fine|zustand|react-reconciler|suspend-react|its-fine)[\\/]/,
              },
            ],
          },
        },
      },
    },
  },
});
