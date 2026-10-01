import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import {
  gameFrame,
  inGame,
  revealStrip,
  runInHall,
  waitForGame,
} from '../../../packages/bridge/testing/hall';
import { describeScenes, saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Robots inside the Hall, by day and by night (the Hall's
 * appearance; the stadium has a single night look). Run with `SHOTS=1`, see
 * playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));
const READY = "typeof window.__rr === 'object'";

/** The opening fall from a distant star to the stadium takes this long. */
const OPENING_MS = 7000;
/** And the robots of a new match beam down in this long. */
const BEAM_DOWN_MS = 4500;

for (const appearance of ['dark', 'light'] as const) {
  test(`the game menu and the first wave, Hall ${appearance}, 1920×1080`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await runInHall(page, 'robots', { appearance });
    await waitForGame(page, READY);
    await page.waitForTimeout(OPENING_MS);
    await revealStrip(page);
    await page.waitForTimeout(400);
    const size = await saveScreenshot(page, `${MEDIA}in-the-hall-${appearance}-1920.webp`);
    console.log(`robots in-the-hall-${appearance}-1920.webp ${size} KB`);
    // The stadium has one night look, so the uncovered play frame is taken once.
    if (appearance === 'dark') {
      await inGame(page, "window.__rr.start('exhibition')");
      await page.mouse.move(960, 600);
      await page.waitForTimeout(BEAM_DOWN_MS);
      const play = await saveScreenshot(page, `${MEDIA}first-wave-1920.webp`);
      console.log(`robots first-wave-1920.webp ${play} KB`);
    }
  });
}

/** Two robots either side of the player's column meet one row up: the wave is clear. */
const CLEAR_THE_WAVE =
  "window.__rr.setState({ level: 2, score: 990, player: { x: 30, y: 12 }, robots: [{ id: 1, x: 29, y: 9 }, { id: 2, x: 31, y: 9 }], piles: [], waitBonus: 0, status: 'playing' })";
/** A later wave (a new level number, after the advance to wave 3): one robot beside the player. */
const CAUGHT =
  "window.__rr.setState({ level: 4, score: 1010, player: { x: 30, y: 12 }, robots: [{ id: 1, x: 31, y: 12 }, { id: 2, x: 5, y: 3 }, { id: 3, x: 52, y: 20 }], piles: [{ x: 40, y: 15 }], waitBonus: 0, status: 'playing' })";
/** The run so far, as the tracker would have counted it. */
const RUN_SO_FAR = 'Object.assign(window.__rr.tracker(), { points: 1270, hype: 62 })';
const STAY = "window.__rr.act({ kind: 'move', direction: 'stay' })";

describeScenes({ id: 'robots', ready: READY }, MEDIA, [
  // The game menu over the stadium, once the camera has fallen from the star.
  { name: 'title', waitMs: OPENING_MS },
  {
    name: 'play',
    stage: async (page) => {
      await page.waitForTimeout(OPENING_MS);
      await inGame(page, "window.__rr.start('exhibition')");
    },
    waitMs: BEAM_DOWN_MS,
  },
  {
    // A wave cleared at Showtime: the crowd on its feet and fireworks over the stands.
    name: 'signature',
    stage: async (page) => {
      await inGame(page, "window.__rr.start('exhibition')");
      await page.waitForTimeout(BEAM_DOWN_MS);
      await inGame(page, CLEAR_THE_WAVE);
      await page.waitForTimeout(300);
      await inGame(page, 'window.__rr.tracker().hype = 90');
      await inGame(page, STAY);
    },
    waitMs: 5000,
  },
  {
    name: 'grand-tour',
    stage: async (page) => {
      await page.waitForTimeout(OPENING_MS);
      await gameFrame(page).getByTestId('rr-mode-tour').click();
    },
    waitMs: 600,
  },
  {
    name: 'match-report',
    stage: async (page) => {
      await inGame(page, "window.__rr.start('exhibition')");
      await page.waitForTimeout(BEAM_DOWN_MS);
      await inGame(page, CLEAR_THE_WAVE);
      await page.waitForTimeout(300);
      await inGame(page, STAY);
      await page.waitForTimeout(2500);
      await inGame(page, 'window.__rr.advance()');
      await page.waitForTimeout(2500);
      await inGame(page, CAUGHT);
      await page.waitForTimeout(300);
      await inGame(page, RUN_SO_FAR);
      await inGame(page, STAY);
    },
    waitMs: 7000,
  },
]);
