import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Sinkers inside the real Hall (its own dev server on port 5305): launched from the Hall, and
 * every way back out of it.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

async function openGame(page: Page) {
  await runInHall(page, 'blocks', { appearance: 'dark' });
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible({ timeout: 30_000 });
}

async function startMarathon(page: Page) {
  await page.getByRole('button', { name: /^Marathon/ }).click();
  await page.getByRole('button', { name: /^Dive at level/ }).click();
  await page.keyboard.press('ArrowRight');
}

/** Plunges until the tank is full and the card is up. */
async function fillTheTank(page: Page) {
  for (let i = 0; i < 80; i++) {
    if ((await page.locator('.snk-results__title').count()) > 0) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
  await expect(page.locator('.snk-results__title')).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(700);
}

test.describe('Sinkers in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the game’s items, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await startMarathon(page);
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Sonar: on',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await page.getByTestId('pl-confirm').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
  });

  test('P pauses as Escape does', async ({ page }) => {
    await openGame(page);
    await startMarathon(page);
    await page.keyboard.press('p');
    await expect(page.getByTestId('pl-pause')).toBeVisible();
  });

  test('Back to the Hall from the pause menu', async ({ page }) => {
    await openGame(page);
    await startMarathon(page);
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Back to the Hall' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    await expectBackInHall(page);
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await startMarathon(page);
    await fillTheTank(page);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Play again on the results starts the same kind of run', async ({ page }) => {
    await openGame(page);
    await startMarathon(page);
    await fillTheTank(page);
    await page.keyboard.press('r');
    await expect(page.locator('.snk-context')).toContainText('Marathon');
    await expect(page.locator('.snk-results')).toHaveCount(0);
  });
});
