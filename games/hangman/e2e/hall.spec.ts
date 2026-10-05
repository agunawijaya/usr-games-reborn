import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import './hook';

/**
 * Before the Tide, a native game, inside the Hall: its game menu, a Daily Word reaching the
 * Hall's save with its packages, the pause menu, the safe zones and every way out.
 */
async function openGame(page: Page) {
  await runInHall(page, 'hangman');
  await expect(page.getByTestId('bt-menu')).toBeVisible({ timeout: 30_000 });
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Before the Tide' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Daily Word/ })).toBeVisible();
  await expect(page.locator('.pl-corner')).toBeVisible();
  await expect(page.getByTestId('pl-pause-button')).toBeHidden();
  expect(foreign()).toEqual([]);
});

test('a Daily Word reaches the Hall: a win in its save, packages as toasts', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /Daily Word/ }).click();
  await expect(page.getByTestId('pl-pause-button')).toBeVisible();
  await page.evaluate(() => window.__bt.play()!.solve());
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bt-results')).toBeVisible();
  await expect(toasts(page)).toContainText(/XP/);
  await expect.poll(() => savedGameStats(page, 'hangman')).toMatchObject({ sessions: 1, wins: 1 });
  const saved = await page.evaluate(() =>
    window.localStorage.getItem('usr-games:hall:progression'),
  );
  expect(saved).toContain('hangman/first-castle');
  expect(saved).toContain('hangman/clean-sweep');
});

test('the pause menu keeps the standard order, with Head home on a beach', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /Classic/ }).click();
  await page.evaluate(() => window.__bt.play()!.solve());
  await page.keyboard.press('Enter');
  await page.getByTestId('pl-pause-button').click();
  const menu = page.getByRole('list').filter({ has: page.getByRole('button', { name: /Resume/ }) });
  await expect(menu.getByRole('button', { name: /Resume/ })).toBeVisible();
  const labels = (await menu.getByRole('button').allTextContents()).map((text) =>
    text.replace(/\s+/g, ' ').trim(),
  );
  const order = ['Resume', 'Head home', 'How to play', 'Settings', 'Game menu', 'Back to the Hall'];
  const positions = order.map((label) => labels.findIndex((text) => text.includes(label)));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('keeps the Pause pill and the toast corner clear during play', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /Beach day/ }).click();
  await page.getByRole('button', { name: /To the beach/ }).click();
  await expect(page.getByTestId('bt-keys')).toBeVisible();
  const clear = await page.evaluate(() => {
    const hits: string[] = [];
    const zones = [
      { left: window.innerWidth - 220, top: 0, right: window.innerWidth, bottom: 64 },
      { left: 0, top: window.innerHeight - 64 - 260, right: 400, bottom: window.innerHeight - 64 },
    ];
    for (const el of document.querySelectorAll<HTMLElement>('.bt *')) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!ownText && !el.matches('button, a, input')) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      for (const zone of zones) {
        const apart =
          box.right <= zone.left ||
          box.left >= zone.right ||
          box.bottom <= zone.top ||
          box.top >= zone.bottom;
        if (!apart) hits.push(el.className || el.tagName);
      }
    }
    return hits;
  });
  expect(clear).toEqual([]);
});

test('every way out: Back to the Hall from the menu, H from the results', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Escape');
  await expectBackInHall(page);
  await openGame(page);
  await page.getByRole('button', { name: /Tide run/ }).click();
  await page.evaluate(() => window.__bt.play()!.lose());
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bt-results')).toBeVisible();
  await page.keyboard.press('KeyH');
  await expectBackInHall(page);
});
