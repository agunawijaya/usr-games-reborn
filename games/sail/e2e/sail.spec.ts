import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  frameReloaded,
  gameFrame,
  inGame,
  revealStrip,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Broadside, the adopted sail, inside the Hall: the game menu is its title screen (its pages keep
 * Escape for going back), an action of the Sea Service reports its end with the day's
 * commendations, the Hall's Game menu brings back the game menu rather than the battle the game
 * keeps for its own reloads, and it leaves by every door.
 */

const game = {
  id: 'sail',
  ready: "window.__ready === true && !!document.querySelector('#menu.open [data-deck=\"menu\"]')",
  titleScreen: true,
};

async function setSail(page: Page) {
  const frame = gameFrame(page);
  await frame.getByRole('button', { name: /Historical Actions/ }).click();
  await frame.locator('#menu [data-sc]').first().click();
  await frame.locator('[data-ship]').first().click();
  await frame.locator('#sail').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
}

test('opens on its game menu in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Broadside');
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await expect(gameFrame(page).getByRole('button', { name: /Back to the Hall/ })).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('the game menu’s pages keep Escape for going back to the menu', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('s');
  await expect(gameFrame(page).getByRole('heading', { name: 'The Sea Service' })).toBeVisible();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.keyboard.press('Escape');
  await expect(gameFrame(page).getByRole('button', { name: /The Sea Service/ })).toBeFocused();
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(await inGame(page, 'window.__game.menuPage')).toBe('menu');
});

test('Escape closes the help opened over the game menu, and stays in the game', async ({
  page,
}) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.getByRole('button', { name: 'How to command' }).click();
  await expect(frame.locator('#help')).toHaveClass(/\bopen\b/);
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.keyboard.press('Escape');
  await expect(frame.locator('#help')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
});

test('giving up command reports the battle to the Hall', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await setSail(page);
  await inGame(page, "window.__game.runCommand('Q')");
  await expect
    .poll(() => savedGameStats(page, game.id), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, completed: 0 });
});

test('an action of the Sea Service ends on a report with its commendations', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('s');
  await gameFrame(page).getByRole('button', { name: 'Take command' }).click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  // Give up at once: the report still lists the action's commendations, none earned.
  await inGame(page, "window.__game.runCommand('Q')");
  const report = gameFrame(page).locator('#end.open');
  await expect(report).toContainText('Command relinquished', { timeout: 15_000 });
  await expect(report).toContainText('Win by turn 12');
  await expect(report.getByRole('button', { name: /Game menu/ })).toBeVisible();
  await expect(report.getByRole('button', { name: /Back to the Hall/ })).toBeVisible();
});

test('Game menu during a battle returns to the game menu', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await setSail(page);
  await revealStrip(page);
  await page.getByTestId('pl-strip-menu').click();
  const reloaded = frameReloaded(page, game.id);
  await page.getByRole('button', { name: 'Leave' }).click();
  await reloaded;
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
});

describeWaysOut(game);
