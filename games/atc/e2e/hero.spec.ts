import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/** The hero frames for the owner's checkpoint, 1920 × 1080, in both looks. */

const SCENES = ['rush', 'tilt', 'pearls', 'loss', 'tapestry'] as const;
const LOOKS = [
  { look: 'chart', file: 'day-chart' },
  { look: 'scope', file: 'night-scope' },
] as const;
const only = process.env.HERO_SCENE;

for (const scene of SCENES) {
  if (only && only !== scene) continue;
  for (const { look, file } of LOOKS) {
    test(`hero ${scene} in ${look} @hero`, async ({ page }) => {
      await page.goto(`/?scene=${scene}&look=${look}`);
      await page.waitForFunction(() => window.__sceneReady === true);
      const target = new URL(`../docs/media/hero/${scene}-${file}.webp`, import.meta.url);
      const kb = await saveScreenshot(page, fileURLToPath(target));
      console.log(`${scene}-${file}.webp ${kb} KB`);
      expect(kb).toBeLessThan(900);
    });
  }
}
