import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import './hook';

/**
 * Documentation screenshots of Before the Tide inside the Hall, at 1280×720 and 1920×1080, in
 * the Hall's light (Midday) and dark (Moonlit Tide) appearances. Run with `SHOTS=1`.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

async function save(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  const kb = await saveScreenshot(page, `${MEDIA}${name}-${width}.webp`);
  console.log(`${name}-${width}.webp ${kb} KB`);
}

/** Plays letters by key, a short pause between them so each moment lands. */
async function play(page: Page, letters: string, pause = 250) {
  for (const letter of letters) {
    await page.keyboard.press(`Key${letter.toUpperCase()}`);
    await page.waitForTimeout(pause);
  }
}

for (const appearance of ['light', 'dark'] as const) {
  const look = appearance === 'light' ? 'midday' : 'moonlit';
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`Before the Tide in the Hall, ${look}, ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'hangman', { appearance });
      await expect(page.getByTestId('bt-menu')).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      await save(page, `menu-${look}`);

      await page.getByRole('button', { name: /Beach day/ }).click();
      await page.getByTestId('bt-decks').getByRole('radio', { name: /Ocean/ }).click();
      await save(page, `decks-${look}`);
      await page.getByRole('button', { name: /To the beach/ }).click();

      // Mid-word: two right letters, two waves, the second still rolling in.
      const secret = await page.evaluate(() => window.__bt.play()!.word);
      const wrong = [...'zqxjkvwy'].filter((letter) => !secret.includes(letter));
      const right = [...new Set(secret)].slice(0, 2).join('');
      await play(page, right + wrong[0]!);
      await page.waitForTimeout(2600);
      await play(page, wrong[1]!);
      await page.waitForTimeout(900);
      await save(page, `play-${look}`);

      await page.evaluate(() => window.__bt.play()!.solve());
      await page.waitForTimeout(1300);
      await save(page, `found-${look}`);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.evaluate(() => window.__bt.play()!.lose());
      await page.waitForTimeout(5200);
      await save(page, `tide-${look}`);

      await page.getByRole('button', { name: 'Head home' }).click();
      await expect(page.getByTestId('bt-results')).toBeVisible();
      await page.waitForTimeout(500);
      await save(page, `results-${look}`);
    });
  }
}
