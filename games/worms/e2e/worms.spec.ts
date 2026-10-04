import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  inGame,
  runInHall,
  savedGameStats,
  setTabHidden,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Abyssal Worms, the adopted worms, inside the Hall: a key press is a visit (a screensaver left
 * running earns nothing), its packages install, it follows the Hall's sound and reduced motion,
 * holds still while the Hall pauses, and it leaves by every door.
 */

const game = { id: 'worms', ready: 'window.__abyss?.ready === true' };

interface AmbienceState {
  muted: boolean;
  context: string;
  volume: number;
  gain: number;
}

/** The ambience as the game itself holds it: its switch, audio context and master gain. */
function ambience(page: Page) {
  return inGame<AmbienceState>(
    page,
    `(() => {
      const { S, audio } = window.__abyss;
      return {
        muted: S.muted,
        context: audio.ctx ? audio.ctx.state : 'none',
        volume: audio.volume,
        gain: audio.master ? audio.master.gain.value : 0,
      };
    })()`,
  );
}

const fullMotion = (page: Page) => inGame<boolean>(page, 'window.__abyss.S.motion');
const engineSteps = (page: Page) => inGame<number>(page, 'window.__abyss.world.steps');

test('opens in the Hall’s frame and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Abyssal Worms');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#abyss')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a key press counts as today’s visit and the terminal view installs a package', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('c');
  await expect(toasts(page)).toContainText('Achievement unlocked: Back to the terminal');
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`the strip sits above the abyss and its controls at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expectStripAboveFrame(page);
    await expect(frame.locator('.brand h1')).toBeInViewport();
    await expect(frame.locator('#btn-settings')).toBeInViewport();
    // with the settings open, as mid-visit
    await frame.locator('#btn-settings').click();
    await expect(frame.locator('#panel')).toBeInViewport();
    await expectStripAboveFrame(page);
  });
}

test.describe('sound follows the Hall', () => {
  test('a muted Hall starts the abyss silent; the strip’s toggle turns it on and off', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    expect(await ambience(page)).toMatchObject({ muted: true, context: 'none' });
    await expect(frame.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'false');

    const hallMute = page.getByTestId('pl-strip-mute');
    await hallMute.click();
    await expect(hallMute).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() => ambience(page))
      .toMatchObject({ muted: false, context: 'running', volume: 0.8 });
    await expect(frame.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await ambience(page)).gain).toBeGreaterThan(0.3);

    await hallMute.click();
    await expect.poll(() => ambience(page)).toMatchObject({ muted: true, volume: 0 });
    await expect(frame.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await ambience(page)).gain).toBeLessThan(0.01);
  });

  test('an unmuted Hall starts the ambience at its own volume', async ({ page }) => {
    // Half the Hall's default volume: half the ambience's designed level.
    const frame = await runInHall(page, game.id, { volume: 0.175 });
    await waitForGame(page, game.ready);
    await expect
      .poll(() => ambience(page))
      .toMatchObject({ muted: false, context: 'running', volume: expect.closeTo(0.4, 5) });
    await expect(frame.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => (await ambience(page)).gain, { timeout: 15_000 })
      .toBeGreaterThan(0.3);
    expect((await ambience(page)).gain).toBeLessThanOrEqual(0.4001);
  });

  test('if the browser holds the sound back, the first key in the game starts it', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect.poll(() => ambience(page)).toMatchObject({ muted: false, context: 'running' });
    // What a browser does when nothing was clicked yet: the context waits, suspended.
    await inGame(page, 'window.__abyss.audio.ctx.suspend()');
    await page.keyboard.press('Shift');
    await expect.poll(async () => (await ambience(page)).context).toBe('running');
  });

  test('the game’s own switch works during the visit until the Hall’s sound changes', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect.poll(() => ambience(page)).toMatchObject({ muted: false });
    await page.keyboard.press('m');
    await expect.poll(() => ambience(page)).toMatchObject({ muted: true });
    await expect(frame.locator('#btn-sound')).toHaveAttribute('aria-pressed', 'false');
    // Muting and unmuting the Hall hands the sound back to the Hall.
    const hallMute = page.getByTestId('pl-strip-mute');
    await hallMute.click();
    await hallMute.click();
    await expect.poll(() => ambience(page)).toMatchObject({ muted: false, volume: 0.8 });
  });
});

test.describe('reduced motion follows the Hall', () => {
  test('the Hall’s setting reaches the abyss', async ({ page }) => {
    await runInHall(page, game.id, { motion: 'reduce' });
    await waitForGame(page, game.ready);
    await expect.poll(() => fullMotion(page)).toBe(false);
    expect(await inGame(page, `document.documentElement.hasAttribute('data-reduced-motion')`)).toBe(
      true,
    );
    // styles.css's own reduced-motion rule, repeated for the Hall: the controls stop fading
    const fade = `parseFloat(getComputedStyle(document.querySelector('.ui')).transitionDuration)`;
    expect(await inGame<number>(page, fade)).toBeLessThan(0.01);
  });

  test('following the system, it switches live both ways', async ({ page }) => {
    await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    await expect.poll(() => fullMotion(page)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => fullMotion(page)).toBe(false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => fullMotion(page)).toBe(true);
  });
});

test('a hidden tab freezes the abyss and silences it; back in view it carries on as it was', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await expect.poll(() => ambience(page)).toMatchObject({ muted: false, context: 'running' });

  await setTabHidden(page, true);
  await expect.poll(() => ambience(page)).toMatchObject({ context: 'suspended' });
  const frozenAt = await engineSteps(page);
  await page.waitForTimeout(600);
  expect(await engineSteps(page)).toBe(frozenAt);

  await setTabHidden(page, false);
  await expect.poll(() => ambience(page)).toMatchObject({ muted: false, context: 'running' });
  await expect.poll(() => engineSteps(page)).toBeGreaterThan(frozenAt);

  // The player's own pause (Space) and mute (M) outlast a hidden tab.
  await page.keyboard.press(' ');
  await page.keyboard.press('m');
  await setTabHidden(page, true);
  await setTabHidden(page, false);
  await page.waitForTimeout(300);
  expect(await inGame(page, 'window.__abyss.S.paused')).toBe(true);
  expect(await ambience(page)).toMatchObject({ muted: true });
});

test('the keyboard alone reaches the abyss, crosses to the strip and back, and leaves', async ({
  page,
}) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  // The frame has the focus on arrival: the game's own keys work at once.
  await page.keyboard.press('s');
  await expect(frame.locator('#panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(frame.locator('#panel')).toBeHidden();

  await page.keyboard.press('Tab');
  const firstControl = frame.locator('[data-view="classic"]');
  await expect(firstControl).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  const backToHall = page.locator('.pl-strip__hall');
  await expect(backToHall).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(firstControl).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(backToHall).toBeFocused();
  await page.keyboard.press('Enter');
  await expectBackInHall(page);
});

test.describe('the logbook', () => {
  /** Waits for the abyss to mark a sighting on the floor. */
  const sightingOnShow = (page: Page) =>
    expect
      .poll(
        () => inGame<string | null>(page, 'window.__abyss.logbook.watch.active?.kind ?? null'),
        {
          timeout: 60_000,
        },
      )
      .not.toBeNull();

  test('a ring on the floor is logged with L, and the first sighting is a package', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await sightingOnShow(page);
    await page.keyboard.press('l');
    await expect(frame.locator('#log-toast')).toContainText('logged');
    await expect(toasts(page)).toContainText('Achievement unlocked: First sighting');
    await page.keyboard.press('b');
    await expect(frame.locator('#logbook')).toContainText('Logged 1×');
  });

  test('J meets a worm and puts its species in the journal', async ({ page }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await page.keyboard.press('j');
    await expect(frame.locator('#log-toast')).toContainText('new in the journal');
    await page.keyboard.press('b');
    await frame.locator('[data-page="journal"]').click();
    await expect(frame.locator('#logbook')).toContainText('1 of 8 species');
  });

  test('the Daily Dive digs the day’s abyss and, finished, counts as the daily challenge', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await page.keyboard.press('b');
    await frame.locator('[data-page="dive"]').click();
    await frame.getByTestId('dive-start').click();
    const dive = await inGame<{ seed: number; seek: string[] }>(
      page,
      'window.__abyss.logbook.dive',
    );
    expect(await inGame<number>(page, 'window.__abyss.S.seed')).toBe(dive.seed);
    // The three sightings it asks for, each marked on the floor in turn and logged.
    for (const kind of dive.seek) {
      await inGame(
        page,
        `window.__abyss.logbook.watch.active = { kind: '${kind}', x: 5, y: 5, worm: 0, born: 0, until: 1e9 }`,
      );
      await page.keyboard.press('l');
    }
    await expect(frame.locator('#log-toast')).toContainText('finished');
    await expect(toasts(page)).toContainText('Achievement unlocked: Daily diver');
    await expect(frame.getByTestId('dive-share')).toBeVisible();
  });

  test('a postcard keeps the scene and opens it again', async ({ page }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await page.keyboard.press('b');
    await frame.locator('[data-page="postcards"]').click();
    await frame.getByTestId('postcard-keep').click();
    const seed = await inGame<number>(page, 'window.__abyss.S.seed');
    await page.keyboard.press('Escape');
    await frame.locator('#btn-settings').click();
    await frame.locator('#btn-seed').click();
    expect(await inGame<number>(page, 'window.__abyss.S.seed')).not.toBe(seed);
    await page.keyboard.press('b');
    await frame.locator('#logbook').getByRole('button', { name: 'Open' }).click();
    expect(await inGame<number>(page, 'window.__abyss.S.seed')).toBe(seed);
  });
});

describeWaysOut(game);
