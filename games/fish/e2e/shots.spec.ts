import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The documentation screens (`--grep @shots`): the game menu, a Quick game's setup, play with
 * the notebook open, the results, the album, the Tournament, the Daily Pond and How to play, by
 * morning and by firefly light, at 1280 × 720 and 1920 × 1080, into docs/media/.
 */

const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
] as const;
/** The Quick game every picture shows: books made on both sides a few asks in, a win at the end. */
const DOCUMENTED_GAME = 'docs-pond-10';
const LOOKS = [
  { name: 'morning', appearance: 'light' },
  { name: 'firefly', appearance: 'dark' },
] as const;

async function save(page: Page, name: string, look: string, width: number): Promise<void> {
  await page.waitForTimeout(350);
  const target = new URL(`../docs/media/${name}-${look}-${width}.webp`, import.meta.url);
  const kb = await saveScreenshot(page, fileURLToPath(target));
  console.log(`${name}-${look}-${width}.webp ${kb} KB`);
  expect(kb).toBeLessThan(800);
}

async function playToTheEnd(page: Page): Promise<void> {
  await page.evaluate(() => window.__gf!.fast(40));
  for (let guard = 0; guard < 800; guard++) {
    const phase = await page.evaluate(() => window.__gf!.phase());
    if (phase === 'results') return;
    if (phase === 'your-turn') await page.evaluate(() => window.__gf!.askSmart());
    await page.waitForTimeout(30);
  }
}

for (const size of SIZES) {
  for (const look of LOOKS) {
    test(`screens ${look.name} ${size.width} @shots`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.setViewportSize(size);
      await page.goto(
        `/?game&fresh=1&sample=1&chrome=0&appearance=${look.appearance}&date=2026-10-15`,
      );
      await page.waitForFunction(() => window.__gf !== undefined);
      await expect(page.getByTestId('gf-title')).toBeVisible();
      await save(page, 'game-menu', look.name, size.width);

      await page.getByTestId('gf-menu-quick').click();
      await save(page, 'quick-game', look.name, size.width);
      await page.evaluate((seed) => window.__gf!.nextSeed(seed), DOCUMENTED_GAME);
      await page.getByTestId('gf-quick-start').click();
      // A few rounds in, so the notebook has something to say.
      await page.evaluate(() => window.__gf!.fast(20));
      for (let asks = 0; asks < 4; asks++) {
        await expect
          .poll(() => page.evaluate(() => window.__gf!.phase()), { timeout: 60_000 })
          .toMatch(/your-turn|results/);
        if ((await page.evaluate(() => window.__gf!.phase())) !== 'your-turn') break;
        if (asks < 3) await page.evaluate(() => window.__gf!.askSmart());
      }
      await page.evaluate(() => window.__gf!.fast(1));
      await page.waitForTimeout(1200);
      await save(page, 'play', look.name, size.width);

      await playToTheEnd(page);
      await save(page, 'results', look.name, size.width);
      await page.getByTestId('gf-results-menu').click();
      for (const [menu, name] of [
        ['album', 'album'],
        ['tournament', 'tournament'],
        ['daily', 'daily-pond'],
        ['help', 'how-to-play'],
      ] as const) {
        await page.getByTestId(`gf-menu-${menu}`).click();
        await save(page, name, look.name, size.width);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('gf-title')).toBeVisible();
      }
    });
  }
}
