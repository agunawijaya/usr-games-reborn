// Frame-rate check on a crowded board: node scripts/perf.mjs [label]
// (dev server or preview on APP_URL; GPU=cpu for the software renderer;
// QUERY=quality=low to force the light path). Level 4: 40 robots, 12 heaps.
import { chromium } from 'playwright';

const label = process.argv[2] ?? '';
const url = (process.env.APP_URL ?? 'http://localhost:5173/') + (process.env.QUERY ? `?${process.env.QUERY}` : '');
const args = process.env.GPU === 'cpu' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url);
await page.waitForFunction(() => !!window.__rr, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const robots = [], piles = [];
for (let i = 0; i < 40; i++) robots.push({ id: 500 + i, x: 2 + ((i * 7) % 56), y: 1 + ((i * 5) % 21) });
for (let i = 0; i < 12; i++) piles.push({ x: 4 + i * 4, y: (i * 7) % 21 + 1 });
await page.evaluate(([r, p]) => window.__rr.setState({ level: 4, score: 900, player: { x: 30, y: 11 }, robots: r, piles: p, waitBonus: 0, status: 'playing' }), [robots, piles]);
await page.waitForTimeout(2500);
const measure = () => page.evaluate(() => new Promise((res) => {
  const times = [];
  let last = performance.now();
  const f = (now) => { times.push(now - last); last = now; if (times.length < 180) requestAnimationFrame(f); else res(times); };
  requestAnimationFrame(f);
}));
const stats = (t) => {
  const s = [...t].sort((a, b) => a - b);
  const avg = t.reduce((a, b) => a + b, 0) / t.length;
  return `avg ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(0)} fps), p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)} ms`;
};
const idle = await measure();
// and with the busiest effect running: a wait-turn with crashes every so often
await page.evaluate(() => { for (let i = 0; i < 6; i++) setTimeout(() => window.__rr.act({ kind: 'teleport' }), i * 400); });
const busy = await measure();
const info = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '?';
});
console.log(`${label} [${info}]`);
console.log(`  idle, 40 robots: ${stats(idle)}`);
console.log(`  teleporting:     ${stats(busy)}`);
if (errs.length) console.log('  ERRORS:', errs.slice(0, 3).join(' | '));
await browser.close();
