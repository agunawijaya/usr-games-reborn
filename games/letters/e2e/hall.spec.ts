import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  runInHall,
  savedGameStats,
  toasts,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import { boardWords, trace, waitForPlay } from './hook';

/**
 * Chain Letter, a native game, inside the Hall: its game menu, a Daily Grid reaching the Hall's
 * save with its packages, the pause menu's order, the safe zones and the ways out.
 */
async function openGame(page: Page) {
  await runInHall(page, 'letters');
  await expect(page.getByTestId('chl-title')).toBeVisible({ timeout: 30_000 });
}

async function revealFromPause(page: Page) {
  await page.getByTestId('pl-pause-button').click();
  await page.getByRole('button', { name: /Reveal the board now/ }).click();
  await expect(page.getByTestId('chl-reveal')).toBeVisible({ timeout: 15_000 });
}

/** The game's visible text and controls under an element of the Hall's (as the Hall's spec does). */
function underneath(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const zone = document.querySelector(sel)!.getBoundingClientRect();
    const hits: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('.pl-stage *')) {
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      if (!ownText && !el.matches('button, a, input, select')) continue;
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.opacity === '0') continue;
      const apart =
        box.right <= zone.left ||
        box.left >= zone.right ||
        box.bottom <= zone.top ||
        box.top >= zone.bottom;
      if (!apart) hits.push(`${el.tagName.toLowerCase()}.${el.classList[0] ?? ''}`);
    }
    return hits;
  }, selector);
}

test('opens on its game menu inside the Hall and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  await openGame(page);
  await expect(page.getByRole('heading', { name: /Chain/ })).toBeVisible();
  await expect(page.getByTestId('chl-mode-daily')).toBeVisible();
  await expect(page.locator('.pl-corner')).toBeVisible();
  await expect(page.getByTestId('pl-pause-button')).toBeHidden();
  expect(foreign()).toEqual([]);
});

test('a Daily Grid reaches the Hall: a session in its save, packages as toasts', async ({
  page,
}) => {
  await openGame(page);
  await page.getByTestId('chl-mode-daily').click();
  await waitForPlay(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 4)!;
  await trace(page, word.path);
  await revealFromPause(page);
  await expect(toasts(page)).toContainText(/XP/);
  await expect.poll(() => savedGameStats(page, 'letters')).toMatchObject({ sessions: 1 });
  const saved = await page.evaluate(() =>
    window.localStorage.getItem('usr-games:hall:progression'),
  );
  expect(saved).toContain('letters/first-chain');
});

test('the pause menu keeps the standard order with the game’s own items', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('chl-mode-classic').click();
  await waitForPlay(page);
  await page.getByTestId('pl-pause-button').click();
  const menu = page.getByRole('list').filter({ has: page.getByRole('button', { name: /Resume/ }) });
  await expect(menu.getByRole('button', { name: /Resume/ })).toBeVisible();
  const labels = (await menu.getByRole('button').allTextContents()).map((text) =>
    text.replace(/\s+/g, ' ').trim(),
  );
  const order = [
    'Resume',
    'New board',
    'Reveal the board now',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ];
  const positions = order.map((label) => labels.findIndex((text) => text.includes(label)));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`at ${size.width}, the pill and three toasts cover none of the game's text or controls`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await openGame(page);
    await page.getByTestId('chl-mode-classic').click();
    await waitForPlay(page);
    const pill = page.getByTestId('pl-pause-button');
    await expect(pill).toBeVisible();
    expect(await underneath(page, '[data-testid="pl-pause-button"]')).toEqual([]);
    await page.evaluate(() => {
      const stack = document.querySelector('[data-testid="pl-toasts"]')!;
      for (const xp of ['+30 XP', '+60 XP', '+115 XP']) {
        const card = document.createElement('div');
        card.className = 'pl-toast pl-toast--xp';
        card.innerHTML = `<p class="pl-toast__lead">${xp}</p><ul class="pl-toast__list"><li class="pl-toast__item">Achievement unlocked: a long achievement name</li></ul>`;
        stack.append(card);
      }
    });
    expect(await underneath(page, '[data-testid="pl-toasts"]')).toEqual([]);
  });
}

test('Escape on the game menu, and Back to the Hall on the reveal, both lead home', async ({
  page,
}) => {
  await openGame(page);
  await page.keyboard.press('Escape');
  await expectBackInHall(page);
  await openGame(page);
  await page.getByTestId('chl-mode-classic').click();
  await waitForPlay(page);
  await revealFromPause(page);
  await page.getByTestId('chl-hall').click();
  await expectBackInHall(page);
});
