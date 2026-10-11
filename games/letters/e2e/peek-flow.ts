/** Opens the workbench at `query`, starts a Classic round, types a few words: `tsx e2e/peek-flow.ts <query> <png>` */
import { chromium } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';
import { boardWords, waitForPlay } from './hook';

async function main() {
  const [query = 'fresh=1', file = 'flow.png'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => process.stdout.write(`${String(e)}\n`));
  await page.goto(`http://localhost:5291/?${query}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.getByTestId('chl-mode-classic').click();
  await waitForPlay(page);
  for (const word of (await boardWords(page)).filter((w) => !w.word.includes('qu')).slice(0, 8)) {
    await page.keyboard.type(word.word);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.type((await boardWords(page)).at(-1)!.word.slice(0, 3));
  await page.waitForTimeout(900);
  await page.screenshot({ path: file });
  await browser.close();
}

void main();
