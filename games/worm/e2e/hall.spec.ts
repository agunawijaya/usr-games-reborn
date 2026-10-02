import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Noodle Nine inside the real Hall (its own dev server on port 5295): launched from the Hall, and
 * every way back out of it.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

async function openGame(page: Page) {
  await runInHall(page, 'worm', { appearance: 'dark' });
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible({ timeout: 30_000 });
}

/** Endless, straight up into the top edge: a bonk and its card. */
async function bonkInEndless(page: Page) {
  await page.getByRole('button', { name: /^Endless/ }).click();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.nn-results__title')).toHaveText('Bonk!', { timeout: 15_000 });
  await page.waitForTimeout(700);
}

test.describe('Noodle Nine in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the game’s items, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await page.getByRole('button', { name: /^Endless/ }).click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Classic tempo: off',
      'Grid lines: on',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await page.getByTestId('pl-confirm').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
  });

  test('Back to the Hall from the pause menu', async ({ page }) => {
    await openGame(page);
    await page.getByRole('button', { name: /^Endless/ }).click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Back to the Hall' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    await expectBackInHall(page);
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await bonkInEndless(page);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Play again on the results starts the same kind of run', async ({ page }) => {
    await openGame(page);
    await bonkInEndless(page);
    await page.keyboard.press('r');
    await expect(page.locator('.nn-start-hint')).toBeVisible();
    await expect(page.locator('.nn-context')).toContainText('Endless');
  });
});
