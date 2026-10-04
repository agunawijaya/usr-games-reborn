import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Figurehead, a native game, inside the Hall: its game menu, a turn played by keyboard, Today's
 * Weather to its reckoning, a ship launched and her first chapter written in the log, the pause
 * menu's own items, a battle kept and resumed, and the ways out. `__figureheadAutopilot` (a
 * development hook) plays the rest of a battle at once with the sailing master's orders.
 */

async function openGame(page: Page, appearance: 'light' | 'dark' = 'light') {
  await runInHall(page, 'figurehead', { appearance });
  await expect(page.getByTestId('fh-title')).toBeVisible({ timeout: 30_000 });
}

async function autopilot(page: Page) {
  await page.waitForFunction(() => '__figureheadAutopilot' in window);
  await page.evaluate(() =>
    (window as unknown as { __figureheadAutopilot(n: number): unknown }).__figureheadAutopilot(400),
  );
}

async function sailToday(page: Page) {
  await page.getByTestId('fh-menu-daily').click();
  await expect(page.getByTestId('fh-briefing')).toContainText('Mentioned in the log for');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fh-panel')).toBeVisible();
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Figurehead' })).toBeVisible();
  await expect(page.getByTestId('fh-menu-daily')).toContainText('Today’s Weather #');
  await expect(page.getByTestId('pl-pause-button')).toBeHidden();
  expect(foreign()).toEqual([]);
});

test('a turn by keyboard: steer, make it so, and the film plays', async ({ page }) => {
  await openGame(page);
  await sailToday(page);
  await expect(page.getByTestId('fh-turn')).toContainText('Turn 1 of');
  await page.keyboard.press('h');
  await expect(page.getByTestId('fh-helm')).toContainText('hold');
  await page.keyboard.press('2');
  await expect(page.getByTestId('fh-helm')).toContainText('2');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('fh-turn')).toContainText('Turn 2 of');
});

test('Today’s Weather to its reckoning, in the Hall’s results order, and H leaves', async ({
  page,
}) => {
  await openGame(page);
  await sailToday(page);
  await autopilot(page);
  await page.getByTestId('fh-to-report').click();
  const after = page.getByTestId('fh-aftermath');
  await expect(after).toBeVisible();
  await expect(after.getByRole('button')).toContainText(['Play again', 'Game menu', 'Back to the Hall']);
  await expect.poll(() => savedGameStats(page, 'figurehead')).toMatchObject({ sessions: 1 });
  await page.keyboard.press('h');
  await expectBackInHall(page);
});

test('a ship is launched, her maiden cruise fought, and the chapter written in her log', async ({
  page,
}) => {
  await openGame(page);
  await page.getByTestId('fh-menu-voyage').click();
  await page.getByTestId('fh-launch-name').fill('Larkspur');
  await page.getByTestId('fh-carving-owl').click();
  await page.getByTestId('fh-launch-go').click();
  await expect(page.getByTestId('fh-voyage')).toContainText('Larkspur');
  await page.getByTestId('fh-choice-0').click();
  await expect(page.getByTestId('fh-briefing')).toContainText('Maiden cruise');
  await page.getByTestId('fh-make-sail').click();
  await autopilot(page);
  await page.getByTestId('fh-to-report').click();
  await page.getByTestId('fh-write-log').click();
  await expect(page.getByTestId('fh-log-entry')).toContainText('Year 1 in her log');
  await expect(toasts(page)).toContainText('Achievement unlocked');
  await page.getByTestId('fh-continue').click();
  await expect(page.getByTestId('fh-voyage')).toContainText('Chapter 2');
});

test('the pause menu offers to break off; it is written in her log as unfinished', async ({
  page,
}) => {
  await openGame(page);
  await page.getByTestId('fh-menu-voyage').click();
  await page.getByTestId('fh-launch-go').click();
  await page.getByTestId('fh-choice-0').click();
  await page.getByTestId('fh-make-sail').click();
  await expect(page.getByTestId('fh-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  const pause = page.getByTestId('pl-pause');
  await expect(pause.getByRole('button')).toContainText([
    'Resume',
    'Break off the action',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ]);
  await pause.getByRole('button', { name: 'Break off the action' }).click();
  await page.getByTestId('fh-confirm-yes').click();
  await expect(page.getByTestId('fh-after-headline')).toContainText('broke off');
});

test('a battle left through the Game menu is kept and can be resumed', async ({ page }) => {
  await openGame(page);
  await sailToday(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('fh-turn')).toContainText('Turn 2 of');
  await page.keyboard.press('Escape');
  await page.getByTestId('pl-pause').getByRole('button', { name: 'Game menu' }).click();
  const leave = page.getByRole('alertdialog').getByRole('button', { name: 'Leave' });
  if (await leave.isVisible({ timeout: 2000 }).catch(() => false)) await leave.click();
  await expect(page.getByTestId('fh-title')).toBeVisible();
  await page.getByTestId('fh-menu-daily').click();
  await expect(page.getByTestId('fh-turn')).toContainText('Turn 2 of');
});

test('by night the game takes its lantern look', async ({ page }) => {
  await openGame(page, 'dark');
  await expect(page.getByTestId('fh-root')).toHaveAttribute('data-look', 'night');
});

test('Escape on the game menu goes back to the Hall', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Escape');
  await expectBackInHall(page);
});
