import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: live scenes from the workbench, drawn by the
 * game's own painters and interface at 1920×1080, by morning and by night.
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const SCENES = [
  { scene: 'hub', name: 'desk-message-waiting' },
  { scene: 'cipher', name: 'cipher-crack' },
  { scene: 'banner', name: 'banner-reveal' },
  { scene: 'semaphore', name: 'semaphore-sending' },
] as const;

for (const { scene, name } of SCENES) {
  for (const look of ['morning', 'night'] as const) {
    test(`@hero ${name}, ${look}`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/?scene=${scene}&look=${look}&freeze=3`);
      await page.waitForFunction(
        () => (window as unknown as { __ready?: boolean }).__ready === true,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const size = await saveScreenshot(page, `${HERO}${name}-${look}-1920.webp`);
      console.log(`${name}-${look}-1920.webp ${size} KB`);
    });
  }
}
