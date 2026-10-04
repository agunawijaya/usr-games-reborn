import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import './hook';

/**
 * Documentation screenshots of Double Cross inside the Hall, at 1280×720 and 1920×1080, in the
 * Hall's light (Sidewalk Chalk) and dark (Night Neon) appearances. Run with `SHOTS=1`.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

async function save(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  const kb = await saveScreenshot(page, `${MEDIA}${name}-${width}.webp`);
  process.stdout.write(`${name}-${width}.webp ${kb} KB\n`);
}

/** Plays your lines as Master would until `lines` are on the board (or the game ends). */
async function playTo(page: Page, lines: number) {
  await page.waitForFunction(
    `(() => {
      const p = window.__dx.play();
      if (!p || p.match.over || p.match.turns.length >= ${lines}) return true;
      if (p.humanToMove) p.play(p.suggest());
      else p.skipWait();
      return false;
    })()`,
    undefined,
    { polling: 60, timeout: 60_000 },
  );
}

const horizontal = (columns: number, row: number, column: number) => row * columns + column;
const vertical = (columns: number, rows: number, row: number, column: number) =>
  (rows + 1) * columns + row * (columns + 1) + column;

for (const appearance of ['light', 'dark'] as const) {
  const look = appearance === 'light' ? 'chalk' : 'neon';
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`Double Cross in the Hall, ${look}, ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'dab', { appearance });
      await expect(page.getByTestId('dx-title')).toBeVisible();
      await page.waitForTimeout(2500);
      await save(page, `title-${look}`);

      await page.getByTestId('dx-go-ladder').click();
      await save(page, `ladder-${look}`);

      await page.getByTestId('dx-rung-1').click();
      await save(page, `intro-${look}`);
      await page.getByTestId('dx-start').click();
      await page.keyboard.press('KeyC');
      await playTo(page, 10);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(900);
      await save(page, `play-${look}`);
      await playTo(page, 999);
      await expect(page.getByTestId('dx-results')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(600);
      await save(page, `results-${look}`);

      await page.getByTestId('dx-results').getByRole('button', { name: 'Game menu' }).click();
      await page.getByTestId('dx-go-puzzles').click();
      await save(page, `puzzles-${look}`);
      await page.getByTestId('dx-puzzle-26').click();
      await page.getByTestId('dx-start').click();
      await page.getByTestId('dx-lens').click();
      await page.waitForTimeout(600);
      await save(page, `puzzle-${look}`);

      // The tutorial's last step, played to the double cross itself.
      await page.getByTestId('dx-menu').click();
      await page.getByTestId('dx-go-tutorial').click();
      await page.evaluate('window.__dx.play().play(0)');
      await page.getByTestId('dx-coach-next').click();
      await page.evaluate(`window.__dx.play().play(${vertical(2, 2, 0, 1)})`);
      await page.evaluate(`window.__dx.play().play(${horizontal(2, 2, 1)})`);
      await page.getByTestId('dx-coach-next').click();
      for (const c of [1, 2, 3])
        await page.evaluate(`window.__dx.play().play(${vertical(3, 1, 0, c)})`);
      await page.getByTestId('dx-coach-next').click();
      await page.evaluate('window.__dx.play().play(0)');
      await playTo(page, 999);
      await page.getByTestId('dx-coach-next').click();
      await page.evaluate(`window.__dx.play().play(${vertical(4, 2, 0, 1)})`);
      await page.evaluate(`window.__dx.play().play(${vertical(4, 2, 0, 2)})`);
      await page.waitForTimeout(700);
      await save(page, `tutorial-${look}`);
      await page.evaluate(`window.__dx.play().play(${vertical(4, 2, 0, 4)})`);
      await page.waitForTimeout(650);
      await save(page, `double-cross-${look}`);
    });
  }
}
