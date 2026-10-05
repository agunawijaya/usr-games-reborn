import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: live scenes from the workbench, drawn by the
 * game's own water shader, castle painter and interface at 1920×1080, at midday and by moonlight.
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const SCENES = [
  { scene: 'midround', name: 'mid-round-wave-cresting' },
  { scene: 'win', name: 'the-castle-stands' },
  { scene: 'title', name: 'game-menu-attract' },
] as const;

for (const { scene, name } of SCENES) {
  for (const look of ['midday', 'moonlit'] as const) {
    test(`@hero ${name}, ${look}`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/?scene=${scene}&look=${look}&freeze=9`);
      await page.waitForFunction(
        () => (window as unknown as { __ready?: boolean }).__ready === true,
      );
      expect(await page.evaluate(() => (window as unknown as { __webgl?: boolean }).__webgl)).toBe(
        true,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const size = await saveScreenshot(page, `${HERO}${name}-${look}-1920.webp`);
      console.log(`${name}-${look}-1920.webp ${size} KB`);
    });
  }
}
