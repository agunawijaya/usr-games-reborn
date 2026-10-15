import { expect, test } from '@playwright/test';

/**
 * Close-up checks while drawing: `LOOK=scene=fish&look=firefly LOOK_OUT=<file.png>` saves one
 * workbench scene as a PNG wherever asked (normally outside the repository), at `LOOK_SIZE`
 * (`1920x1080` unless given), optionally cropped (`LOOK_CLIP`) and magnified (`LOOK_DPR`).
 * Nothing here is kept as documentation.
 */
test.use({ deviceScaleFactor: Number(process.env.LOOK_DPR ?? 1) });

test('workbench scene close up @look', async ({ page }) => {
  const query = process.env.LOOK ?? 'scene=fish';
  const out = process.env.LOOK_OUT;
  expect(out, 'LOOK_OUT names the file to write').toBeTruthy();
  const [width, height] = (process.env.LOOK_SIZE ?? '1920x1080').split('x').map(Number);
  await page.setViewportSize({ width: width!, height: height! });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__sceneReady === true, undefined, { timeout: 90_000 });
  await page.waitForTimeout(Number(process.env.LOOK_WAIT ?? 250));
  // LOOK_CLIP=x,y,w,h crops a region, at LOOK_DPR times its size for a close look.
  const [x, y, w, h] = (process.env.LOOK_CLIP ?? '').split(',').map(Number);
  const clip = w && h ? { x: x!, y: y!, width: w, height: h } : undefined;
  await page.screenshot({ path: out!, scale: 'device', clip });
});
