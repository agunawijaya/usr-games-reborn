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
 * Rain on Still Water, the adopted rain, inside the Hall: a key press is a visit (a screensaver
 * left running earns nothing), its packages install, it follows the Hall's sound and reduced
 * motion, holds still while the Hall pauses, and it leaves by every door.
 */

const game = { id: 'rain', ready: 'window.__ready === true' };

interface PondSound {
  muted: boolean;
  state: string;
  gain: number;
}

/** The pond's sound as the game itself holds it: its switch, audio context and master gain. */
const pondSound = (page: Page) => inGame<PondSound>(page, 'window.__rain.audio()');
const reducedMotion = (page: Page) =>
  inGame<{ loop: boolean; renderer: boolean | null }>(page, 'window.__rain.reducedMotion()');
const delay = (page: Page) => inGame<number>(page, 'window.__rain.rain.delay');
const engineFrame = (page: Page) => inGame<number>(page, 'window.__rain.rain.frame');

test('opens in the Hall’s frame and makes no outside requests', async ({ page }) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Rain on Still Water');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#pond')).toBeVisible();
  expect(foreign()).toEqual([]);
});

test('a key press counts as today’s visit and the split view installs a package', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await page.keyboard.press('2');
  await expect(toasts(page)).toContainText('Achievement unlocked: Side by side');
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`the strip sits above the pond and its controls at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expectStripAboveFrame(page);
    await expect(frame.locator('#title h1')).toBeInViewport();
    await expect(frame.locator('#sound')).toBeInViewport();
    await expect(frame.locator('#bar')).toBeInViewport({ ratio: 1 });
    // with the help open, as mid-visit
    await frame.locator('#help-btn').click();
    await expect(frame.locator('#help')).toBeInViewport({ ratio: 1 });
    await expectStripAboveFrame(page);
  });
}

test.describe('sound follows the Hall', () => {
  test('a muted Hall starts the pond silent; the strip’s toggle turns it on and off', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    expect(await pondSound(page)).toMatchObject({ muted: true, state: 'none' });
    await expect(frame.locator('#sound')).toHaveAttribute('aria-pressed', 'false');

    const hallMute = page.getByTestId('pl-strip-mute');
    await hallMute.click();
    await expect(hallMute).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: false, state: 'running' });
    await expect(frame.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
    await expect(frame.locator('#sound')).toContainText('Sound on');
    await expect.poll(async () => (await pondSound(page)).gain).toBeCloseTo(0.9, 2);

    await hallMute.click();
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: true });
    await expect(frame.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => (await pondSound(page)).gain).toBeLessThan(0.01);
  });

  test('an unmuted Hall starts the pond’s sound at its own volume', async ({ page }) => {
    // Half the Hall's default volume: half the pond's designed level.
    const frame = await runInHall(page, game.id, { volume: 0.175 });
    await waitForGame(page, game.ready);
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: false, state: 'running' });
    await expect(frame.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await pondSound(page)).gain).toBeCloseTo(0.45, 2);
  });

  test('if the browser holds the sound back, the first key in the game starts it', async ({
    page,
  }) => {
    // Keep a hand on every audio context the game's page makes.
    await page.addInitScript(() => {
      if (window.top === window) return;
      const contexts: AudioContext[] = [];
      Object.assign(window, { __audioContexts: contexts });
      window.AudioContext = class extends window.AudioContext {
        constructor(options?: AudioContextOptions) {
          super(options);
          contexts.push(this);
        }
      };
    });
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: false, state: 'running' });
    // What a browser does when nothing was clicked yet: the context waits, suspended.
    await inGame(page, 'window.__audioContexts[0].suspend()');
    expect((await pondSound(page)).state).toBe('suspended');
    await page.keyboard.press('Shift');
    await expect.poll(async () => (await pondSound(page)).state).toBe('running');
    await expect.poll(async () => (await pondSound(page)).gain).toBeCloseTo(0.9, 2);
  });

  test('the game’s own switch works during the visit until the Hall’s sound changes', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: false });
    await page.keyboard.press('m');
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: true });
    await expect(frame.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
    // Muting and unmuting the Hall hands the sound back to the Hall.
    const hallMute = page.getByTestId('pl-strip-mute');
    await hallMute.click();
    await hallMute.click();
    await expect.poll(() => pondSound(page)).toMatchObject({ muted: false });
    await expect(frame.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('reduced motion follows the Hall', () => {
  test('the Hall’s setting reaches the pond: a drizzle, a still camera, no fades', async ({
    page,
  }) => {
    await runInHall(page, game.id, { motion: 'reduce' });
    await waitForGame(page, game.ready);
    await expect.poll(() => reducedMotion(page)).toEqual({ loop: true, renderer: true });
    expect(await delay(page)).toBe(400);
    const fade = `getComputedStyle(document.documentElement).getPropertyValue('--fade').trim()`;
    expect(await inGame(page, fade)).toBe('0.01s');
  });

  test('following the system, it switches live both ways', async ({ page }) => {
    await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    await expect.poll(() => reducedMotion(page)).toEqual({ loop: false, renderer: false });
    expect(await delay(page)).toBe(120);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => reducedMotion(page)).toEqual({ loop: true, renderer: true });
    expect(await delay(page)).toBe(400);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => reducedMotion(page)).toEqual({ loop: false, renderer: false });
    expect(await delay(page)).toBe(120);
  });

  test('an intensity the player picked stays when the setting changes', async ({ page }) => {
    const frame = await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    await frame.getByRole('button', { name: 'Downpour' }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => reducedMotion(page)).toMatchObject({ loop: true });
    expect(await delay(page)).toBe(10);
  });
});

test('a hidden tab freezes the pond and silences it; back in view it carries on as it was', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await expect.poll(() => pondSound(page)).toMatchObject({ muted: false, state: 'running' });

  await setTabHidden(page, true);
  await expect.poll(() => pondSound(page)).toMatchObject({ state: 'suspended' });
  const frozenAt = await engineFrame(page);
  await page.waitForTimeout(600);
  expect(await engineFrame(page)).toBe(frozenAt);

  await setTabHidden(page, false);
  await expect.poll(() => pondSound(page)).toMatchObject({ muted: false, state: 'running' });
  await expect.poll(() => engineFrame(page)).toBeGreaterThan(frozenAt);

  // The player's own mute (M) outlasts a hidden tab.
  await page.keyboard.press('m');
  await expect.poll(() => pondSound(page)).toMatchObject({ muted: true });
  await setTabHidden(page, true);
  await setTabHidden(page, false);
  await page.waitForTimeout(300);
  expect(await pondSound(page)).toMatchObject({ muted: true, state: 'running' });
});

test('the keyboard alone reaches the pond, crosses to the strip and back, and leaves', async ({
  page,
}) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  // The frame has the focus on arrival: the game's own keys work at once.
  await page.keyboard.press('3');
  await expect(frame.locator('body')).toHaveAttribute('data-view', 'classic');
  await page.keyboard.press('1');
  await expect(frame.locator('body')).toHaveAttribute('data-view', 'modern');

  await page.keyboard.press('Tab');
  const firstControl = frame.locator('#sound');
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

test.describe('with every control hidden (H)', () => {
  test('a quiet button brings them back, by Tab and Enter or by a click', async ({ page }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    const showControls = frame.getByRole('button', { name: 'Show controls' });
    const bar = frame.locator('#bar');
    await expect(showControls).toBeHidden();

    await page.keyboard.press('h');
    await expect(bar).toBeHidden();
    await expect(frame.locator('#sound')).toBeHidden();
    await expect(showControls).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(showControls).toBeFocused();
    expect(await showControls.evaluate((button) => getComputedStyle(button).outlineStyle)).toBe(
      'solid',
    );
    await page.keyboard.press('Enter');
    await expect(bar).toBeVisible();
    await expect(frame.locator('#sound')).toBeVisible();
    await expect(showControls).toBeHidden();

    await page.keyboard.press('h');
    await expect(bar).toBeHidden();
    await showControls.click();
    await expect(bar).toBeVisible();
    await expect(frame.locator('body')).not.toHaveClass(/hidden-ui/);
    await expect(showControls).toBeHidden();
  });

  test('the button works on its own too, outside the Hall', async ({ page }) => {
    await page.goto('/play/rain/');
    await expect.poll(() => page.evaluate(game.ready)).toBe(true);
    await page.keyboard.press('h');
    await expect(page.locator('#bar')).toBeHidden();
    await page.getByRole('button', { name: 'Show controls' }).click();
    await expect(page.locator('#bar')).toBeVisible();
  });
});

describeWaysOut(game);
