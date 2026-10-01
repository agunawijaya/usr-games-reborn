// Regenerates the port screenshots in media/ (documentation only; the
// runtime contains no raster assets, see docs/decisions/002).
//
// Usage:  npm install && npm run shots
// Needs a GPU-backed Chromium (Playwright). Uses ANGLE/D3D11 on Windows.
// Worlds use the default seed 1 and ?warm= steps, so the worm layout is
// reproducible for a given viewport.

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = resolve(ROOT, 'media');
const PORT = 5398;
const BASE = `http://localhost:${PORT}/`;
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const q = (args, extra = '') => `args=${encodeURIComponent(args)}${extra}`;

const SHOTS = [
  { file: '01-abyss-eight-species.png', q: q('-n 8 -l 28 -d 35', '&cell=22&warm=260'), wait: 3000 },
  { file: '02-luminous-trails.png', q: q('-t -n 6 -l 20 -d 30'), wait: 10000 },
  { file: '03-worm-field.png', q: q('-f -n 6 -l 24 -d 35', '&warm=220'), wait: 3000 },
  { file: '04-split-view.png', q: q('-f -n 6 -l 24 -d 35', '&view=split&warm=180'), wait: 2500, wake: true },
  { file: '05-classic-terminal.png', q: q('-f -t -n 8 -l 16 -d 35', '&view=classic&warm=240'), wait: 1500 },
  { file: '06-settings.png', q: q('-t -n 6 -l 24 -d 40'), wait: 6000, settings: true },
  { file: '07-emergence.png', q: q('-n 8 -l 28 -d 90', '&cell=24&warm=10'), wait: 1200 },
  { file: '08-no-gpu-lite.png', q: q('-f -n 10 -l 12 -d 40', '&warm=160'), wait: 3000, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] },
  { file: '09-no-webgl-classic.png', q: q('-f -n 8 -l 16 -d 40', '&warm=160'), wait: 1500, args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'], wake: true },
];

const server = spawn(process.execPath, [resolve(ROOT, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
await mkdir(MEDIA, { recursive: true });

const browsers = new Map();
const browserFor = async (args) => {
  const key = args.join(' ');
  if (!browsers.has(key)) browsers.set(key, await chromium.launch({ args }));
  return browsers.get(key);
};
try {
  for (const s of SHOTS) {
    const browser = await browserFor(s.args ?? GPU);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('pageerror:', e.message));
    await page.goto(`${BASE}?${s.q}`);
    await page.waitForFunction(() => window.__abyss?.ready, null, { timeout: 90000 });
    await page.waitForTimeout(s.wait);
    if (s.wake || s.settings) {
      await page.mouse.move(700, 450);
      await page.mouse.move(720, 470);
    }
    if (s.settings) await page.click('#btn-settings');
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(MEDIA, s.file) });
    console.log('captured', s.file);
    await context.close();
  }
} finally {
  for (const b of browsers.values()) await b.close();
  server.kill();
}
