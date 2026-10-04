import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint: positions played by the real engine, drawn by the
 * game's own renderer and interface at 1920×1080, in Sidewalk Chalk and in Night Neon.
 */
const HERO = fileURLToPath(new URL('../docs/media/hero/', import.meta.url));

const SCENES = [
  { scene: 'midgame', name: 'midgame-chain-lens' },
  { scene: 'double-cross', name: 'double-cross-cascade' },
  { scene: 'tutorial', name: 'tutorial-the-double-cross' },
] as const;

const LOOKS = [
  { look: 'chalk', appearance: 'light' },
  { look: 'neon', appearance: 'dark' },
] as const;

for (const { scene, name } of SCENES) {
  for (const { look, appearance } of LOOKS) {
    test(`@hero ${name}, ${appearance}`, async ({ page }) => {
      await page.goto(`/?scene=${scene}&look=${look}&freeze=2.4`);
      await page.waitForFunction('window.__ready === true');
      await page.evaluate('document.fonts.ready');
      await page.waitForTimeout(600);
      const size = await saveScreenshot(page, `${HERO}${name}-${appearance}-1920.webp`);
      console.log(`${name}-${appearance}-1920.webp ${size} KB`);
    });
  }
}
