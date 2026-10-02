import { expect, test } from '@playwright/test';
import {
  describeWaysOut,
  gameFrame,
  inGame,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Trek — Deep Space, the adopted trek, inside the Hall: the title screen's first page is the game
 * menu (Escape there goes home, on the pages behind it Escape goes back to the menu), an abandoned
 * mission reports to the Hall, and it leaves by every door.
 */

const game = { id: 'trek', ready: 'window.__trek?.ready === true', titleScreen: true };

test('opens on its title screen in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Trek — Deep Space');
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await expect(gameFrame(page).getByRole('button', { name: /Back to the Hall/ })).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('the menu’s pages keep Escape for going back to the menu', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('t');
  await expect(gameFrame(page).getByRole('heading', { name: 'Frontier Tour' })).toBeVisible();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.keyboard.press('Escape');
  await expect(gameFrame(page).getByRole('button', { name: /Frontier Tour/ })).toBeFocused();
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(await inGame(page, 'window.__trek.page')).toBe('menu');
});

test('abandoning a mission asks first, then reports it to the Hall', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('f');
  await page.keyboard.press('Enter');
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  // The first mission opens the tutorial; Escape closes it.
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.keyboard.type('quit');
  await page.keyboard.press('Enter');
  await expect(gameFrame(page).locator('#cmd-hint')).toContainText('Abandon this mission?');
  await page.keyboard.type('quit');
  await page.keyboard.press('Enter');
  await expect(gameFrame(page).locator('#game-over-title')).toHaveText('ABANDONED');
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 0 });
});

describeWaysOut(game);
