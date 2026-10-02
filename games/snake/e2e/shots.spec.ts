import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import './hook';

/**
 * Documentation screenshots of Full Pockets inside the Hall, at 1280×720 and 1920×1080, in the
 * Hall's light (Sun Garden) and dark (Moon Garden) appearances. Run with `SHOTS=1`.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

async function save(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  const kb = await saveScreenshot(page, `${MEDIA}${name}-${width}.webp`);
  console.log(`${name}-${width}.webp ${kb} KB`);
}

async function intoRun(page: Page) {
  await page.getByRole('button', { name: /Start a run/ }).click();
  await page.getByTestId('fp-map').waitFor();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fp-map')).toBeHidden();
}

/** A chamber mid-run: a full satchel, the snake two squares off and the strike preview showing. */
async function stageMidRun(page: Page) {
  await page.evaluate(() => {
    const play = window.__fp.play()!;
    const round = play.session.round as unknown as { you: { x: number; y: number } };
    const { x, y } = round.you;
    play.stage({
      snake: [
        { x: x + 3, y: y + 1 },
        { x: x + 4, y: y + 2 },
        { x: x + 5, y: y + 2 },
        { x: x + 6, y: y + 3 },
        { x: x + 7, y: y + 3 },
        { x: x + 7, y: y + 4 },
      ],
      heading: 7,
      ledger: { gross: 1062, spent: 0 },
      loot: 250,
      pickups: 6,
    });
  });
}

for (const appearance of ['light', 'dark'] as const) {
  const look = appearance === 'light' ? 'sun' : 'moon';
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`Full Pockets in the Hall, ${look}, ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'snake', { appearance });
      await expect(page.getByTestId('fp-title')).toBeVisible();
      await page.waitForTimeout(2500);
      await save(page, `title-${look}`);

      await intoRun(page);
      await stageMidRun(page);
      await page.waitForTimeout(800);
      await save(page, `play-${look}`);

      // Caught on a record run: the wink, then the dial.
      const roll = await page.evaluate(() => window.__fp.play()!.session.luckyRollAfter(1));
      await page.evaluate((digit) => {
        const play = window.__fp.play()!;
        const { x, y } = play.session.round.you;
        play.stage({
          snake: [
            { x: x + 2, y },
            { x: x + 1, y },
            { x: x + 1, y: y + 1 },
            { x: x + 2, y: y + 1 },
            { x: x + 3, y: y + 1 },
            { x: x + 3, y },
          ],
          ledger: { gross: 1381 + ((digit + 1) % 10), spent: 0 },
        });
      }, roll);
      await page.keyboard.press('ArrowRight');
      await page.locator('[data-card="dial"]').waitFor({ timeout: 6000 });
      await page.waitForTimeout(1200);
      await save(page, `capture-${look}`);
      await page.getByTestId('fp-results').waitFor({ timeout: 8000 });
      await page.waitForTimeout(400);
      await save(page, `caught-${look}`);

      // A banked haul: the vault and the sulking snake.
      await page.keyboard.press('KeyR');
      await page.getByTestId('fp-map').waitFor();
      await page.keyboard.press('Enter');
      await page.evaluate(() => {
        const play = window.__fp.play()!;
        const round = play.session.round as unknown as {
          you: { x: number; y: number };
          garden: { width: number; height: number };
        };
        const corner = round.you.x < round.garden.width / 2 ? round.garden.width - 1 : 0;
        play.stage({
          garden: { ...round.garden, door: { x: round.you.x + 1, y: round.you.y } },
          snake: Array.from({ length: 6 }, (_, i) => ({
            x: corner === 0 ? i % 3 : corner - (i % 3),
            y: round.garden.height - 1 - Math.floor(i / 3),
          })),
          ledger: { gross: 1240, spent: 0 },
          loot: 250,
        });
      });
      await page.evaluate(() => window.__fp.play()!.played({ pickups: 17, closestHere: 1 }));
      await page.keyboard.press('ArrowRight');
      await page.getByTestId('fp-door').waitFor();
      await save(page, `door-${look}`);
      await page.keyboard.press('KeyB');
      await page.waitForTimeout(1500);
      await save(page, `bank-${look}`);
    });
  }
}
