import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  inGame,
  runInHall,
  savedGameStats,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';

/**
 * Hunt — Ricochet, the adopted hunt, inside the Hall: the match setup is the game menu, a match
 * ended from the pause menu counts as a session, its sound and motion follow the Hall, a keyboard
 * alone can play it through, and it leaves by every door.
 */

const game = { id: 'hunt', ready: 'window.__ready === true', titleScreen: true };

test('opens on its match setup in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Hunt — Ricochet');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#setup')).toHaveClass(/\bon\b/);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(foreign()).toEqual([]);
});

test('a match ended from the pause menu counts as a session', async ({ page }) => {
  const frame = await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await frame.locator('#o-start').click();
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await frame.locator('#p-new').click();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`the strip sits above the game at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expectStripAboveFrame(page);
    await frame.locator('#o-start').click();
    await expect(frame.locator('#setup')).not.toHaveClass(/\bon\b/);
    await expectStripAboveFrame(page);
  });
}

test.describe('sound follows the Hall', () => {
  interface SoundState {
    muted: boolean;
    context: AudioContextState | null;
    gain: number | null;
    label: string;
    pressed: string | null;
  }
  const soundState = (page: Page) =>
    inGame<SoundState>(
      page,
      `(() => {
        const audio = window.__hunt.audio;
        const soundSwitch = document.getElementById('sound');
        return {
          muted: audio.muted,
          context: audio.ctx ? audio.ctx.state : null,
          gain: audio.master ? audio.master.gain.value : null,
          label: soundSwitch.textContent,
          pressed: soundSwitch.getAttribute('aria-pressed'),
        };
      })()`,
    );
  const gain = async (page: Page) => (await soundState(page)).gain ?? -1;

  test('a muted Hall starts the game silent', async ({ page }) => {
    const frame = await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    await expect
      .poll(() => soundState(page))
      .toMatchObject({ muted: true, label: 'SOUND: OFF', pressed: 'false' });
    // A gesture that would start the sound the Hall asked for starts none.
    await frame.locator('#o-start').click();
    await page.waitForTimeout(500);
    expect(await soundState(page)).toMatchObject({ muted: true, context: null });
  });

  test('it starts at the Hall’s level and the strip’s Mute silences and restores it', async ({
    page,
  }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect
      .poll(() => soundState(page))
      .toMatchObject({ muted: false, context: null, label: 'SOUND: ON', pressed: 'true' });
    // The browser starts audio only from a gesture: the first click in the frame.
    await frame.locator('#o-start').click();
    await expect.poll(async () => (await soundState(page)).context).toBe('running');
    // At the Hall's default volume the game plays at its own designed level.
    await expect.poll(() => gain(page)).toBeCloseTo(0.8, 2);

    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => gain(page)).toBeLessThan(0.005);
    expect(await soundState(page)).toMatchObject({ muted: true, label: 'SOUND: OFF' });

    await page.getByTestId('pl-strip-mute').click();
    await expect.poll(() => gain(page)).toBeCloseTo(0.8, 2);
    expect(await soundState(page)).toMatchObject({ muted: false, label: 'SOUND: ON' });
  });

  test('the Hall’s volume scales the game’s level', async ({ page }) => {
    const frame = await runInHall(page, game.id, { volume: 0.175 });
    await waitForGame(page, game.ready);
    await frame.locator('#o-start').click();
    await expect.poll(() => gain(page)).toBeCloseTo(0.4, 2);
  });
});

test.describe('reduced motion follows the Hall', () => {
  const rendererReduced = (page: Page) =>
    inGame<boolean | undefined>(page, 'window.__hunt.renderer?.reduced');

  test('the Hall’s setting wins over the system’s', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await runInHall(page, game.id, { motion: 'full' });
    await waitForGame(page, game.ready);
    await expect.poll(() => rendererReduced(page)).toBe(false);
  });

  test('a Hall set to reduce reaches the renderer', async ({ page }) => {
    await runInHall(page, game.id, { motion: 'reduce' });
    await waitForGame(page, game.ready);
    await expect.poll(() => rendererReduced(page)).toBe(true);
  });

  test('following the system, it switches live both ways', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    await expect.poll(() => rendererReduced(page)).toBe(false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => rendererReduced(page)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => rendererReduced(page)).toBe(false);
  });
});

test.describe('with the keyboard alone', () => {
  /** The id of the element focused inside the game's page. */
  const focusedInGame = (page: Page) => inGame<string>(page, 'document.activeElement?.id ?? ""');
  /** Which part of the Hall's page holds the focus: the frame, or one of the strip's controls. */
  const focusedInHall = (page: Page) =>
    page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return '';
      return active.getAttribute('data-testid') ?? active.className;
    });

  async function tabTo(page: Page, id: string, key = 'Tab') {
    for (let presses = 0; presses < 60; presses += 1) {
      if ((await focusedInGame(page)) === id) return;
      await page.keyboard.press(key);
    }
    throw new Error(`${key} never reached #${id}`);
  }

  async function expectFocusRing(page: Page) {
    const outline = await inGame<{ style: string; width: string }>(
      page,
      `(() => {
        const style = getComputedStyle(document.activeElement);
        return { style: style.outlineStyle, width: style.outlineWidth };
      })()`,
    );
    expect(outline).toEqual({ style: 'solid', width: '2px' });
  }

  test('starts a match, ends it from the pause menu and leaves for the Hall', async ({ page }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect.poll(() => focusedInHall(page)).toBe('pl-frame');

    await tabTo(page, 'o-start');
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    await expect(frame.locator('#setup')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await page.waitForTimeout(1500);

    await page.keyboard.press('Escape');
    await expect(frame.locator('#pause')).toHaveClass(/\bon\b/);
    await tabTo(page, 'p-new');
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    await expect
      .poll(() => savedGameStats(page, game.id))
      .toMatchObject({ sessions: 1, completed: 1 });
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);

    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('Shift+Tab leaves the match setup for the strip, and Tab comes back', async ({ page }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect.poll(() => focusedInHall(page)).toBe('pl-frame');
    await tabTo(page, 'o-help');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedInGame(page)).toBe('o-start');

    // Back past the setup's first control, out of the frame onto the strip's last one.
    let presses = 0;
    while ((await focusedInHall(page)) === 'pl-frame' && presses < 60) {
      await page.keyboard.press('Shift+Tab');
      presses += 1;
    }
    await expect(page.locator('.pl-strip__hall')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect.poll(() => focusedInHall(page)).toBe('pl-frame');
    expect(await focusedInGame(page)).not.toBe('');
  });

  test('Tab moves between the pause menu’s buttons', async ({ page }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await frame.locator('#o-start').click();
    await page.keyboard.press('Escape');
    await expect(frame.locator('#pause')).toHaveClass(/\bon\b/);
    await tabTo(page, 'p-resume');
    await expectFocusRing(page);
    await page.keyboard.press('Tab');
    expect(await focusedInGame(page)).toBe('p-restart');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedInGame(page)).toBe('p-resume');
    await page.keyboard.press('Enter');
    await expect(frame.locator('#pause')).not.toHaveClass(/\bon\b/);
  });

  test('in a running match Tab still shows and hides the scoreboard', async ({ page }) => {
    const frame = await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await frame.locator('#o-start').click();
    await expect(frame.locator('#scores')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(frame.locator('#scores')).toBeHidden();
    await page.keyboard.press('Tab');
    await expect(frame.locator('#scores')).toBeVisible();
    expect(await focusedInHall(page)).toBe('pl-frame');
  });
});

describeWaysOut(game);
