import { expect, test } from '@playwright/test';
import {
  describeWaysOut,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Hunt — Ricochet, the adopted hunt, inside the Hall: the match setup is the game menu, a match
 * ended from the pause menu counts as a session, and it leaves by every door.
 */

const game = { id: 'hunt', ready: 'window.__ready === true', titleScreen: true };

test('opens on its match setup in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Hunt — Ricochet');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#setup')).toHaveClass(/\bon\b/);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(foreign()).toEqual([]);
});

test('a match ended from the pause menu counts as a session', async ({ page }) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.locator('#o-start').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await frame.locator('#p-new').click();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
});

describeWaysOut(game);
