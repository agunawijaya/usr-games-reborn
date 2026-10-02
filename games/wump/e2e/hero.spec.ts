import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The hero frames for the owner's checkpoint, 1920 × 1080, in both looks. `HERO_SCENE=play` renders
 * one scene; `HERO_OUT=<folder>` writes somewhere else (for critique rounds outside the repo).
 */

const SCENES = ['play', 'ride', 'hushed', 'loss'] as const;
const LOOKS = [
  { look: 'paper', file: 'scrap-paper' },
  { look: 'lantern', file: 'lantern-dark' },
] as const;
const only = process.env.HERO_SCENE;
const out = process.env.HERO_OUT ?? fileURLToPath(new URL('../docs/media/hero/', import.meta.url));
const size =
  process.env.HERO_SIZE === '1280' ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };

for (const scene of SCENES) {
  if (only && !only.split(',').includes(scene)) continue;
  for (const { look, file } of LOOKS) {
    test(`hero ${scene} in ${look} @hero`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(
        `/?scene=${scene}&look=${look}${process.env.HERO_TIME ? `&time=${process.env.HERO_TIME}` : ''}`,
      );
      await page.waitForFunction(() => window.__sceneReady === true, undefined, {
        timeout: 60_000,
      });
      const name = `${scene}-${file}${size.width === 1280 ? '-1280' : ''}.webp`;
      const kb = await saveScreenshot(page, join(out, name));
      console.log(`${name} ${kb} KB`);
      expect(kb).toBeLessThan(900);
    });
  }
}
