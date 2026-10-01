#!/usr/bin/env node
// Plays into the first dogfight and screenshots the cockpit.
//   node scripts/dogfight-shot.mjs <out-dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const port = 8900 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const gpu = process.env.GPU || 'gpu';
const args = gpu === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 760) } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 400)); });
await page.goto(`http://localhost:${port}/index.html?fresh=1&seed=${process.env.SEED || 7}`);
await page.waitForFunction(() => window.__ready === true);
await page.waitForTimeout(1500);
const cmds = ['right', 'right', 'take amulet', 'back', 'ahead', 'take laser', 'back', 'left', 'take knife', 'back', 'left', 'down', 'right', 'ahead', 'right', 'right', 'launch', 'right', 'ahead'];
for (const c of cmds) { await page.evaluate((c) => window.__bs.send(c), c); await page.waitForTimeout(120); }
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, 'cruise.png') });
await page.evaluate(() => window.__bs.send('ahead'));
await page.waitForTimeout(2500);
await page.keyboard.press('+');
await page.waitForTimeout(2600);
await page.screenshot({ path: join(out, 'dogfight.png') });
await page.keyboard.press('f');
await page.waitForTimeout(250);
await page.screenshot({ path: join(out, 'dogfight-fire.png') });
await page.keyboard.press('q');
await page.waitForTimeout(700);
await page.screenshot({ path: join(out, 'dogfight-quit.png') });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(out, 'after.png') });
await browser.close();
server.close();
