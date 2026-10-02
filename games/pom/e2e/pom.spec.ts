import { expect, type Page, test } from '@playwright/test';
import {
  bridgeLog,
  expectBackInHall,
  expectStripAboveFrame,
  frameReloaded,
  inGame,
  recordBridgeMessages,
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

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`the strip sits above the toy at ${viewport.width}×${viewport.height}, with and without the calendar`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const frame = await runInHall(page, 'pom');
    await waitForGame(page, BAKED);
    await expectStripAboveFrame(page);
    await expect(frame.locator('#btn-calendar')).toBeInViewport();
    await frame.locator('#btn-calendar').click();
    await expect(frame.locator('#calendar')).toBeVisible();
    await expectStripAboveFrame(page);
  });
}

test.describe('the Hall’s reduced motion', () => {
  /** Selene's own motion switch and the still class its stylesheet keys on (src/ui/app.js). */
  const motion = (page: Page) =>
    inGame<{ motion: boolean; still: boolean }>(
      page,
      `({ motion: window.__seleneApp.S.motion, still: document.body.classList.contains('still') })`,
    );

  test('a Hall set to reduced motion holds the sky still', async ({ page }) => {
    await runInHall(page, 'pom', { motion: 'reduce' });
    await waitForGame(page, BAKED);
    await expect.poll(() => motion(page)).toEqual({ motion: false, still: true });
  });

  test('with the system’s motion setting, a change there reaches the toy live', async ({
    page,
  }) => {
    await recordBridgeMessages(page);
    await runInHall(page, 'pom', { motion: 'system' });
    await waitForGame(page, BAKED);
    await expect
      .poll(async () => (await bridgeLog(page)).some((message) => message.type === 'hello'))
      .toBe(true);
    expect(await motion(page)).toEqual({ motion: true, still: false });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => motion(page)).toEqual({ motion: false, still: true });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => motion(page)).toEqual({ motion: true, still: false });
  });
});

test('keyboard alone: travel and play a timelapse, step out to the strip and back, and leave', async ({
  page,
}) => {
  const frame = await runInHall(page, 'pom');
  await waitForGame(page, BAKED);
  const inStrip = () =>
    page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="pl-strip"]')?.contains(document.activeElement)),
    );
  const inFrame = () =>
    page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'pl-frame');
  const hallLink = page.locator('.pl-strip__hall');

  await page.keyboard.press('Shift+ArrowRight');
  await expect(frame.locator('#cap-cmd')).not.toHaveText('pom');
  await page.keyboard.press('Space');
  await expect(frame.locator('#btn-play')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(frame.locator('#btn-play')).toHaveAttribute('aria-pressed', 'false');

  // Shift+Tab walks out of the toy to the strip above it; Tab walks back in.
  for (let i = 0; i < 30 && !(await inStrip()); i++) await page.keyboard.press('Shift+Tab');
  expect(await inStrip()).toBe(true);
  for (let i = 0; i < 30 && !(await inFrame()); i++) await page.keyboard.press('Tab');
  expect(await inFrame()).toBe(true);
  expect(await inGame(page, 'document.activeElement !== document.body')).toBe(true);

  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Shift+Tab');
    if (await hallLink.evaluate((link) => link === document.activeElement)) break;
  }
  await expect(hallLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expectBackInHall(page);
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
