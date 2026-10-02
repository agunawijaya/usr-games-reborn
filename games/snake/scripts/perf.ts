// Frames per second on the play screen at 1920×1080: `npx tsx games/snake/scripts/perf.ts [look]`.
import { chromium } from '@playwright/test';

const look = process.argv[2] ?? 'moon';
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://localhost:5276/?fresh=1&look=${look}`);
await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
// Passed as a string: the bundler's name helpers do not exist inside the page.
const COUNT_FRAMES = `new Promise((resolve) => {
  let frames = 0;
  const start = performance.now();
  const tick = () => {
    frames++;
    if (performance.now() - start < 3000) requestAnimationFrame(tick);
    else resolve((frames * 1000) / (performance.now() - start));
  };
  requestAnimationFrame(tick);
})`;
const measure = () => page.evaluate(COUNT_FRAMES) as Promise<number>;
await page.waitForTimeout(1500);
process.stdout.write(`menu (attract garden): ${(await measure()).toFixed(1)} fps\n`);
await page.getByRole('button', { name: /Start a run/ }).click();
await page.getByTestId('fp-map').waitFor();
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
const walking = page.evaluate(`(async () => {
  for (let i = 0; i < 12; i++) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: i % 2 ? 'ArrowRight' : 'ArrowLeft', key: 'x' }));
    await new Promise((r) => setTimeout(r, 250));
  }
})()`);
process.stdout.write(`play, walking, strike preview on: ${(await measure()).toFixed(1)} fps\n`);
await walking;
await browser.close();
