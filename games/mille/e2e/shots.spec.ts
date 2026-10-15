import { fileURLToPath } from 'node:url';
import { type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import {
  card,
  COUP_READY,
  freshStorage,
  openGame,
  RUN_TO_700,
  stackFirstDeal,
  startQuickHand,
  waitForMode,
} from './table';

/**
 * Documentation screens for docs/media/screens/, every screen at 1280 × 720 and 1920 × 1080 by
 * day and by night. Run with `--grep @shots` (`SHOT=name` for one screen).
 */

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const LOOKS = ['day', 'night'] as const;
const only = process.env.SHOT;

async function save(page: Page, name: string, look: string) {
  const size = page.viewportSize()!;
  const target = new URL(
    `../docs/media/screens/${name}-${look}-${size.width}.webp`,
    import.meta.url,
  );
  await page.waitForTimeout(300);
  await saveScreenshot(page, fileURLToPath(target));
}

async function playByKeys(page: Page, name: string): Promise<void> {
  await waitForMode(page, 'play');
  const slot = Number(await card(page, name).getAttribute('data-slot'));
  await page.keyboard.press(slot === 0 ? 'p' : String(slot));
  await page.keyboard.press('u');
}

/** Plays the stacked run up to the extension question. */
async function runTo700(page: Page): Promise<void> {
  await startQuickHand(page, 'Classic');
  for (const name of [
    'Green Light',
    '200 miles',
    '200 miles',
    '100 miles',
    '100 miles',
    '100 miles',
  ]) {
    await playByKeys(page, name);
  }
  await waitForMode(page, 'extension');
}

interface Screen {
  stage: (page: Page) => Promise<void>;
  /** A stacked first deal, set before the page loads. */
  deal?: (page: Page) => Promise<void>;
  /** Keep the motion on (the coup's slow motion is the point of its picture). */
  motion?: boolean;
}

const SCREENS: Record<string, Screen> = {
  title: { stage: async (page) => void (await page.waitForTimeout(1200)) },
  setup: {
    stage: async (page) => {
      await page.getByRole('button', { name: /Full game/ }).click();
      await page.locator('.dt-setup').waitFor();
    },
  },
  table: {
    deal: (page) => stackFirstDeal(page, RUN_TO_700),
    stage: async (page) => {
      await startQuickHand(page, 'Classic');
      for (const name of ['Green Light', '200 miles', '100 miles']) await playByKeys(page, name);
      await waitForMode(page, 'play');
      await card(page, '200 miles').click();
    },
  },
  blocked: {
    deal: (page) => stackFirstDeal(page, COUP_READY),
    stage: async (page) => {
      await startQuickHand(page, 'Rookie');
      await waitForMode(page, 'play');
      await card(page, '50 miles').hover();
    },
  },
  'coup-prompt': {
    deal: (page) => stackFirstDeal(page, COUP_READY),
    stage: async (page) => {
      await startQuickHand(page, 'Rookie');
      await playByKeys(page, 'Green Light');
      await waitForMode(page, 'coup');
    },
  },
  'coup-slam': {
    deal: (page) => stackFirstDeal(page, COUP_READY),
    motion: true,
    stage: async (page) => {
      await startQuickHand(page, 'Rookie');
      await playByKeys(page, 'Green Light');
      await waitForMode(page, 'coup', 60_000);
      await page.keyboard.press('c');
      await page.waitForTimeout(1500);
    },
  },
  extension: { deal: (page) => stackFirstDeal(page, RUN_TO_700), stage: runTo700 },
  sheet: {
    deal: (page) => stackFirstDeal(page, RUN_TO_700),
    stage: async (page) => {
      await runTo700(page);
      await page.keyboard.press('n');
      await page.locator('.dt-sheet-wrap').waitFor({ timeout: 20_000 });
    },
  },
  results: {
    deal: (page) => stackFirstDeal(page, RUN_TO_700),
    stage: async (page) => {
      await runTo700(page);
      await page.keyboard.press('n');
      await page.locator('.dt-sheet-wrap').waitFor({ timeout: 20_000 });
      await page.keyboard.press('Enter');
      await page.locator('.dt-results').waitFor();
    },
  },
  daily: {
    stage: async (page) => void (await page.getByRole('button', { name: /Daily Road/ }).click()),
  },
  journal: {
    stage: async (page) =>
      void (await page.getByRole('button', { name: /Travel journal/ }).click()),
  },
  help: {
    stage: async (page) => void (await page.getByRole('button', { name: 'How to play' }).click()),
  },
  options: {
    stage: async (page) => void (await page.getByRole('button', { name: 'Options' }).click()),
  },
  teams: {
    stage: async (page) => {
      await page.getByRole('button', { name: /Teams/ }).click();
      await page.locator('.dt-start').click();
      await waitForMode(page, 'play', 60_000);
    },
  },
};

for (const [name, screen] of Object.entries(SCREENS)) {
  if (only && only !== name) continue;
  for (const look of LOOKS)
    for (const size of SIZES)
      test(`${name} · ${look} · ${size.width} @shots`, async ({ page }) => {
        await page.setViewportSize(size);
        await freshStorage(page);
        if (screen.deal) await screen.deal(page);
        const appearance = look === 'night' ? 'dark' : 'light';
        await openGame(
          page,
          `appearance=${appearance}&chrome=0&mute=1&reduced=${screen.motion ? 0 : 1}`,
        );
        await screen.stage(page);
        await save(page, name, look);
      });
}
