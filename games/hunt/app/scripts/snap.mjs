#!/usr/bin/env node
// Drive the page with Playwright and take screenshots of scripted moments.
//   node scripts/snap.mjs <out-dir> <scene|file=scene> [...]
// Scenes are defined in scripts/scenes.mjs. The page runs in manual time
// (?manual=1): the script steps the engine and advances frames itself, so
// every screenshot is reproducible.
// Env: W, H (viewport), GPU=gpu|cpu|nogl, VERBOSE=1.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
import { SCENES } from './scenes.mjs';

const [outDir, ...names] = process.argv.slice(2);
if (!outDir || !names.length) {
  console.error(`usage: node scripts/snap.mjs <out-dir> <scene...>\nscenes: ${Object.keys(SCENES).join(' ')}`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const port = 8800 + Math.floor(Math.random() * 150);
const server = await startServer(port);
const gpuArgs = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  nogl: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2'],
}[process.env.GPU || 'gpu'];
const browser = await chromium.launch({ args: gpuArgs });
const W = +(process.env.W || 1600);
const H = +(process.env.H || 900);
for (const arg of names) {
  // "file=scene" writes <file>.png from <scene>; a bare "scene" uses its name
  const [name, sceneName = arg] = arg.includes('=') ? arg.split('=') : [arg];
  const scene = SCENES[sceneName];
  if (!scene) { console.error(`unknown scene ${sceneName}`); continue; }
  const page = await browser.newPage({ viewport: { width: scene.w || W, height: scene.h || H } });
  page.on('console', (m) => { if (m.type() === 'error' || process.env.VERBOSE) console.log(`[${m.type()}]`, m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const url = `http://localhost:${port}/?manual=1&${scene.query || ''}`;
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const t0 = Date.now();
  const info = await scene.run(page);
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`${name}.png  ${Date.now() - t0} ms ${info ? JSON.stringify(info) : ''}`);
  await page.close();
}
await browser.close();
server.close();
