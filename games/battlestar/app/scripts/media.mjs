// Regenerates the README screenshots in media/ (documentation only: the
// game never loads them, ADR 002). Each shot poses the engine with the
// __bs debug hook, waits for the scene to settle, and captures either the
// 3D scene or the whole page.
//
//   node scripts/media.mjs            all shots (hardware GPU)
//   node scripts/media.mjs 08 12      only shots whose name starts with these
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '../media');
mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const want = (name) => !only.length || only.some((p) => name.startsWith(p));
const port = 8800 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const GPU = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const CPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'];
const NONE = ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'];

async function session(args, query = 'fresh=1&seed=7', vp = { width: 1600, height: 900 }) {
  const browser = await chromium.launch({ args });
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://localhost:${port}/index.html?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(2000);
  return { browser, page };
}
// every pose is explicit: day unless night, wearing the silk pajamas (object 15)
const place = (page, o) => page.evaluate((o) => window.__bs.place({ night: false, worn: [15], ...o }), o);
const put = (page, room, obj) => page.evaluate(([room, obj]) => {
  const g = window.__bs.game;
  g.location[room].objects[obj >> 5] |= 1 << (obj & 31);
  window.__bs.refresh();
}, [room, obj]);
async function scene(page, name, settle = 3500) {
  if (!want(name)) return;
  await page.waitForTimeout(settle);
  await page.locator('#scene-wrap').screenshot({ path: join(out, `${name}.png`) });
  console.log(name);
}
async function full(page, name, settle = 2500) {
  if (!want(name)) return;
  await page.waitForTimeout(settle);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log(name);
}

// ---- GPU: the biomes, the finale, the UI
{
  const { browser, page } = await session(GPU);
  // 01: the whole page on the village street, with a few commands in the log
  await place(page, { room: 92, facing: 'n', time: 40 });
  for (const c of ['look', 'inven']) { await page.evaluate((c) => window.__bs.send(c), c); await page.waitForTimeout(200); }
  await full(page, '01-ui-village');
  await place(page, { room: 22, facing: 'n', time: 3 });
  await scene(page, '02-ship-stateroom');
  await place(page, { room: 2, facing: 'n', time: 20 });
  await scene(page, '03-ship-landing-bay-alert');
  await place(page, { room: 68, facing: 'n', time: 30 });
  await scene(page, '04-space-orbit');
  await place(page, { room: 73, facing: 'e', time: 22 });
  await scene(page, '06-air-day');
  await place(page, { room: 90, facing: 'n', night: true, time: 130 });
  await scene(page, '07-air-night');
  await place(page, { room: 80, facing: 'n', time: 30 });
  await scene(page, '08-coast-day');
  await place(page, { room: 92, facing: 'n', night: true, time: 140 });
  await scene(page, '09-coast-night');
  await place(page, { room: 113, facing: 'n', time: 40 });
  await scene(page, '10-forest-day');
  await place(page, { room: 126, facing: 'n', night: true, time: 130 });
  await scene(page, '11-forest-night');
  await place(page, { room: 265, facing: 'e', dark: true, items: [12], time: 120, night: true });
  await scene(page, '12-cave-lantern');
  await place(page, { room: 258, facing: 'n', dark: true, items: [], time: 40 });
  await scene(page, '13-cave-darkness');
  await place(page, { room: 268, facing: 'n', dark: true, items: [12], time: 40 });
  await put(page, 268, 24); // the goddess, as after following her from the pools
  await scene(page, '14-finale-throne');
  await browser.close();
}

// ---- GPU: hints and the Override panel, in a game played from the start
if (want('15') || want('16')) {
  const { browser, page } = await session(GPU);
  for (const c of ['look', 'right', 'right']) { await page.evaluate((c) => window.__bs.send(c), c); await page.waitForTimeout(250); }
  await page.keyboard.press('`');
  await full(page, '15-hints', 2500);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+Backquote');
  await page.check('#dlg-override [data-flag="infiniteFuel"]');
  await page.check('#ovr-reveal');
  await full(page, '16-override-map', 1200);
  await browser.close();
}

// ---- GPU: the dogfight (played into the first Cylon)
if (want('05')) {
  const { browser, page } = await session(GPU, 'fresh=1&seed=7', { width: 1600, height: 900 });
  const cmds = ['right', 'right', 'take amulet', 'back', 'ahead', 'take laser', 'back', 'left', 'take knife', 'back', 'left', 'down', 'right', 'ahead', 'right', 'right', 'launch', 'right', 'ahead', 'ahead'];
  for (const c of cmds) { await page.evaluate((c) => window.__bs.send(c), c); await page.waitForTimeout(150); }
  await page.waitForTimeout(2500);
  await page.keyboard.press('+');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(out, '05-dogfight.png') });
  console.log('05-dogfight');
  await browser.close();
}

// ---- no GPU: software WebGL picks Low; no WebGL at all is text mode
if (want('17')) {
  const { browser, page } = await session(CPU);
  await place(page, { room: 113, facing: 'n', time: 40 });
  await full(page, '17-no-gpu-low', 6000);
  await browser.close();
}
if (want('18')) {
  const { browser, page } = await session(NONE);
  for (const c of ['look', 'right']) { await page.evaluate((c) => window.__bs.send(c), c); await page.waitForTimeout(200); }
  await full(page, '18-no-webgl-text', 800);
  await browser.close();
}
server.close();
