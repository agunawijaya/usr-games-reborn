/**
 * Workbench screenshots: `tsx scripts/shot.ts <out.png> <path?query> [width] [height] [steps]`.
 * Opens the workbench on port 5320 in Chromium, plays the steps and saves one frame. Steps are
 * separated by `;`: `click:<testid>`, `key:<key>`, `wait:<ms>`, `fill:<testid>=<text>`,
 * `eval:<js>` (run in the page), `full` (the whole scrolling page).
 */
import { chromium } from '@playwright/test';

const [out, path = '/', width = '1280', height = '720', steps = 'wait:700'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto(`http://localhost:5320${path}`);
await page.waitForTimeout(500);
let fullPage = false;
for (const step of steps.split(';').filter(Boolean)) {
  const colon = step.indexOf(':');
  const kind = colon < 0 ? step : step.slice(0, colon);
  const arg = colon < 0 ? '' : step.slice(colon + 1);
  if (kind === 'click') await page.getByTestId(arg).click();
  else if (kind === 'key') await page.keyboard.press(arg);
  else if (kind === 'fill') {
    const [testId, value = ''] = arg.split('=');
    await page.getByTestId(testId!).fill(value);
  } else if (kind === 'wait') await page.waitForTimeout(Number(arg));
  else if (kind === 'eval') {
    const result = await page.evaluate(arg);
    if (result !== undefined) process.stdout.write(`eval: ${JSON.stringify(result)}\n`);
  } else if (kind === 'full') fullPage = true;
}
await page.screenshot({ path: out!, fullPage });
await browser.close();
if (errors.length) process.stdout.write(`errors:\n${errors.join('\n')}\n`);
process.stdout.write(`saved ${out}\n`);
