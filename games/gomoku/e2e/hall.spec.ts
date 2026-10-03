import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { boardGeometry } from '../src/render/geometry';
import { HALL_PORT } from './ports';

/**
 * Fivefold inside the real Hall (its own dev server on port 5306): launched from the Hall, and
 * every way back out of it.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

async function openGame(page: Page) {
  await runInHall(page, 'gomoku', { appearance: 'dark' });
  await expect(page.getByRole('navigation', { name: 'Game menu' })).toBeVisible({
    timeout: 30_000,
  });
}

async function clickPoint(page: Page, p: number) {
  const box = (await page.getByTestId('board').boundingBox())!;
  const g = boardGeometry({ x: box.x, y: box.y, width: box.width, height: box.height }, 15);
  await page.mouse.click(g.left + (p % 15) * g.cell, g.top + Math.floor(p / 15) * g.cell);
}

async function startTwoPlayers(page: Page) {
  await page.getByRole('button', { name: /Two players/ }).click();
  await page.getByRole('button', { name: /Start the game/ }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

test.describe('Fivefold in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the game’s items, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await startTwoPlayers(page);
    await clickPoint(page, 7 * 15 + 7);
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      /Read the board/,
      'Take back a move',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    else await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('navigation', { name: 'Game menu' })).toBeVisible();
  });

  test('Back to the Hall from the pause menu', async ({ page }) => {
    await openGame(page);
    await startTwoPlayers(page);
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Back to the Hall' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    await expectBackInHall(page);
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await startTwoPlayers(page);
    for (let i = 0; i < 5; i++) {
      await clickPoint(page, 7 * 15 + 3 + i);
      if (i < 4) await clickPoint(page, 9 * 15 + 3 + i);
    }
    await expect(page.locator('.ff-results')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });
});
