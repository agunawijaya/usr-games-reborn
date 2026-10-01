// Regenerates the port screenshots in media/ (documentation only; the
// runtime itself contains no raster assets, see docs/decisions/002).
//
// Usage:  npm install && npm run shots
// Needs a GPU-backed Chromium (Playwright). Uses ANGLE/D3D11 on Windows;
// on other platforms Chromium picks its default GL backend.
//
// All dates are passed in pom's own compressed format via ?date=, and the
// page is pinned to Asia/Jakarta so captions are reproducible.

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = resolve(ROOT, 'media');
const PORT = 5399;
const BASE = `http://localhost:${PORT}/`;

const SHOTS = [
  { file: '01-first-quarter.png', q: 'date=2026101900' },
  { file: '02-full-moon-lake.png', q: 'date=2026102612' },
  { file: '03-crescent-milky-way.png', q: 'date=2026111318' },
  { file: '04-calendar.png', q: 'date=2026101921&calendar=1' },
  { file: '05-terminator-closeup.png', q: 'date=2026101500&zoom=3.2&mx=0.3&my=0.55' },
  { file: '06-feature-tooltip.png', q: 'date=2026101921', hover: { lat: 17.0, lon: 59.1 } },
  { file: '07-high-contrast.png', q: 'date=2026101921&hc=1' },
  { file: '08-mobile.png', q: 'date=2026111318', viewport: { width: 390, height: 844 }, dpr: 2 },
  // no-GPU modes: a CPU rasteriser (lite profile) and WebGL switched off (text mode)
  { file: '09-no-gpu-lite.png', q: 'date=2026101921', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] },
  { file: '10-no-webgl-text-mode.png', q: 'date=2026101921', args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'], noGL: true },
];
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];

const server = spawn(process.execPath, [resolve(ROOT, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
await mkdir(MEDIA, { recursive: true });

const browsers = new Map();   // one browser per distinct set of flags
const browserFor = async (args) => {
  const key = args.join(' ');
  if (!browsers.has(key)) browsers.set(key, await chromium.launch({ args }));
  return browsers.get(key);
};
try {
  for (const s of SHOTS) {
    const browser = await browserFor(s.args ?? GPU_ARGS);
    const context = await browser.newContext({
      viewport: s.viewport ?? { width: 1440, height: 900 },
      deviceScaleFactor: s.dpr ?? 1,
      timezoneId: 'Asia/Jakarta',
      locale: 'en-GB',
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error('pageerror:', e.message));
    await page.goto(`${BASE}?${s.q}`);
    if (!s.noGL) await page.waitForFunction(() => window.__selene?.ready, null, { timeout: 60000 });
    await page.waitForTimeout(1800); // fade-in and calendar paint
    if (s.hover) {
      const pos = await page.evaluate(({ lat, lon }) => {
        const S = window.__seleneApp.S;
        const r = Math.min(innerHeight * 0.2, innerWidth * 0.17);
        const la = (lat * Math.PI) / 180;
        const lo = (lon * Math.PI) / 180;
        return { x: S.moonX + Math.cos(la) * Math.sin(lo) * r, y: innerHeight * 0.36 - Math.sin(la) * r };
      }, s.hover);
      await page.mouse.move(pos.x, pos.y);
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: resolve(MEDIA, s.file) });
    console.log('captured', s.file);
    await context.close();
  }
} finally {
  for (const b of browsers.values()) await b.close();
  server.kill();
}
