import { fileURLToPath } from 'node:url';
import { type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import {
  challenge,
  commandMove,
  freshStorage,
  openGame,
  playProof,
  settle,
  startChallenge,
} from './table';

/**
 * Documentation screens for docs/media/screens/, every screen at 1280 × 720 and 1920 × 1080 in
 * both rooms. Run with `--grep @shots`.
 */

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const LOOKS = ['light', 'dark'] as const;
const only = process.env.SHOT;

async function save(page: Page, name: string, look: string) {
  const size = page.viewportSize()!;
  const room = look === 'dark' ? 'observatory' : 'sunroom';
  const target = new URL(
    `../docs/media/screens/${name}-${room}-${size.width}.webp`,
    import.meta.url,
  );
  await settle(page, 250);
  await saveScreenshot(page, fileURLToPath(target));
}

type Stage = (page: Page) => Promise<void>;

const SCREENS: Record<string, Stage> = {
  title: async () => {},
  'new-deal': async (page) => {
    await page.getByTestId('td-menu-new').click();
  },
  daily: async (page) => {
    await page.getByTestId('td-menu-daily').click();
  },
  challenges: async (page) => {
    await page.getByTestId('td-menu-challenges').click();
  },
  help: async (page) => {
    await page.getByTestId('td-menu-help').click();
  },
  settings: async (page) => {
    await page.getByTestId('td-menu-settings').click();
  },
  records: async (page) => {
    await page.getByTestId('td-menu-records').click();
  },
  table: async (page) => {
    const c = challenge('c20');
    await startChallenge(page, c.id);
    await playProof(page, c.proof.slice(0, 60), (code) => commandMove(page, code));
  },
  insight: async (page) => {
    const c = challenge('c20');
    await startChallenge(page, c.id);
    await playProof(page, c.proof.slice(0, 30), (code) => commandMove(page, code));
    await page.keyboard.press('c');
  },
  'bank-stage': async (page) => {
    await page.getByTestId('td-menu-new').click();
    await page.getByTestId('td-scoring-bank').check();
    await page.getByTestId('td-deal-go').click();
    await page.getByTestId('td-play').waitFor();
  },
  'bank-ledger': async (page) => {
    await page.getByTestId('td-menu-new').click();
    await page.getByTestId('td-scoring-bank').check();
    await page.getByTestId('td-deal-go').click();
    await page.getByTestId('td-play').waitFor();
    await page.keyboard.press('i');
    await page.keyboard.press('p');
    for (let i = 0; i < 5; i++) await page.keyboard.press('d');
    await page.keyboard.press('l');
  },
  tutorial: async (page) => {
    await page.getByTestId('td-menu-tutorial').click();
    await page.getByTestId('td-play').waitFor();
    await page.getByTestId('td-coach-next').click();
  },
  'results-won': async (page) => {
    const c = challenge('c19');
    await startChallenge(page, c.id);
    await playProof(page, c.proof, (code) => commandMove(page, code));
    await page.getByTestId('td-results').waitFor({ timeout: 20_000 });
  },
  'results-lost': async (page) => {
    await page.getByTestId('td-menu-new').click();
    await page.getByTestId('td-deal-go').click();
    await page.getByTestId('td-play').waitFor();
    for (let i = 0; i < 6; i++) await page.keyboard.press('d');
    await commandMove(page, 'q');
    await page.getByTestId('td-confirm-yes').click();
    await page
      .getByTestId('td-verdict')
      .getByText(/won|could not|settle/)
      .waitFor({ timeout: 20_000 });
  },
};

for (const [name, stage] of Object.entries(SCREENS)) {
  if (only && only !== name) continue;
  for (const look of LOOKS)
    for (const size of SIZES)
      test(`${name} · ${look} · ${size.width} @shots`, async ({ page }) => {
        await page.setViewportSize(size);
        await freshStorage(page);
        await openGame(page, `&appearance=${look}&chrome=0`);
        await stage(page);
        await save(page, name, look);
      });
}
