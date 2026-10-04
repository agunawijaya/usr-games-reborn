import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { gameFrame } from '../../../packages/bridge/testing/hall';
import { describeScenes } from '../../../packages/bridge/testing/shots';
import { beginShift, followTheHints, READY, seedTheShift } from './shift';

/**
 * Documentation screenshots of Control Room 1986 inside the Hall at 1280×720: the game menu's
 * desk, the briefing clipboard, a shift on the Default sector, its signature moment (a plane
 * brought home with the radio reading it back), the printed report of a first assignment and
 * the logbook. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));
const SEED = 1986;

test.beforeEach(({ page }) => seedTheShift(page, SEED));

/** A new career's first-shift tips are for players; a tip still up is dismissed for the picture. */
async function dismissTips(page: Page) {
  const close = gameFrame(page).locator('#tip:not([hidden]) .tip-close');
  while (await close.count()) await close.click();
}

/** Begins an open shift on the Default sector; the reference card starts closed. */
async function beginOnDefault(page: Page) {
  await page.keyboard.press('2');
  await gameFrame(page).locator('.title-sector-btn[data-pf="default"]').click();
  await beginShift(page, 'open');
  await dismissTips(page);
}

/** The cheat panel helps the suite type; players never see it, so the pictures do not either. */
async function hideCheat(page: Page) {
  await page.keyboard.press('Control+Alt+KeyC');
  await expect(gameFrame(page).locator('#cheat-live-panel')).not.toHaveClass(/shown/);
}

/** The first assignment flown to its relief, with the report printed in full. */
async function relieved(page: Page) {
  await beginShift(page, 'career');
  await dismissTips(page);
  await followTheHints(page, 2);
  await expect(gameFrame(page).locator('#game-over')).toHaveClass(/shown/);
  await page.keyboard.press('Shift');
  await expect(gameFrame(page).locator('.report-actions')).toBeVisible();
}

describeScenes({ id: 'atc-classic', ready: READY }, MEDIA, [
  { name: 'title', waitMs: 2500 },
  {
    name: 'play',
    stage: async (page) => {
      await beginOnDefault(page);
      await followTheHints(page, Number.POSITIVE_INFINITY, 20);
      await hideCheat(page);
    },
    waitMs: 1200,
  },
  {
    name: 'signature',
    stage: async (page) => {
      await beginOnDefault(page);
      await followTheHints(page, 1);
      await hideCheat(page);
    },
    waitMs: 400,
  },
  {
    name: 'briefing',
    stage: async (page) => {
      await page.keyboard.press('1');
      await page.keyboard.press('Enter');
      await expect(gameFrame(page).locator('#briefing-overlay')).toHaveClass(/shown/);
    },
    waitMs: 600,
  },
  {
    name: 'report',
    stage: relieved,
    waitMs: 400,
  },
  {
    name: 'logbook',
    stage: async (page) => {
      await relieved(page);
      await page.keyboard.press('m');
      await page.keyboard.press('l');
      await expect(gameFrame(page).locator('#logbook-overlay')).toHaveClass(/shown/);
    },
    waitMs: 800,
  },
]);
