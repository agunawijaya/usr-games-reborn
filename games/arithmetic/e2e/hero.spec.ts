import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: live scenes from the workbench, drawn by the
 * game's own worlds and interface at 1920×1080, in both themes, by day and by night.
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const SCENES = [
  { scene: 'sums', name: 'quick-sums-mid-block' },
  { scene: 'split', name: 'split-the-last-split' },
  { scene: 'menu', name: 'game-menu-daily' },
] as const;

for (const { scene, name } of SCENES) {
  for (const theme of ['sprint', 'atom'] as const) {
    for (const look of ['day', 'night'] as const) {
      test(`@hero ${name}, ${theme}, ${look}`, async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(`/?scene=${scene}&theme=${theme}&look=${look}`);
        await page.waitForFunction(
          () => (window as unknown as { __ready?: boolean }).__ready === true,
        );
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const size = await saveScreenshot(page, `${HERO}${name}-${theme}-${look}-1920.webp`);
        console.log(`${name}-${theme}-${look}-1920.webp ${size} KB`);
      });
    }
  }
}
