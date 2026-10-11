import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: live scenes from the workbench, drawn by the
 * game's own cube renderer and interface at 1920×1080, in Studio (light) and Arcade Glow (dark).
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const SCENES = [
  { query: 'scene=play&freeze=3', name: 'long-chain-mid-trace' },
  { query: 'scene=reveal&hover=0', name: 'the-reveal-web' },
  { query: 'scene=tumble&at=0.75', name: 'cubes-tumble-in' },
] as const;

for (const { query, name } of SCENES) {
  for (const look of ['studio', 'arcade'] as const) {
    test(`@hero ${name}, ${look}`, async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/?${query}&look=${look}`);
      await page.waitForFunction(
        () => (window as unknown as { __ready?: boolean }).__ready === true,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(700);
      expect(await page.locator('.chl-board__gl').count()).toBe(1);
      const size = await saveScreenshot(page, `${HERO}${name}-${look}-1920.webp`);
      console.log(`${name}-${look}-1920.webp ${size} KB`);
    });
  }
}
