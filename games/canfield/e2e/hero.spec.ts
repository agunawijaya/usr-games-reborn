import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/** The hero frames for the owner's checkpoint, 1920 × 1080, in both rooms. */

const SCENES = ['midgame', 'finish', 'deck-sheet'] as const;
const LOOKS = ['sunroom', 'observatory'] as const;
const only = process.env.HERO_SCENE;
const onlyLook = process.env.HERO_LOOK;

for (const scene of SCENES) {
  if (only && only !== scene) continue;
  for (const look of LOOKS) {
    if (onlyLook && onlyLook !== look) continue;
    test(`hero ${scene} in ${look} @hero`, async ({ page }) => {
      await page.goto(`/?scene=${scene}&look=${look}${process.env.HERO_QUERY ?? ''}`);
      await page.waitForFunction(() => window.__sceneReady === true, undefined, {
        timeout: 90_000,
      });
      await page.waitForTimeout(300);
      const target = new URL(`../docs/media/hero/${scene}-${look}.webp`, import.meta.url);
      const kb = await saveScreenshot(page, fileURLToPath(target));
      console.log(`${scene}-${look}.webp ${kb} KB`);
      expect(kb).toBeLessThan(900);
    });
  }
}
