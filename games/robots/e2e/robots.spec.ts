import { expect, type Page, test } from '@playwright/test';
import {
  bridgeLog,
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  frameReloaded,
  gameFrame,
  inGame,
  recordBridgeMessages,
  revealStrip,
  runInHall,
  savedGameStats,
  setTabHidden,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Robots, the adopted remaster, running inside the Hall: it opens on its game menu in the
 * player's frame, turns a cleared wave and the end of a run into packages and XP, leaves by every
 * door, and never reaches beyond its own files. Boards are staged through the game's own test
 * hook (`window.__rr`); a staged board gets a new level number so the game reads it as a new wave.
 */

const READY = "typeof window.__rr === 'object'";

interface Spot {
  x: number;
  y: number;
}

async function stageBoard(page: Page, level: number, player: Spot, robots: Spot[], score = 0) {
  const state = {
    level,
    score,
    player,
    robots: robots.map((spot, index) => ({ id: index + 1, ...spot })),
    piles: [],
    waitBonus: 0,
    status: 'playing',
  };
  await inGame(page, `window.__rr.setState(${JSON.stringify(state)})`);
  // The new wave draws a jumbotron call; clearing it keeps the points down to the crashes alone.
  await expect.poll(() => inGame(page, 'window.__rr.getState().level')).toBe(level);
  await inGame(page, 'window.__rr.tracker().call = null');
}

const stayPut = (page: Page) =>
  inGame(page, `window.__rr.act({ kind: 'move', direction: 'stay' })`);

test('opens on its game menu in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, 'robots');
  await expect(page.getByTestId('pl-strip')).toContainText('Robots');
  await waitForGame(page, READY);
  await expect(frame.locator('canvas')).toBeVisible();
  await expect(frame.getByTestId('rr-menu')).toBeVisible();
  await expect(frame.getByTestId('rr-mode-showdown')).toContainText('Daily Showdown #');
  await frame.getByTestId('rr-mode-exhibition').click();
  await frame.getByTestId('rr-start').click();
  await expect(frame.locator('.rr-stats')).toContainText('WAVE');
  expect(foreign()).toEqual([]);
});

test('the Grand Tour opens one match at a time', async ({ page }) => {
  const frame = await runInHall(page, 'robots');
  await waitForGame(page, READY);
  await frame.getByTestId('rr-mode-tour').click();
  await expect(frame.getByTestId('rr-match-opening-night')).toBeEnabled();
  await expect(frame.getByTestId('rr-match-second-leg')).toBeDisabled();
  await frame.getByTestId('rr-match-opening-night').click();
  await expect(frame.getByTestId('rr-intro')).toContainText('Score 160 points');
  await page.keyboard.press('Escape');
  await expect(frame.getByTestId('rr-tour')).toBeVisible();
});

test('a cleared wave installs packages and the end of the run brings XP', async ({ page }) => {
  await runInHall(page, 'robots');
  await waitForGame(page, READY);
  await inGame(page, "window.__rr.start('exhibition')");

  // Two robots either side of the player's column meet one row above them.
  await stageBoard(page, 2, { x: 30, y: 12 }, [
    { x: 29, y: 9 },
    { x: 31, y: 9 },
  ]);
  await stayPut(page);
  await expect(toasts(page)).toContainText('Achievement unlocked: Clean sweep', {
    timeout: 15_000,
  });
  await expect(toasts(page)).toContainText('Achievement unlocked: Feet on the ground');

  // Then a robot right beside the player ends the run: one wave cleared counts as a win.
  await stageBoard(page, 3, { x: 30, y: 12 }, [{ x: 31, y: 12 }], 20);
  await stayPut(page);
  await expect
    .poll(() => savedGameStats(page, 'robots'), { timeout: 15_000 })
    .toMatchObject({ sessions: 1, wins: 1, bestScore: 20, counters: { wavesCleared: 1 } });
  await expect(gameFrame(page).getByTestId('rr-report')).toContainText('WHAT A RUN');
});

