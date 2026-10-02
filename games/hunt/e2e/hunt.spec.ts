import { expect, type FrameLocator, type Page, test } from '@playwright/test';
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
 * Hunt — Ricochet, the adopted hunt, inside the Hall: it opens on its game menu; a career match
 * ends by itself and reports a win or a loss, leaving one early asks first and reports a quit; a
 * free match without a goal counts when ended from the pause menu; Fog, Bot speed, Turn by turn
 * and the Aim controls work; the tutorial moves from lesson to lesson; its sound and motion follow
 * the Hall; a keyboard alone can play it through; and it leaves by every door.
 */

const game = { id: 'hunt', ready: 'window.__ready === true', titleScreen: true };

async function openHunt(page: Page, options?: Parameters<typeof runInHall>[2]) {
  const frame = await runInHall(page, game.id, options);
  await waitForGame(page, game.ready);
  return frame;
}

/** Sets options on the Settings page, opened from the game menu. */
async function chooseSettings(frame: FrameLocator, choices: Record<string, string>) {
  await frame.locator('#m-settings').click();
  for (const [opt, value] of Object.entries(choices)) {
    await frame.locator(`#settings [data-opt="${opt}"] [data-v="${value}"]`).click();
  }
  await frame.locator('#s-done').click();
  await expect(frame.locator('#desk-menu')).toBeVisible();
}

async function startFreeMatch(frame: FrameLocator) {
  await frame.locator('#m-free').click();
  await frame.locator('#o-start').click();
  await expect(frame.locator('#setup')).not.toHaveClass(/\bon\b/);
}

const inMatch = <T>(page: Page, body: string) =>
  inGame<T>(page, `(() => { const h = window.__hunt; ${body} })()`);

test('opens on its game menu in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  const frame = await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Hunt — Ricochet');
  await waitForGame(page, game.ready);
  await expect(frame.locator('#desk-menu')).toBeVisible();
  await expect(frame.locator('#m-continue')).toContainText('Start the career');
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  expect(foreign()).toEqual([]);
});

test('a free match without a goal counts when ended from the pause menu', async ({ page }) => {
  const frame = await openHunt(page);
  await startFreeMatch(frame);
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await frame.locator('#p-menu').click();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1 });
  await expect(frame.locator('#desk-menu')).toBeVisible();
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
});

test('a career match is won at its tags, earns stars, and opens the next', async ({ page }) => {
  const frame = await openHunt(page);
  await frame.locator('#m-continue').click();
  await expect(frame.locator('#desk-briefing')).toContainText('First Light');
  await frame.locator('#b-begin').click();
  await expect(frame.locator('#c-goal')).toBeVisible();
  await expect(frame.locator('#c-tags')).toHaveText('0 / 2');
  await inMatch(page, "h.g.scores.find((row) => row.name === 'you').gkills = 2; h.step(1);");
  await expect(frame.locator('#desk-results')).toContainText('MATCH WON');
  await expect(frame.locator('#desk-results .result-stars')).toBeVisible();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1, wins: 1, bestScore: 2 });
  await page.keyboard.press('n');
  await expect(frame.locator('#desk-briefing')).toContainText('Two to Chase');
});

test('a career match is lost at its hit-outs', async ({ page }) => {
  const frame = await openHunt(page);
  await frame.locator('#m-continue').click();
  await frame.locator('#b-begin').click();
  await inMatch(page, "h.g.scores.find((row) => row.name === 'you').deaths = 3; h.step(1);");
  await expect(frame.locator('#desk-results')).toContainText('MATCH LOST');
  await expect.poll(() => savedGameStats(page, game.id)).toMatchObject({ sessions: 1, losses: 1 });
  await expect(frame.locator('#r-next')).toHaveCount(0);
});

