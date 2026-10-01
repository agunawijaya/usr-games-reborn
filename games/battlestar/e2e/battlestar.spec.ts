import { expect, test } from '@playwright/test';
import {
  describeWaysOut,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Pajamas to Paradise, the adopted battlestar, inside the Hall: its title dialog is the game
 * menu, a game that ends reports to the Hall, and it leaves by every door.
 */

const game = { id: 'battlestar', ready: 'window.__ready === true', titleScreen: true };

test('opens on its title in the Hall’s frame and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Pajamas to Paradise');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#dlg-title')).toHaveAttribute('open', '');
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(foreign()).toEqual([]);
});

test('quitting a game reports it to the Hall', async ({ page }) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.locator('#b-start').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await frame.locator('#cmd').fill('quit');
  await frame.locator('#cmd').press('Enter');
  await expect
    .poll(() => savedGameStats(page, game.id), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, completed: 0 });
});

describeWaysOut(game);
