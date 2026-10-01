import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Lightkeeper, a native game, inside the Hall: its game menu, an open watch fought by keyboard
 * alone (a volley that stops the zone, the clock stretching, a package), the end of a watch,
 * and every way out. The open-watch code `test-40` starts a Cadet beside two gleaners.
 */

async function openGame(page: Page) {
  await runInHall(page, 'lightkeeper');
  await expect(page.getByTestId('lk-title')).toBeVisible();
}

async function startTestWatch(page: Page) {
  await page.getByTestId('lk-menu-open').click();
  await page.getByTestId('lk-open-code').fill('test-40');
  await page.getByRole('radio', { name: /Cadet/ }).click();
  await page.getByRole('radio', { name: /Short/ }).click();
  await page.getByRole('radio', { name: /1976/ }).click();
  await page.getByTestId('lk-open-begin').click();
  await expect(page.getByTestId('lk-brief')).toContainText('test-40');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lk-play')).toBeVisible();
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Lightkeeper' })).toBeVisible();
  await expect(page.getByTestId('lk-menu-daily')).toContainText('Tonight’s watch #');
  await expect(page.locator('.pl-corner')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a volley by keyboard stops the zone, stretches the clock and earns a package', async ({
  page,
}) => {
  await openGame(page);
  await startTestWatch(page);
  await expect(page.getByTestId('lk-zone')).toBeFocused();
  const before = Number(
    (await page.getByTestId('lk-days-left').textContent())!.replace(/[^\d.]/g, ''),
  );
  await page.keyboard.press('g');
  await expect(page.getByTestId('lk-log')).toContainText('Shield lowered.');
  await page.keyboard.press('b');
  await expect(page.getByTestId('lk-sheet')).toContainText('Beams');
  await page.getByTestId('lk-beam-sure').click();
  await page.getByTestId('lk-beam-fire').click();
  await expect(page.getByTestId('lk-log')).toContainText('went dark');
  await expect
    .poll(async () =>
      Number((await page.getByTestId('lk-days-left').textContent())!.replace(/[^\d.]/g, '')),
    )
    .toBeGreaterThan(before);
  await expect(toasts(page)).toContainText('Achievement unlocked: Lights out, gleaner');
});

test('the pause menu ends a watch, the results follow the Hall order, and H leaves', async ({
  page,
}) => {
  await openGame(page);
  await startTestWatch(page);
  await page.keyboard.press('Escape');
  const pause = page.getByTestId('pl-pause');
  await expect(pause).toBeVisible();
  await expect(pause.getByRole('button')).toContainText([
    'Resume',
    'First officer’s tips on or off',
    'Animations: calm or brisk',
    'End this watch',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ]);
  await pause.getByRole('button', { name: 'End this watch' }).click();
  const results = page.getByTestId('lk-results');
  await expect(results).toBeVisible({ timeout: 15_000 });
  await expect(results.getByRole('button')).toContainText([
    'Play again',
    'Game menu',
    'Back to the Hall',
  ]);
  await expect
    .poll(() => savedGameStats(page, 'lightkeeper'), { timeout: 15_000 })
    .toMatchObject({ sessions: 1 });
  await page.keyboard.press('h');
  await expectBackInHall(page);
});

test('a watch left half done can be resumed from the game menu', async ({ page }) => {
  await openGame(page);
  await startTestWatch(page);
  await page.keyboard.press('g');
  await expect(page.getByTestId('lk-log')).toContainText('Shield lowered.');
  await page.keyboard.press('Escape');
  const pause = page.getByTestId('pl-pause');
  await pause.getByRole('button', { name: 'Game menu' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByTestId('lk-menu-resume')).toContainText('Resume the watch');
  await page.getByTestId('lk-menu-resume').click();
  await expect(page.getByTestId('lk-log')).toContainText('Shield lowered.');
});

test('Escape on the game menu goes back to the Hall', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Escape');
  await expectBackInHall(page);
});
