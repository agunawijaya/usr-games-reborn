import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { ROOMS, roomById } from '../src/data/house';
import type { RoomTheme } from '../src/data/blueprints';
import { createRoom } from '../src/engine/room';
import { solve } from '../src/engine/solver';

/**
 * The polish pass's "after" frames (`docs/media/polish/`, with POLISH.md beside them), inside the
 * Hall at 1920×1080 in both looks: the whole house in play, the Long Night with the camera on the
 * cat, the room-cleared payoff mid-moment, and the reveal with the new trails; the whole house at
 * 1280×720, where the camera keeps the cat 48 px tall; and two Hall frames for the player's safe
 * zones. Run with `SHOTS=1 pnpm exec playwright test -c games/zoomies polish-shots`.
 */

const MEDIA = 'games/zoomies/docs/media/polish';
type Look = 'light' | 'dark';
const LOOKS: Look[] = ['light', 'dark'];
const name = (look: Look) => (look === 'light' ? 'day' : 'night');
/** After the last step's key, the turn plays (about 0.45 s), then the payoff begins. */
const MID_PAYOFF_MS = Number(process.env.MID_PAYOFF_MS ?? 1450);

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

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, look: Look, width = 1920, height = 1080) {
  await page.setViewportSize({ width, height });
  await runInHall(page, 'zoomies', { appearance: look, style: 'console' });
  // runInHall clears the save on every load, so the open house is written after it, then reloaded.
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

/** Plays the first `turns` of a room's par route; the last key is not waited for. */
async function playRoute(page: Page, id: RoomTheme, turns: number) {
  await page.getByTestId('zm-menu-house').click();
  await page.getByTestId(`zm-room-${id}`).click();
  await expect(page.getByTestId('zm-intro')).toBeVisible();
  await page.keyboard.press('Enter');
  const route = solve(createRoom(roomById(id).spec))!.actions;
  const steps = route.slice(0, turns);
  for (const [turn, action] of steps.entries()) {
    if (action.type !== 'step') continue;
    await page.keyboard.press(STEP_KEYS[`${action.dx},${action.dy}`]!);
    if (turn < steps.length - 1)
      await expect(page.getByTestId('zm-turn')).toContainText(`${turn + 1}`);
  }
  return route;
}

for (const look of LOOKS) {
  test(`the whole house in play, ${name(look)}`, async ({ page }) => {
    await open(page, look);
    await playRoute(page, 'night', 3);
    await page.waitForTimeout(900);
    await page.mouse.move(10, 1070);
    await saveScreenshot(page, `${MEDIA}/big-room-${name(look)}-1920.webp`);
  });

  test(`the Long Night, the camera on the cat, ${name(look)}`, async ({ page }) => {
    await open(page, look);
    await page.getByTestId('zm-menu-night').click();
    await page.getByTestId('zm-start').click();
    await expect(page.getByTestId('zm-start')).toBeHidden();
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('KeyS');
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(700);
    await saveScreenshot(page, `${MEDIA}/long-night-${name(look)}-1920.webp`);
  });

  test(`the payoff, mid-moment, ${name(look)}`, async ({ page }) => {
    await open(page, look);
    const route = solve(createRoom(roomById('living').spec))!.actions;
    await playRoute(page, 'living', route.length);
    await page.waitForTimeout(MID_PAYOFF_MS);
    await saveScreenshot(page, `${MEDIA}/payoff-${name(look)}-1920.webp`);
  });

  test(`the reveal with the trails, ${name(look)}`, async ({ page }) => {
    await open(page, look);
    const route = solve(createRoom(roomById('living').spec))!.actions;
    await playRoute(page, 'living', route.length);
    await expect(page.getByTestId('zm-results')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(6500);
    await saveScreenshot(page, `${MEDIA}/reveal-${name(look)}-1920.webp`);
  });
}

test('the whole house at 1280×720, the cat still 48 px tall', async ({ page }) => {
  await open(page, 'light', 1280, 720);
  await playRoute(page, 'night', 3);
  await page.waitForTimeout(900);
  await page.mouse.move(10, 710);
  await saveScreenshot(page, `${MEDIA}/big-room-day-1280.webp`);
});

test('the Hall: a game menu has no Pause pill', async ({ page }) => {
  await open(page, 'dark');
  await page.waitForTimeout(2500);
  await saveScreenshot(page, `${MEDIA}/hall-menu-night-1920.webp`);
});

test('the Hall: the pill clear of the status, a toast in the bottom-left', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await runInHall(page, 'lightkeeper', { appearance: 'dark', style: 'console' });
  await page.getByTestId('lk-menu-open').click();
  await page.getByTestId('lk-open-code').fill('test-40');
  await page.getByRole('radio', { name: /^Cadet/ }).click();
  await page.getByRole('radio', { name: /Short/ }).click();
  await page.getByRole('radio', { name: /1976/ }).click();
  await page.getByTestId('lk-open-begin').click();
  await page.getByTestId('lk-begin').click();
  await expect(page.getByTestId('lk-play')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.keyboard.press('g');
  await expect(page.getByTestId('lk-log')).toContainText('Shield lowered.');
  await page.keyboard.press('b');
  await page.getByTestId('lk-beam-sure').click();
  await page.getByTestId('lk-beam-fire').click();
  await expect(page.getByTestId('pl-toasts')).toContainText('Achievement unlocked', {
    timeout: 10_000,
  });
  await page.waitForTimeout(900);
  await saveScreenshot(page, `${MEDIA}/hall-play-night-1920.webp`);
});
