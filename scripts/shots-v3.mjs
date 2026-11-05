import { chromium } from '@playwright/test';
const out = 'docs/reviews/v3-final';
const base = 'http://localhost:4411/';
const args = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
const b = await chromium.launch({ channel: 'chromium', args });
async function page(vw, theme, js = true, mobile = false) {
  const ctx = await b.newContext({
    viewport: vw,
    deviceScaleFactor: 1,
    javaScriptEnabled: js,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: theme === 'paper' ? 'light' : 'dark',
  });
  const p = await ctx.newPage();
  await p.addInitScript((t) => {
    try {
      localStorage.setItem('nihal:theme', t);
      localStorage.setItem('theme', t);
    } catch {}
  }, theme);
  return p;
}
const D = { width: 1440, height: 900 },
  M = { width: 390, height: 844 };
for (const theme of ['blue', 'paper']) {
  let p = await page(D, theme);
  await p.goto(base);
  await p.waitForTimeout(3500);
  console.log(
    theme,
    await p.evaluate(() => document.documentElement.dataset.theme),
  );
  await p.screenshot({ path: `${out}/desktop-${theme}.png` });
  if (theme === 'blue') {
    // throw two objects off
    const info = await p.evaluate(() =>
      document.querySelector('[data-poster]').getBoundingClientRect().toJSON(),
    );
    console.log(JSON.stringify(info));
    p.__ = 1;
  }
  await p.context().close();
  p = await page(M, theme, true, true);
  await p.goto(base);
  await p.waitForTimeout(3500);
  await p.screenshot({ path: `${out}/phone-${theme}.png` });
  await p.context().close();
  p = await page(D, theme);
  await p.goto(base);
  await p.waitForTimeout(500);
  await p.evaluate(() =>
    document.querySelector('[aria-label="garden"]').scrollIntoView(),
  );
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/garden-${theme}.png` });
  await p.context().close();
}
let p = await page(D, 'blue', false);
await p.goto(base);
await p.screenshot({ path: `${out}/desktop-nojs-full.png`, fullPage: true });
await b.close();
