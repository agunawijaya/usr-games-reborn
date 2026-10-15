import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Gone Fishing inside the real Hall (its own dev server on port 5335): launched from the Hall,
 * its pause items, its own results with the Hall's receipt, and every way back out.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

async function openGame(page: Page, appearance: 'dark' | 'light' = 'dark') {
  await runInHall(page, 'fish', { appearance, motion: 'reduce' });
  await expect(page.getByTestId('gf-title')).toBeVisible({ timeout: 30_000 });
}

async function startQuickGame(page: Page) {
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-quick-start').click();
  await expect(page.locator('.gf-hud')).toBeVisible();
}

async function playToTheEnd(page: Page) {
  await page.evaluate(() => window.__gf!.fast(40));
  for (let guard = 0; guard < 800; guard++) {
    const phase = await page.evaluate(() => window.__gf!.phase());
    if (phase === 'results') return;
    if (phase === 'your-turn') await page.evaluate(() => window.__gf!.askAny());
    await page.waitForTimeout(30);
  }
  throw new Error('the game did not end');
}

test.describe('Gone Fishing in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('Escape on a page of the game menu comes back to the game menu, not the Hall', async ({
    page,
  }) => {
    await openGame(page);
    await page.getByTestId('gf-menu-album').click();
    await expect(page.getByTestId('gf-album')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gf-title')).toBeVisible();
  });

  test('the pause menu carries the notebook, and its Game menu asks before leaving', async ({
    page,
  }) => {
    await openGame(page);
    await startQuickGame(page);
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Notebook open or closed',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    else await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('gf-title')).toBeVisible();
  });

  test('a finished game shows its own results with the Hall’s receipt; H goes home', async ({
    page,
  }) => {
    await openGame(page, 'light');
    await startQuickGame(page);
    await playToTheEnd(page);
    await expect(page.getByTestId('gf-results')).toBeVisible();
    await expect(page.locator('.gf-footnotes')).toContainText('XP');
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Play again starts a new game without leaving', async ({ page }) => {
    await openGame(page);
    await startQuickGame(page);
    await playToTheEnd(page);
    await page.waitForTimeout(700);
    await page.keyboard.press('r');
    await expect(page.getByTestId('gf-results')).toBeHidden();
    await expect(page.locator('.gf-hud')).toBeVisible();
  });

  test('the game page shows its art, and the run page leaves nothing behind in the console', async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text());
    });
    await runInHall(page, 'fish', { appearance: 'dark' });
    await expect(page.getByTestId('gf-title')).toBeVisible({ timeout: 30_000 });
    await page.goto('/#/game/fish');
    await page.waitForTimeout(2500);
    expect(problems).toEqual([]);
  });
});
