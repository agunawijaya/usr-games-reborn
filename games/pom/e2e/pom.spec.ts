import { expect, test } from '@playwright/test';
import {
  expectBackInHall,
  frameReloaded,
  revealStrip,
  runInHall,
  savedGameStats,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Selene, the adopted pom, running inside the Hall: it opens in the player's frame, earns the
 * toy's once-a-day XP when the player travels through time, installs its packages, leaves by
 * every door, and never reaches beyond its own files.
 */

const BAKED = 'window.__selene?.ready === true';

test('opens in the Hall’s frame, paints the Moon and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, 'pom');
  await expect(page.getByTestId('pl-strip')).toContainText('Selene');
  await waitForGame(page, BAKED);
  await expect(frame.locator('#r-phase')).not.toHaveText('—');
  await expect(frame.locator('#cap-cmd')).toHaveText('pom');
  expect(foreign()).toEqual([]);
});

test('travelling a day forward counts as today’s visit', async ({ page }) => {
  await runInHall(page, 'pom');
  await waitForGame(page, BAKED);
  await page.keyboard.press('Shift+ArrowRight');
  await expect(toasts(page).locator('.pl-toast').first()).toContainText(/\+\d+ XP/);
  await expect.poll(() => savedGameStats(page, 'pom')).toMatchObject({ sessions: 1, completed: 1 });
});

test('asking pom in its own words installs its package', async ({ page }) => {
  const frame = await runInHall(page, 'pom');
  await waitForGame(page, BAKED);
  await frame.locator('#in-pom').fill('2026010112');
  await frame.locator('#in-pom').press('Enter');
  await expect(frame.locator('#cap-cmd')).toHaveText('pom 2026010112');
  await expect(toasts(page)).toContainText('Achievement unlocked: In pom’s own words');
});

test('picking the coming full moon in the calendar installs Next full moon', async ({ page }) => {
  const frame = await runInHall(page, 'pom');
  await waitForGame(page, BAKED);
  await frame.locator('#btn-calendar').click();
  await frame.locator('#events button', { hasText: 'Full Moon' }).first().click();
  await expect(toasts(page)).toContainText('Achievement unlocked: Next full moon', {
    timeout: 15_000,
  });
});

test('a timelapse watched to the end installs A whole lunation', async ({ page }) => {
  await runInHall(page, 'pom');
  await waitForGame(page, BAKED);
  await page.keyboard.press('Space');
  await expect(toasts(page)).toContainText('Achievement unlocked: A whole lunation', {
    timeout: 40_000,
  });
});

test.describe('the ways out', () => {
  test('Back to the Hall on the strip', async ({ page }) => {
    await runInHall(page, 'pom');
    await waitForGame(page, BAKED);
    await revealStrip(page);
    await page.locator('.pl-strip__hall').click();
    await expectBackInHall(page);
  });

  test('Game menu asks first, then starts the toy afresh', async ({ page }) => {
    const frame = await runInHall(page, 'pom');
    await waitForGame(page, BAKED);
    await page.keyboard.press('Shift+ArrowRight');
    await revealStrip(page);
    await page.getByTestId('pl-strip-menu').click();
    const reloaded = frameReloaded(page, 'pom');
    await page.getByRole('button', { name: 'Leave' }).click();
    await reloaded;
    await waitForGame(page, BAKED);
    await expect(frame.locator('#cap-cmd')).toHaveText('pom');
    await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  });

  test('the browser’s Back button', async ({ page }) => {
    await runInHall(page, 'pom');
    await waitForGame(page, BAKED);
    await page.goBack();
    await expectBackInHall(page);
  });
});