test('leaving a career match early asks first and counts as a quit', async ({ page }) => {
  const frame = await openHunt(page);
  await frame.locator('#m-continue').click();
  await frame.locator('#b-begin').click();
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await frame.locator('#p-menu').click();
  await expect(frame.locator('#desk-confirm')).toBeVisible();
  await frame.locator('#c-keep').click();
  await expect(frame.locator('#desk-confirm')).toHaveCount(0);
  expect(await inMatch<boolean>(page, 'return h.running;')).toBe(true);

  await page.keyboard.press('Escape');
  await frame.locator('#p-menu').click();
  await frame.locator('#c-leave').click();
  await expect(frame.locator('#desk-menu')).toBeVisible();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 0, wins: 0 });
});

test('with the fog off the whole maze is lit, and the match still counts', async ({ page }) => {
  const sight = () =>
    inMatch<{ seeAll: boolean; cheated: boolean }>(
      page,
      'return { seeAll: h.renderer.seeAll, cheated: h.g.cheated };',
    );
  const frame = await openHunt(page);
  await chooseSettings(frame, { fog: 'off' });
  await startFreeMatch(frame);
  await expect(frame.locator('#b-fog')).toBeVisible();
  expect(await sight()).toEqual({ seeAll: true, cheated: false });

  // The pause menu's Settings bring the fog back mid-match.
  await page.keyboard.press('Escape');
  await frame.locator('#p-settings').click();
  await frame.locator('#settings [data-opt="fog"] [data-v="on"]').click();
  await frame.locator('#s-done').click();
  await expect(frame.locator('#b-fog')).toBeHidden();
  expect(await sight()).toEqual({ seeAll: false, cheated: false });

  // An Override match reports no score at all; this one reports its tags, none so far.
  await frame.locator('#p-menu').click();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1, bestScore: 0 });
});

test('Slow bots reach the match, and Turn by turn waits for a key', async ({ page }) => {
  const frame = await openHunt(page);
  await chooseSettings(frame, { botSpeed: 'slow', pace: 'turns' });
  await startFreeMatch(frame);
  await expect(frame.locator('#b-turns')).toBeVisible();
  expect(await inMatch<string>(page, 'return h.g.botSpeed;')).toBe('slow');
  const step = () => inMatch<number>(page, 'return h.g.step;');
  const before = await step();
  await page.waitForTimeout(1000);
  expect(await step()).toBe(before);
  await page.keyboard.press('Period');
  await expect.poll(step).toBe(before + 1);
  await page.keyboard.press('KeyD');
  await expect.poll(step).toBe(before + 2);
  await page.waitForTimeout(600);
  expect(await step()).toBe(before + 2);
});

test('under Aim the arrows walk, Shift and Alt with an arrow fire, and the player is round', async ({
  page,
}) => {
  const frame = await openHunt(page);
  await chooseSettings(frame, { scheme: 'aim' });
  await startFreeMatch(frame);
  const state = () =>
    inMatch<{ x: number; y: number; face: string; ammo: number; round: boolean }>(
      page,
      'const me = h.me(); return { x: me.x, y: me.y, face: String.fromCharCode(me.face), ammo: me.ammo, round: h.renderer.actors.get(me.id).actor.round };',
    );
  const start = await state();
  expect(start.round).toBe(true);

  // A plain arrow walks (toward an open cell) and leaves the aim alone.
  const open = await inMatch<string>(
    page,
    `const me = h.me(); const W = 51;
     const dirs = [['ArrowRight', 1, 0], ['ArrowLeft', -1, 0], ['ArrowDown', 0, 1], ['ArrowUp', 0, -1]];
     return dirs.find(([, dx, dy]) => h.g.maze[(me.y + dy) * W + me.x + dx] === 32)[0];`,
  );
  await page.keyboard.press(open);
  await expect
    .poll(async () => {
      const now = await state();
      return now.x !== start.x || now.y !== start.y;
    })
    .toBe(true);
  expect((await state()).face).toBe(start.face);

  await page.keyboard.press('Shift+ArrowDown');
  await expect.poll(async () => (await state()).face).toBe('!');
  await expect.poll(async () => (await state()).ammo).toBe(start.ammo - 1);
  // Space fires again the way you last fired
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state()).ammo).toBe(start.ammo - 2);
  expect((await state()).face).toBe('!');
  // Alt with an arrow throws a grenade, never the browser's Back
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(async () => (await state()).face).toBe('i');
  await expect.poll(async () => (await state()).ammo).toBe(start.ammo - 2 - 9);
  await expect(frame.locator('#desk-menu')).toHaveCount(0);
});

