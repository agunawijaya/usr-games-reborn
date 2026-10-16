import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: live scenes from the workbench, drawn by the
 * game's own renderer and panels at 1920×1080, each board in its light and dark looks: the town
 * mid-game with a street going up and a token on the move, and the board's first-landmark
 * moment; and the trade table with a rival's counter-offer on Harbour City.
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const FRAMES = [
  ...(['harbour', 'colony', 'popup'] as const).flatMap((board) => [
    { query: `scene=mid&board=${board}`, name: `${board}-mid-game` },
    { query: `scene=tower&board=${board}`, name: `${board}-first-landmark` },
  ]),
  { query: 'scene=trade&board=harbour', name: 'harbour-trade-counter' },
];

for (const { query, name } of FRAMES) {
  for (const look of ['light', 'dark'] as const) {
    test(`@hero ${name}, ${look}`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/?${query}&look=${look}`);
      await page.waitForFunction(
        () => (window as unknown as { __ready?: boolean }).__ready === true,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900);
      expect(await page.locator('canvas.dd-world').count()).toBe(1);
      const size = await saveScreenshot(page, `${HERO}${name}-${look}-1920.webp`);
      console.log(`${name}-${look}-1920.webp ${size} KB`);
    });
  }
}
