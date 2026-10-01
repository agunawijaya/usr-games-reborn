/**
 * Workbench screenshots: `tsx scripts/shot.ts <out.png> <path?query> [width] [height] [waitMs]`.
 * Opens the workbench on port 5290 in Chromium and saves one frame.
 */
import { chromium } from '@playwright/test';

const [out, path = '/', width = '1280', height = '720', wait = '900'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto(`http://localhost:5290${path}`);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out! });
await browser.close();
if (errors.length) process.stdout.write(`errors:\n${errors.join('\n')}\n`);
process.stdout.write(`saved ${out}\n`);
