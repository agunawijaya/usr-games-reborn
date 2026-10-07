import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  gameFrame,
  inGame,
  runInHall,
  savedGameStats,
  setTabHidden,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import { enterRoom, installedPackages, loseCipher, READY, solveCipher } from './gallows';

/**
 * Escape the Gallows inside the Hall: five rooms drawn in code with nothing fetched from anywhere,
 * a solved cipher as a win with its package, a lost one as a loss with the room's own ending,
 * the Hall's reduced motion and pause, and every way back out.
 */

async function openGame(page: Page, seed = {}) {
  const frame = await runInHall(page, 'hangman-classic', seed);
  await waitForGame(page, READY);
  return frame;
}

test.describe('Escape the Gallows in the Hall', () => {
  test('opens in the Pirate’s Hold, every room drawn in code, nothing fetched beyond the Hall', async ({
    page,
  }) => {
    const foreign = watchForeignRequests(page);
    const missing: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) missing.push(response.url());
    });
    const frame = await openGame(page);
    await expect(frame.locator('.scene-pirate.active')).toBeVisible();
    const pictures = await inGame<{ total: number; drawn: number }>(
      page,
      `(() => {
        const all = [...document.querySelectorAll('[data-art]')];
        return { total: all.length, drawn: all.filter((el) => el.querySelector('svg')).length };
      })()`,
    );
    expect(pictures.total).toBeGreaterThan(50);
    expect(pictures.drawn).toBe(pictures.total);
    for (const room of ['lab', 'temple', 'crypt', 'void'] as const) {
      await enterRoom(page, room);
      await expect(frame.locator(`.scene-${room}.active`)).toBeVisible();
    }
    expect(foreign()).toEqual([]);
    expect(missing).toEqual([]);
  });

  test('a solved cipher is a win the Hall keeps, with the room’s package', async ({ page }) => {
    const frame = await openGame(page);
    await solveCipher(page);
    await expect(frame.locator('#overlay.visible.win-mode')).toBeVisible();
    await expect(frame.locator('#overlay-title')).toHaveText('The door opens.');
    await expect
      .poll(async () => (await savedGameStats(page, 'hangman-classic'))?.wins ?? 0)
      .toBe(1);
    await expect
      .poll(async () => (await savedGameStats(page, 'hangman-classic'))?.counters.ciphers ?? 0)
      .toBe(1);
    await expect.poll(() => installedPackages(page)).toContain('hangman-classic/out-of-the-hold');
  });

  test('a lost cipher is a loss, and the hold floods with the captain’s bones afloat', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await loseCipher(page);
    await expect(frame.locator('#overlay.visible')).toBeVisible();
    await expect(frame.locator('#overlay-title')).toHaveText('The water takes you.');
    await expect(frame.locator('.pirate-character')).toBeHidden();
    await expect(frame.locator('.pirate-messy-scattered')).toHaveCount(18);
    await expect
      .poll(async () => (await savedGameStats(page, 'hangman-classic'))?.losses ?? 0)
      .toBe(1);
  });

  test('each room plays its own end', async ({ page }) => {
    const frame = await openGame(page);
    await enterRoom(page, 'lab');
    await loseCipher(page);
    await expect(frame.locator('.lab-character[data-slump="6"]')).toBeVisible();
    await enterRoom(page, 'temple');
    await loseCipher(page);
    await expect(frame.locator('.temple-worker.dead')).toBeVisible();
    await expect(frame.locator('.temple-mummy.emerging')).toBeVisible();
    await enterRoom(page, 'crypt');
    await loseCipher(page);
    await expect(frame.locator('.crypt-dracula-kill.visible')).toBeVisible();
    await expect(frame.locator('.scene-crypt.darkened')).toBeVisible();
    await expect(frame.locator('#overlay-title')).toHaveText('The cape closes. The candles die.');
    await enterRoom(page, 'void');
    const oxygen = frame.locator('[data-gas="o2"]');
    await expect(oxygen.locator('[data-part="value"]')).toHaveText('20.9');
    await loseCipher(page);
    await expect(frame.locator('#voidShatter.visible')).toBeVisible();
    await expect(oxygen).toHaveAttribute('data-level', 'crit');
    await expect(oxygen.locator('[data-part="value"]')).toHaveText('9.0');
    await expect(frame.locator('[data-gas="h2s"] [data-part="value"]')).toHaveText('100');
    // A new cipher brings every room back as it was.
    await enterRoom(page, 'crypt');
    await expect(frame.locator('.scene-crypt.darkened')).toHaveCount(0);
    await enterRoom(page, 'lab');
    await expect(frame.locator('.lab-character[data-slump="0"]')).toBeVisible();
  });

  test('the Tesla coil throws its streamers while the lab is open', async ({ page }) => {
    const frame = await openGame(page);
    await enterRoom(page, 'lab');
    await expect
      .poll(() => inGame<number>(page, "document.querySelectorAll('#labArcs path').length"))
      .toBeGreaterThan(2);
    await expect(frame.locator('#labArcs')).toBeVisible();
  });

  test('the Hall’s reduced motion keeps the rooms still', async ({ page }) => {
    const frame = await openGame(page, { motion: 'reduce' });
    await expect(frame.locator('html')).toHaveClass(/reduced-motion/);
    await enterRoom(page, 'lab');
    await page.waitForTimeout(400);
    expect(await inGame<number>(page, "document.querySelectorAll('#labArcs path').length")).toBe(0);
    await enterRoom(page, 'crypt');
    await expect(frame.locator('.crypt-bats')).toBeHidden();
  });

  test('the Hall’s pause holds every animation, and resume lets them go', async ({ page }) => {
    const frame = await openGame(page);
    await setTabHidden(page, true);
    await expect(frame.locator('html')).toHaveClass(/is-paused/);
    await setTabHidden(page, false);
    await expect(frame.locator('html')).not.toHaveClass(/is-paused/);
    await expect(gameFrame(page).locator('.scene-pirate.active')).toBeVisible();
  });
});

describeWaysOut({ id: 'hangman-classic', ready: READY });
