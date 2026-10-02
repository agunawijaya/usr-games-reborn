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
 * Full Pockets, a native game, inside the Hall: its game menu, a banked run reaching the Hall's
 * save with its packages, the pause menu's order, and every way out.
 */

async function openGame(page: Page) {
  await runInHall(page, 'snake');
  await expect(page.getByTestId('fp-title')).toBeVisible();
}

async function startRun(page: Page) {
  await page.getByRole('button', { name: /Start a run/ }).click();
  await page.getByTestId('fp-map').waitFor();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fp-map')).toBeHidden();
}

/** The door one step east, the snake far off, something in the satchel. */
async function doorEast(page: Page, pockets: number) {
  await page.evaluate((glints) => {
    const play = window.__fp.play()!;
    const round = play.session.round as unknown as {
      you: { x: number; y: number };
      garden: { width: number; height: number };
    };
    const corner = round.you.x < round.garden.width / 2 ? round.garden.width - 1 : 0;
    play.stage({
      garden: { ...round.garden, door: { x: round.you.x + 1, y: round.you.y } },
      glints: [{ x: corner, y: 0 }],
      snake: Array.from({ length: 6 }, (_, i) => ({
        x: corner === 0 ? i : corner - i,
        y: round.garden.height - 1,
      })),
      ledger: { gross: glints, spent: 0 },
      loot: 200,
    });
  }, pockets);
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Full Pockets' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Daily Run #\d+/ })).toBeVisible();
  await expect(page.locator('.pl-corner')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a banked run reaches the Hall: results, packages and a win in its save', async ({ page }) => {
  await openGame(page);
  await startRun(page);
  await doorEast(page, 640);
  await page.keyboard.press('ArrowRight');
  await page.getByTestId('fp-door').waitFor();
  await page.keyboard.press('KeyB');
  await expect(page.getByTestId('fp-results')).toContainText('Banked!', { timeout: 10_000 });
  await expect(toasts(page)).toContainText('Achievement unlocked: Banked');
  await expect
    .poll(() => savedGameStats(page, 'snake'), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, wins: 1, bestScore: 640, counters: { banked: 1 } });
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
    await startRun(page);
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Strike preview: on',
      'How to play',
      'Settings',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('fp-title')).toBeVisible();
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await startRun(page);
    await doorEast(page, 120);
    await page.keyboard.press('ArrowRight');
    await page.getByTestId('fp-door').waitFor();
    await page.keyboard.press('KeyB');
    await expect(page.getByTestId('fp-results')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('KeyH');
    await expectBackInHall(page);
  });

  test('the browser’s Back button leaves for the man page', async ({ page }) => {
    await openGame(page);
    await page.goBack();
    await expectBackInHall(page);
  });
});
