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
 * Broadside, the adopted sail, inside the Hall: its scenario list is the game menu, a battle
 * reports its end, the Hall's Game menu brings back the scenario list rather than the battle the
 * game keeps for its own reloads, and it leaves by every door.
 */

const game = {
  id: 'sail',
  ready: "window.__ready === true && !!document.querySelector('#menu.open [data-sc]')",
  titleScreen: true,
};

async function setSail(page: Page) {
  const frame = gameFrame(page);
  await frame.locator('#menu [data-sc]').first().click();
  await frame.locator('[data-ship]').first().click();
  await frame.locator('#sail').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
}

test('opens on its scenario list in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Broadside');
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(foreign()).toEqual([]);
});

test('Escape closes the help opened over the scenario list, and stays in the game', async ({
  page,
}) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.locator('#btnMenuHelp').click();
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

test('Game menu during a battle returns to the scenario list', async ({ page }) => {
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
