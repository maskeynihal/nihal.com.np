/**
 * Brand rasters (D-05). Renders public/og.png (1200x630), favicon.svg, favicon-32.png,
 * apple-touch-icon.png, icon-192.png and icon-512.png from HTML/SVG templates in Playwright's
 * Chromium, using the project woff2 files, the poster (D-01) and the nib. Text comes from
 * src/content. `pnpm og` rewrites the files; run `pnpm assets` first if the poster changed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { copy } from '../../src/content/copy';
import { site } from '../../src/content/site';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = resolve(ROOT, 'public');
const BLUE = site.themeColor;
const BLUE_INK = '#0a1c6b';
const PAPER = '#f6f5f1';

const font = (file: string) =>
  readFileSync(resolve(PUBLIC, 'fonts', file)).toString('base64');
const FONTS = `
@font-face{font-family:'Fraunces';font-weight:400 700;src:url(data:font/woff2;base64,${font('fraunces-25ffec13.woff2')}) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:400 600;src:url(data:font/woff2;base64,${font('jetbrains-mono-52175104.woff2')}) format('woff2')}`;

const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8').trim();
const inner = (svg: string) =>
  svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

/** Square brand icon: white nib on blue, 32-unit grid. */
export function iconSvg(): string {
  const nib = read('src/assets/nib.svg');
  // nib.svg is white-on-transparent in a 32 grid; draw it slightly inset on a blue square
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" fill="${BLUE}"/>` +
    `<g transform="translate(3.2 3.2) scale(.8)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner(
      nib,
    ).replace(/<g[^>]*>/g, '')}</g></svg>`
  );
}

function ogHtml(): string {
  const poster = read('src/assets/poster.svg');
  return `<!doctype html><meta charset="utf-8"><style>${FONTS}
html,body{margin:0;width:1200px;height:630px;background:${BLUE};overflow:hidden}
.poster{position:absolute;left:0;top:-150px;width:1200px;height:800px}
.poster svg{width:100%;height:100%}
.poster path{stroke-width:2.5px}
.poster path:first-child{stroke-width:1.5px}
.block{position:absolute;left:56px;bottom:48px;width:560px;box-sizing:border-box;padding:28px 32px 26px;background:${PAPER};color:${BLUE_INK};border-radius:6px}
h1{margin:0;font:600 76px/1 'Fraunces',Georgia,serif;letter-spacing:-.01em}
.role{margin:14px 0 0;font:400 26px/1.2 'Fraunces',Georgia,serif}
.rev{margin:22px 0 0;padding-top:14px;border-top:1px solid rgba(10,28,107,.25);font:400 18px/1 'JetBrains Mono',ui-monospace,monospace}
</style>
<div class="poster">${poster}</div>
<div class="block"><h1>${copy.titleBlock.name}</h1><p class="role">${copy.meta.ogAlt.replace(/^nihal maskey, /, '')}</p><p class="rev">rev 2026.11 · sheet 1 of 1 · scale 1:1</p></div>`;
}

async function main() {
  writeFileSync(resolve(PUBLIC, 'favicon.svg'), `${iconSvg()}\n`);
  const browser = await chromium.launch();
  try {
    const shot = async (html: string, w: number, h: number, file: string) => {
      const page = await browser.newPage({
        viewport: { width: w, height: h },
        deviceScaleFactor: 1,
      });
      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: resolve(PUBLIC, file),
        clip: { x: 0, y: 0, width: w, height: h },
      });
      await page.close();
    };
    await shot(ogHtml(), 1200, 630, 'og.png');
    const icon = iconSvg().replace('<svg ', '<svg width="100%" height="100%" ');
    for (const [size, file] of [
      [32, 'favicon-32.png'],
      [180, 'apple-touch-icon.png'],
      [192, 'icon-192.png'],
      [512, 'icon-512.png'],
    ] as const) {
      await shot(
        `<!doctype html><style>html,body{margin:0;width:${size}px;height:${size}px}</style>${icon}`,
        size,
        size,
        file,
      );
    }
  } finally {
    await browser.close();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
