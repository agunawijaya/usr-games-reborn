import { expect, test } from '@playwright/test';
import {
  describeWaysOut,
  runInHall,
  savedGameStats,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Rain on Still Water, the adopted rain, inside the Hall: a key press is a visit (a screensaver
 * left running earns nothing), its packages install, and it leaves by every door.
 */

const game = { id: 'rain', ready: 'window.__ready === true' };

test('opens in the Hall’s frame and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Rain on Still Water');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#pond')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a key press counts as today’s visit and the split view installs a package', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('2');
  await expect(toasts(page)).toContainText('Achievement unlocked: Side by side');
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
});

describeWaysOut(game);
