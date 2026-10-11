import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Dits & Daws, a native game, inside the Hall: its game menu, a message reaching the Hall's save
 * with its packages, the pause menu's order, the safe zones and every way out.
 */
async function openGame(page: Page) {
  await runInHall(page, 'signal');
  await expect(page.getByTestId('dd-menu')).toBeVisible({ timeout: 30_000 });
}

async function readFirstMessage(page: Page) {
  await page.getByRole('button', { name: /The Signal Room/ }).click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.getByTestId('dd-input').fill('tea at ten');
  await page.keyboard.press('Enter');
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: /Dits/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Daily Signal/ })).toBeVisible();
  await expect(page.locator('.pl-corner')).toBeVisible();
  await expect(page.getByTestId('pl-pause-button')).toBeHidden();
  expect(foreign()).toEqual([]);
});

test('a message reaches the Hall: a win in its save, XP as a toast', async ({ page }) => {
  await openGame(page);
  await readFirstMessage(page);
  await expect(page.getByTestId('dd-results')).toBeVisible({ timeout: 15_000 });
  await expect(toasts(page)).toContainText(/XP/);
  await expect.poll(() => savedGameStats(page, 'signal')).toMatchObject({ sessions: 1, wins: 1 });
});

test('a package installs into the Hall’s save', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Free desk', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).first().click();
  await page.keyboard.down('Space');
  await page.waitForTimeout(80);
  await page.keyboard.up('Space');
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('usr-games:hall:progression') ?? ''),
    )
    .toContain('signal/first-dit');
});

test('the pause menu keeps the standard order, with the desk’s own items', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /The Signal Room/ }).click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await page.getByTestId('pl-pause-button').click();
  const menu = page.getByRole('list').filter({ has: page.getByRole('button', { name: /Resume/ }) });
  await expect(menu.getByRole('button', { name: /Resume/ })).toBeVisible();
  const labels = (await menu.getByRole('button').allTextContents()).map((text) =>
    text.replace(/\s+/g, ' ').trim(),
  );
  const order = [
    'Resume',
    'Play the message again',
    'Show me the answer',
    'Back to the desk',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ];
  const positions = order.map((label) => labels.findIndex((text) => text.includes(label)));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

test('keeps the Pause pill and the toast corner clear during play', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /The Signal Room/ }).click();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dd-input')).toBeVisible();
  const clear = await page.evaluate(() => {
    const hits: string[] = [];
    const zones = [
      { left: window.innerWidth - 220, top: 0, right: window.innerWidth, bottom: 64 },
      { left: 0, top: window.innerHeight - 64 - 260, right: 400, bottom: window.innerHeight - 64 },
    ];
    for (const el of document.querySelectorAll<HTMLElement>('.dd *')) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!ownText && !el.matches('button, a, input')) continue;
      if (el.closest('[hidden]')) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0) continue;
      for (const zone of zones) {
        const apart =
          box.right <= zone.left ||
          box.left >= zone.right ||
          box.bottom <= zone.top ||
          box.top >= zone.bottom;
        if (!apart) hits.push(`${el.tagName}.${el.className}`);
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
  await readFirstMessage(page);
  await expect(page.getByTestId('dd-results')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('KeyH');
  await expectBackInHall(page);
});
