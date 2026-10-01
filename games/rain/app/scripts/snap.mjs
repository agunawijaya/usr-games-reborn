#!/usr/bin/env node
// Snapshot one or more pages with Playwright (Chromium, GPU where available).
//   node scripts/snap.mjs <out-dir> "<name>=<path?query>" ["<name>=<path>" ...]
// Waits for window.__ready, then an extra settle time (?settle=ms, default 1500).
// With &ui in the path, the mouse is moved first so the idle-faded
// controls are showing; &help also opens the help panel.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const [outDir, ...jobs] = process.argv.slice(2);
if (!outDir || !jobs.length) {
  console.error('usage: node scripts/snap.mjs <out-dir> name=path ...');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const port = 8800 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const W = +(process.env.W || 1600);
const H = +(process.env.H || 900);
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || process.env.VERBOSE) console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const job of jobs) {
  const i = job.indexOf('=');
  const name = job.slice(0, i);
  const path = job.slice(i + 1);
  const url = `http://localhost:${port}/${path}`;
  if (process.env.VERBOSE) console.log('job', JSON.stringify(path));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const settle = +(new URL(url).searchParams.get('settle') || 1500);
  await page.waitForTimeout(settle);
  if (/[?&]ui(&|$)/.test(path)) {
    await page.mouse.move(W / 2 + 40, H / 2 + 20);
    await page.mouse.move(W / 2, H / 2);
    if (/[?&]help(&|$)/.test(path)) await page.keyboard.press('?');
    await page.waitForTimeout(1400);
    if (process.env.VERBOSE) console.log(await page.evaluate(() => [document.body.className, document.getElementById('help').hidden]));
  }
  const info = await page.evaluate(() => window.__info || null);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`${name}.png`, info ? JSON.stringify(info) : '');
}
await browser.close();
server.close();
