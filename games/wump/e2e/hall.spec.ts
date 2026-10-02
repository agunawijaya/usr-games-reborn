import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Hush the Wumpus inside the real Hall (its own dev server on port 5294): launched from the
 * Hall, and every way back out of it.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

async function openGame(page: Page) {
  await runInHall(page, 'wump', { appearance: 'dark' });
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible({ timeout: 30_000 });
}

/** The tutorial, played to its hush with the keyboard. */
async function hushTheTutorial(page: Page) {
  await page.getByRole('button', { name: /Tutorial/ }).click();
  for (const key of ['1', '1', '3', '2']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
  }
  await page.keyboard.press('a');
  await page.keyboard.press('3');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(page.locator('.hw-results__title')).toHaveText('Hushed!');
}

test.describe('Hush the Wumpus in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the game’s items, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await page.getByRole('button', { name: /Tutorial/ }).click();
    await expect(page.locator('.hw-room__name')).toHaveText('Room 1');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Next expedition: Classic rules',
      'Scout assist off',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await page.getByTestId('pl-confirm').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
  });

  test('Back to the Hall from the pause menu', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: /Tutorial/ }).click();
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Back to the Hall' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    await expectBackInHall(page);
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await hushTheTutorial(page);
    await page.waitForTimeout(800);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Play again on the results starts the same expedition', async ({ page }) => {
    await openGame(page);
    await hushTheTutorial(page);
    await page.waitForTimeout(800);
    await page.keyboard.press('r');
    await expect(page.locator('.hw-coach')).toContainText('A quiet room');
  });
});
