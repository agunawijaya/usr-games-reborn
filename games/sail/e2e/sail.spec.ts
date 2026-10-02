import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  frameReloaded,
  gameFrame,
  inGame,
  revealStrip,
  runInHall,
  savedGameStats,
  setTabHidden,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Broadside, the adopted sail, inside the Hall: the game menu is its title screen (its pages keep
 * Escape for going back), an action of the Sea Service reports its end with the day's
 * commendations, the Hall's Game menu brings back the game menu rather than the battle the game
 * keeps for its own reloads, and it leaves by every door.
 */

const game = {
  id: 'sail',
  ready: 'window.__ready === true && !!document.querySelector(\'#menu.open [data-deck="menu"]\')',
  titleScreen: true,
};

async function setSail(page: Page) {
  const frame = gameFrame(page);
  await frame.getByRole('button', { name: /Historical Actions/ }).click();
  await frame.locator('#menu [data-sc]').first().click();
  await frame.locator('[data-ship]').first().click();
  await frame.locator('#sail').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
}

test('opens on its game menu in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Broadside');
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await expect(gameFrame(page).getByRole('button', { name: /Back to the Hall/ })).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('the game menu’s pages keep Escape for going back to the menu', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('s');
  await expect(gameFrame(page).getByRole('heading', { name: 'The Sea Service' })).toBeVisible();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.keyboard.press('Escape');
  await expect(gameFrame(page).getByRole('button', { name: /The Sea Service/ })).toBeFocused();
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(await inGame(page, 'window.__game.menuPage')).toBe('menu');
});

test('Escape closes the help opened over the game menu, and stays in the game', async ({
  page,
}) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.getByRole('button', { name: 'How to command' }).click();
  await expect(frame.locator('#help')).toHaveClass(/\bopen\b/);
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.keyboard.press('Escape');
  await expect(frame.locator('#help')).not.toHaveClass(/\bopen\b/);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
});

test('giving up command reports the battle to the Hall', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await setSail(page);
  await inGame(page, "window.__game.runCommand('Q')");
  await expect
    .poll(() => savedGameStats(page, game.id), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, completed: 0 });
});

test('an action of the Sea Service ends on a report with its commendations', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('s');
  await gameFrame(page).getByRole('button', { name: 'Take command' }).click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  // Give up at once: the report still lists the action's commendations, none earned.
  await inGame(page, "window.__game.runCommand('Q')");
  const report = gameFrame(page).locator('#end.open');
  await expect(report).toContainText('Command relinquished', { timeout: 15_000 });
  await expect(report).toContainText('Win by turn 12');
  await expect(report.getByRole('button', { name: /Game menu/ })).toBeVisible();
  await expect(report.getByRole('button', { name: /Back to the Hall/ })).toBeVisible();
});

test('Game menu during a battle returns to the game menu', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await setSail(page);
  await revealStrip(page);
  await page.getByTestId('pl-strip-menu').click();
  const reloaded = frameReloaded(page, game.id);
  await page.getByRole('button', { name: 'Leave' }).click();
  await reloaded;
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
});

