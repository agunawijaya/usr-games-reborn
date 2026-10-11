/**
 * A quick look at one workbench scene while iterating on art: `tsx e2e/peek.ts <query> <file>
 * [width] [height]`. Saves a PNG and prints the page's console errors.
 */
import { chromium } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';

async function main() {
  const [query = 'scene=play', file = 'peek.png', width = '1920', height = '1080'] =
    process.argv.slice(2);
  const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
  const page = await browser.newPage({
    viewport: { width: Number(width), height: Number(height) },
  });
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(`http://localhost:5291/?${query}`);
  await page.waitForFunction(
    () => (window as unknown as { __ready?: boolean }).__ready === true,
    null,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(Number(process.env.PEEK_WAIT ?? 700));
  await page.screenshot({ path: file });
  if (errors.length) console.log(errors.join('\n'));
  await browser.close();
}

void main();
