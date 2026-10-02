import { expect, type FrameLocator, type Page, test } from '@playwright/test';
import { beginCareerDelve, READY, slayTheWumpus } from './delve';
import {
  describeWaysOut,
  expectBackInHall,
  inGame,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * The Rune Gates inside the Hall: the game menu as its title screen, a career delve from the
 * briefing to the chronicle, the Daily Delve's share line, leaving a delve half-way, and every
 * way back out. The engine is the game's own; the tests read its cave (window.game) to walk
 * safely and aim true, as a careful delver would after enough delves.
 */

async function openGame(page: Page): Promise<FrameLocator> {
  const frame = await runInHall(page, 'wump-classic');
  await waitForGame(page, READY);
  return frame;
}

test.describe('The Rune Gates in the Hall', () => {
  test('opens on its game menu, with no requests beyond the Hall', async ({ page }) => {
    const foreign = watchForeignRequests(page);
    const frame = await openGame(page);
    await expect(frame.getByRole('navigation', { name: 'Game menu' })).toBeVisible();
    await expect(frame.getByTestId('rank')).toContainText('Lamp-bearer');
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.waitForTimeout(1500);
    expect(foreign()).toEqual([]);
  });

  test('a career delve: briefing, the hunt, the chronicle and the Hall’s result', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginCareerDelve(page);
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await slayTheWumpus(page);
    await expect(frame.locator('.desk-report-title')).toHaveText('WUMPUS SLAIN!');
    await expect(frame.locator('.desk-chronicle li').first()).toContainText(
      'You passed through the rune gate',
    );
    await expect.poll(async () => (await savedGameStats(page, 'wump-classic'))?.wins ?? 0).toBe(1);
    // The gate to the second delve is open now.
    await frame.getByRole('button', { name: 'Game menu' }).click();
    await frame.getByRole('button', { name: /The Delves/ }).click();
    await expect(
      frame.getByRole('button', { name: /Delve 2: The Twelve-Pillared Hall/ }),
    ).toBeEnabled();
  });

  test('the Daily Delve gives a share line with no link', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByRole('button', { name: /Daily Delve/ }).click();
    await frame.getByRole('button', { name: /Begin the delve/ }).click();
    await slayTheWumpus(page);
    await expect(frame.getByTestId('share-line')).toHaveText(
      /^The Rune Gates #\d+ · slain in \d+ moves · 🏹\d · [◆◇]{3}$/,
    );
    await expect(frame.getByText('Your Daily Delve is in the ledger.')).toBeVisible();
  });

  test('leaving a delve half-way asks first and counts as a quit', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerDelve(page);
    const wall = await inGame<number>(
      page,
      `(() => { const g = window.game; for (let r = 1; r <= 20; r++) if (r !== g.playerLoc && !g.cave[g.playerLoc].includes(r)) return r; })()`,
    );
    await inGame(page, `window.handlePlayerMove(${wall})`);
    await frame.locator('#btn-desk-menu').click();
    await expect(frame.getByRole('heading', { name: 'Leave this delve?' })).toBeVisible();
    await frame.getByRole('button', { name: 'Keep delving' }).click();
    await expect(frame.locator('#btn-shoot-modal')).toBeVisible();
    await frame.locator('#btn-desk-menu').click();
    await frame.getByRole('button', { name: 'Leave' }).click();
    await expect(frame.getByRole('navigation', { name: 'Game menu' })).toBeVisible();
    await expect
      .poll(async () => (await savedGameStats(page, 'wump-classic'))?.sessions ?? 0)
      .toBe(1);
  });

  test('an arrow can be aimed from the keyboard alone', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerDelve(page);
    await page.keyboard.press('s');
    await expect(frame.locator('.tunnel-chip').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(frame.locator('#trajectory-display .traj-hop')).toHaveCount(2);
    await expect(frame.locator('.tunnel-chip').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(frame.locator('#modal-shoot')).not.toHaveClass(/open/);
  });

  test('Escape closes How to play without leaving for the Hall', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByRole('button', { name: /How to play/ }).click();
    await expect(frame.locator('#modal-lore')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(frame.locator('#modal-lore')).not.toHaveClass(/open/);
    await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  });

  test('H on the chronicle goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await beginCareerDelve(page);
    await slayTheWumpus(page);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });
});

describeWaysOut({ id: 'wump-classic', ready: READY, titleScreen: true });
