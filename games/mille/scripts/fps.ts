import { chromium, type Page } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';

/**
 * Frame pacing on the running workbench (port 5296) at 1920×1080: the game menu's endless drive,
 * a live hand between two Classic drivers, and the coup scene's slow motion. Prints the mean
 * frame rate, the 95th-percentile frame time and the share of frames over 20 ms for each.
 * `npx tsx scripts/fps.ts [dark|light]`
 */

const appearance = process.argv[2] ?? 'dark';
const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

async function sample(page: Page, seconds: number): Promise<number[]> {
  // A string, not a function: tsx would wrap a function's inner helpers in its own `__name`.
  return page.evaluate(`new Promise((resolve) => {
    const gaps = [];
    let last = performance.now();
    const started = last;
    const tick = (now) => {
      gaps.push(now - last);
      last = now;
      if (now - started < ${seconds * 1000}) requestAnimationFrame(tick);
      else resolve(gaps.slice(1));
    };
    requestAnimationFrame(tick);
  })`);
}

function report(name: string, gaps: number[]): void {
  const sorted = [...gaps].sort((a, b) => a - b);
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const slow = gaps.filter((g) => g > 20).length / gaps.length;
  process.stdout.write(
    `${name.padEnd(12)} ${(1000 / mean).toFixed(1)} fps · p95 ${p95.toFixed(1)} ms · ${(slow * 100).toFixed(1)}% over 20 ms · ${gaps.length} frames\n`,
  );
}

await page.goto(`http://localhost:5296/?game&appearance=${appearance}&mute=1`);
await page.waitForSelector('.dt-title');
await page.waitForTimeout(1500);
report('menu', await sample(page, 6));

await page.getByRole('button', { name: /Quick hand/ }).click();
await page.locator('.dt-start').click();
await page.waitForSelector('.dt-table[data-mode="play"]');
await page.evaluate(() =>
  (window as unknown as { __dtTable: { setAutoplay(on: boolean): void } }).__dtTable.setAutoplay(
    true,
  ),
);
await page.waitForTimeout(1000);
report('live hand', await sample(page, 10));

await page.goto(`http://localhost:5296/?scene=coup&look=${appearance}&live=1`);
await page.waitForFunction(
  () => (window as unknown as { __sceneReady?: boolean }).__sceneReady === true,
);
report('coup scene', await sample(page, 6));
await browser.close();
