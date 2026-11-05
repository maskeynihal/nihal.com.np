import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

const png = (file: string) => {
  const b = readFileSync(`public/${file}`);
  expect(b.subarray(1, 4).toString(), file).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

test('raster sizes @D-05', () => {
  expect(png('og.png')).toEqual({ w: 1200, h: 630 });
  expect(png('favicon-32.png')).toEqual({ w: 32, h: 32 });
  expect(png('apple-touch-icon.png')).toEqual({ w: 180, h: 180 });
  expect(png('icon-192.png')).toEqual({ w: 192, h: 192 });
  expect(png('icon-512.png')).toEqual({ w: 512, h: 512 });
});

test('manifest is valid and every icon is served @D-05', async ({
  request,
}) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m.name).toBe('nihal maskey');
  expect(m.theme_color).toBe('#1F3FE0');
  expect(m.start_url).toBe('/');
  expect(m.icons.length).toBeGreaterThanOrEqual(2);
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  for (const icon of m.icons as { src: string; type: string }[]) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()['content-type'], icon.src).toContain(icon.type);
  }
});

test('og image and favicons are served with image types @D-05', async ({
  request,
}) => {
  for (const [path, type] of [
    ['/og.png', 'image/png'],
    ['/favicon-32.png', 'image/png'],
    ['/apple-touch-icon.png', 'image/png'],
    ['/favicon.svg', 'image/svg+xml'],
  ] as const) {
    const r = await request.get(path);
    expect(r.status(), path).toBe(200);
    expect(r.headers()['content-type'], path).toContain(type);
  }
});