test.describe('the Hall’s sound, motion and pause', () => {
  const audio = 'window.__game.fleet.audio';
  const audioState = (page: Page) => inGame<string | null>(page, `${audio}.context?.state ?? null`);
  const seaTime = (page: Page) => inGame<number>(page, 'window.__game.world.time');
  /** Lets the game's page draw a few frames (or hold them, while it is held still). */
  const framesPass = (page: Page) =>
    inGame(
      page,
      'new Promise((r) => { let n = 6; const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); })',
    );
  /** A click on the menu's backdrop: a gesture inside the game, which starts its AudioContext. */
  const touchTheGame = (page: Page) =>
    gameFrame(page)
      .locator('#menu')
      .click({ position: { x: 4, y: 4 } });

  test('the strip sits above the game, on its menu and mid-battle, at both sizes', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expectStripAboveFrame(page);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expectStripAboveFrame(page);
    await setSail(page);
    await expectStripAboveFrame(page);
    await expect(gameFrame(page).locator('#topbar')).toBeInViewport({ ratio: 1 });
    await page.setViewportSize({ width: 1280, height: 720 });
    await expectStripAboveFrame(page);
    await expect(gameFrame(page).locator('#topbar')).toBeInViewport({ ratio: 1 });
    await expect(gameFrame(page).locator('#orders')).toBeInViewport({ ratio: 1 });
  });

  test('a muted Hall starts the game silent, though its own sound starts on', async ({ page }) => {
    await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    await touchTheGame(page);
    await expect.poll(() => audioState(page)).toBe('running');
    expect(await inGame(page, `${audio}.muted`)).toBe(true);
    await expect(gameFrame(page).locator('#btnSound')).toHaveAttribute('aria-pressed', 'false');

    // The strip's Mute toggle brings it back at the level the game was mixed for, and silences it again.
    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => inGame(page, `${audio}.muted`)).toBe(false);
    expect(await inGame<number>(page, `${audio}.level`)).toBeCloseTo(0.8);
    await expect(gameFrame(page).locator('#btnSound')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => inGame(page, `${audio}.muted`)).toBe(true);
    await expect(gameFrame(page).locator('#btnSound')).toHaveAttribute('aria-pressed', 'false');
  });

  test('the Hall’s volume scales the game, and its own switch works until the next Hall change', async ({
    page,
  }) => {
    await runInHall(page, game.id, { volume: 0.175 });
    await waitForGame(page, game.ready);
    expect(await inGame(page, `${audio}.muted`)).toBe(false);
    expect(await inGame<number>(page, `${audio}.level`)).toBeCloseTo(0.4);
    await setSail(page);
    await gameFrame(page).locator('#btnSound').click();
    expect(await inGame(page, `${audio}.muted`)).toBe(true);
    await page.getByTestId('pl-strip-mute').click();
    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => inGame(page, `${audio}.muted`)).toBe(false);
  });

  test('the Hall’s reduced motion reaches the camera and skips the opening sweep', async ({
    page,
  }) => {
    await runInHall(page, game.id, { motion: 'reduce' });
    await waitForGame(page, game.ready);
    expect(await inGame(page, 'window.__game.director.reduced')).toBe(true);
    expect(await inGame(page, "document.documentElement.hasAttribute('data-reduced-motion')")).toBe(
      true,
    );
    await setSail(page);
    expect(await inGame(page, 'window.__game.director.mode')).not.toBe('cinematic');
  });

  test('reduced motion follows the system live when the player left it to the system', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    expect(await inGame(page, 'window.__game.director.reduced')).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => inGame(page, 'window.__game.director.reduced')).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => inGame(page, 'window.__game.director.reduced')).toBe(false);
  });

  test('a hidden tab, or the Hall’s own question, holds the battle still and silent', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await setSail(page);
    await expect.poll(() => audioState(page)).toBe('running');

    await setTabHidden(page, true);
    await expect.poll(() => audioState(page)).toBe('suspended');
    const held = await seaTime(page);
    await framesPass(page);
    expect(await seaTime(page)).toBe(held);
    await setTabHidden(page, false);
    await expect.poll(() => audioState(page)).toBe('running');
    await framesPass(page);
    expect(await seaTime(page)).toBeGreaterThan(held);

    await page.getByTestId('pl-strip-menu').click();
    await expect(page.getByRole('button', { name: 'Keep playing' })).toBeVisible();
    await expect.poll(() => audioState(page)).toBe('suspended');
    const asked = await seaTime(page);
    await framesPass(page);
    expect(await seaTime(page)).toBe(asked);
    await page.getByRole('button', { name: 'Keep playing' }).click();
    await expect.poll(() => audioState(page)).toBe('running');
    await framesPass(page);
    expect(await seaTime(page)).toBeGreaterThan(asked);
  });

  test('keyboard alone: out to the strip and back, into a battle, and home', async ({ page }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    const focusInStrip = () =>
      page.evaluate(() => !!document.activeElement?.closest('[data-testid="pl-strip"]'));
    const focusInMenu = () => inGame<boolean>(page, "!!document.activeElement?.closest('#menu')");
    const pressUntil = async (key: string, reached: () => Promise<boolean>) => {
      for (let presses = 0; presses < 40 && !(await reached()); presses++)
        await page.keyboard.press(key);
      expect(await reached()).toBe(true);
    };

    await expect.poll(focusInMenu).toBe(true);
    await pressUntil('Shift+Tab', focusInStrip);
    await expect(page.locator('.pl-strip__hall')).toBeFocused();
    await pressUntil('Tab', focusInMenu);

    await page.keyboard.press('d');
    await expect(gameFrame(page).getByRole('button', { name: 'Take command' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);

    await pressUntil('Shift+Tab', focusInStrip);
    await expect(page.locator('.pl-strip__hall')).toBeFocused();
    await page.keyboard.press('Enter');
    await expectBackInHall(page);
  });
});

describeWaysOut(game);