test('Game menu asks first during a match, then opens on the game menu again', async ({ page }) => {
  const frame = await runInHall(page, 'robots');
  await waitForGame(page, READY);
  await inGame(page, "window.__rr.start('exhibition')");
  await revealStrip(page);
  await page.getByTestId('pl-strip-menu').click();
  await page.getByRole('button', { name: 'Keep playing' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  await revealStrip(page);
  await page.getByTestId('pl-strip-menu').click();
  const reloaded = frameReloaded(page, 'robots');
  await page.getByRole('button', { name: 'Leave' }).click();
  await reloaded;
  await waitForGame(page, READY);
  await expect(frame.getByTestId('rr-menu')).toBeVisible();
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`the strip sits above the game at ${viewport.width}×${viewport.height}, on the menu and in play`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const frame = await runInHall(page, 'robots');
    await waitForGame(page, READY);
    await expect(frame.getByTestId('rr-menu')).toBeVisible();
    await expectStripAboveFrame(page);
    await inGame(page, "window.__rr.start('exhibition')");
    await expect(frame.locator('.rr-stats')).toBeVisible();
    await expectStripAboveFrame(page);
  });
}

test.describe('the Hall’s sound, motion and pause', () => {
  interface SoundState {
    on: boolean;
    context: AudioContextState | null;
    gain: number | null;
  }

  /** The game's own sound engine (src/audio/sfx.ts), read through its test hook. */
  const soundState = (page: Page) =>
    inGame<SoundState>(
      page,
      `(() => {
        const sfx = window.__rr.sfx;
        return { on: sfx.on, context: sfx.ctx ? sfx.ctx.state : null, gain: sfx.ctx ? sfx.master.gain.value : null };
      })()`,
    );
  const gain = (page: Page) => async () => (await soundState(page)).gain ?? 0;
  const contextState = (page: Page) => async () => (await soundState(page)).context;

  async function waitForHello(page: Page) {
    await expect
      .poll(async () => (await bridgeLog(page)).some((message) => message.type === 'hello'))
      .toBe(true);
  }

  test('a muted Hall starts the stadium silent, and the strip’s Mute switches it live', async ({
    page,
  }) => {
    await recordBridgeMessages(page);
    const frame = await runInHall(page, 'robots', { muted: true });
    await waitForGame(page, READY);
    await waitForHello(page);
    await inGame(page, "window.__rr.start('exhibition')");
    const soundSwitch = frame.getByTitle('Sound (m)');
    await expect(soundSwitch).toHaveText('♪ off');
    // Muted from the start, the game never even opens an audio context.
    expect(await soundState(page)).toEqual({ on: false, context: null, gain: null });

    const mute = page.getByTestId('pl-strip-mute');
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await mute.click();
    await expect(soundSwitch).toHaveText('♪ on');
    await expect.poll(contextState(page)).toBe('running');
    // The Hall's default volume leaves the stadium at its own designed level.
    await expect.poll(gain(page)).toBeCloseTo(0.85, 2);

    await mute.click();
    await expect(soundSwitch).toHaveText('♪ off');
    await expect.poll(gain(page)).toBeLessThan(0.005);
    expect((await soundState(page)).on).toBe(false);
  });

  test('the Hall’s volume scales the stadium, and M still switches it during the visit', async ({
    page,
  }) => {
    const frame = await runInHall(page, 'robots', { volume: 0.175 });
    await waitForGame(page, READY);
    await inGame(page, "window.__rr.start('exhibition')");
    const soundSwitch = frame.getByTitle('Sound (m)');
    await expect(soundSwitch).toHaveText('♪ on');
    // Half the Hall's default volume: half the designed level.
    await expect.poll(gain(page)).toBeCloseTo(0.425, 2);

    await page.keyboard.press('m');
    await expect(soundSwitch).toHaveText('♪ off');
    await expect.poll(gain(page)).toBeLessThan(0.005);
    await page.keyboard.press('m');
    await expect(soundSwitch).toHaveText('♪ on');
    await expect.poll(gain(page)).toBeCloseTo(0.425, 2);

    // Switched off in the game, the next change in the Hall applies the Hall's sound again.
    await page.keyboard.press('m');
    await expect(soundSwitch).toHaveText('♪ off');
    const mute = page.getByTestId('pl-strip-mute');
    await mute.click();
    await mute.click();
    await expect(soundSwitch).toHaveText('♪ on');
    await expect.poll(gain(page)).toBeCloseTo(0.425, 2);
  });

  test('the Hall’s reduced motion reaches the game’s own switch and its stylesheet', async ({
    page,
  }) => {
    const frame = await runInHall(page, 'robots', { motion: 'reduce' });
    await waitForGame(page, READY);
    await expect.poll(() => inGame(page, 'window.__rr.quality.reducedMotion')).toBe(true);
    expect(await inGame(page, "document.documentElement.hasAttribute('data-reduced-motion')")).toBe(
      true,
    );
    await expect(frame.getByTestId('rr-mode-tour')).toHaveCSS('transition-property', 'none');
  });

  test('with the system’s motion setting, a change there reaches the game live', async ({
    page,
  }) => {
    await recordBridgeMessages(page);
    const frame = await runInHall(page, 'robots', { motion: 'system' });
    await waitForGame(page, READY);
    await waitForHello(page);
    const reduced = () => inGame<boolean>(page, 'window.__rr.quality.reducedMotion');
    const tour = frame.getByTestId('rr-mode-tour');
    expect(await reduced()).toBe(false);
    await expect(tour).not.toHaveCSS('transition-property', 'none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(reduced).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(reduced).toBe(false);
    expect(await inGame(page, "document.documentElement.hasAttribute('data-reduced-motion')")).toBe(
      false,
    );
    await expect(tour).not.toHaveCSS('transition-property', 'none');
  });

  test('a hidden tab stops the Blitz clock and silences the stadium; back in view both return', async ({
    page,
  }) => {
    await runInHall(page, 'robots');
    await waitForGame(page, READY);
    await inGame(page, "window.__rr.start('blitz', 1)");
    // One robot far down the row: the one-second clock walks it towards the player.
    await stageBoard(page, 2, { x: 30, y: 12 }, [{ x: 5, y: 12 }]);
    const robotX = () => inGame<number>(page, 'window.__rr.getState().robots[0].x');
    await expect.poll(contextState(page)).toBe('running');
    await expect.poll(robotX, { timeout: 10_000 }).toBeGreaterThan(5);

    await setTabHidden(page, true);
    await expect.poll(contextState(page)).toBe('suspended');
    // A step already under way may still land; after that the clock holds.
    await page.waitForTimeout(300);
    const held = await robotX();
    await page.waitForTimeout(2500);
    expect(await robotX()).toBe(held);

    await setTabHidden(page, false);
    await expect.poll(contextState(page)).toBe('running');
    await expect.poll(robotX, { timeout: 10_000 }).toBeGreaterThan(held);
  });
});

test('keyboard alone: start a match, step out to the strip and back, and leave for the Hall', async ({
  page,
}) => {
  const frame = await runInHall(page, 'robots');
  await waitForGame(page, READY);
  const inStrip = () =>
    page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="pl-strip"]')?.contains(document.activeElement)),
    );
  const inFrame = () =>
    page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'pl-frame');
  const hallLink = page.locator('.pl-strip__hall');

  await expect(frame.getByTestId('rr-mode-exhibition')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(frame.getByTestId('rr-start')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(frame.locator('.rr-stats')).toContainText('WAVE');
  // Staying put for a turn ('.') lets every robot take a step.
  const robots = () => inGame<string>(page, 'JSON.stringify(window.__rr.getState().robots)');
  const before = await robots();
  await page.keyboard.press('.');
  await expect.poll(robots).not.toBe(before);

  // Shift+Tab walks out of the game to the strip above it; Tab walks back in.
  for (let i = 0; i < 12 && !(await inStrip()); i++) await page.keyboard.press('Shift+Tab');
  expect(await inStrip()).toBe(true);
  for (let i = 0; i < 12 && !(await inFrame()); i++) await page.keyboard.press('Tab');
  expect(await inFrame()).toBe(true);
  expect(await inGame(page, "document.activeElement?.tagName === 'BUTTON'")).toBe(true);

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Shift+Tab');
    if (await hallLink.evaluate((link) => link === document.activeElement)) break;
  }
  await expect(hallLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expectBackInHall(page);
});

describeWaysOut({ id: 'robots', ready: READY, titleScreen: true });
