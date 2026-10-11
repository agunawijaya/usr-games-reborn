import { fileURLToPath } from 'node:url';
import { type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots from the workbench, for a player some way in (`?sample=1`): every
 * main screen in both themes, by day and by night, at 1920 × 1080, and the four busiest at
 * 1280 × 720 too. Run with `SHOTS=1 pnpm exec playwright test -c games/arithmetic --project shots`.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

declare global {
  interface Window {
    __ns: { mode: string; answer(): string } | null;
    __ready: boolean;
  }
}

async function open(page: Page, theme: string, look: string) {
  await page.goto(`/?fresh=1&sample=1&theme=${theme}&look=${look}&date=2026-10-11`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => document.fonts.ready);
}

async function answer(page: Page, times: number, pause: number) {
  for (let i = 0; i < times; i++) {
    const next = await page.evaluate(() => window.__ns?.answer() ?? '');
    if (!next) return;
    await page.keyboard.type(next);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(pause);
  }
}

async function finish(page: Page) {
  for (let i = 0; i < 300; i++) {
    const state = await page.evaluate(() =>
      window.__ns ? { m: window.__ns.mode, a: window.__ns.answer() } : null,
    );
    if (!state) return;
    if (!state.a) {
      await page.waitForTimeout(100);
      continue;
    }
    await page.keyboard.type(state.a);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(state.m === 'sums' ? 20 : state.m === 'sieve' ? 80 : 1000);
  }
}

async function free(page: Page, mode: string, rung: string) {
  await page.getByTestId(`ns-menu-${mode}`).click();
  await page.getByTestId(`ns-rung-${rung}`).click();
  await page.getByTestId('ns-setup-start').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__ns));
}

for (const theme of ['sprint', 'atom'] as const) {
  for (const look of ['day', 'night'] as const) {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      const wide = size.width === 1920;
      test(`@shots ${theme} ${look} ${size.width}`, async ({ page }) => {
        await page.setViewportSize(size);
        const save = async (name: string) => {
          await page.waitForTimeout(700);
          await saveScreenshot(page, `${MEDIA}${name}-${theme}-${look}-${size.width}.webp`);
        };
        await open(page, theme, look);
        await save('menu');

        await free(page, 'sums', 'times-10');
        await answer(page, 6, 400);
        await page.keyboard.type('5');
        await save('quick-sums');

        await open(page, theme, look);
        await free(page, 'sieve', 'two-hundred');
        await answer(page, 3, 700);
        await save('sieve');

        await open(page, theme, look);
        await free(page, 'spell', 'thousands');
        const words = await page.evaluate(() => window.__ns!.answer());
        await page.keyboard.type(words.split(' ').slice(0, 2).join(' '));
        await save('spell-it');
        if (!wide) return;

        await open(page, theme, look);
        await free(page, 'split', 'thousands');
        await answer(page, 2, 900);
        await save('split');

        await open(page, theme, look);
        await page.getByRole('button', { name: /Prime album/ }).click();
        await save('album');

        await open(page, theme, look);
        await page.getByTestId('ns-menu-daily').click();
        for (let event = 0; event < 4; event++) {
          await page.getByTestId('ns-intro-start').click();
          await finish(page);
        }
        await page.getByTestId('ns-results').waitFor();
        await page.waitForTimeout(1400);
        await save('daily-results');
      });
    }
  }
}
