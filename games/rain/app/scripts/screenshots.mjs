#!/usr/bin/env node
// Regenerate the screenshots in media/ (documentation only — ADR-002: none
// of them is used by the program).
//   node scripts/screenshots.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'media');
mkdirSync(out, { recursive: true });
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
const CPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];

// name, query, { settle ms, ui: show controls, help, size, args, reduced }
const SHOTS = [
  ['01-pond', '?d=40', { settle: 7000 }],
  ['02-drizzle', '?d=400', { settle: 7000 }],
  ['03-downpour', '?d=3', { settle: 6000 }],
  ['04-split', '?view=split&d=90', { settle: 6000, ui: true }],
  ['05-classic', '?view=classic', { settle: 5000 }],
  ['06-controls', '?d=120', { settle: 5000, ui: true, help: true }],
  ['07-no-gpu-lite', '?d=40', { settle: 7000, args: CPU }],
  ['08-no-webgl', '?nogl', { settle: 3000, ui: true, args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'] }],
  ['09-phone-split', '?view=split&d=60', { settle: 6000, ui: true, size: [390, 844] }],
];

const port = 8500 + Math.floor(Math.random() * 90);
const server = await startServer(port);
for (const [name, query, o] of SHOTS) {
  const browser = await chromium.launch({ args: o.args || GPU });
  const [w, h] = o.size || [1600, 900];
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    deviceScaleFactor: o.size ? 2 : 1,
    reducedMotion: o.reduced ? 'reduce' : 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/index.html${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(o.settle);
  if (o.ui) {
    await page.mouse.move(w / 2 + 30, h / 2 + 10);
    await page.mouse.move(w / 2, h / 2);
    if (o.help) await page.keyboard.press('?');
    await page.waitForTimeout(1400);
  }
  await page.screenshot({ path: join(out, `${name}.png`) });
  const info = await page.evaluate(() => window.__info);
  console.log(`${name}.png`, info.profile || info.fallback, info.view, errors.length ? errors : '');
  await browser.close();
}
server.close();
