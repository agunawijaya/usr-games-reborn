import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { gameFrame, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { describeScenes, saveScreenshot } from '../../../packages/bridge/testing/shots';
import {
  beginCareerShift,
  clearTheShift,
  reachTheCanyonCut,
  READY,
  setUpACanyonNearClear,
} from './shift';

/**
 * Documentation screenshots of Broken Well inside the Hall at 1280×720: the game menu, a
 * briefing, the Canyon Cut mid-shift with a line about to clear, the report and the trail of
 * shifts afterwards. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'blocks-classic', ready: READY }, MEDIA, [
  { name: 'title', waitMs: 1500 },
  {
    name: 'briefing',
    stage: async (page) => {
      await gameFrame(page)
        .getByRole('button', { name: /Continue/ })
        .click();
      await expect(gameFrame(page).getByText('Your contracts')).toBeVisible();
    },
    waitMs: 400,
  },
  {
    name: 'play',
    stage: async (page) => {
      await reachTheCanyonCut(page);
      await setUpACanyonNearClear(page);
    },
    waitMs: 600,
  },
  {
    name: 'report',
    stage: async (page) => {
      await beginCareerShift(page);
      await clearTheShift(page);
    },
    waitMs: 500,
  },
  {
    name: 'trail',
    stage: async (page) => {
      await beginCareerShift(page);
      await clearTheShift(page);
      await gameFrame(page).getByRole('button', { name: 'Game menu' }).click();
      await gameFrame(page)
        .getByRole('button', { name: /The Shifts/ })
        .click();
    },
    waitMs: 400,
  },
]);

/**
 * The signature moment at 1920×1080, and the light look, beyond `describeScenes`' fixed
 * 1280×720 dark capture (the shared helper every adopted game's suite uses). Both prove the
 * hero-frame checkpoint was checked at both sizes and in both appearances, not just the one the
 * shared screenshot helper takes.
 */
test.describe('additional hero-frame sizes', () => {
  test('the Canyon Cut at 1920×1080', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await runInHall(page, 'blocks-classic');
    await waitForGame(page, READY);
    await reachTheCanyonCut(page);
    await setUpACanyonNearClear(page);
    await page.mouse.move(960, 600);
    await page.waitForTimeout(600);
    const size = await saveScreenshot(page, `${MEDIA}play-1920.webp`);
    expect(size, 'a documentation screenshot stays under 800 KB').toBeLessThan(800);
  });

  test('the Canyon Cut in the light look', async ({ page }) => {
    await runInHall(page, 'blocks-classic', { appearance: 'light' });
    await waitForGame(page, READY);
    await reachTheCanyonCut(page);
    await setUpACanyonNearClear(page);
    await page.mouse.move(640, 400);
    await page.waitForTimeout(600);
    const size = await saveScreenshot(page, `${MEDIA}play-light-1280.webp`);
    expect(size, 'a documentation screenshot stays under 800 KB').toBeLessThan(800);
  });
});
