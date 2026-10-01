#!/usr/bin/env node
// Measures what the README's "Requirements & running without a GPU" table
// reports. Each mode gets a fresh browser profile (no shader cache).
//   node scripts/perf.mjs [gpu|cpu ...]
import { chromium } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const MODES = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  nogl: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2'],
};
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MODES);
const server = await startServer(8990);

for (const mode of want) {
  for (const quality of (process.env.Q ? process.env.Q.split(',') : ['auto', 'high', 'low', 'lite'])) {
    const dir = mkdtempSync(join(tmpdir(), 'trek-perf-'));
    const ctx = await chromium.launchPersistentContext(dir, { args: MODES[mode], viewport: { width: 1600, height: 900 } });
    const page = ctx.pages()[0] || await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`http://localhost:8990/index.html?seed=428&difficulty=standard&help=0&quality=${quality}`);
    await page.waitForFunction(() => window.__trek?.ready, null, { timeout: 180000 });
    const firstFrame = Date.now() - t0;
    const profile = await page.evaluate(() => window.__trek.profile());
    await page.keyboard.press('Enter');
    const t1 = Date.now();
    await page.waitForFunction(() => window.__trek.frames > 0 && window.__trek.game, null, { timeout: 60000 });
    await page.waitForTimeout(400);
    const startMs = Date.now() - t1;
    const sample = async (ms) => {
      const f0 = await page.evaluate(() => window.__trek.frames);
      await page.waitForTimeout(ms);
      const f1 = await page.evaluate(() => window.__trek.frames);
      return ((f1 - f0) / (ms / 1000)).toFixed(1);
    };
    const idle = await sample(4000);
    for (const c of ['shields up', 'move 1.5 1']) { await page.keyboard.type(c); await page.keyboard.press('Enter'); await page.waitForTimeout(300); }
    await page.waitForTimeout(2500);
    await page.keyboard.type('phaser 400'); await page.keyboard.press('Enter');
    const combat = await sample(1500);
    await page.keyboard.type('torpedo 4.5'); await page.keyboard.press('Enter');
    const boom = await sample(2500);
    console.log(JSON.stringify({ mode, quality, profile, firstFrameMs: firstFrame, startMissionMs: startMs, fpsIdle: +idle, fpsPhaser: +combat, fpsExplosion: +boom }));
    await ctx.close();
    rmSync(dir, { recursive: true, force: true });
    if (quality === 'auto' && mode === 'gpu') continue;
  }
}
server.close();
