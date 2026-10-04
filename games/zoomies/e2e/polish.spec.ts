import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, type HallSeed, runInHall } from '../../../packages/bridge/testing/hall';
import { ROOMS, roomById } from '../src/data/house';
import type { RoomTheme } from '../src/data/blueprints';
import { createRoom } from '../src/engine/room';
import { solve } from '../src/engine/solver';

/**
 * The polish pass (prompt P1-Z): the room-cleared payoff (played through, skipped, and under
 * reduced motion, with the counter changing last), the panel with nine or more vacuums, the
 * focus cue on the cat, and a whole room played with the keyboard alone.
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

const board = (page: Page) => page.getByTestId('zm-board');

/** Opens Zoomies with every house room open, so any room can be played. */
async function openHouse(page: Page, seed: HallSeed = {}) {
  await runInHall(page, 'zoomies', seed);
  await page.addInitScript(
    (rooms) => {
      if (window.top !== window) return;
      const tidy = Object.fromEntries(
        rooms.map((id) => [id, { stars: [true, false, false], bestTurns: null, tidy: true }]),
      );
      window.localStorage.setItem(
        'usr-games:zoomies:house',
        JSON.stringify({ v: 1, savedAt: '', data: { rooms: tidy, lastRoom: null } }),
      );
    },
    ROOMS.map((room) => room.id),
  );
  await page.reload();
  await expect(page.getByTestId('zm-title')).toBeVisible();
}

async function enterRoom(page: Page, id: RoomTheme) {
  await page.getByTestId('zm-menu-house').click();
  await page.getByTestId(`zm-room-${id}`).click();
  await expect(page.getByTestId('zm-intro')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zm-intro')).toBeHidden();
}

/** Steps along the par route, waiting for each turn but the last to land. */
async function stepRoute(page: Page, id: RoomTheme, count?: number) {
  const route = solve(createRoom(roomById(id).spec))!.actions;
  const steps = route.slice(0, count ?? route.length);
  for (const [turn, action] of steps.entries()) {
    if (action.type !== 'step') throw new Error(`${id}'s par route is all steps.`);
    await page.keyboard.press(STEP_KEYS[`${action.dx},${action.dy}`]!);
    if (turn < steps.length - 1)
      await expect(page.getByTestId('zm-turn')).toContainText(`${turn + 1}`);
  }
}

test.describe('the room-cleared payoff', () => {
  test('plays after the last vacuum arrives, and the counter changes last', async ({ page }) => {
    await openHouse(page);
    await enterRoom(page, 'living');
    await stepRoute(page, 'living');
    await expect(board(page)).toHaveAttribute('data-moment', 'payoff', { timeout: 3_000 });
    const began = Date.now();
    await expect(page.getByTestId('zm-left')).toHaveText('1 left');
    await expect(board(page)).not.toHaveAttribute('data-moment', 'payoff', { timeout: 5_000 });
    expect(Date.now() - began).toBeGreaterThan(1_600);
    await expect(page.getByTestId('zm-left')).toHaveText('0 left');
    await expect(page.getByTestId('zm-results')).toBeVisible();
  });

  test('any key skips it', async ({ page }) => {
    await openHouse(page);
    await enterRoom(page, 'living');
    await stepRoute(page, 'living');
    await expect(board(page)).toHaveAttribute('data-moment', 'payoff', { timeout: 3_000 });
    await page.keyboard.press('KeyK');
    // The payoff has well over a second left; the skip must not wait for it.
    await expect(board(page)).not.toHaveAttribute('data-moment', 'payoff', { timeout: 500 });
    await expect(page.getByTestId('zm-left')).toHaveText('0 left');
    await expect(page.getByTestId('zm-results')).toBeVisible({ timeout: 1_000 });
  });

  test('under reduced motion it is a short still, and still the counter waits', async ({
    page,
  }) => {
    await openHouse(page, { motion: 'reduce' });
    await enterRoom(page, 'living');
    await stepRoute(page, 'living');
    await expect(board(page)).toHaveAttribute('data-moment', 'payoff', { timeout: 3_000 });
    await expect(page.getByTestId('zm-left')).toHaveText('1 left');
    await expect(board(page)).not.toHaveAttribute('data-moment', 'payoff', { timeout: 1_500 });
    await expect(page.getByTestId('zm-left')).toHaveText('0 left');
  });
});

test('with nine or more vacuums the counter and its dots stay on one line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openHouse(page);
  await enterRoom(page, 'night');
  const route = solve(createRoom(roomById('night').spec))!.actions;
  const compact = page.getByTestId('zm-pips').locator('.zm-pips__count');
  for (let turns = 1; turns < route.length && (await compact.count()) === 0; turns++) {
    const action = route[turns - 1]!;
    if (action.type !== 'step') break;
    await page.keyboard.press(STEP_KEYS[`${action.dx},${action.dy}`]!);
    await expect(page.getByTestId('zm-turn')).toContainText(`${turns}`);
  }
  await expect(compact).toHaveCount(2);
  await expect(page.getByTestId('zm-pips')).toHaveAttribute('aria-label', /of (9|1\d) tangled/);
  await expect(page.getByTestId('zm-left')).toContainText('docked');
  const counter = (await page.getByTestId('zm-left').boundingBox())!;
  const pips = (await page.getByTestId('zm-pips').boundingBox())!;
  // One line each, side by side in the same row.
  expect(counter.height).toBeLessThan(44);
  expect(pips.height).toBeLessThan(24);
  expect(Math.abs(pips.y + pips.height / 2 - (counter.y + counter.height / 2))).toBeLessThan(14);
});

test('the focus shows on the cat, not as a frame round the board', async ({ page }) => {
  await openHouse(page);
  await enterRoom(page, 'hallway');
  await expect(board(page)).toBeFocused();
  await expect(board(page)).toHaveAttribute('data-focus', 'cat');
  expect(await board(page).evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  await board(page).click({ position: { x: 20, y: 20 } });
  await expect(board(page)).not.toHaveAttribute('data-focus', 'cat');
  await page.keyboard.press('KeyV');
  await expect(board(page)).toHaveAttribute('data-focus', 'cat');
});

test('a whole room with the keyboard alone, from the game menu to the Hall', async ({ page }) => {
  await runInHall(page, 'zoomies');
  await expect(page.getByTestId('zm-menu-house')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zm-room-hallway')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('zm-intro')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeFocused();
  await stepRoute(page, 'hallway');
  await expect(page.getByTestId('zm-results')).toBeVisible({ timeout: 8_000 });
  await page.keyboard.press('KeyH');
  await expectBackInHall(page);
});
