import type { Page } from '@playwright/test';
import { test, expect, expectNoAxeViolations } from './fixtures';
import { copy } from '../src/content/copy';
import { site } from '../src/content/site';

const ENDPOINT = `https://formspree.io/f/${site.formspreeId}`;
const f = copy.contact.form;
const message = 'Hello Nihal, a question about the tz converter.';

const field = (page: Page, label: string) => page.getByLabel(label);

/** Scroll the form into view and wait for the island to hydrate (it turns native validation off). */
async function ready(page: Page) {
  await page.goto('/');
  await page.locator('.contact-form').scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page
        .locator('.contact-form')
        .evaluate((el) => (el as HTMLFormElement).noValidate),
    )
    .toBe(true);
}

async function fillValid(page: Page) {
  await field(page, f.name).fill('Test Person');
  await field(page, f.email).fill('test@example.com');
  await field(page, f.subject).fill('Hello');
  await field(page, f.message).fill(message);
}

test.describe('contact form @B-06b', () => {
  test('the served HTML is a working native form: action, method, honeypot, _next @B-06b', async ({
    page,
  }) => {
    const html = await (await page.request.get('/')).text();
    expect(html).toContain(`action="${ENDPOINT}"`);
    expect(html).toMatch(/method="POST"/i);
    expect(html).toContain('name="_gotcha"');
    expect(html).toContain(`name="_next" value="${site.url}/sent/"`);
    // Server-rendered island (client:visible), not client:only: the labels are in the HTML.
    expect(html).toMatch(/client="visible"/);
    expect(html).not.toMatch(/client="only"[^>]*ContactForm/);
    for (const label of [f.name, f.email, f.subject, f.message, f.send])
      expect(html.replaceAll('&#39;', "'")).toContain(label);
    await page.goto('/');
    await expect(page.locator('.contact-form')).toHaveAttribute(
      'action',
      ENDPOINT,
    );
    await expect(page.locator('input[name="_gotcha"]')).toBeHidden();
    await expectNoAxeViolations(page, { label: '/ contact form idle' });
  });

  test('no JS: the native form posts to Formspree with _next and the fields @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'no-js project only');
    let body = '';
    let method = '';
    await page.route(ENDPOINT, async (route) => {
      body = route.request().postData() ?? '';
      method = route.request().method();
      await route.fulfill({
        status: 303,
        headers: { location: new URL('/sent/', page.url()).href },
      });
    });
    await page.goto('/');
    await fillValid(page);
    await page.getByRole('button', { name: f.send }).click();
    await expect(page).toHaveURL(/\/sent\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      copy.sent.heading,
    );
    expect(method).toBe('POST');
    const params = new URLSearchParams(body);
    expect(params.get('email')).toBe('test@example.com');
    expect(params.get('message')).toBe(message);
    expect(params.get('_subject')).toBe('Hello');
    expect(params.get('_next')).toBe(`${site.url}/sent/`);
    expect(params.get('_gotcha')).toBe('');
  });

  test('no JS: the browser blocks an empty email and message natively @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, 'no-js project only');
    let posted = false;
    await page.route(ENDPOINT, (route) => {
      posted = true;
      return route.abort();
    });
    await page.goto('/');
    await page.getByRole('button', { name: f.send }).click();
    expect(posted).toBe(false);
  });

  test('mocked 200: fetch with Accept json, success message gets focus, form is replaced @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    let accept = '';
    let body = '';
    await page.route(ENDPOINT, async (route) => {
      accept = (await route.request().allHeaders())['accept'] ?? '';
      body = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"ok":true}',
      });
    });
    await ready(page);
    await fillValid(page);
    await page.getByRole('button', { name: f.send }).click();
    const ok = page.locator('.form-success');
    await expect(ok).toHaveText(copy.contact.success);
    await expect(ok).toBeFocused();
    await expect(page.locator('.contact-form')).toBeHidden();
    expect(accept).toContain('application/json');
    expect(body).toContain('test@example.com');
    expect(body).toContain('_gotcha');
    expect(page.url()).not.toContain('/sent');
    await expectNoAxeViolations(page, { label: '/ contact form sent' });
  });

  test('mocked 500: network copy with the address, nothing lost, can retry @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    let calls = 0;
    await page.route(ENDPOINT, (route) => {
      calls += 1;
      return calls === 1
        ? route.fulfill({ status: 500, body: 'no' })
        : route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{}',
          });
    });
    await ready(page);
    await fillValid(page);
    await page.getByRole('button', { name: f.send }).click();
    const status = page.locator('.form-status');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveText(copy.contact.errors.network);
    await expect(
      status.getByRole('link', { name: copy.titleBlock.email }),
    ).toHaveAttribute('href', `mailto:${copy.titleBlock.email}`);
    await expect(field(page, f.message)).toHaveValue(message);
    await expectNoAxeViolations(page, { label: '/ contact form failed' });
    await page.getByRole('button', { name: f.send }).click();
    await expect(page.locator('.form-success')).toBeVisible();
  });

  test('network failure shows the same copy @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.route(ENDPOINT, (route) => route.abort('failed'));
    await ready(page);
    await fillValid(page);
    await page.getByRole('button', { name: f.send }).click();
    await expect(page.locator('.form-status')).toHaveText(
      copy.contact.errors.network,
    );
  });

  test('inline validation: errors, aria wiring, focus on the first invalid field @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    let posted = false;
    await page.route(ENDPOINT, (route) => {
      posted = true;
      return route.abort();
    });
    await ready(page);
    const email = field(page, f.email);
    const msg = field(page, f.message);
    await page.getByRole('button', { name: f.send }).click();
    expect(posted).toBe(false);
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(msg).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#cf-email-error')).toHaveText(
      copy.contact.errors.email,
    );
    await expect(page.locator('#cf-message-error')).toHaveText(
      copy.contact.errors.message,
    );
    await expect(email).toHaveAttribute('aria-describedby', 'cf-email-error');
    await expect(page.locator('#cf-email-error')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await expectNoAxeViolations(page, { label: '/ contact form errors' });
    // Fixing a field clears its error as the visitor types.
    await email.fill('nope');
    await expect(page.locator('#cf-email-error')).toHaveText(
      copy.contact.errors.email,
    );
    await email.fill('a@b.co');
    await expect(page.locator('#cf-email-error')).toHaveText('');
    await expect(email).toHaveAttribute('aria-invalid', 'false');
    // Only the message is left: it takes focus on the next try.
    await page.getByRole('button', { name: f.send }).click();
    await expect(msg).toBeFocused();
    expect(posted).toBe(false);
  });

  test('keyboard only: Tab through the fields and press Enter on send @B-06b', async ({
    page,
    javaScriptEnabled,
    isMobile,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    test.skip(isMobile, 'keyboard path is a desktop concern');
    await page.route(ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await ready(page);
    await field(page, f.name).focus();
    await page.keyboard.type('Test Person');
    await page.keyboard.press('Tab');
    await page.keyboard.type('test@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Hello');
    await page.keyboard.press('Tab');
    await page.keyboard.type(message);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: f.send })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.form-success')).toBeFocused();
  });

  test('inputs are 44 px targets and 16 px text on a phone @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.setViewportSize({ width: 320, height: 700 });
    await ready(page);
    for (const l of [f.name, f.email, f.subject, f.message]) {
      const el = field(page, l);
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(el).toHaveCSS('font-size', '16px');
    }
    expect(
      (await page.getByRole('button', { name: f.send }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
});

test.describe('contact form under the production CSP @B-06b', () => {
  test.use({ baseURL: 'http://localhost:4391' });

  test('submit with a mocked response raises no CSP violation @B-06b', async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, 'needs JS');
    await page.addInitScript(() => {
      const list: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = list;
      document.addEventListener('securitypolicyviolation', (e) => {
        list.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await page.route(ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await ready(page);
    await fillValid(page);
    await page.getByRole('button', { name: f.send }).click();
    await expect(page.locator('.form-success')).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      ),
    ).toEqual([]);
  });
});
