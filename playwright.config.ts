import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: [
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ],
        },
      },
    },
    { name: 'mobile-android', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        reducedMotion: 'reduce',
      },
    },
    {
      name: 'no-webgl',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: { args: ['--disable-webgl', '--disable-webgl2'] },
      },
    },
    {
      name: 'no-js',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        javaScriptEnabled: false,
      },
    },
  ],
  // Serves whatever is in dist/. Run via `pnpm review` (it builds the e2e dist
  // with test hooks first); running `playwright test` directly is unsupported.
  webServer: [
    {
      command: 'pnpm preview --port 4321 --ignore-lock',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
    // Same dist with the production response headers (CSP) applied; used by @A-09 specs.
    {
      command: 'pnpm exec tsx e2e/header-server.ts',
      url: 'http://localhost:4391',
      reuseExistingServer: !process.env['CI'],
      timeout: 60_000,
    },
  ],
});
