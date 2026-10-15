import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Detour inside the real Hall (its own dev server on port 5316): launched from the Hall, its
 * pause item, its own results with the Hall's receipt, every way back out, and not one request
 * beyond its own files.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

/** Every request to anywhere but this Hall (hard rule 4: no runtime network). */
function watchForeignRequests(page: Page): () => string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== `http://localhost:${HALL_PORT}`) foreign.push(request.url());
  });
  return () => [...foreign];
}

async function openGame(page: Page) {
  await runInHall(page, 'mille', { appearance: 'dark', motion: 'reduce' });
  await expect(page.locator('.dt-title')).toBeVisible({ timeout: 30_000 });
}

async function quickHand(page: Page) {
  await page.getByRole('button', { name: /Quick hand/ }).click();
  await page.locator('.dt-start').click();
  await expect(page.locator('.dt-table')).toHaveAttribute('data-mode', 'play', { timeout: 30_000 });
}

async function finishHand(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { __dtTable: { setAutoplay(on: boolean): void } }).__dtTable.setAutoplay(
      true,
    ),
  );
  await page.getByRole('button', { name: /See the result/ }).click({ timeout: 120_000 });
  await expect(page.locator('.dt-results')).toBeVisible();
}

test.describe('Detour in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the helper switch, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await quickHand(page);
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button', { name: 'Turn the helper off' })).toBeVisible();
    await pause.getByRole('button', { name: 'Game menu' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    else await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.locator('.dt-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /Continue/ })).toBeVisible();
  });

  test('a finished hand shows the game’s own results with the Hall’s receipt; H goes home', async ({
    page,
  }) => {
    const foreign = watchForeignRequests(page);
    await openGame(page);
    await quickHand(page);
    await finishHand(page);
    await expect(page.locator('.dt-results')).toContainText('XP');
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    await expectBackInHall(page);
    expect(foreign()).toEqual([]);
  });

  test('Play again deals afresh without leaving', async ({ page }) => {
    await openGame(page);
    await quickHand(page);
    await finishHand(page);
    await page.waitForTimeout(700);
    await page.keyboard.press('r');
    await expect(page.locator('.dt-results')).toBeHidden();
    await expect(page.locator('.dt-table')).toBeVisible();
  });
});
