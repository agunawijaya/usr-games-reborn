// Frame-rate survey: loads the game in Chromium with a given GPU mode, poses
// one room per biome (day and night) and reports the settled fps and the
// quality the game chose.
//
//   node scripts/perf.mjs                 hardware GPU (ANGLE/D3D11 on Windows)
//   GPU=swiftshader node scripts/perf.mjs CPU-only WebGL (software rasteriser)
//   Q=high GPU=swiftshader node ...       force a quality instead of auto
//
// The viewport is 1440x900. Numbers are from requestAnimationFrame in a
// visible page, so they are capped at the display rate (60).
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const gpu = process.env.GPU || 'gpu';
const args = gpu === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu']
  : gpu === 'none' ? ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl']
  : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const port = 8600 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const q = process.env.Q ? `&q=${process.env.Q}` : '';
await page.goto(`http://localhost:${port}/index.html?fresh=1&seed=1${q}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.waitForTimeout(3000);
const rooms = [
  ['ship: stateroom', 22, false], ['ship: parlor (stairs)', 16, false], ['ship: control room (crew)', 4, false], ['ship: hangar (crew)', 1, false], ['ship: landing bay', 2, false],
  ['ship: closet (wardrobes)', 8, false], ['ship: sick bay', 18, false], ['ship: dining hall (14 seated)', 28, false], ['ship: lounge (coral stair)', 24, false], ['space', 37, false], ['air: over the beach', 73, false],
  ['coast: village', 92, false], ['coast: village, night', 92, true], ['forest: woods', 113, false], ['forest: pools, night', 126, true],
  ['cave: catacombs (lantern)', 258, false, true], ['cave: throne (lantern)', 268, false, true],
];
const rows = [];
const info0 = await page.evaluate(() => (window.__bs.stage ? window.__bs.stage.info() : null));
if (!info0) {
  console.log(`GPU=${gpu}: no WebGL — text mode (no frames to measure).`);
} else {
  for (const [label, room, night, dark] of rooms) {
    await page.evaluate(([room, night, dark]) => window.__bs.place({ room, night, dark: !!dark, items: dark ? [12] : [], time: night ? 140 : 40 }), [room, night, dark]);
    await page.waitForTimeout(4500);
    const i = await page.evaluate(() => window.__bs.stage.info());
    rows.push([label, i.fps, i.quality]);
  }
  const renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
  console.log(`GPU=${gpu} renderer: ${renderer}`);
  for (const [l, f, qq] of rows) console.log(`  ${l.padEnd(28)} ${String(f).padStart(3)} fps  (${qq})`);
}
await browser.close();
server.close();
