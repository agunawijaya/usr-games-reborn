import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { hostedSuiteConfig, runInHall, waitForGame } from './hall';

/**
 * Documentation screenshots of hosted games inside the Hall (`games/<id>/docs/media/`). They
 * are taken on the real GPU, because the adopted games drop to lighter looks on a software
 * renderer, and saved as WebP to stay well under the 800 KB a screenshot may weigh.
 */

/**
 * Chromium flags that let a headless browser draw WebGL on the machine's own GPU (Direct3D on
 * Windows). Where there is no GPU, Chromium keeps drawing in software.
 */
export const GPU_LAUNCH_ARGS = [
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--enable-gpu',
  '--ignore-gpu-blocklist',
];

const WEBP_QUALITY = 0.86;

/** Re-encodes a PNG capture as WebP in a blank page of the same browser. */
async function toWebp(page: Page, png: Buffer): Promise<Buffer> {
  const encoder = await page.context().newPage();
  try {
    const dataUrl = await encoder.evaluate(
      async ({ source, quality }) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d')!.drawImage(image, 0, 0);
        return canvas.toDataURL('image/webp', quality);
      },
      { source: `data:image/png;base64,${png.toString('base64')}`, quality: WEBP_QUALITY },
    );
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  } finally {
    await encoder.close();
  }
}

/** Saves the page as it looks now; returns the file size in kilobytes. */
export async function saveScreenshot(page: Page, file: string): Promise<number> {
  const webp = await toWebp(page, await page.screenshot());
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, webp);
  return Math.round(webp.length / 1024);
}

export interface HostedScene {
  /** File name stem: `<name>-1280.webp`. */
  name: string;
  /** Reopens the game's page inside the Hall's frame with these query parameters, to stage it. */
  query?: string;
  /** Readiness expression after a `query` reload, if different from the game's own. */
  ready?: string;
  /** Anything the scene needs once the game is ready (keys, clicks, the game's test hooks). */
  stage?: (page: Page) => Promise<void>;
  /** Settling time before the picture is taken. */
  waitMs?: number;
}

/**
 * One documentation screenshot per scene, of the game running inside the Hall at 1280×720 in
 * the Hall's dark appearance, into the game's `docs/media/`.
 */
export function describeScenes(
  game: { id: string; ready: string },
  media: string,
  scenes: readonly HostedScene[],
) {
  for (const scene of scenes) {
    test(`${scene.name}, 1280×720`, async ({ page }) => {
      await runInHall(page, game.id);
      await waitForGame(page, game.ready);
      if (scene.query) {
        const frame = page.frame({ url: new RegExp(`/play/${game.id}/`) });
        await frame!.goto(`${hostedSuiteConfig().baseURL}play/${game.id}/?${scene.query}`);
        await waitForGame(page, scene.ready ?? game.ready);
      }
      await scene.stage?.(page);
      await page.mouse.move(640, 400);
      await page.waitForTimeout(scene.waitMs ?? 1500);
      const size = await saveScreenshot(page, `${media}${scene.name}-1280.webp`);
      expect(size, 'a documentation screenshot stays under 800 KB').toBeLessThan(800);
    });
  }
}
