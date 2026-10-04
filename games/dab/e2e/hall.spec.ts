import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import './hook';

/**
 * Double Cross, a native game, inside the Hall: its game menu, a won match reaching the Hall's
 * save with its packages, the pause menu's order, and every way out.
 */

async function openGame(page: Page) {
  await runInHall(page, 'dab');
  await expect(page.getByTestId('dx-title')).toBeVisible();
}

async function startFirstMatch(page: Page) {
  await page.getByTestId('dx-go-ladder').click();
  await page.getByTestId('dx-rung-1').click();
  await page.getByTestId('dx-start').click();
  await expect(page.getByTestId('dx-intro')).toBeHidden();
}

/** Plays every one of your lines as Master would, until the board is full. */
async function playWell(page: Page) {
  await page.waitForFunction(
    `(() => {
      const p = window.__dx.play();
      if (!p || p.match.over) return true;
      if (p.humanToMove) p.play(p.suggest());
      else p.skipWait();
      return false;
    })()`,
    undefined,
    { polling: 50, timeout: 60_000 },
  );
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Double Cross' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Daily Board #\d+/ })).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a won match reaches the Hall: results, packages and a win in its save', async ({ page }) => {
  await openGame(page);
  await startFirstMatch(page);
  await playWell(page);
  await expect(page.getByTestId('dx-results')).toContainText('Match won!', { timeout: 15_000 });
  await expect(toasts(page)).toContainText('Achievement unlocked');
  await expect
    .poll(() => savedGameStats(page, 'dab'), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, wins: 1 });
});

test.describe('the ways out', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu keeps the standard order, and its Game menu asks first', async ({
    page,
  }) => {
    await openGame(page);
    await startFirstMatch(page);
    await page.evaluate('window.__dx.play().play(0)');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Chain lens: off',
      'How to play',
      'Settings',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('dx-title')).toBeVisible();
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await startFirstMatch(page);
    await playWell(page);
    await expect(page.getByTestId('dx-results')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('KeyH');
    await expectBackInHall(page);
  });

  test('the browser’s Back button leaves for the man page', async ({ page }) => {
    await openGame(page);
    await page.goBack();
    await expectBackInHall(page);
  });
});
