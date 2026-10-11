import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Number Sprint, a native game, inside the Hall: the first-launch theme pick and the game menu, a
 * block reaching the Hall's save with its packages, the pause menu's order, the safe zones in
 * every mode and the ways out.
 */

declare global {
  interface Window {
    __ns: { mode: string; answer(): string } | null;
  }
}

async function openGame(page: Page) {
  await runInHall(page, 'arithmetic');
  await expect(page.getByTestId('ns-pick')).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('1');
  await expect(page.getByTestId('ns-menu-daily')).toBeVisible();
}

async function startFree(page: Page, mode: string, rung: string) {
  await page.getByTestId(`ns-menu-${mode}`).click();
  await page.getByTestId(`ns-rung-${rung}`).click();
  await page.getByTestId('ns-setup-start').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__ns));
}

async function finishEvent(page: Page) {
  for (let i = 0; i < 200; i++) {
    const next = await page.evaluate(() => window.__ns?.answer() ?? null);
    if (next === null) return;
    if (next === '') {
      await page.waitForTimeout(100);
      continue;
    }
    await page.keyboard.type(next);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(25);
  }
}

test('opens on the theme pick, then its game menu, and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: 'Number Sprint' })).toBeVisible();
  await expect(page.locator('.pl-corner')).toBeVisible();
  await expect(page.getByTestId('pl-pause-button')).toBeHidden();
  expect(foreign()).toEqual([]);
});

test('a block reaches the Hall: a win in its save, packages as toasts', async ({ page }) => {
  await openGame(page);
  await startFree(page, 'sums', 'plus-10');
  await expect(page.getByTestId('pl-pause-button')).toBeVisible();
  await finishEvent(page);
  await expect(page.getByTestId('ns-results')).toBeVisible({ timeout: 15_000 });
  await expect(toasts(page)).toContainText(/XP/);
  await expect
    .poll(() => savedGameStats(page, 'arithmetic'))
    .toMatchObject({ sessions: 1, wins: 1 });
  const saved = await page.evaluate(() =>
    window.localStorage.getItem('usr-games:hall:progression'),
  );
  expect(saved).toContain('arithmetic/perfect-block');
});

test('the pause menu keeps the standard order, with the restart in its place', async ({ page }) => {
  await openGame(page);
  await startFree(page, 'sums', 'plus-10');
  await page.getByTestId('pl-pause-button').click();
  const menu = page.getByRole('list').filter({ has: page.getByRole('button', { name: /Resume/ }) });
  await expect(menu.getByRole('button', { name: /Resume/ })).toBeVisible();
  const labels = (await menu.getByRole('button').allTextContents()).map((text) =>
    text.replace(/\s+/g, ' ').trim(),
  );
  const order = [
    'Resume',
    'Start this block again',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ];
  const positions = order.map((label) => labels.findIndex((text) => text.includes(label)));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

for (const [mode, rung] of [
  ['sums', 'times-10'],
  ['split', 'hundreds'],
  ['sieve', 'four-hundred'],
  ['spell', 'thousands'],
] as const) {
  test(`keeps the Pause pill and the toast corner clear in ${mode}`, async ({ page }) => {
    await openGame(page);
    await startFree(page, mode, rung);
    await page.waitForTimeout(400);
    const hits = await page.evaluate(() => {
      const found: string[] = [];
      const zones = [
        { left: window.innerWidth - 220, top: 0, right: window.innerWidth, bottom: 64 },
        {
          left: 0,
          top: window.innerHeight - 64 - 260,
          right: 400,
          bottom: window.innerHeight - 64,
        },
      ];
      for (const el of document.querySelectorAll<HTMLElement>('.ns *')) {
        const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
        if (!ownText && !el.matches('button')) continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0) continue;
        for (const zone of zones) {
          const apart =
            box.right <= zone.left ||
            box.left >= zone.right ||
            box.bottom <= zone.top ||
            box.top >= zone.bottom;
          if (!apart) found.push(String(el.className || el.tagName));
        }
      }
      return found;
    });
    expect(hits).toEqual([]);
  });
}

test('every way out: Escape on the menu, H from the results', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Escape');
  await expectBackInHall(page);
  await openGame(page);
  await startFree(page, 'sums', 'plus-10');
  await finishEvent(page);
  await expect(page.getByTestId('ns-results')).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('h');
  await expectBackInHall(page);
});
