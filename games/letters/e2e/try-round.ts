/** A quick scripted round on the workbench while building: `tsx e2e/try-round.ts <dir> [look]` */
import { chromium } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';
import { boardWords, foundWords, trace, waitForPlay } from './hook';

async function main() {
  const [dir = '.', look = 'studio'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:5291/?fresh=1&look=${look}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.getByTestId('chl-mode-classic').click();
  await waitForPlay(page);
  const words = await boardWords(page);
  const long = words.find((w) => w.word.length >= 5)!;
  await trace(page, long.path);
  const typed = words.find(
    (w) => w.word !== long.word && !w.word.includes('qu') && w.word.length === 4,
  )!;
  await page.keyboard.type(typed.word);
  await page.keyboard.press('Enter');
  const partial = words.find((w) => w.word.length >= 6 && w.word !== long.word)!;
  await trace(page, partial.path.slice(0, -1));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/r-play-${look}.png` });
  process.stdout.write(`found ${JSON.stringify(await foundWords(page))}\n`);
  await page.getByTestId('mock-pill').click();
  await page.getByTestId('mock-item-show-board').click();
  await page.waitForSelector('[data-testid="chl-reveal"]', { timeout: 10_000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${dir}/r-reveal-${look}.png` });
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  process.stdout.write(`${log.join('\n')}\n${errors.join('\n')}\n`);
  await browser.close();
}

void main();
