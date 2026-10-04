import AxeBuilder from '@axe-core/playwright';
import { expect, type FrameLocator, type Page, test } from '@playwright/test';
import { SLEEPING } from './catalog';

/**
 * The player that runs games (`#/run/<id>`): the hosted fixture in its bridge frame with the
 * slim strip, the native fixture with the pause menu, results and toasts, reduced motion, and
 * axe on the pause menu, the results and the strip in every style by day and by night.
 */

type Style = 'console' | 'holo' | 'machine-room';
const STYLES: readonly Style[] = ['console', 'holo', 'machine-room'];

interface Seed {
  style?: Style;
  appearance?: 'light' | 'dark';
  motion?: 'full' | 'reduce' | 'system';
}

/**
 * A signed-in guest who already picked a style, so the first-visit screens stay away. The save
 * is written before the Hall's own scripts run; then the Hall opens and the game is launched
 * from it, so the browser's Back button has somewhere to go.
 */
async function openPlayer(page: Page, id: string, seed: Seed = {}) {
  const settings = {
    style: seed.style ?? 'console',
    appearance: seed.appearance ?? 'dark',
    motion: seed.motion ?? 'full',
  };
  await page.addInitScript((seeded) => {
    // Hosted games share the origin; their frames must not touch the Hall's save.
    if (window.top !== window) return;
    window.localStorage.clear();
    const save = (key: string, v: number, data: unknown) =>
      window.localStorage.setItem(
        `usr-games:hall:${key}`,
        JSON.stringify({ v, savedAt: '', data }),
      );
    save('settings', 2, seeded);
    save('profile', 2, {
      username: null,
      guest: true,
      createdOn: null,
      hintsSeen: [],
      styleChosen: true,
    });
  }, settings);
  if (!page.url().includes('#/run/')) {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-style', settings.style);
  }
  await page.goto(`/#/run/${id}`);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  await expect(page.locator('html')).toHaveAttribute('data-player-style', settings.style);
}

async function openHosted(page: Page, seed: Seed = {}): Promise<FrameLocator> {
  await openPlayer(page, 'fixture', seed);
  const frame = page.frameLocator('[data-testid="pl-frame"]');
  // The fixture shows the Hall's palette once the bridge's hello has arrived. The dev server
  // builds the bridge on the first request, so the first hosted test waits a little longer.
  await expect(frame.getByTestId('appearance')).not.toHaveText('standalone', {
    timeout: 20_000,
  });
  return frame;
}

