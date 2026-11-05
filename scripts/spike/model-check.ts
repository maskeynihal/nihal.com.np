/**
 * D-03 visual check: serves the GLBs with a tiny three.js page, renders each model from two
 * angles plus the hero scene and the SVG poster in Playwright's Chromium (SwiftShader).
 * Usage: `pnpm exec tsx scripts/spike/model-check.ts [outDir]`. Spike code, not shipped.
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { heroCamera } from '../../src/assets/camera';
import { objects } from '../../src/content/objects';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = resolve(ROOT, process.argv[2] ?? 'docs/reviews/D-03');
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  let file: string | null = null;
  if (p === '/') file = 'scripts/spike/model-viewer.html';
  else if (p.startsWith('/three/')) file = `node_modules/three/${p.slice(7)}`;
  else if (p.startsWith('/glb/')) file = `src/assets/models/${p.slice(5)}`;
  else if (p === '/poster.svg') file = 'src/assets/poster.svg';
  const abs = file && resolve(ROOT, file);
  if (!abs || !existsSync(abs)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(abs)] ?? 'text/plain' });
  res.end(readFileSync(abs));
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning')
      console.log('page:', m.text());
  });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(`${base}/?w=800&h=600`);
  await page.waitForFunction('window.ready === true');
  const views: [string, string, number, number, object?][] = [
    ['arduino', 'arduino-a', 35, 38],
    ['arduino', 'arduino-b', -150, 30],
    ['clock', 'clock-a', 20, 40, { poseClock: true }],
    ['clock', 'clock-b', 160, 25, { poseClock: true }],
    ['calendar', 'calendar-a', 25, 22],
    ['calendar', 'calendar-b', 150, 30],
    ['ghost', 'ghost-a', 20, 20],
    ['ghost', 'ghost-b', 160, 25],
    ['cruiser', 'cruiser-a', 35, 30],
    ['cruiser', 'cruiser-b', -140, 30],
  ];
  for (const [file, name, yaw, pitch, opts] of views) {
    await page.evaluate(
      ([f, y, p, o]) =>
        (
          window as never as {
            renderModel: (...a: unknown[]) => Promise<boolean>;
          }
        ).renderModel(f, y, p, o ?? {}),
      [file, yaw, pitch, opts] as const,
    );
    await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  }
  const hero = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  await hero.goto(`${base}/?w=1200&h=800`);
  await hero.waitForFunction('window.ready === true');
  await hero.evaluate(
    ([o, c]) =>
      (
        window as never as { renderHero: (...a: unknown[]) => Promise<boolean> }
      ).renderHero(o, c, false),
    [objects, heroCamera] as const,
  );
  await hero.screenshot({ path: resolve(OUT, 'hero-3d.png') });
  const poster = await browser.newPage({
    viewport: { width: 1200, height: 800 },
  });
  await poster.setContent(
    `<body style="margin:0;background:#1F3FE0">${readFileSync(resolve(ROOT, 'src/assets/poster.svg'), 'utf8').replace('<svg ', '<svg width="1200" height="800" ')}</body>`,
  );
  await poster.screenshot({ path: resolve(OUT, 'poster.png') });
} finally {
  await browser.close();
  server.close();
}
