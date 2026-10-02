import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  gameFrame,
  inGame,
  runInHall,
  savedGameStats,
  setTabHidden,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Pajamas to Paradise, the adopted battlestar, inside the Hall: its title dialog is the game
 * menu, a game that ends reports to the Hall, and it leaves by every door.
 */

const game = { id: 'battlestar', ready: 'window.__ready === true', titleScreen: true };

test('opens on its title in the Hall’s frame and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Pajamas to Paradise');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#dlg-title')).toHaveAttribute('open', '');
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(foreign()).toEqual([]);
});

test('quitting a game reports it to the Hall', async ({ page }) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.locator('#b-start').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await frame.locator('#cmd').fill('quit');
  await frame.locator('#cmd').press('Enter');
  await expect
    .poll(() => savedGameStats(page, game.id), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, completed: 0 });
});

test.describe('the Hall’s sound, motion and pause', () => {
  interface SoundState {
    muted: boolean;
    state: string;
    bed: string | null;
  }
  const soundState = (page: Page) => inGame<SoundState>(page, 'window.__bs.sound()');
  const soundButton = (page: Page) => gameFrame(page).locator('#btn-sound');
  const sceneTime = (page: Page) => inGame<number | null>(page, 'window.__bs.stage?.t ?? null');
  /** Lets the game's page draw a few frames (or hold them, while it is held still). */
  const framesPass = (page: Page) =>
    inGame(
      page,
      'new Promise((r) => { let n = 6; const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); })',
    );
  async function newGame(page: Page, seed?: number) {
    const frame = gameFrame(page);
    if (seed !== undefined) await frame.locator('#f-seed').fill(String(seed));
    await frame.locator('#b-start').click();
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  }

  test('the strip sits above the game, on its title and mid-game, at both sizes', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expectStripAboveFrame(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expectStripAboveFrame(page);
    await newGame(page);
    await expectStripAboveFrame(page);
    await expect(gameFrame(page).locator('#cmd')).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await expectStripAboveFrame(page);
    await expect(gameFrame(page).locator('#cmd')).toBeInViewport({ ratio: 1 });
    await expect(soundButton(page)).toBeInViewport({ ratio: 1 });
  });

  // Playwright's evaluate counts as a user gesture in the game's page, so the wait for the first
  // gesture cannot be watched here: the switch turns on as soon as the Hall's sound arrives.
  test('an unmuted Hall turns the game’s sound on, and the strip’s Mute toggles it', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await newGame(page);
    await expect.poll(() => soundState(page)).toMatchObject({ muted: false, state: 'running' });
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await soundState(page)).bed).not.toBeNull();

    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => soundState(page)).toMatchObject({ muted: true });
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => soundState(page)).toMatchObject({ muted: false, state: 'running' });
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');

    // The game's own switch still works during the visit.
    await soundButton(page).click();
    await expect.poll(() => soundState(page)).toMatchObject({ muted: true });
  });

  test('a muted Hall keeps the game silent', async ({ page }) => {
    await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    await newGame(page);
    expect(await soundState(page)).toMatchObject({ muted: true, state: 'none' });
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => soundState(page)).toMatchObject({ muted: false, state: 'running' });
  });

  test('the Hall’s reduced motion reaches the scene and the page', async ({ page }) => {
    await runInHall(page, game.id, { motion: 'reduce' });
    await waitForGame(page, game.ready);
    expect(await inGame(page, "document.body.classList.contains('reduce-motion')")).toBe(true);
    expect(await inGame(page, 'window.__bs.stage?.reducedMotion ?? true')).toBe(true);
  });

  test('reduced motion follows the system live when the player left it to the system', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    const reduced = () =>
      inGame<boolean>(page, "document.body.classList.contains('reduce-motion')");
    expect(await reduced()).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(reduced).toBe(true);
    expect(await inGame(page, 'window.__bs.stage?.reducedMotion ?? true')).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(reduced).toBe(false);
  });

  test('a hidden tab, or the Hall’s own question, holds the scene still and silent', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await newGame(page);
    await expect.poll(() => soundState(page)).toMatchObject({ muted: false, state: 'running' });

    await setTabHidden(page, true);
    await expect.poll(() => soundState(page)).toMatchObject({ muted: true, state: 'suspended' });
    const held = await sceneTime(page);
    await framesPass(page);
    expect(await sceneTime(page)).toBe(held);
    await setTabHidden(page, false);
    await expect.poll(() => soundState(page)).toMatchObject({ muted: false, state: 'running' });
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');
    if (held !== null) await expect.poll(() => sceneTime(page)).toBeGreaterThan(held);

    await page.getByTestId('pl-strip-menu').click();
    await expect(page.getByRole('button', { name: 'Keep playing' })).toBeVisible();
    await expect.poll(() => soundState(page)).toMatchObject({ muted: true, state: 'suspended' });
    await page.getByRole('button', { name: 'Keep playing' }).click();
    await expect.poll(() => soundState(page)).toMatchObject({ muted: false, state: 'running' });
  });

  test('a hidden tab stops the dogfight’s clock, which starts again on return', async ({
    page,
  }) => {
    test.slow();
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    // The route into the first dogfight of seed 7 (the same as scripts/dogfight-shot.mjs).
    await newGame(page, 7);
    const route = [
      'right',
      'right',
      'take amulet',
      'back',
      'ahead',
      'take laser',
      'back',
      'left',
      'take knife',
      'back',
      'left',
      'down',
      'right',
      'ahead',
      'right',
      'right',
      'launch',
      'right',
      'ahead',
      'ahead',
    ];
    for (const command of route) await inGame(page, `window.__bs.send(${JSON.stringify(command)})`);
    const flying = () => inGame<boolean>(page, "document.body.classList.contains('flight-on')");
    await expect.poll(flying, { timeout: 15_000 }).toBe(true);
    const clock = () => inGame<number>(page, 'window.__bs.game.ourclock');

    await setTabHidden(page, true);
    const held = await clock();
    await page.waitForTimeout(2500);
    expect(await clock()).toBe(held);
    await setTabHidden(page, false);
    await expect.poll(clock, { timeout: 5_000 }).toBeLessThan(held);
  });

  test('keyboard alone: out to the strip and back, into a game, and home', async ({ page }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    const focusInStrip = () =>
      page.evaluate(() => !!document.activeElement?.closest('[data-testid="pl-strip"]'));
    const focusOn = (id: string) => () =>
      inGame<boolean>(page, `document.activeElement?.id === '${id}'`);
    const focusInTitle = () =>
      inGame<boolean>(page, "!!document.activeElement?.closest('#dlg-title')");
    const pressUntil = async (key: string, reached: () => Promise<boolean>) => {
      for (let presses = 0; presses < 30 && !(await reached()); presses++)
        await page.keyboard.press(key);
      expect(await reached()).toBe(true);
    };

    await expect.poll(focusInTitle).toBe(true);
    await pressUntil('Shift+Tab', focusInStrip);
    await expect(page.locator('.pl-strip__hall')).toBeFocused();
    await pressUntil('Tab', focusInTitle);

    await pressUntil('Tab', focusOn('b-start'));
    await page.keyboard.press('Enter');
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await expect.poll(focusOn('cmd')).toBe(true);

    // In play the command line keeps Tab for completing words; "quit" ends the game, Escape closes
    // its last word, and Escape on the title that follows leads home.
    await page.keyboard.type('quit');
    await page.keyboard.press('Enter');
    await expect(gameFrame(page).locator('#dlg-end')).toHaveAttribute('open', '', {
      timeout: 10_000,
    });
    await page.keyboard.press('Escape');
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });
});

describeWaysOut(game);
