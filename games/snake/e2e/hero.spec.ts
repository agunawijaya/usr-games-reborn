import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: live scenes from the workbench, rendered by the
 * game's own garden view and interface at 1920×1080, by day and by moonlight.
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const SCENES = [
  { scene: 'chamber', name: 'chamber-mid-run' },
  { scene: 'coil', name: 'coil-and-lucky-break' },
  { scene: 'bank', name: 'bank-cascade' },
  { scene: 'wink', name: 'the-wink' },
] as const;

for (const { scene, name } of SCENES) {
  for (const look of ['sun', 'moon'] as const) {
    test(`@hero ${name}, ${look}`, async ({ page }) => {
      await page.goto(`/?scene=${scene}&look=${look}&freeze=2.4`);
      await page.waitForFunction(
        () => (window as unknown as { __ready?: boolean }).__ready === true,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const size = await saveScreenshot(page, `${HERO}${name}-${look}-1920.webp`);
      console.log(`${name}-${look}-1920.webp ${size} KB`);
    });
  }
}
