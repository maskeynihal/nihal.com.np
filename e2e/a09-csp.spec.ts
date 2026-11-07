import { readFileSync } from 'node:fs';
import { test, expect, expectNoAxeViolations } from './fixtures';
import {
  buildVercelConfig,
  collectHashes,
} from '../scripts/write-vercel-json.ts';

// Served by e2e/header-server.ts with the production headers.
test.use({
  baseURL: `http://localhost:${process.env['E2E_HEADER_PORT'] ?? '4391'}`,
});

const violations = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __csp: string[] }).__csp.slice());

test.beforeEach(async ({ page, javaScriptEnabled }) => {
  if (!javaScriptEnabled) return;
  await page.addInitScript(() => {
    const list: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = list;
    document.addEventListener('securitypolicyviolation', (e) => {
      list.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
});

test.describe('CSP and headers @A-09', () => {
  test('response carries the section 9 headers @A-09', async ({ request }) => {
    const res = await request.get('/');
    const h = res.headers();
    const csp = h['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval' 'sha256-");
    expect(csp).toContain('https://va.vercel-scripts.com');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  test('written .astro/vercel.e2e.json matches the dist it was built with @A-09', () => {
    const written: unknown = JSON.parse(
      readFileSync(
        new URL('../.astro/vercel.e2e.json', import.meta.url),
        'utf8',
      ),
    );
    expect(written).toEqual(
      buildVercelConfig(
        collectHashes(new URL('../dist', import.meta.url).pathname),
      ),
    );
  });

  for (const path of ['/', '/sent/', '/404.html'])
    test(`${path} loads with zero CSP violations @A-09`, async ({
      page,
      javaScriptEnabled,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('load');
      if (javaScriptEnabled) {
        await page.locator('html[data-motion]').waitFor();
        expect(await violations(page)).toEqual([]);
      }
      await expectNoAxeViolations(page, { label: `${path} under CSP` });
    });

  test('hook builds never load analytics @A-09', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    const asked: string[] = [];
    page.on('request', (r) => {
      if (/insights|va\.vercel-scripts/.test(r.url())) asked.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    expect(asked).toEqual([]);
    expect(await violations(page)).toEqual([]);
  });

  test('later-ticket origins and capabilities are allowed @A-09', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.route('https://formspree.io/**', (r) =>
      r.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*' },
        body: '{}',
      }),
    );
    await page.route('https://maskeynihal.github.io/**', (r) =>
      r.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>game</title>',
      }),
    );
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const out: Record<string, string> = {};
      const r = await fetch('https://formspree.io/f/test', { method: 'POST' });
      out['form'] = String(r.status);
      const frame = document.createElement('iframe');
      frame.title = 'game';
      frame.src = 'https://maskeynihal.github.io/pac-man/';
      await new Promise<void>((done) => {
        frame.onload = () => done();
        document.body.append(frame);
      });
      out['frame'] = 'loaded';
      const url = URL.createObjectURL(
        new Blob(['postMessage(1)'], { type: 'text/javascript' }),
      );
      const w = new Worker(url);
      out['worker'] = String(
        await new Promise((res) => {
          w.onmessage = (e) => res(e.data);
        }),
      );
      w.terminate();
      // Smallest valid module: magic + version. Needs wasm-unsafe-eval.
      await WebAssembly.compile(
        new Uint8Array([0, 0x61, 0x73, 0x6d, 1, 0, 0, 0]),
      );
      out['wasm'] = 'compiled';
      return out;
    });
    expect(result).toEqual({
      form: '200',
      frame: 'loaded',
      worker: '1',
      wasm: 'compiled',
    });
    expect(await violations(page)).toEqual([]);
  });

  test('the policy is enforced: foreign origins and unhashed inline are blocked @A-09', async ({
    browser,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    // A separate context: the blocked requests log console errors on purpose, so the
    // auto console guard on the default page must not see them.
    const context = await browser.newContext({
      baseURL: `http://localhost:${process.env['E2E_HEADER_PORT'] ?? '4391'}`,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const list: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = list;
      document.addEventListener('securitypolicyviolation', (e) => {
        list.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.route('https://example.com/**', (r) =>
      r.fulfill({ status: 200, body: 'x' }),
    );
    await page.goto('/');
    await page.evaluate(async () => {
      await fetch('https://example.com/x').catch(() => undefined);
      const s = document.createElement('script');
      s.textContent = 'window.__ran = true';
      document.head.append(s);
    });
    // Violation events are queued tasks; wait for both before reading.
    await expect
      .poll(async () => (await violations(page)).length)
      .toBeGreaterThanOrEqual(2);
    const v = await violations(page);
    expect(
      v.some((x) => x.startsWith('connect-src') && x.includes('example.com')),
    ).toBe(true);
    expect(
      v.some((x) => x.startsWith('script-src') && x.includes('inline')),
    ).toBe(true);
    expect(await page.evaluate(() => '__ran' in window)).toBe(false);
    await context.close();
  });
});
