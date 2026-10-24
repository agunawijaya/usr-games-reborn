import { expect, type Page, test } from '@playwright/test';
import { expectBackInHall, runInHall } from '../../../packages/bridge/testing/hall';
import { HALL_PORT } from './ports';

/**
 * Fifteen-Two inside the real Hall (its own dev server on port 5317): launched from the Hall,
 * its pause item, its own results with the Hall's receipt, Play again, and every way back out.
 */

test.use({ baseURL: `http://localhost:${HALL_PORT}/` });

// A freshly started dev server compiles the game on its first request; do that once, untimed.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ baseURL: `http://localhost:${HALL_PORT}/` });
  await runInHall(page, 'cribbage').catch(() => undefined);
  await page.getByTestId('ft-title').waitFor({ timeout: 90_000 }).catch(() => undefined);
  await page.close();
});

async function openGame(page: Page, appearance: 'dark' | 'light' = 'dark') {
  await runInHall(page, 'cribbage', { appearance, motion: 'reduce' });
  await expect(page.getByTestId('ft-title')).toBeVisible({ timeout: 30_000 });
}

async function startShortGame(page: Page) {
  await page.getByTestId('ft-menu-new').click();
  await page.getByTestId('ft-choice-length-61').check();
  await page.getByTestId('ft-start').click();
  await page.waitForFunction(() => window.__ft?.phase() === 'lay-away', undefined, { timeout: 30_000 });
}

async function playToTheEnd(page: Page) {
  await page.evaluate(() => window.__ft!.fast(12));
  for (let guard = 0; guard < 3000; guard++) {
    const done = await page.evaluate(() => {
      const ft = window.__ft!;
      const phase = ft.phase();
      if (phase === 'results') return true;
      if (phase === 'lay-away' || phase === 'play') ft.act(ft.best());
      else if (phase === 'next-hand') ft.next();
      return false;
    });
    if (done) return;
    await page.waitForTimeout(30);
  }
  throw new Error('the game did not end');
}

test.describe('Fifteen-Two in the Hall @game', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('Escape on a page of the game menu comes back to the game menu, not the Hall', async ({ page }) => {
    await openGame(page);
    await page.getByTestId('ft-menu-album').click();
    await expect(page.getByTestId('ft-album')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ft-title')).toBeVisible();
  });

  test('the pause menu carries the coach, and its Game menu asks before leaving', async ({ page }) => {
    await openGame(page);
    await startShortGame(page);
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('pl-pause');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toContainText(['Resume', 'Coach off', 'Game menu', 'Back to the Hall']);
    await pause.getByRole('button', { name: 'Game menu' }).click();
    const confirm = page.getByTestId('pl-confirm');
    if (await confirm.isVisible()) await confirm.getByRole('button', { name: 'Leave' }).click();
    else await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('ft-title')).toBeVisible();
    // The game was kept: it can be continued.
    await expect(page.getByTestId('ft-menu-continue')).toBeVisible();
  });

  test('a finished game shows its own results with the Hall’s receipt; H goes home', async ({ page }) => {
    await openGame(page, 'light');
    await startShortGame(page);
    await playToTheEnd(page);
    await expect(page.getByTestId('ft-results')).toBeVisible();
    await expect(page.locator('.ft-footnotes')).toContainText('XP');
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Play again deals a new game without leaving', async ({ page }) => {
    await openGame(page);
    await startShortGame(page);
    await playToTheEnd(page);
    await page.waitForTimeout(700);
    await page.keyboard.press('r');
    await page.waitForFunction(() => ['lay-away', 'busy'].includes(window.__ft!.phase()), undefined, {
      timeout: 30_000,
    });
  });
});
