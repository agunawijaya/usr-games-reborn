import { expect, test } from '@playwright/test';
import {
  describeWaysOut,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Trek — Deep Space, the adopted trek, inside the Hall: the title screen is the game menu, an
 * aborted mission reports to the Hall, and it leaves by every door.
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
  expect(foreign()).toEqual([]);
});

test('aborting a mission reports it to the Hall', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('Enter');
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  // The first mission opens the tutorial; Escape closes it.
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.keyboard.type('quit');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 0 });
});

describeWaysOut(game);