/** Every bridge message the game's page has received, recorded by `recordHallMessages`. */
async function hallMessages(
  page: Page,
): Promise<{ type: string; payload: Record<string, unknown> }[]> {
  const frame = page.frame({ url: /\/play\// });
  return ((await frame?.evaluate('window.__bridgeLog')) ?? []) as {
    type: string;
    payload: Record<string, unknown>;
  }[];
}

async function recordHallMessages(page: Page) {
  await page.addInitScript(`
    if (window.top !== window) {
      window.__bridgeLog = [];
      window.addEventListener('message', (event) => {
        if (event.data && event.data.protocol === 'usr-games-bridge') window.__bridgeLog.push(event.data);
      });
    }
  `);
}

/** Headless pages are never hidden; this makes the Hall and the game both believe they are. */
async function setTabHidden(page: Page, hidden: boolean) {
  const script = `(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => ${hidden} });
    document.dispatchEvent(new Event('visibilitychange'));
  })()`;
  for (const frame of page.frames()) await frame.evaluate(script).catch(() => undefined);
}

async function expectStripAboveFrame(page: Page) {
  const viewport = page.viewportSize()!;
  const strip = (await page.getByTestId('pl-strip').boundingBox())!;
  const frame = (await page.getByTestId('pl-frame').boundingBox())!;
  expect(strip.y).toBe(0);
  expect(Math.abs(frame.y - (strip.y + strip.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(frame.y + frame.height - viewport.height)).toBeLessThanOrEqual(1);
}

const menuEntries = (page: Page) =>
  page
    .getByTestId('pl-pause')
    .locator('.pl-menu__item')
    .evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset.entry));

async function expectHall(page: Page) {
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-style', 'player');
}

test.describe('hosted games', () => {
  test('run in a frame with the Hall’s look and a strip with the way out', async ({ page }) => {
    const frame = await openHosted(page, { style: 'console', appearance: 'dark' });
    await expect(frame.getByTestId('appearance')).toHaveText('dark · console');
    const strip = page.getByTestId('pl-strip');
    await expect(strip).toContainText('Bridge fixture');
    await expect(strip.getByRole('button', { name: 'Game menu' })).toBeVisible();
    // On the game's own title screen the strip stays out and says what Escape does.
    await expect(strip.locator('.pl-strip__hint')).toContainText('back to the Hall');
    await strip.getByRole('link', { name: 'Back to the Hall' }).click();
    await expectHall(page);
  });

  test('Escape on the game’s title screen goes back to the Hall', async ({ page }) => {
    const frame = await openHosted(page);
    await frame.getByTestId('start').focus();
    await page.keyboard.press('Escape');
    await expectHall(page);
  });

  test('the browser’s Back button leaves the game', async ({ page }) => {
    await openHosted(page);
    await page.goBack();
    await expect(page.locator('html')).not.toHaveAttribute('data-style', 'player');
  });

  test('Game menu asks first mid-round, then reloads the game', async ({ page }) => {
    const frame = await openHosted(page);
    await frame.getByTestId('start').click();
    await expect(frame.getByTestId('win')).toBeVisible();
    await page.getByTestId('pl-strip-menu').click();
    const dialog = page.getByRole('alertdialog', { name: 'Leave this round?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep playing' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Keep playing' }).click();
    await expect(dialog).toBeHidden();
    await expect(frame.getByTestId('win')).toBeVisible();
    await page.getByTestId('pl-strip-menu').click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
    await expect(frame.getByTestId('start')).toBeVisible();
    await expect(frame.getByTestId('appearance')).not.toHaveText('standalone');
  });

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`the strip sits above the game, never over it, at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const frame = await openHosted(page);
      await expectStripAboveFrame(page);
      // It stays put during play too: nothing slides over the game's own top bar.
      await frame.getByTestId('start').click();
      await page.mouse.move(viewport.width / 2, 2);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      await page.waitForTimeout(400);
      await expectStripAboveFrame(page);
      await expect(page.getByTestId('pl-strip')).toBeInViewport();
    });
  }

  test('Tab leaves the game for the strip, and the strip’s ways out work by keyboard', async ({
    page,
  }) => {
    const frame = await openHosted(page);
    await frame.getByTestId('start').focus();
    // Shift+Tab from the game's first control lands on the strip's last one.
    await page.keyboard.press('Shift+Tab');
    const back = page.getByRole('link', { name: 'Back to the Hall' });
    await expect(back).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('pl-strip-menu')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('pl-strip-mute')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expectHall(page);
  });

  test('the strip’s mute and the Hall’s motion reach the game over the bridge', async ({
    page,
  }) => {
    await recordHallMessages(page);
    await openHosted(page, { motion: 'system' });
    const hello = (await hallMessages(page)).find((message) => message.type === 'hello');
    expect(hello?.payload.settings).toMatchObject({
      volume: 0.35,
      muted: false,
      reducedMotion: false,
    });

    const mute = page.getByTestId('pl-strip-mute');
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(
        async () =>
          (await hallMessages(page)).filter((m) => m.type === 'settings-changed').at(-1)?.payload,
      )
      .toMatchObject({ settings: { muted: true } });

    // The player chose "match my device": the system turning on reduced motion reaches the game.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect
      .poll(
        async () =>
          (await hallMessages(page)).filter((m) => m.type === 'settings-changed').at(-1)?.payload,
      )
      .toMatchObject({ settings: { muted: true, reducedMotion: true } });
  });

  test('the game is paused while the Hall asks, and while the tab is hidden', async ({ page }) => {
    await recordHallMessages(page);
    const frame = await openHosted(page);
    await frame.getByTestId('start').click();
    const pauses = async () =>
      (await hallMessages(page))
        .map((message) => message.type)
        .filter((type) => type === 'pause' || type === 'resume');

    await page.getByTestId('pl-strip-menu').click();
    await expect.poll(pauses).toEqual(['pause']);
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep playing' }).click();
    await expect.poll(pauses).toEqual(['pause', 'resume']);

    await setTabHidden(page, true);
    await expect.poll(pauses).toEqual(['pause', 'resume', 'pause']);
    await setTabHidden(page, false);
    await expect.poll(pauses).toEqual(['pause', 'resume', 'pause', 'resume']);
  });

  test('a result and an achievement each bring an XP toast', async ({ page }) => {
    const frame = await openHosted(page);
    await frame.getByTestId('start').click();
    await frame.getByTestId('win').click();
    const toasts = page.getByTestId('pl-toasts');
    await expect(toasts).toHaveAttribute('aria-live', 'polite');
    await expect(toasts.locator('.pl-toast').first()).toContainText(/\+\d+ XP/);
    await frame.getByTestId('unlock').click();
    await expect(toasts).toContainText('Achievement unlocked: First contact');
  });
});

test.describe('native games', () => {
  test('Escape pauses, the menu keeps the standard order, and Escape resumes', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await page.getByTestId('fx-start').click();
    await page.keyboard.press('Escape');
    const pause = page.getByRole('dialog', { name: 'Paused' });
    await expect(pause).toBeVisible();
    expect(await menuEntries(page)).toEqual([
      'resume',
      'game:restart',
      'how-to-play',
      'settings',
      'game-menu',
      'hall',
    ]);
    await expect(pause.getByRole('button', { name: 'Resume' })).toBeFocused();
    // The game stops while paused: its score does not move.
    const score = await page.getByTestId('fx-score').textContent();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('fx-score')).toHaveText(score ?? '');
    // Focus stays inside the menu.
    await page.keyboard.press('Shift+Tab');
    await expect(pause.getByRole('button', { name: 'Back to the Hall' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
    await expect(page.getByTestId('pl-pause-button')).toBeVisible();
  });

  test('How to play and Settings open inside the pause menu', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await page.getByTestId('fx-start').click();
    await page.getByTestId('pl-pause-button').click();
    const pause = page.getByTestId('pl-pause');
    await pause.getByRole('button', { name: 'How to play' }).click();
    await expect(pause.getByRole('heading', { name: 'How to play' })).toBeVisible();
    await expect(pause.locator('.pl-howto li')).toHaveCount(3);
    await expect(pause.locator('.pl-controls__row')).toHaveText([
      /Win the round\s*W/,
      /Lose the round\s*L/,
    ]);
    await page.keyboard.press('Escape');
    await expect(pause.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await expect(pause.getByRole('button', { name: 'How to play' })).toBeFocused();
    await pause.getByRole('button', { name: 'Settings' }).click();
    await expect(pause.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(pause.locator('.set-panel')).toContainText('Day or night');
    await expect(pause.locator('.set-panel')).toContainText('Controls');
    await pause.getByTestId('pl-view-back').click();
    await expect(pause.getByRole('heading', { name: 'Paused' })).toBeVisible();
  });

  test('Game menu and Back to the Hall ask before leaving a round', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await page.getByTestId('fx-start').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Game menu' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Leave this round?' });
    await expect(confirm).toContainText('Your progress in it will be lost.');
    await page.keyboard.press('Escape');
    await expect(confirm).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Game menu' }).click();
    await confirm.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('fx-start')).toBeVisible();

    await page.getByTestId('fx-start').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Back to the Hall' }).click();
    await confirm.getByRole('button', { name: 'Leave' }).click();
    await expectHall(page);
  });

  test('the Pause pill shows only during play, inside its top-right safe zone', async ({
    page,
  }) => {
    await openPlayer(page, 'fixture-native');
    await expect(page.locator('.pl-corner')).toBeVisible();
    await expect(page.getByTestId('pl-pause-button')).toBeHidden();
    await page.getByTestId('fx-start').click();
    await expect(page.getByTestId('pl-pause-button')).toBeVisible();
    await expect(page.locator('.pl-corner')).toBeHidden();
    const pill = (await page.getByTestId('pl-pause-button').boundingBox())!;
    expect(pill.x).toBeGreaterThanOrEqual(page.viewportSize()!.width - 220);
    expect(pill.y + pill.height).toBeLessThanOrEqual(64);
    // Back on the game's own menu, the pill goes again.
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('fx-start')).toBeVisible();
    await expect(page.getByTestId('pl-pause-button')).toBeHidden();
  });

  test('toasts stack in the bottom-left safe zone, clear of a side panel', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await page.getByTestId('fx-start').click();
    await page.keyboard.press('KeyW');
    const toasts = page.getByTestId('pl-toasts');
    await expect(toasts).toContainText('Achievement unlocked: First win');
    const box = (await toasts.boundingBox())!;
    expect(box.x).toBeLessThanOrEqual(30);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height - 64 + 1);
    expect(box.width).toBeLessThanOrEqual(400);
  });

  test('on the title screen Escape and the corner link go straight back', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await expect(page.getByTestId('fx-start')).toBeFocused();
    await expect(page.locator('.pl-corner')).toBeVisible();
    await page.keyboard.press('Escape');
    await expectHall(page);
    await page.goBack();
    await expect(page.getByTestId('fx-start')).toBeVisible();
    await page.locator('.pl-corner').click();
    await expectHall(page);
  });

  test('results: Play again with R, Game menu, and home with H', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await page.getByTestId('fx-start').click();
    await page.keyboard.press('KeyW');
    const results = page.getByRole('dialog', { name: 'You won' });
    await expect(results).toBeVisible();
    await expect(results.getByTestId('pl-score')).toHaveText(/\d/);
    await expect(results.getByTestId('pl-xp')).toHaveText(/\+\d+ XP/);
    await expect(results.locator('.pl-ledger__row').first()).toContainText(
      'Session of Native fixture',
    );
    await expect(results.getByRole('progressbar')).toBeVisible();
    await expect(results.locator('.pl-results__actions button')).toHaveText([
      /Play again\s*R/,
      'Game menu',
      /Back to the Hall\s*H/,
    ]);
    // The first win also installed a package, announced as a toast.
    await expect(page.getByTestId('pl-toasts')).toContainText('Achievement unlocked: First win');

    await page.keyboard.press('r');
    await expect(results).toBeHidden();
    await expect(page.getByTestId('fx-round')).toHaveText('Round 2');

    await page.getByTestId('fx-lose').click();
    const over = page.getByRole('dialog', { name: 'Round over' });
    await over.getByRole('button', { name: 'Play again' }).click();
    await expect(page.getByTestId('fx-round')).toHaveText('Round 3');

    await page.getByTestId('fx-lose').click();
    await over.getByRole('button', { name: 'Game menu' }).click();
    await expect(page.getByTestId('fx-start')).toBeVisible();

    await page.getByTestId('fx-start').click();
    await page.getByTestId('fx-win').click();
    await page.keyboard.press('h');
    await expectHall(page);
  });

  test('a pause-menu item from the game runs after resuming', async ({ page }) => {
    await openPlayer(page, 'fixture-native');
    await page.getByTestId('fx-start').click();
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'Restart round' }).click();
    await expect(page.getByTestId('pl-pause')).toBeHidden();
    await expect(page.getByTestId('fx-round')).toHaveText('Round 1');
    await expect(page.getByTestId('pl-toasts')).toContainText(
      'Achievement unlocked: Second thoughts',
    );
  });

  test('an unknown game gets a still page with the ways onward', async ({ page }) => {
    const sleeping = SLEEPING[0]!.id;
    await openPlayer(page, sleeping);
    const closed = page.getByTestId('pl-closed');
    await expect(closed.getByRole('heading', { name: 'Coming soon' })).toBeVisible();
    await expect(closed.getByRole('link', { name: 'About this game' })).toHaveAttribute(
      'href',
      `#/game/${sleeping}`,
    );
    await openPlayer(page, 'no-such-game');
    await expect(closed.getByRole('heading', { level: 1 })).toHaveText(
      'There is no game by that name',
    );
    await closed.getByRole('link', { name: 'Back to the Hall' }).click();
    await expectHall(page);
  });
});

test('reduced motion: the player’s overlays and toasts appear without animation', async ({
  page,
}) => {
  await openPlayer(page, 'fixture-native', { motion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce');
  await page.getByTestId('fx-start').click();
  await page.keyboard.press('Escape');
  const sheet = page.locator('.pl-sheet--pause');
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.keyboard.press('Escape');
  await page.getByTestId('fx-win').click();
  await expect(page.locator('.pl-level__track')).toBeVisible();
  const fill = page.locator('.pl-level__fill');
  expect(await fill.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  const toast = page.locator('.pl-toast').first();
  expect(await toast.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // The hosted game's own page is the game's responsibility, not the player's.
    .exclude('[data-testid="pl-frame"]')
    .analyze();
  expect(
    results.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`),
  ).toEqual([]);
}

for (const style of STYLES) {
  for (const appearance of ['light', 'dark'] as const) {
    test(`axe: pause, results and strip in ${style} by ${appearance === 'light' ? 'day' : 'night'}`, async ({
      page,
    }) => {
      await openPlayer(page, 'fixture-native', { style, appearance, motion: 'reduce' });
      await page.getByTestId('fx-start').click();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('pl-pause')).toBeVisible();
      await expectNoViolations(page, 'pause');
      await page.keyboard.press('Escape');
      await page.getByTestId('fx-win').click();
      await expect(page.getByTestId('pl-results')).toBeVisible();
      await expectNoViolations(page, 'results');

      await openHosted(page, { style, appearance, motion: 'reduce' });
      await expect(page.getByTestId('pl-strip')).toBeInViewport();
      await expectNoViolations(page, 'strip');
    });
  }
}
