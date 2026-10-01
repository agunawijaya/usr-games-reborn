/**
 * Frame-time check on the workbench: `tsx scripts/perf.ts <path?query> <width> <height> <steps…>`
 * runs the steps (as in drive.ts), then measures two seconds of animation frames.
 */
import { chromium } from '@playwright/test';

const [path = '/', width = '1920', height = '1080', ...steps] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(`http://localhost:5290${path}`);
await page.waitForTimeout(800);
for (const step of steps) {
  const [kind, value = ''] = step.split(/:(.*)/s);
  if (kind === 'click') await page.click(`[data-testid="${value}"]`);
  else if (kind === 'key') await page.keyboard.press(value);
  else if (kind === 'wait') await page.waitForTimeout(Number(value));
}
// Passed as text: tsx would otherwise wrap the function in helpers the page does not have.
const frames = (await page.evaluate(`new Promise((resolve) => {
  const times = [];
  let last = performance.now();
  const start = last;
  const tick = (now) => {
    times.push(now - last);
    last = now;
    if (now - start < 2000) requestAnimationFrame(tick);
    else resolve(times);
  };
  requestAnimationFrame(tick);
})`)) as number[];
const sorted = [...frames].sort((a, b) => a - b);
const average = frames.reduce((s, t) => s + t, 0) / frames.length;
process.stdout.write(
  `frames ${frames.length} · average ${average.toFixed(1)} ms (${(1000 / average).toFixed(0)} fps) · p95 ${sorted[Math.floor(sorted.length * 0.95)]!.toFixed(1)} ms\n`,
);
if (errors.length) process.stdout.write(`errors:\n${errors.join('\n')}\n`);
await browser.close();
