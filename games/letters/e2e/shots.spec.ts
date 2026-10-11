import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { boardWords, trace, waitForPlay } from './hook';

/**
 * The documentation screenshots: every screen at 1280×720 and 1920×1080, in Studio and Arcade
 * Glow, from the real game on its workbench. `--grep @shots`; `SHOTS_DIR` sends them elsewhere
 * (for critique rounds) instead of docs/media.
 */
const MEDIA = process.env.SHOTS_DIR ?? fileURLToPath(new URL('../docs/media/', import.meta.url));
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const LOOKS = ['studio', 'arcade'] as const;

async function open(page: Page, look: string) {
  await page.goto(`/?fresh=1&date=2026-10-11&look=${look}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(() => document.fonts.ready);
}

/** Types a handful of the board's words, the way a player on a good run might. */
async function playSome(page: Page, count: number) {
  const words = (await boardWords(page)).filter((w) => !w.word.includes('qu')).reverse();
  for (const word of words.slice(0, count)) {
    await page.keyboard.type(word.word);
    await page.keyboard.press('Enter');
  }
}

async function reveal(page: Page) {
  await page.getByTestId('mock-pill').click();
  await page.getByTestId('mock-item-show-board').click();
  await expect(page.getByTestId('chl-reveal')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(2600);
}

const SCENES: { name: string; stage: (page: Page) => Promise<void> }[] = [
  { name: 'game-menu', stage: async (page) => void (await page.waitForTimeout(3500)) },
  {
    name: 'choose-board',
    stage: async (page) => {
      await page.getByTestId('chl-mode-setup').click();
    },
  },
  {
    name: 'round',
    stage: async (page) => {
      await page.getByTestId('chl-mode-classic').click();
      await waitForPlay(page);
      await playSome(page, 14);
      const words = await boardWords(page);
      const long = words.find((w) => w.word.length >= 6) ?? words[0]!;
      const first = long.path.slice(0, -1);
      await trace(page, first);
      await page.keyboard.type('');
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'duel',
    stage: async (page) => {
      await page.getByTestId('chl-mode-duel').click();
      await page.getByTestId('chl-pick-strength-3').check();
      await page.getByTestId('chl-start').click();
      await waitForPlay(page);
      await page.waitForTimeout(9000);
      await playSome(page, 6);
    },
  },
  {
    name: 'tutorial',
    stage: async (page) => {
      await page.getByTestId('chl-mode-tutorial').click();
      await waitForPlay(page);
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'reveal',
    stage: async (page) => {
      await page.getByTestId('chl-mode-classic').click();
      await waitForPlay(page);
      await playSome(page, 16);
      await reveal(page);
    },
  },
  {
    name: 'daily-reveal',
    stage: async (page) => {
      await page.getByTestId('chl-mode-daily').click();
      await waitForPlay(page);
      await playSome(page, 12);
      await reveal(page);
    },
  },
  {
    name: 'duel-reveal',
    stage: async (page) => {
      await page.getByTestId('chl-mode-duel').click();
      await page.getByTestId('chl-start').click();
      await waitForPlay(page);
      await playSome(page, 8);
      await page.waitForTimeout(6000);
      await reveal(page);
    },
  },
  {
    name: 'word-book',
    stage: async (page) => {
      await page.getByTestId('chl-mode-classic').click();
      await waitForPlay(page);
      await playSome(page, 20);
      await reveal(page);
      await page.getByTestId('chl-menu').click();
      await page.getByTestId('chl-open-book').click();
    },
  },
  {
    name: 'records',
    stage: async (page) => {
      await page.getByTestId('chl-open-records').click();
    },
  },
  {
    name: 'how-to-play',
    stage: async (page) => {
      await page.getByTestId('chl-open-help').click();
    },
  },
];

for (const scene of SCENES) {
  for (const look of LOOKS) {
    for (const size of SIZES) {
      test(`@shots ${scene.name}, ${look}, ${size.width}`, async ({ page }) => {
        await page.setViewportSize(size);
        await open(page, look);
        await scene.stage(page);
        await page.mouse.move(2, size.height - 2);
        const kb = await saveScreenshot(page, `${MEDIA}/${scene.name}-${look}-${size.width}.webp`);
        expect(kb).toBeLessThan(800);
      });
    }
  }
}
