import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Deeds & Dice inside the real Hall (its own dev server on port 5314, `--grep @hall`): launched
 * from the Hall, its pause items, a scenario played by keys to the game's own recap with the
 * Hall's receipt, every way back out, and not one request beyond the Hall's own files.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/`, viewport: { width: 1280, height: 720 } });

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

async function openGame(page: Page): Promise<void> {
  await runInHall(page, 'monop', { appearance: 'light', motion: 'reduce' });
  await expect(page.locator('.dd-menu-card')).toBeVisible({ timeout: 60_000 });
}

/**
 * Plays the person's part by keys until the recap shows: the main choice on the action bar,
 * offers turned down, auctions passed, and a debt settled by leaving the game.
 */
async function playToTheRecap(page: Page): Promise<void> {
  const recap = page.locator('.dd-results');
  const primary = page.locator('.dd-actions .dd-action--primary:not(:disabled)');
  const deadline = Date.now() + 360_000;
  while (!(await recap.isVisible())) {
    expect(Date.now(), 'the scenario should end within six minutes').toBeLessThan(deadline);
    if (await page.locator('.dd-trade').isVisible()) await page.keyboard.press('Escape');
    else if (await page.locator('.dd-auction-bids').isVisible()) await page.keyboard.press('p');
    else if (await page.locator('.dd-debt').isVisible()) await page.keyboard.press('l');
    else if (await primary.isVisible()) await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
}

test.describe('Deeds & Dice in the Hall @hall', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu carries the coach, the map and the music', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('.dd-actions')).toBeVisible({ timeout: 60_000 });
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button', { name: /Coach: (on|off)/ })).toBeVisible();
    await expect(pause.getByRole('button', { name: /Music: (on|off)/ })).toBeVisible();
    // A game's item resumes play, then runs: the board goes flat.
    await pause.getByRole('button', { name: /Map view: off/ }).click();
    await expect(pause).toBeHidden();
    await expect(page.locator('canvas.dd-map')).toBeVisible();
  });

  test('a scenario ends in the game’s own recap with the Hall’s receipt; H goes home', async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const foreign = watchForeignRequests(page);
    await openGame(page);
    await page.keyboard.press('s');
    await page.keyboard.press('2');
    await page.locator('[data-act="pick"][data-id="dealmakers-day"]').click();
    await page.keyboard.press('Enter');
    await expect(page.locator('.dd-actions')).toBeVisible({ timeout: 60_000 });
    await playToTheRecap(page);
    await expect(page.locator('.dd-results')).toContainText('XP');
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    await expectBackInHall(page);
    expect(foreign()).toEqual([]);
  });
});
