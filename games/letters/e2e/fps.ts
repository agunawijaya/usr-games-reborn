/**
 * Frame rate at 1920×1080 on this machine's GPU: the game menu (attract loop), a round being
 * traced and the reveal, in both looks. `tsx e2e/fps.ts`
 */
import { chromium, type Page } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';
import { boardWords, trace, waitForPlay } from './hook';

/** Counts frames for a while in the page; a string, so the bundler adds no helpers to it. */
async function measure(page: Page, seconds: number): Promise<{ fps: number; worst: number }> {
  return page.evaluate(`new Promise((resolve) => {
    const times = [];
    const step = (now) => {
      times.push(now);
      if (now - times[0] < ${seconds * 1000}) requestAnimationFrame(step);
      else {
        const gaps = times.slice(1).map((t, i) => t - times[i]);
        resolve({ fps: (gaps.length * 1000) / (times[times.length - 1] - times[0]), worst: Math.max(...gaps) });
      }
    };
    requestAnimationFrame(step);
  })`);
}

async function main() {
  const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
  for (const look of ['studio', 'arcade']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`http://localhost:5291/?fresh=1&look=${look}`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
    const menu = await measure(page, 4);
    await page.getByTestId('chl-mode-classic').click();
    await waitForPlay(page);
    const words = await boardWords(page);
    const tracing = measure(page, 4);
    for (const word of words.slice(0, 6)) await trace(page, word.path);
    const play = await tracing;
    await page.getByTestId('mock-pill').click();
    await page.getByTestId('mock-item-show-board').click();
    await page.waitForSelector('[data-testid="chl-reveal"]');
    const reveal = await measure(page, 4);
    const line = (name: string, r: { fps: number; worst: number }) =>
      `${name} ${r.fps.toFixed(1)} fps (worst frame ${r.worst.toFixed(1)} ms)`;
    process.stdout.write(
      `${look}: ${line('menu', menu)}; ${line('round', play)}; ${line('reveal', reveal)}\n`,
    );
    await page.close();
  }
  await browser.close();
}

void main();
