import { expect, type Page } from '@playwright/test';
import { gameFrame, inGame, waitForGame } from '../../../packages/bridge/testing/hall';

/**
 * Shared moves for the suites. Real play is exercised by the unit tests
 * (`app/tests/engine.test.js`); these helpers fast-forward a shift to its ending by setting the
 * engine's own counters directly, the same thing a very fast or very unlucky digger would reach
 * on their own, so the desk's wiring (reports, the career, the logbook, the Hall's result) is what
 * gets tested here.
 */

/** Truthy inside the game once its menu is up. */
export const READY = 'Boolean(window.BrokenWellDesk && document.body.dataset.desk === "menu")';

/** From the menu, the next career shift begun from its briefing. */
export async function beginCareerShift(page: Page) {
  await gameFrame(page)
    .getByRole('button', { name: /Continue/ })
    .click();
  await expect(gameFrame(page).getByText('Your contracts')).toBeVisible();
  await gameFrame(page)
    .getByRole('button', { name: /Begin the shift/ })
    .click();
}

/** From the menu, the Daily Shift's briefing and the shift itself. */
export async function beginDailyShift(page: Page) {
  await gameFrame(page)
    .getByRole('button', { name: /Daily Shift/ })
    .click();
  await expect(gameFrame(page).getByText('Your contracts')).toBeVisible();
  await gameFrame(page)
    .getByRole('button', { name: /Begin the shift/ })
    .click();
}

/** Declares the shift's line (or flood) target already met, and lets the desk notice. */
export async function clearTheShift(page: Page) {
  await inGame(
    page,
    `(() => {
      const g = window.game;
      g.lines = Math.max(g.lines, 999);
      g.rubbleRowsSurvived = Math.max(g.rubbleRowsSurvived, 999);
      g.piecesLocked = Math.max(g.piecesLocked, 1);
      g.score = Math.max(g.score, 500);
      window.BrokenWellDesk.checkShiftEnd();
    })()`,
  );
  await expect(gameFrame(page).getByTestId('report')).toBeVisible({ timeout: 10_000 });
}

/** Tops the stack out, as if the digger had run out of room. */
export async function topOutTheShift(page: Page) {
  await inGame(
    page,
    `(() => { window.game.gameOver = true; window.BrokenWellDesk.checkShiftEnd(); })()`,
  );
  await expect(gameFrame(page).getByTestId('report')).toBeVisible({ timeout: 10_000 });
}

/**
 * Marks Shift 1 already cleared directly in the save (no toast-triggering play needed) and
 * reloads, then opens Shift 2 (the Canyon Cut) from the menu: the reshaped well used for
 * documentation screenshots, with a narrow cut, a starting rubble stack and the signature moment
 * of a line about to clear.
 */
export async function reachTheCanyonCut(page: Page) {
  await inGame(
    page,
    `(() => {
      const save = { v: 1, data: { shifts: { 'open-shaft': { tries: 1, cleared: true, stars: 3, bestScore: 1200 } } } };
      window.localStorage.setItem('usr-games:blocks-classic:career', JSON.stringify(save));
    })()`,
  );
  await gameFrame(page)
    .locator('body')
    .evaluate(() => window.location.reload());
  await waitForGame(page, READY);
  await gameFrame(page)
    .getByRole('button', { name: /Continue — Shift 2: The Canyon Cut/ })
    .click();
  await gameFrame(page)
    .getByRole('button', { name: /Begin the shift/ })
    .click();
}

/**
 * Builds up the canyon's stack to one open row from a clear, by filling every column but one with
 * rubble directly (the same shape a real session would reach by dropping pieces), so the
 * screenshot shows the well under pressure with a line about to go.
 */
export async function setUpACanyonNearClear(page: Page) {
  await inGame(
    page,
    `(() => {
      const g = window.game;
      const bottom = g.height - 1;
      const open = [];
      for (let x = 0; x < g.width; x++) if (g.board[bottom][x].type !== 'rock') open.push(x);
      const hole = open[0];
      for (const x of open) {
        g.board[bottom][x] = x === hole ? { type: 'empty' } : { type: 'filled', color: '#f5c242' };
      }
      g.updateGhost();
    })()`,
  );
}
