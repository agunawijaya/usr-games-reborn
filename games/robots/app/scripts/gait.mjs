// Frame-by-frame look at the walk: node scripts/gait.mjs <outdir> [direction] [frames]
// Freezes the visual clock, makes one move at full zoom and steps the clock
// by hand, saving a crop round the player per frame (gait-<dir>-NN.png).
// upRight is a true side view in this camera (the move runs across the screen).
// The zoom stays under the follow threshold so the camera holds still and a
// planted foot must stay on the same spot of floor; pixels are doubled.
import { chromium } from 'playwright';

const [out, dir = 'upRight', frames = '14'] = process.argv.slice(2);
const url = process.env.APP_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
await page.goto(url);
await page.waitForFunction(() => !!window.__rr, null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__rr.setZoom(29);
  // a new level number, so the board is read as a fresh level, not a turn
  window.__rr.setState({ level: 2, score: 0, player: { x: 30, y: 11 }, robots: [{ id: 1, x: 2, y: 2 }, { id: 2, x: 58, y: 21 }], piles: [], waitBonus: 0, status: 'playing' });
});
await page.waitForTimeout(3000);
await page.evaluate(() => { window.__rr.vclock.manual = true; });
const n = +frames;
const dur = +(process.env.DUR || 0.42);
const moves = +(process.env.MOVES || 1);
const clip = moves > 1 ? { x: 520, y: 290, width: 240, height: 150 } : { x: 540, y: 330, width: 170, height: 110 };
let f = 0;
for (let m = 0; m < moves; m++) {
  await page.evaluate((d) => window.__rr.act({ kind: 'move', direction: d }), dir);
  for (let i = 0; i <= n; i++) {
    if (m > 0 && i === 0) { await page.evaluate((dt) => { window.__rr.vclock.t += dt; }, dur / n); continue; }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: `${out}/gait-${dir}-${String(f++).padStart(2, '0')}.png`, clip });
    await page.evaluate((dt) => { window.__rr.vclock.t += dt; }, dur / n);
  }
}
console.log('gait', dir, 'ok');
await browser.close();
