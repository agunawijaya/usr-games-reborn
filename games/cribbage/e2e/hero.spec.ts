import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint, 1920 × 1080, on the porch and by the fire: the
 * play to 31 with a run of four just laid, a hand being counted with its fifteens lit, and the
 * perfect 29. `HERO_SCENE` and `HERO_LOOK` narrow the run to one frame.
 */

const SCENES = ['hero-play', 'hero-count', 'hero-perfect'] as const;
const LOOKS = ['porch', 'fireside'] as const;
const only = process.env.HERO_SCENE;
const onlyLook = process.env.HERO_LOOK;

for (const scene of SCENES) {
  if (only && only !== scene) continue;
  for (const look of LOOKS) {
    if (onlyLook && onlyLook !== look) continue;
    test(`${scene} ${look} @hero`, async ({ page }) => {
      await page.goto(`/?scene=${scene}&look=${look}&time=2`);
      await page.waitForFunction(() => window.__sceneReady === true, undefined, {
        timeout: 90_000,
      });
      await page.waitForTimeout(300);
      const name = `${scene.replace('hero-', '')}-${look}.webp`;
      const target = new URL(`../docs/media/hero/${name}`, import.meta.url);
      const kb = await saveScreenshot(page, fileURLToPath(target));
      console.log(`${name} ${kb} KB`);
      expect(kb).toBeLessThan(900);
    });
  }
}
