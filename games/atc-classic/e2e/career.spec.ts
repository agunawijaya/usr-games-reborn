import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  gameFrame,
  inGame,
  runInHall,
  waitForGame,
} from '../../../packages/bridge/testing/hall';
import {
  beginShift,
  followTheHints,
  forceTicksUntilLost,
  READY,
  seedTheShift,
  shiftIsOver,
  takePosition,
} from './shift';

/**
 * Control Room 1986's career, briefings, printed reports, logbook and Daily Traffic inside the
 * Hall, with the Hall's pause reaching the game and the cheat panel out of sight.
 */

const GAME = 'atc-classic';
/** A seed whose first Easy shift reaches the first assignment's target by following the hints. */
const CAREER_SEED = 12;

/** Records every result the game sends the Hall, in the Hall's own window. */
async function recordResults(page: Page) {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const results: unknown[] = [];
    Object.assign(window, { __results: results });
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'result') results.push(event.data.payload);
    });
  });
}

test('the cheat panel stays out of sight until its hidden key', async ({ page }) => {
  await runInHall(page, GAME);
  await waitForGame(page, READY);
  await beginShift(page);
  const frame = gameFrame(page);
  await expect(frame.locator('#cheat-btn')).toBeHidden();
  await expect(frame.locator('#cheat-live-panel')).not.toHaveClass(/shown/);
  await page.keyboard.press('Control+Alt+KeyC');
  await expect(frame.locator('#cheat-live-panel')).toHaveClass(/shown/);
});

test('the first assignment ends with the relief, prints a report and opens the next', async ({
  page,
}) => {
  await recordResults(page);
  await seedTheShift(page, CAREER_SEED);
  await runInHall(page, GAME);
  await waitForGame(page, READY);
  await beginShift(page, 'career');
  await followTheHints(page, 2);
  const frame = gameFrame(page);
  await expect(frame.locator('#game-over')).toHaveClass(/shown/);
  // The first key finishes the printing; the report says how the shift ended.
  await page.keyboard.press('Shift');
  await expect(frame.locator('.report-text')).toContainText('RELIEVED ON SCHEDULE');
  await expect(frame.locator('.report-text')).toContainText('ASSIGNMENT 1/12');
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __results: { outcome: string }[] }).__results.at(-1)?.outcome,
      ),
    )
    .toBe('win');

  await page.keyboard.press('m');
  await expect(frame.locator('#title-screen')).not.toHaveClass(/hiding/);
  await expect(frame.locator('.assignment[data-assignment="0"]')).toHaveClass(/passed/);
  await expect(frame.locator('.assignment[data-assignment="1"]')).toBeEnabled();
  await expect(frame.locator('.licence')).toContainText('Shifts worked');

  // The logbook keeps the printed report; Escape closes it and stays in the game.
  await page.keyboard.press('l');
  await expect(frame.locator('#logbook-overlay')).toHaveClass(/shown/);
  await expect(frame.locator('.log-row')).toHaveCount(1);
  await expect(frame.locator('#logbook-overlay .report-text')).toContainText('FIRST WATCH');
  await page.keyboard.press('Escape');
  await expect(frame.locator('#logbook-overlay')).not.toHaveClass(/shown/);
  await expect(page).toHaveURL(/#\/run\/atc-classic$/);
});

test('Daily Traffic reports to the Hall as the daily challenge', async ({ page }) => {
  await recordResults(page);
  await runInHall(page, GAME);
  await waitForGame(page, READY);
  await beginShift(page, 'daily');
  await forceTicksUntilLost(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __results: { daily?: boolean }[] }).__results.at(-1)?.daily,
      ),
    )
    .toBe(true);
  await page.keyboard.press('Shift');
  await expect(gameFrame(page).locator('.share-line')).toContainText(
    /^Control Room 1986 #\d+ · \w+ · \d+ home · /,
  );
});

test('a hidden page stops the shift clock, and it runs on when the page is back', async ({
  page,
}) => {
  await runInHall(page, GAME);
  await waitForGame(page, READY);
  await beginShift(page);
  const setHidden = (hidden: boolean) =>
    inGame(
      page,
      `Object.defineProperty(document, 'hidden', { configurable: true, get: () => ${hidden} });
       document.dispatchEvent(new Event('visibilitychange'));`,
    );
  await setHidden(true);
  await expect(gameFrame(page).locator('#next-tick')).toHaveText('PAUSED');
  const clock = await inGame<string>(page, "document.getElementById('info').textContent");
  await page.waitForTimeout(7000);
  expect(await inGame<string>(page, "document.getElementById('info').textContent")).toBe(clock);
  await setHidden(false);
  await expect(gameFrame(page).locator('#next-tick')).toHaveText(/NEXT TICK/);
});

test('Escape on the briefing returns to the game menu, and Escape there to the Hall', async ({
  page,
}) => {
  await runInHall(page, GAME);
  await waitForGame(page, READY);
  await page.keyboard.press('Enter');
  await expect(gameFrame(page).locator('#briefing-overlay')).toHaveClass(/shown/);
  await page.keyboard.press('Escape');
  await expect(gameFrame(page).locator('#title-screen')).not.toHaveClass(/hiding/);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await page.keyboard.press('Escape');
  await expectBackInHall(page);
});

test('a lost assignment can be tried again from its report', async ({ page }) => {
  await runInHall(page, GAME);
  await waitForGame(page, READY);
  await beginShift(page, 'career');
  await forceTicksUntilLost(page);
  expect(await shiftIsOver(page)).toBe(true);
  await page.keyboard.press('Shift');
  await expect(gameFrame(page).locator('.report-text')).toContainText('SHIFT ENDED');
  await page.keyboard.press('r');
  await expect(gameFrame(page).locator('#briefing-overlay')).toHaveClass(/shown/);
  await takePosition(page);
});
