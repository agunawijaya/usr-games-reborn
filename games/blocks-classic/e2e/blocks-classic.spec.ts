import { expect, type FrameLocator, type Page, test } from '@playwright/test';
import { beginCareerShift, beginDailyShift, clearTheShift, READY, topOutTheShift } from './shift';
import {
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  inGame,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Broken Well inside the Hall: the game menu as its title screen, a career shift from its
 * briefing to the report, the Daily Shift's share line, leaving a shift half-way, pause, the
 * Hall's sound and appearance, the strip and the keyboard, and every way back out.
 */

async function openGame(page: Page): Promise<FrameLocator> {
  const frame = await runInHall(page, 'blocks-classic');
  await waitForGame(page, READY);
  return frame;
}

test.describe('Broken Well in the Hall', () => {
  test('opens on its game menu, with no requests beyond the Hall', async ({ page }) => {
    const foreign = watchForeignRequests(page);
    const frame = await openGame(page);
    await expect(frame.getByRole('button', { name: /Continue — Shift 1/ })).toBeVisible();
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.waitForTimeout(1500);
    expect(foreign()).toEqual([]);
  });

  test('a career shift: briefing, the drop, the report and the Hall’s result', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerShift(page);
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await clearTheShift(page);
    await expect(frame.locator('.desk-report-title')).toHaveText('Shift cleared!');
    await expect(frame.locator('.desk-chronicle li').first()).toContainText('You clocked in at');
    await expect
      .poll(async () => (await savedGameStats(page, 'blocks-classic'))?.wins ?? 0)
      .toBe(1);
    // The gate to the second shift is open now.
    await frame.getByRole('button', { name: 'Game menu' }).click();
    await frame.getByRole('button', { name: /The Shifts/ }).click();
    await expect(frame.getByRole('button', { name: /Shift 2: The Canyon Cut/ })).toBeEnabled();
  });

  test('a topped-out shift reports a loss and still writes the logbook', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerShift(page);
    await topOutTheShift(page);
    await expect(frame.locator('.desk-report-title')).toHaveText('The stack topped out');
    await frame.getByRole('button', { name: 'Game menu' }).click();
    await frame.getByRole('button', { name: 'Logbook' }).click();
    await expect(frame.locator('.desk-log-entry').first()).toBeVisible();
  });

  test('the Daily Shift gives a share line with no link', async ({ page }) => {
    const frame = await openGame(page);
    await beginDailyShift(page);
    await clearTheShift(page);
    await expect(frame.getByTestId('share-line')).toHaveText(
      /^Broken Well #\d+ · shift cleared in \d+ pieces · \d+ pts · [◆◇]{3}$/,
    );
  });

  test('leaving a shift half-way asks first and counts as a quit', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerShift(page);
    await frame.locator('#btn-pause').click();
    await expect(frame.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await frame.getByRole('button', { name: 'Game menu' }).click();
    await expect(frame.getByRole('heading', { name: 'Leave this shift?' })).toBeVisible();
    await frame.getByRole('button', { name: 'Keep digging' }).click();
    await expect(frame.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await frame.getByRole('button', { name: 'Game menu' }).click();
    await frame.getByRole('button', { name: 'Leave' }).click();
    await expect(frame.getByRole('button', { name: /Continue — Shift 1/ })).toBeVisible();
    await expect
      .poll(async () => (await savedGameStats(page, 'blocks-classic'))?.sessions ?? 0)
      .toBe(1);
  });

  test('Esc pauses during play and Enter resumes', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerShift(page);
    await page.keyboard.press('Escape');
    await expect(frame.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(frame.getByRole('heading', { name: 'Paused' })).not.toBeVisible();
  });

  test('R replays and H returns to the Hall from the report', async ({ page }) => {
    await openGame(page);
    await beginCareerShift(page);
    await clearTheShift(page);
    await page.keyboard.press('r');
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await clearTheShift(page);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });
});

test.describe('the Hall’s appearance', () => {
  test('a dark Hall keeps the well dark; a light Hall switches it', async ({ page }) => {
    await runInHall(page, 'blocks-classic', { appearance: 'light' });
    await waitForGame(page, READY);
    await expect
      .poll(() => inGame<string | null>(page, 'document.documentElement.dataset.theme ?? null'))
      .toBe('light');
  });
});

test.describe('the strip and the keyboard', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`the strip sits above the game at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openGame(page);
      await expectStripAboveFrame(page);
      await beginCareerShift(page);
      await expectStripAboveFrame(page);
    });
  }
});

describeWaysOut({ id: 'blocks-classic', ready: READY, titleScreen: true });
