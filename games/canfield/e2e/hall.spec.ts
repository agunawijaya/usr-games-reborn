import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Thirteen Down inside the real Hall (its own dev server on port 5309): launched from the Hall,
 * its pause items, its own results, and every way back out.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

async function openGame(page: Page) {
  await runInHall(page, 'canfield', { appearance: 'dark', motion: 'reduce' });
  await expect(page.getByTestId('td-title')).toBeVisible({ timeout: 30_000 });
}

async function newDeal(page: Page) {
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-deal-go').click();
  await expect(page.getByTestId('td-play')).toBeVisible();
}

async function endDeal(page: Page) {
  await page.keyboard.press('/');
  await page.keyboard.type('q');
  await page.keyboard.press('Enter');
  await page.getByTestId('td-confirm-yes').click();
  await expect(page.getByTestId('td-results')).toBeVisible();
}

test.describe('Thirteen Down in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the game’s items, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await newDeal(page);
    await page.keyboard.press('d');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Take back a move',
      'Hint',
      'Insight on or off',
      'End this deal',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    else await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('td-title')).toBeVisible();
    // The deal waits to be continued.
    await expect(page.getByTestId('td-menu-continue')).toBeVisible();
  });

  test('a finished deal shows the game’s own results with the Hall’s receipt; H goes home', async ({
    page,
  }) => {
    await openGame(page);
    await newDeal(page);
    await page.keyboard.press('d');
    await endDeal(page);
    await expect(page.locator('.td-results__notes')).toContainText('XP');
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Play again deals afresh without leaving', async ({ page }) => {
    await openGame(page);
    await newDeal(page);
    await endDeal(page);
    await page.waitForTimeout(700);
    await page.keyboard.press('r');
    await expect(page.getByTestId('td-play')).toBeVisible();
    await expect(page.getByTestId('td-results')).toBeHidden();
  });
});
