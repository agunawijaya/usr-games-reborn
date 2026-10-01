import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { ROOMS, roomById } from '../src/data/house';
import type { RoomTheme } from '../src/data/blueprints';
import { createRoom } from '../src/engine/room';
import { solve } from '../src/engine/solver';

/**
 * The documentation screenshots in `docs/media/`, taken inside the Hall:
 * `SHOTS=1 pnpm exec playwright test -c games/zoomies`. Every room is opened in the save first,
 * so any room can be shot.
 */

const MEDIA = 'games/zoomies/docs/media';

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

type Look = 'light' | 'dark';
const LOOKS: Look[] = ['light', 'dark'];
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];
const name = (look: Look) => (look === 'light' ? 'day' : 'night');

async function open(page: Page, look: Look, width: number, height: number) {
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

async function playRoute(page: Page, id: RoomTheme, turns: number) {
  await page.getByTestId('zm-menu-house').click();
  await page.getByTestId(`zm-room-${id}`).click();
  await expect(page.getByTestId('zm-intro')).toBeVisible();
  await page.keyboard.press('Enter');
  const route = solve(createRoom(roomById(id).spec))!.actions;
  for (const [turn, action] of route.slice(0, turns).entries()) {
    if (action.type !== 'step') continue;
    await page.keyboard.press(STEP_KEYS[`${action.dx},${action.dy}`]!);
    if (turn < route.length - 1)
      await expect(page.getByTestId('zm-turn')).toContainText(`${turn + 1}`);
  }
}

for (const look of LOOKS) {
  for (const { width, height } of SIZES) {
    test(`game menu, ${name(look)}, ${width}`, async ({ page }) => {
      await open(page, look, width, height);
      await page.waitForTimeout(2500);
      await saveScreenshot(page, `${MEDIA}/title-${name(look)}-${width}.webp`);
    });

    test(`a room in play, ${name(look)}, ${width}`, async ({ page }) => {
      await open(page, look, width, height);
      await playRoute(page, 'study', 3);
      await page.waitForTimeout(700);
      await saveScreenshot(page, `${MEDIA}/play-${name(look)}-${width}.webp`);
    });

    test(`results beside the trails, ${name(look)}, ${width}`, async ({ page }) => {
      await open(page, look, width, height);
      await playRoute(page, 'living', 99);
      await expect(page.getByTestId('zm-results')).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(2200);
      await saveScreenshot(
        page,
        `${MEDIA}/${width === 1920 ? 'hero' : 'results'}-${name(look)}-${width}.webp`,
      );
    });
  }

  test(`the house, ${name(look)}`, async ({ page }) => {
    await open(page, look, 1280, 720);
    await page.getByTestId('zm-menu-house').click();
    await page.waitForTimeout(400);
    await saveScreenshot(page, `${MEDIA}/house-${name(look)}-1280.webp`);
  });

  test(`the long night, ${name(look)}`, async ({ page }) => {
    await open(page, look, 1280, 720);
    await page.getByTestId('zm-menu-night').click();
    await page.keyboard.press('4');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('KeyS');
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(600);
    await saveScreenshot(page, `${MEDIA}/long-night-${name(look)}-1280.webp`);
  });

  test(`the pattern lab, ${name(look)}`, async ({ page }) => {
    await open(page, look, 1280, 720);
    await page.getByTestId('zm-menu-lab').click();
    await page.getByTestId('zm-run').click();
    await page.waitForTimeout(2500);
    await saveScreenshot(page, `${MEDIA}/lab-${name(look)}-1280.webp`);
  });
}

test('the game page in Console Home', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await runInHall(page, 'zoomies', { appearance: 'dark', style: 'console' });
  await page.goto('/#/game/zoomies');
  await page.waitForTimeout(3000);
  await saveScreenshot(page, `${MEDIA}/in-the-hall-night-1920.webp`);
});
