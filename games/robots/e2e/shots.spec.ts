import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { inGame, revealStrip, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { describeScenes, saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Robots inside the Hall, by day and by night (the Hall's
 * appearance; the stadium has a single night look). Run with `SHOTS=1`, see
 * playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

/** The opening fall from a distant star into the arena, and the robots beaming down, take this long. */
const OPENING_MS = 7000;

for (const appearance of ['dark', 'light'] as const) {
  test(`the first wave on the glass arena, Hall ${appearance}, 1920×1080`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await runInHall(page, 'robots', { appearance });
    await waitForGame(page, "typeof window.__rr === 'object'");
    await page.mouse.move(960, 600);
    await page.waitForTimeout(OPENING_MS);
    // The stadium has one night look, so the uncovered play frame is taken once.
    if (appearance === 'dark') {
      const size = await saveScreenshot(page, `${MEDIA}first-wave-1920.webp`);
      console.log(`robots first-wave-1920.webp ${size} KB`);
    }
    await revealStrip(page);
    await page.waitForTimeout(400);
    const size = await saveScreenshot(page, `${MEDIA}in-the-hall-${appearance}-1920.webp`);
    console.log(`robots in-the-hall-${appearance}-1920.webp ${size} KB`);
  });
}

/** Two robots either side of the player's column meet one row up: the wave is clear. */
const CLEAR_THE_WAVE =
  "window.__rr.setState({ level: 2, score: 990, player: { x: 30, y: 12 }, robots: [{ id: 1, x: 29, y: 9 }, { id: 2, x: 31, y: 9 }], piles: [], waitBonus: 0, status: 'playing' }); window.__rr.act({ kind: 'move', direction: 'stay' })";

describeScenes({ id: 'robots', ready: "typeof window.__rr === 'object'" }, MEDIA, [
  // The game opens on the far-off stadium, a single bright star, then falls toward it.
  { name: 'title', waitMs: 600 },
  { name: 'play', waitMs: 7000 },
  {
    name: 'signature',
    stage: async (page) => {
      await page.waitForTimeout(5000);
      await inGame(page, CLEAR_THE_WAVE);
    },
    waitMs: 6000,
  },
]);