test('the tutorial moves on once a lesson is done', async ({ page }) => {
  const frame = await openHunt(page);
  await frame.locator('#m-tutorial').click();
  await expect(frame.locator('#lesson')).toContainText('LESSON 1 OF 4');
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(150);
  }
  await expect(frame.locator('#lesson')).toContainText('LESSON 2 OF 4');
  await expect(frame.locator('#lesson')).toContainText('training target');
});

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`the strip sits above the game at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const frame = await openHunt(page);
    await expectStripAboveFrame(page);
    await startFreeMatch(frame);
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
    const frame = await openHunt(page, { muted: true });
    await expect
      .poll(() => soundState(page))
      .toMatchObject({ muted: true, label: 'SOUND: OFF', pressed: 'false' });
    // A gesture that would start the sound the Hall asked for starts none.
    await startFreeMatch(frame);
    await page.waitForTimeout(500);
    expect(await soundState(page)).toMatchObject({ muted: true, context: null });
  });

  test('it starts at the Hall’s level and the strip’s Mute silences and restores it', async ({
    page,
  }) => {
    const frame = await openHunt(page);
    await expect
      .poll(() => soundState(page))
      .toMatchObject({ muted: false, context: null, label: 'SOUND: ON', pressed: 'true' });
    // The browser starts audio only from a gesture: the first click in the frame.
    await startFreeMatch(frame);
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
    const frame = await openHunt(page, { volume: 0.175 });
    await startFreeMatch(frame);
    await expect.poll(() => gain(page)).toBeCloseTo(0.4, 2);
  });
});

test.describe('reduced motion follows the Hall', () => {
  const rendererReduced = (page: Page) =>
    inGame<boolean | undefined>(page, 'window.__hunt.renderer?.reduced');

  test('the Hall’s setting wins over the system’s', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHunt(page, { motion: 'full' });
    await expect.poll(() => rendererReduced(page)).toBe(false);
  });

  test('a Hall set to reduce reaches the renderer', async ({ page }) => {
    await openHunt(page, { motion: 'reduce' });
    await expect.poll(() => rendererReduced(page)).toBe(true);
  });

  test('following the system, it switches live both ways', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openHunt(page, { motion: 'system' });
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
    const frame = await openHunt(page);
    await expect.poll(() => focusedInHall(page)).toBe('pl-frame');

    await tabTo(page, 'm-free');
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => focusedInGame(page)).toBe('o-start');
    await page.keyboard.press('Enter');
    await expect(frame.locator('#setup')).not.toHaveClass(/\bon\b/);
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await page.waitForTimeout(1000);

    await page.keyboard.press('Escape');
    await expect(frame.locator('#pause')).toHaveClass(/\bon\b/);
    await tabTo(page, 'p-menu');
    await expectFocusRing(page);
    await page.keyboard.press('Enter');
    await expect
      .poll(() => savedGameStats(page, game.id))
      .toMatchObject({ sessions: 1, completed: 1 });
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);

    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('Shift+Tab leaves the game menu for the strip, and Tab comes back', async ({ page }) => {
    await openHunt(page);
    await expect.poll(() => focusedInHall(page)).toBe('pl-frame');
    await tabTo(page, 'm-tutorial');
    await page.keyboard.press('Shift+Tab');
    expect(await focusedInGame(page)).toBe('m-free');

    // Back past the menu's first control, out of the frame onto the strip's last one.
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
    const frame = await openHunt(page);
    await startFreeMatch(frame);
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
    const frame = await openHunt(page);
    await startFreeMatch(frame);
    await expect(frame.locator('#scores')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(frame.locator('#scores')).toBeHidden();
    await page.keyboard.press('Tab');
    await expect(frame.locator('#scores')).toBeVisible();
    expect(await focusedInHall(page)).toBe('pl-frame');
  });
});

describeWaysOut(game);
