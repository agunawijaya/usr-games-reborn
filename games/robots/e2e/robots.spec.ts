import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  frameReloaded,
  gameFrame,
  inGame,
  revealStrip,
  runInHall,
  savedGameStats,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Robots, the adopted remaster, running inside the Hall: it opens on its game menu in the
 * player's frame, turns a cleared wave and the end of a run into packages and XP, leaves by every
 * door, and never reaches beyond its own files. Boards are staged through the game's own test
 * hook (`window.__rr`); a staged board gets a new level number so the game reads it as a new wave.
 */

const READY = "typeof window.__rr === 'object'";

interface Spot {
  x: number;
  y: number;
}

async function stageBoard(page: Page, level: number, player: Spot, robots: Spot[], score = 0) {
  const state = {
    level,
    score,
    player,
    robots: robots.map((spot, index) => ({ id: index + 1, ...spot })),
    piles: [],
    waitBonus: 0,
    status: 'playing',
  };
  await inGame(page, `window.__rr.setState(${JSON.stringify(state)})`);
  // The new wave draws a jumbotron call; clearing it keeps the points down to the crashes alone.
  await expect.poll(() => inGame(page, 'window.__rr.getState().level')).toBe(level);
  await inGame(page, 'window.__rr.tracker().call = null');
}

const stayPut = (page: Page) =>
  inGame(page, `window.__rr.act({ kind: 'move', direction: 'stay' })`);

test('opens on its game menu in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, 'robots');
  await expect(page.getByTestId('pl-strip')).toContainText('Robots');
  await waitForGame(page, READY);
  await expect(frame.locator('canvas')).toBeVisible();
  await expect(frame.getByTestId('rr-menu')).toBeVisible();
  await expect(frame.getByTestId('rr-mode-showdown')).toContainText('Daily Showdown #');
  await frame.getByTestId('rr-mode-exhibition').click();
  await frame.getByTestId('rr-start').click();
  await expect(frame.locator('.rr-stats')).toContainText('WAVE');
  expect(foreign()).toEqual([]);
});

test('the Grand Tour opens one match at a time', async ({ page }) => {
  const frame = await runInHall(page, 'robots');
  await waitForGame(page, READY);
  await frame.getByTestId('rr-mode-tour').click();
  await expect(frame.getByTestId('rr-match-opening-night')).toBeEnabled();
  await expect(frame.getByTestId('rr-match-second-leg')).toBeDisabled();
  await frame.getByTestId('rr-match-opening-night').click();
  await expect(frame.getByTestId('rr-intro')).toContainText('Score 160 points');
  await page.keyboard.press('Escape');
  await expect(frame.getByTestId('rr-tour')).toBeVisible();
});

test('a cleared wave installs packages and the end of the run brings XP', async ({ page }) => {
  await runInHall(page, 'robots');
  await waitForGame(page, READY);
  await inGame(page, "window.__rr.start('exhibition')");

  // Two robots either side of the player's column meet one row above them.
  await stageBoard(page, 2, { x: 30, y: 12 }, [
    { x: 29, y: 9 },
    { x: 31, y: 9 },
  ]);
  await stayPut(page);
  await expect(toasts(page)).toContainText('Achievement unlocked: Clean sweep', {
    timeout: 15_000,
  });
  await expect(toasts(page)).toContainText('Achievement unlocked: Feet on the ground');

  // Then a robot right beside the player ends the run: one wave cleared counts as a win.
  await stageBoard(page, 3, { x: 30, y: 12 }, [{ x: 31, y: 12 }], 20);
  await stayPut(page);
  await expect
    .poll(() => savedGameStats(page, 'robots'), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, wins: 1, bestScore: 20, counters: { wavesCleared: 1 } });
  await expect(gameFrame(page).getByTestId('rr-report')).toContainText('WHAT A RUN');
});

test('Game menu asks first during a match, then opens on the game menu again', async ({ page }) => {
  const frame = await runInHall(page, 'robots');
  await waitForGame(page, READY);
  await inGame(page, "window.__rr.start('exhibition')");
  await revealStrip(page);
  await page.getByTestId('pl-strip-menu').click();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  await revealStrip(page);
  await page.getByTestId('pl-strip-menu').click();
  const reloaded = frameReloaded(page, 'robots');
  await page.getByRole('button', { name: 'Leave' }).click();
  await reloaded;
  await waitForGame(page, READY);
  await expect(frame.getByTestId('rr-menu')).toBeVisible();
});

describeWaysOut({ id: 'robots', ready: READY, titleScreen: true });
