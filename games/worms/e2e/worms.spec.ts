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
 * Abyssal Worms, the adopted worms, inside the Hall: a key press is a visit (a screensaver left
 * running earns nothing), its packages install, and it leaves by every door.
 */

const game = { id: 'worms', ready: 'window.__abyss?.ready === true' };

test('opens in the Hall’s frame and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Abyssal Worms');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#abyss')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a key press counts as today’s visit and the terminal view installs a package', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('c');
  await expect(toasts(page)).toContainText('Achievement unlocked: Back to the terminal');
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
});

describeWaysOut(game);
