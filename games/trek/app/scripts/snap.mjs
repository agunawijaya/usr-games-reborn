#!/usr/bin/env node
// Screenshot one or more pages of this port with Playwright (Chromium, GPU).
//   node scripts/snap.mjs <out-dir> "<name>=<path?query>" ["<name>=<path>" ...]
// Waits for window.__ready, then ?settle=ms (default 800).
// Env: W, H (viewport), GPU=cpu (SwiftShader) | nogl (WebGL disabled).
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
const port = 8900 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const gpuArgs = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  nogl: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2'],
}[process.env.GPU || 'gpu'];
const browser = await chromium.launch({ args: gpuArgs });
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
  const clock = new URL(url).searchParams.get('clock');
  if (clock !== null) {
    // Deterministic moment: fake clock, load in real time, then advance.
    const p2 = await browser.newPage({ viewport: { width: W, height: H } });
    p2.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await p2.clock.install({ time: 0 });
    await p2.clock.pauseAt(1000);   // installed clocks tick in real time until paused
    await p2.goto(url);
    await p2.waitForLoadState('networkidle');
    await p2.waitForTimeout(1200);
    await p2.clock.runFor(+clock);
    // after=ms: keep running until the scripted commands (cmds=) have all
    // been typed, then advance exactly `after` ms past the last one.
    const after = new URL(url).searchParams.get('after');
    if (after !== null) {
      for (let i = 0; i < 400; i++) {
        const left = await p2.evaluate(() => window.__trek?.scriptLeft ?? 1);
        if (left === 0) break;
        await p2.clock.runFor(50);
      }
      const since = await p2.evaluate(() => performance.now() - (window.__trek.lastCommandAt ?? 0));
      await p2.clock.runFor(Math.max(0, +after - since));
    }
    await p2.screenshot({ path: join(outDir, `${name}.png`) });
    console.log(`${name}.png (clock ${clock} ms)`);
    await p2.close();
    continue;
  }
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true || window.__trek?.ready === true, null, { timeout: 120000 });
  const settle = +(new URL(url).searchParams.get('settle') || 800);
  await page.waitForTimeout(settle);
  const info = await page.evaluate(() => window.__info || (window.__trek ? { fps: Math.round(window.__trek.fps), profile: window.__trek.profile(), gpu: window.__trek.gpu() } : null));
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`${name}.png`, info ? JSON.stringify(info) : '');
}
await browser.close();
server.close();
