/**
 * PLACEHOLDER brand assets (A-06). D-05 replaces og.png and the icons with final art.
 * `pnpm tsx scripts/make-placeholders.ts` rewrites public/{favicon.svg,favicon-32.png,
 * apple-touch-icon.png,icon-192.png,icon-512.png,og.png}.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const BLUE = '#1F3FE0';
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${BLUE}"/><path d="M9 24 L21 8" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M21 8 L24 11" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none"/></svg>`;
writeFileSync('public/favicon.svg', `${icon}\n`);

const png = (size: number, file: string) =>
  sharp(Buffer.from(icon), { density: (72 * size) / 32 })
    .resize(size, size)
    .png()
    .toFile(`public/${file}`);

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${BLUE}"/><text x="80" y="360" font-family="Georgia, serif" font-size="120" font-weight="700" fill="#fff">nihal maskey</text><text x="84" y="430" font-family="Menlo, monospace" font-size="32" fill="#fff" fill-opacity="0.8">lead engineer, kathmandu</text></svg>`;

await Promise.all([
  png(32, 'favicon-32.png'),
  png(180, 'apple-touch-icon.png'),
  png(192, 'icon-192.png'),
  png(512, 'icon-512.png'),
  sharp(Buffer.from(og)).resize(1200, 630).png().toFile('public/og.png'),
]);
