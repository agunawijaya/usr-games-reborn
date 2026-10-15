import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint, 1920 × 1080, by morning and by firefly light:
 * mid-game with all three rivals and the notebook open, a "Go Fish!" cast being reeled in, a
 * book leaping into the bucket as its fish, and the golden variant of that leap.
 * `HERO_SCENE` and `HERO_LOOK` narrow the run to one frame.
 */

const SCENES = [
  { name: 'midgame', query: 'scene=midgame' },
  { name: 'cast-and-reel', query: 'scene=cast&age=1.62' },
  { name: 'book-to-fish', query: 'scene=book&age=1.02' },
  { name: 'golden-fish', query: 'scene=golden&age=1.05' },
] as const;
const LOOKS = ['morning', 'firefly'] as const;
const only = process.env.HERO_SCENE;
const onlyLook = process.env.HERO_LOOK;

for (const scene of SCENES) {
  if (only && only !== scene.name) continue;
  for (const look of LOOKS) {
    if (onlyLook && onlyLook !== look) continue;
    test(`hero ${scene.name} in ${look} @hero`, async ({ page }) => {
      await page.goto(`/?${scene.query}&look=${look}&time=2`);
      await page.waitForFunction(() => window.__sceneReady === true, undefined, {
        timeout: 90_000,
      });
      await page.waitForTimeout(300);
      const target = new URL(`../docs/media/hero/${scene.name}-${look}.webp`, import.meta.url);
      const kb = await saveScreenshot(page, fileURLToPath(target));
      console.log(`${scene.name}-${look}.webp ${kb} KB`);
      expect(kb).toBeLessThan(900);
    });
  }
}
