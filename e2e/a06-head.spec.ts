import { test, expect, expectNoAxeViolations } from './fixtures';
import type { Page } from '@playwright/test';

const ORIGIN = 'https://nihal.com.np';
const TITLE = 'nihal maskey · lead engineer, kathmandu';

const meta = (page: Page, attr: 'name' | 'property', key: string) =>
  page.locator(`head meta[${attr}="${key}"]`).getAttribute('content');

test('title, description, canonical, robots, theme @A-06', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(TITLE);
  const description = await meta(page, 'name', 'description');
  expect(description?.length).toBeGreaterThan(40);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${ORIGIN}/`,
  );
  expect(await meta(page, 'name', 'robots')).toBe('index, follow');
  await expectNoAxeViolations(page, { label: '/ head' });
  expect(await meta(page, 'name', 'theme-color')).toBe('#1F3FE0');
  expect(await meta(page, 'name', 'color-scheme')).toBe('light');
  await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  );
  for (const sel of [
    'link[rel="icon"][type="image/svg+xml"]',
    'link[rel="icon"][sizes="32x32"]',
    'link[rel="apple-touch-icon"]',
  ])
    await expect(page.locator(`head ${sel}`)).toHaveCount(1);
});

test('open graph and twitter tags are absolute @A-06', async ({
  page,
  request,
}) => {
  await page.goto('/');
  const og = async (k: string) => meta(page, 'property', `og:${k}`);
  expect(await og('type')).toBe('website');
  expect(await og('url')).toBe(`${ORIGIN}/`);
  expect(await og('title')).toBe(TITLE);
  expect(await og('description')).toBe(await meta(page, 'name', 'description'));
  expect(await og('image')).toBe(`${ORIGIN}/og.png`);
  expect(await og('image:width')).toBe('1200');
  expect(await og('image:height')).toBe('630');
  expect((await og('image:alt'))?.length).toBeGreaterThan(0);
  expect(await meta(page, 'name', 'twitter:card')).toBe('summary_large_image');
  expect(await meta(page, 'name', 'twitter:image')).toBe(`${ORIGIN}/og.png`);

  // The absolute URL points at production; fetch the same path from the preview.
  const res = await request.get('/og.png');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/png');
  const buf = await res.body();
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(buf.readUInt32BE(16)).toBe(1200);
  expect(buf.readUInt32BE(20)).toBe(630);
});

test('JSON-LD Person parses with the expected fields @A-06', async ({
  page,
}) => {
  await page.goto('/');
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(blocks).toHaveLength(1);
  const ld = JSON.parse(blocks[0] ?? '');
  expect(ld).toMatchObject({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Nihal Maskey',
    url: ORIGIN,
    jobTitle: 'Lead Engineer',
    worksFor: { '@type': 'Organization', name: 'Leapfrog Technology' },
    address: { addressLocality: 'Kathmandu', addressCountry: 'NP' },
  });
  expect(ld.worksFor.url).toMatch(/^https:\/\//);
  expect(ld.sameAs).toEqual([
    'https://github.com/maskeynihal',
    'https://www.linkedin.com/in/maskeynihal',
    'https://x.com/nihalmaskey',
  ]);
  expect(blocks[0]).not.toMatch(/trayt/i);
});

test('an unknown path returns 404 with the sheet-not-found page @A-06', async ({
  request,
}) => {
  // Fetched without a browser navigation: a document 404 logs a console error by design.
  const res = await request.get('/no-such-page');
  expect(res.status()).toBe(404);
  const html = await res.text();
  expect(html).toContain('<h1 class="page-title">nothing here</h1>');
  expect(html).toContain('sheet not found');
  expect(html).toContain('name="robots" content="noindex, follow"');
});

test('404 page content, noindex and working link @A-06', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.locator('h1')).toHaveText('nothing here');
  await expect(page).toHaveTitle('nothing here · nihal maskey');
  expect(await meta(page, 'name', 'description')).toBe(
    'That page moved or never existed.',
  );
  await expect(page.getByText('sheet not found')).toBeVisible();
  await expect(
    page.getByText('That page moved or never existed.'),
  ).toBeVisible();
  expect(await meta(page, 'name', 'robots')).toBe('noindex, follow');
  await page.getByRole('link', { name: 'back to the desk' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('h1')).toHaveText('nihal maskey');
});

test('/sent/ is noindex @A-06', async ({ page }) => {
  await page.goto('/sent/');
  await expect(page.locator('h1')).toHaveText('sent');
  await expect(page).toHaveTitle('sent · nihal maskey');
  expect(await meta(page, 'name', 'description')).toBe(
    "Sent. I'll reply from contact@nihal.com.np.",
  );
  await expect(
    page.getByText("I'll reply from contact@nihal.com.np."),
  ).toBeVisible();
  expect(await meta(page, 'name', 'robots')).toContain('noindex');
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(0);
  await page.getByRole('link', { name: 'back to the desk' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('robots.txt, sitemap and manifest @A-06', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const rt = await robots.text();
  expect(rt).toContain('User-agent: *');
  expect(rt).toContain('Allow: /');
  expect(rt).toContain(`Sitemap: ${ORIGIN}/sitemap-index.xml`);

  const index = await request.get('/sitemap-index.xml');
  expect(index.status()).toBe(200);
  const sm = await request.get('/sitemap-0.xml');
  expect(sm.status()).toBe(200);
  const xml = await sm.text();
  expect(xml).toContain(`<loc>${ORIGIN}/</loc>`);
  expect(xml).not.toContain('/sent');
  expect(xml).not.toContain('/404');

  const mf = await request.get('/manifest.webmanifest');
  expect(mf.status()).toBe(200);
  const m = JSON.parse(await mf.text());
  expect(m).toMatchObject({
    name: 'nihal maskey',
    theme_color: '#1F3FE0',
    background_color: '#1F3FE0',
  });
  expect(m.icons.length).toBeGreaterThanOrEqual(2);
  for (const icon of m.icons as { src: string }[]) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
  }
  for (const path of [
    '/favicon.svg',
    '/favicon-32.png',
    '/apple-touch-icon.png',
  ])
    expect((await request.get(path)).status(), path).toBe(200);
});

test('skip link is the first Tab stop and moves focus to #work @A-06', async ({
  page,
  browserName,
  isMobile,
}) => {
  test.skip(
    browserName === 'webkit' && isMobile,
    'Tab order is checked on desktop engines',
  );
  await page.goto('/');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'skip the 3D desk' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#work')).toBeFocused();
  await expect(page).toHaveURL(/#work$/);
});
