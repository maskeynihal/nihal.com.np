/**
 * E-11 spike: what does the physics engine cost on the wire and at init?
 * Builds a tiny entry with Vite (variant `inline`: rapier3d-compat as shipped, wasm as base64 in the
 * JS chunk, which is what `@react-three/rapier` loads; variant `wasm`: the same package with the base64
 * literal moved out into a real .wasm file, a stand-in for the `@dimforge/rapier3d` route, which is not
 * installed), measures gzip and brotli sizes, then times `init()` + one world step in Chromium on
 * desktop and with 4x CPU throttling (CDP).
 * Usage: `pnpm exec tsx scripts/spike/rapier-spike.ts`. Spike code, not shipped.
 */
import { createServer } from 'node:http';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WORK = resolve(ROOT, 'node_modules/.cache/rapier-spike');
const req = createRequire(import.meta.url);
const rapierDir = dirname(
  createRequire(req.resolve('@react-three/rapier')).resolve(
    '@dimforge/rapier3d-compat',
  ),
);
const astroReq = createRequire(req.resolve('astro/package.json'));
const vite = (await import(astroReq.resolve('vite'))) as {
  build: (c: unknown) => Promise<unknown>;
};

const ENTRY = `
const t0 = performance.now();
const R = (await import('@dimforge/rapier3d-compat')).default;
const t1 = performance.now();
await R.init();
const t2 = performance.now();
const world = new R.World({ x: 0, y: -9.81, z: 0 });
world.createCollider(R.ColliderDesc.cuboid(2, 0.1, 2));
const bodies = [];
for (let i = 0; i < 7; i++) {
  const b = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, 1 + i * 0.3, 0));
  world.createCollider(R.ColliderDesc.cuboid(0.1, 0.05, 0.1), b);
  bodies.push(b);
}
for (let i = 0; i < 120; i++) world.step();
const t3 = performance.now();
window.__result = { import: t1 - t0, init: t2 - t1, step: t3 - t2, total: t3 - t0, y: bodies[0].translation().y };
`;

/** Move the base64 wasm literal out of the JS and into a real file fetched at init. */
const wasmOut = {
  name: 'wasm-out',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.endsWith('rapier.mjs')) return null;
    const m = code.match(/lg\.toByteArray\("([A-Za-z0-9+/=]+)"\)\.buffer/);
    if (!m) throw new Error('base64 literal not found');
    writeFileSync(
      join(WORK, 'public-wasm', 'rapier.wasm'),
      Buffer.from(m[1]!, 'base64'),
    );
    return {
      code: code.replace(
        m[0],
        '(yield fetch("./rapier.wasm").then((r) => r.arrayBuffer()))',
      ),
      map: null,
    };
  },
};

async function buildVariant(name: 'inline' | 'wasm') {
  const dir = join(WORK, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(WORK, 'public-wasm'), { recursive: true });
  const entry = join(WORK, `entry-${name}.ts`);
  writeFileSync(entry, ENTRY);
  writeFileSync(
    join(WORK, `index-${name}.html`),
    `<!doctype html><script type="module" src="./entry-${name}.ts"></script>`,
  );
  await vite.build({
    root: WORK,
    logLevel: 'error',
    configFile: false,
    base: './',
    plugins: name === 'wasm' ? [wasmOut] : [],
    resolve: {
      alias: { '@dimforge/rapier3d-compat': join(rapierDir, 'rapier.mjs') },
    },
    build: {
      outDir: dir,
      emptyOutDir: true,
      target: 'es2022',
      minify: 'esbuild',
      rollupOptions: { input: join(WORK, `index-${name}.html`) },
    },
  });
  if (name === 'wasm')
    cpSync(join(WORK, 'public-wasm', 'rapier.wasm'), join(dir, 'rapier.wasm'));
  return dir;
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
function sizes(dir: string) {
  const out: { file: string; raw: number; gz: number; br: number }[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(js|wasm)$/.test(f)) {
        const buf = readFileSync(p);
        out.push({
          file: p.slice(dir.length + 1),
          raw: buf.length,
          gz: gzipSync(buf, { level: 9 }).length,
          br: brotliCompressSync(buf, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
          }).length,
        });
      }
    }
  };
  walk(dir);
  return out;
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
};
const dirs = {
  inline: await buildVariant('inline'),
  wasm: await buildVariant('wasm'),
};
const server = createServer((req2, res) => {
  const [, variant, ...rest] = new URL(
    req2.url ?? '/',
    'http://x',
  ).pathname.split('/');
  const base = dirs[variant as keyof typeof dirs];
  const rel = rest.join('/') || `index-${variant}.html`;
  const abs = base && join(base, rel);
  if (!abs || !existsSync(abs) || statSync(abs).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'content-type': MIME[extname(abs)] ?? 'application/octet-stream',
  });
  res.end(readFileSync(abs));
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;

interface Run {
  import: number;
  init: number;
  step: number;
  total: number;
  y: number;
}
const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const browser = await chromium.launch();
const results: Record<string, Record<string, Record<string, number>>> = {};
try {
  for (const variant of ['inline', 'wasm'] as const) {
    results[variant] = {};
    for (const throttle of [1, 4]) {
      const runs: Run[] = [];
      for (let i = 0; i < 7; i++) {
        // fresh context each run: cold HTTP cache and cold wasm compile cache
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
        if (throttle > 1)
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
        await page.goto(`http://127.0.0.1:${port}/${variant}/`);
        await page.waitForFunction('window.__result !== undefined', undefined, {
          timeout: 120_000,
        });
        runs.push((await page.evaluate('window.__result')) as Run);
        await ctx.close();
      }
      const key = throttle === 1 ? 'desktop' : 'cpu4x';
      results[variant]![key] = {
        import: median(runs.map((r) => r.import)),
        init: median(runs.map((r) => r.init)),
        step120: median(runs.map((r) => r.step)),
        total: median(runs.map((r) => r.total)),
      };
    }
  }
} finally {
  await browser.close();
  server.close();
}

for (const v of ['inline', 'wasm'] as const) {
  console.log(`\n== ${v}`);
  let tgz = 0;
  let tbr = 0;
  for (const s of sizes(dirs[v])) {
    console.log(
      `${s.file.padEnd(34)} raw ${kb(s.raw).padStart(10)}  gz ${kb(s.gz).padStart(9)}  br ${kb(s.br).padStart(9)}`,
    );
    tgz += s.gz;
    tbr += s.br;
  }
  console.log(
    `total (js + wasm)${''.padEnd(18)} gz ${kb(tgz).padStart(9)}  br ${kb(tbr).padStart(9)}`,
  );
  console.log('median of 7 cold runs (ms):', JSON.stringify(results[v]));
}
