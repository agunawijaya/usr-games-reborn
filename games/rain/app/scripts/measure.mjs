#!/usr/bin/env node
// Measure start-up and frame rate in the three ways the page can run
// (README "Requirements & running without a GPU"). Each mode gets a fresh
// browser, so shaders compile cold, like a first visit.
//   node scripts/measure.mjs [gpu] [cpu] [nowebgl] ['?query']   (default: all three)
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const MODES = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  nowebgl: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'],
};
const want = process.argv.slice(2).filter((m) => MODES[m]);
const query = process.argv.slice(2).find((a) => a.startsWith('?')) || '';
const modes = want.length ? want : Object.keys(MODES);
const port = 8700 + Math.floor(Math.random() * 90);
const server = await startServer(port);

for (const mode of modes) {
  const browser = await chromium.launch({ args: MODES[mode] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/index.html${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  const ready = Date.now() - t0;
  // count real frames over 6 s, after 2 s of warm-up (and any quality switch)
  await page.waitForTimeout(2000);
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const start = performance.now();
    const tick = (now) => {
      n++;
      if (now - start < 6000) requestAnimationFrame(tick);
      else resolve((n * 1000) / (now - start));
    };
    requestAnimationFrame(tick);
  }));
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => window.__info);
  const firstFrame = await page.evaluate(() => window.__firstFrame || null);
  console.log(JSON.stringify({
    mode,
    readyMs: ready,
    firstFrameMs: firstFrame && Math.round(firstFrame),
    fps: Math.round(fps),
    renderer: info.renderer || null,
    profile: info.profile || null,
    view: info.view,
    grid: info.grid || null,
    scene: info.scene || null,
    fallback: info.fallback || null,
    errors,
  }));
  await browser.close();
}
server.close();
