#!/usr/bin/env node
// Screenshot runner for the art-direction loop and for media/.
//   node scripts/shots.mjs <out-dir> <shots.json | name=room[,night][,dark][,facing=e]...>
// Each shot: { name, room, night, dark, facing, items:[obj ids], time, wait, cmds:[...] }.
// GPU by default; GPU=swiftshader or GPU=none for the no-GPU checks.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir || !rest.length) { console.error('usage: node scripts/shots.mjs <out-dir> shots.json|name=room[,night][,dark][,facing=e]'); process.exit(1); }
let shots;
if (rest[0].endsWith('.json') && existsSync(rest[0])) shots = JSON.parse(readFileSync(rest[0], 'utf8'));
else shots = rest.map((s) => {
  const [name, spec] = s.split('=');
  const parts = spec.split(',');
  const o = { name, room: +parts[0] };
  for (const p of parts.slice(1)) {
    const [k, v] = p.split(':');
    o[k] = v === undefined ? true : k === 'items' || k === 'worn' ? v.split('+').map(Number) : isNaN(+v) ? v : +v;
  }
  return o;
});
mkdirSync(outDir, { recursive: true });
const port = 8900 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const gpu = process.env.GPU || 'gpu';
const args = gpu === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu']
  : gpu === 'none' ? ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const W = +(process.env.W || 1600);
const H = +(process.env.H || 900);
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || process.env.VERBOSE) { console.log(`[${m.type()}]`, m.text().slice(0, 600)); if (m.type() === 'error') errors.push(m.text()); } });
page.on('pageerror', (e) => { console.log('[pageerror]', e.message); errors.push(e.message); });
const q = process.env.Q ? `&q=${process.env.Q}` : '';
await page.goto(`http://localhost:${port}/index.html?fresh=1&seed=${process.env.SEED || 7}${q}${process.env.EXTRA || ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
await page.waitForTimeout(+(process.env.BOOT || 2500));
for (const s of shots) {
  if (s.cmds) {
    for (const c of s.cmds) { await page.evaluate((c) => window.__bs.send(c), c); await page.waitForTimeout(250); }
  }
  if (s.room) await page.evaluate((s) => window.__bs.place({ room: s.room, night: !!s.night, dark: !!s.dark, facing: s.facing, items: s.items || [], worn: s.worn || [], time: s.time }), s);
  await page.waitForTimeout(s.wait ?? +(process.env.WAIT || 2200));
  const info = await page.evaluate(() => ({ ...(window.__bs.stage ? window.__bs.stage.info() : {}), room: window.__bs.game.position, q: window.__bs.quality() }));
  const target = process.env.FULL ? page : page.locator(process.env.SCENE ? '#scene-wrap' : 'body');
  await target.screenshot({ path: join(outDir, `${s.name}.png`) });
  console.log(`${s.name}.png`, JSON.stringify(info));
}
await browser.close();
server.close();
if (errors.length) { console.log(`${errors.length} error(s)`); process.exitCode = 1; }
