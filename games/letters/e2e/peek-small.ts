/** The game at a small size: `tsx e2e/peek-small.ts <dir> <width> <height>` (menu, round, reveal). */
import { chromium } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';
import { boardWords, waitForPlay } from './hook';

async function main() {
  const [dir = '.', width = '820', height = '600'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  await page.goto('http://localhost:5291/?fresh=1');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/small-menu-${width}.png` });
  await page.getByTestId('chl-mode-classic').click();
  await waitForPlay(page);
  for (const word of (await boardWords(page)).slice(0, 6)) {
    await page.keyboard.type(word.word);
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/small-round-${width}.png` });
  await page.getByTestId('mock-pill').click();
  await page.getByTestId('mock-item-show-board').click();
  await page.waitForSelector('[data-testid="chl-reveal"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/small-reveal-${width}.png` });
  await browser.close();
}

void main();
