import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

/**
 * Every hosted game in the catalog, inside the Hall: the strip sits above the game and never
 * over it, the Hall's sound and motion reach the game over the bridge (on arrival and live), the
 * Hall's pause reaches it while the tab is hidden, and a keyboard alone gets in and out. What each
 * game does with those messages (falling silent, stopping its clock) is checked by its own suite
 * in `games/<id>/e2e/`.
 */

interface CatalogLine {
  id: string;
  source: 'game' | 'placeholder';
}

interface Manifest {
  id: string;
  title: string;
  kind: 'native' | 'hosted';
  status: string;
}

const repo = new URL('../../../', import.meta.url);
const readJson = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, repo), 'utf8')) as T;

const HOSTED: Manifest[] = readJson<{ games: CatalogLine[] }>('apps/hall/src/catalog/catalog.json')
  .games.filter((line) => line.source === 'game')
  .map((line) => readJson<Manifest>(`games/${line.id}/manifest.json`))
  .filter((manifest) => manifest.kind === 'hosted' && manifest.status === 'shipped');

// One game at a time: several of them draw in WebGL and a busy machine runs this suite too.
test.describe.configure({ mode: 'default' });

interface Seed {
  motion?: 'full' | 'reduce' | 'system';
  muted?: boolean;
}

async function signIn(page: Page, seed: Seed = {}) {
  await page.addInitScript(
    (settings) => {
      if (window.top !== window) return;
      window.localStorage.clear();
      const put = (key: string, data: unknown) =>
        window.localStorage.setItem(
          `usr-games:hall:${key}`,
          JSON.stringify({ v: 2, savedAt: '', data }),
        );
      put('settings', { style: 'console', appearance: 'dark', ...settings });
      put('profile', {
        username: null,
        guest: true,
        createdOn: null,
        hintsSeen: [],
        styleChosen: true,
      });
    },
    { motion: seed.motion ?? 'full', muted: seed.muted ?? false },
  );
  // The game's page keeps a log of what the Hall told it.
  await page.addInitScript(() => {
    if (window.top === window) return;
    const log: unknown[] = [];
    (window as unknown as { __bridgeLog: unknown[] }).__bridgeLog = log;
    window.addEventListener('message', (event) => {
      const data = event.data as { protocol?: string } | null;
      if (data?.protocol === 'usr-games-bridge') log.push(data);
    });
  });
}

type Logged = { type: string; payload: { settings?: Record<string, unknown> } };

async function hallMessages(page: Page): Promise<Logged[]> {
  const frame = page.frame({ url: /\/play\// });
  return ((await frame?.evaluate('window.__bridgeLog').catch(() => [])) ?? []) as Logged[];
}

const lastSettings = async (page: Page) =>
  (await hallMessages(page)).filter((m) => m.type === 'settings-changed').at(-1)?.payload.settings;

async function openGame(page: Page, id: string) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
  await page.goto(`/#/run/${id}`);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  // The dev server builds the bridge (and Robots) on first request; the hello marks a live game.
  await expect
    .poll(async () => (await hallMessages(page)).some((m) => m.type === 'hello'), {
      timeout: 60_000,
    })
    .toBe(true);
}

async function expectStripAboveFrame(page: Page) {
  const viewport = page.viewportSize()!;
  const strip = (await page.getByTestId('pl-strip').boundingBox())!;
  const frame = (await page.getByTestId('pl-frame').boundingBox())!;
  expect(strip.y).toBe(0);
  expect(Math.abs(frame.y - (strip.y + strip.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(frame.y + frame.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(frame.width).toBe(viewport.width);
}

async function setTabHidden(page: Page, hidden: boolean) {
  const script = `(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => ${hidden} });
    document.dispatchEvent(new Event('visibilitychange'));
  })()`;
  for (const frame of page.frames()) await frame.evaluate(script).catch(() => undefined);
}

const pauses = async (page: Page) =>
  (await hallMessages(page))
    .map((m) => m.type)
    .filter((type) => type === 'pause' || type === 'resume');

/** Presses `key` until `done` holds, the way a keyboard player would, giving up after `limit`. */
async function pressUntil(page: Page, key: string, done: () => Promise<boolean>, limit = 40) {
  for (let presses = 0; presses < limit; presses++) {
    if (await done()) return true;
    await page.keyboard.press(key);
  }
  return done();
}

for (const game of HOSTED) {
  test.describe(game.title, () => {
    test('the strip sits above it; sound, motion and pause reach it', async ({ page }) => {
      test.setTimeout(150_000);
      await signIn(page, { motion: 'system' });
      await openGame(page, game.id);

      await expectStripAboveFrame(page);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expectStripAboveFrame(page);

      const hello = (await hallMessages(page)).find((m) => m.type === 'hello');
      expect(hello?.payload.settings).toMatchObject({
        volume: 0.35,
        muted: false,
        reducedMotion: false,
      });
      await page.getByTestId('pl-strip-mute').click();
      await expect.poll(() => lastSettings(page)).toMatchObject({ muted: true });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect
        .poll(() => lastSettings(page))
        .toMatchObject({ muted: true, reducedMotion: true });

      await setTabHidden(page, true);
      await expect.poll(() => pauses(page)).toEqual(['pause']);
      await setTabHidden(page, false);
      await expect.poll(() => pauses(page)).toEqual(['pause', 'resume']);
    });

    test('a keyboard alone gets in from its page and back out through the strip', async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await signIn(page, { motion: 'reduce', muted: true });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-style', 'console');
      await page.goto(`/#/game/${game.id}`);
      const play = page.locator('[data-focus-key="ch-detail-play"]');
      await expect(play).toBeVisible();
      const reachedPlay = await pressUntil(page, 'Tab', () =>
        play.evaluate((link) => link === document.activeElement),
      );
      expect(reachedPlay, 'Tab reaches Play on the game page').toBe(true);
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
      await expect
        .poll(async () => (await hallMessages(page)).some((m) => m.type === 'hello'), {
          timeout: 60_000,
        })
        .toBe(true);

      const back = page.getByRole('link', { name: 'Back to the Hall' });
      const reachedStrip = await pressUntil(page, 'Shift+Tab', () =>
        back.evaluate((link) => link === document.activeElement),
      );
      expect(reachedStrip, 'Shift+Tab leaves the game for the strip').toBe(true);
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).not.toHaveAttribute('data-style', 'player');
    });
  });
}
