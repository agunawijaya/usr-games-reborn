/**
 * Frame times on the workbench at 1920×1080 on the machine's GPU: idle in a zone, then while a
 * volley plays. `tsx scripts/perf.ts` with the workbench running on port 5300.
 */
import { chromium } from '@playwright/test';

const say = (line: string) => process.stdout.write(`${line}\n`);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('http://localhost:5300/?fresh=1&look=night');
await page.getByTestId('lk-menu-open').click();
await page.getByTestId('lk-open-code').fill('test-40');
await page.getByTestId('lk-open-begin').click();
await page.getByTestId('lk-begin').click();
await page.waitForTimeout(1500);

async function frames(label: string, during: () => Promise<void>) {
  // A plain string, so the bundler's helpers never reach the page.
  await page.evaluate(`(() => {
    const times = [];
    window.__frames = times;
    const tick = (t) => { times.push(t); if (times.length < 240) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  })()`);
  await during();
  await page.waitForTimeout(3000);
  const times = (await page.evaluate('window.__frames')) as number[];
  const gaps = times.slice(1).map((t, i) => t - times[i]!);
  const sorted = [...gaps].sort((a, b) => a - b);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  say(
    `${label}: ${(1000 / mean).toFixed(1)} fps mean, p95 frame ${sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1)} ms`,
  );
}

await frames('idle in a zone', async () => {});
await frames('lowering the shield under fire', async () => {
  await page.keyboard.press('g');
});
await frames('a volley', async () => {
  await page.keyboard.press('b');
  await page.getByTestId('lk-beam-sure').click();
  await page.getByTestId('lk-beam-fire').click();
});
await browser.close();
