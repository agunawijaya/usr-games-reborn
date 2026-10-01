import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import { roomById } from '../src/data/house';
import { createRoom } from '../src/engine/room';
import { applyAction, legality, STEPS } from '../src/engine/rules';
import { solve } from '../src/engine/solver';

/**
 * Zoomies, a native game, inside the Hall: its game menu, a room cleared at par by keyboard
 * alone (results, packages, a win in the Hall's save), today's room, and every way out.
 */

const STEP_KEYS: Record<string, string> = {
  '-1,-1': 'KeyQ',
  '0,-1': 'KeyW',
  '1,-1': 'KeyE',
  '-1,0': 'KeyA',
  '0,0': 'KeyS',
  '1,0': 'KeyD',
  '-1,1': 'KeyZ',
  '0,1': 'KeyX',
  '1,1': 'KeyC',
};

async function openGame(page: Page) {
  await runInHall(page, 'zoomies');
  await expect(page.getByTestId('zm-title')).toBeVisible();
}

/** Plays the hallway's par route, waiting for each turn to land before the next key. */
async function clearHallway(page: Page) {
  await page.getByTestId('zm-menu-house').click();
  await page.getByTestId('zm-room-hallway').click();
  await expect(page.getByTestId('zm-intro')).toContainText('The hallway');
  await page.keyboard.press('Enter');
  const route = solve(createRoom(roomById('hallway').spec))!.actions;
  for (const [turn, action] of route.entries()) {
    if (action.type !== 'step') throw new Error('The hallway’s par route is all steps.');
    await page.keyboard.press(STEP_KEYS[`${action.dx},${action.dy}`]!);
    if (turn < route.length - 1)
      await expect(page.getByTestId('zm-turn')).toContainText(`${turn + 1}`);
  }
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Zoomies' })).toBeVisible();
  await expect(page.getByTestId('zm-menu-daily')).toContainText('Today’s mess #');
  await expect(page.locator('.pl-corner')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('the hallway at par: stars, packages and a win in the Hall', async ({ page }) => {
  await openGame(page);
  await clearHallway(page);
  const results = page.getByTestId('zm-results');
  await expect(results).toContainText('Spotless!', { timeout: 15_000 });
  await expect(results).toContainText('The cats next door played it too');
  await expect(toasts(page)).toContainText('Achievement unlocked: Hallway tidy');
  await expect
    .poll(() => savedGameStats(page, 'zoomies'), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, wins: 1, counters: { roomsTidied: 1, vacuumsTangled: 3 } });
  // Next room opens the kitchen's intro straight away.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zm-intro')).toContainText('The kitchen');
});

test('a refused step explains itself and costs no turn', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('zm-menu-house').click();
  await page.getByTestId('zm-room-hallway').click();
  await expect(page.getByTestId('zm-intro')).toBeVisible();
  await page.keyboard.press('Enter');
  // Walk the par route until some step is refused (a wall, a vacuum, or a vacuum's reach).
  let state = createRoom(roomById('hallway').spec);
  const route = solve(state)!.actions;
  let refused: (typeof STEPS)[number] | undefined;
  for (const [turn, action] of route.entries()) {
    refused = STEPS.find(([dx, dy]) => legality(state, { type: 'step', dx, dy }) !== 'ok');
    if (refused || action.type !== 'step') break;
    await page.keyboard.press(STEP_KEYS[`${action.dx},${action.dy}`]!);
    await expect(page.getByTestId('zm-turn')).toContainText(`${turn + 1}`);
    state = applyAction(state, action).state;
  }
  expect(refused).toBeDefined();
  const before = await page.getByTestId('zm-turn').textContent();
  await page.keyboard.press(STEP_KEYS[`${refused![0]},${refused![1]}`]!);
  await expect(page.getByTestId('zm-status')).toContainText(/taken|Not there|Staying put/);
  await expect(page.getByTestId('zm-turn')).toHaveText(before ?? '');
});

test('today’s mess opens with its par', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('zm-menu-daily').click();
  await expect(page.getByTestId('zm-intro')).toContainText('Par is');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zm-turn')).toContainText('par');
});

test.describe('the ways out', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('the pause menu keeps the standard order and its Game menu returns to the title', async ({
    page,
  }) => {
    await openGame(page);
    await page.getByTestId('zm-menu-house').click();
    await page.getByTestId('zm-room-hallway').click();
    await expect(page.getByTestId('zm-intro')).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText([
      'Resume',
      'Restart the room',
      'House map',
      'How to play',
      'Settings',
      'Game menu',
      'Back to the Hall',
    ]);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('zm-title')).toBeVisible();
  });

  test('H on the results goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await clearHallway(page);
    await expect(page.getByTestId('zm-results')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });
});
