import { expect, type FrameLocator, type Page, test } from '@playwright/test';

/**
 * End-to-end helpers for hosted games running inside the Hall. Each adopted game's own
 * Playwright suite (`games/<id>/e2e/`) uses them, so the way a test signs in, launches a game
 * and checks the ways out is the same for every hosted game.
 */

export type HallStyle = 'console' | 'holo' | 'machine-room';

export interface HallSeed {
  style?: HallStyle;
  appearance?: 'light' | 'dark';
  motion?: 'full' | 'reduce' | 'system';
  /** The Hall's master volume, 0–1 (the Hall starts at 0.35). */
  volume?: number;
  muted?: boolean;
}

/** The Hall's dev server port for these suites: `HALL_PORT`, else the standard 5173. */
export function hallPort(): number {
  return Number(process.env.HALL_PORT ?? 5173);
}

/**
 * Playwright settings shared by every hosted game's suite: a Hall dev server on `hallPort()`,
 * started if none is running there, and a 1280×720 Chromium window.
 */
export function hostedSuiteConfig() {
  const port = hallPort();
  return {
    baseURL: `http://localhost:${port}/`,
    webServer: {
      command: `pnpm --filter @usr-games/hall exec vite --port ${port} --strictPort`,
      url: `http://localhost:${port}/`,
      reuseExistingServer: true,
      timeout: 90_000,
    },
  };
}

/**
 * Signs in a guest who already picked a style (the save is written before the Hall's own
 * scripts run), opens the Hall, then launches the game from it so the browser's Back button
 * has somewhere to go. Returns the game's frame.
 */
export async function runInHall(
  page: Page,
  id: string,
  seed: HallSeed = {},
): Promise<FrameLocator> {
  const settings = {
    style: seed.style ?? 'console',
    appearance: seed.appearance ?? 'dark',
    motion: seed.motion ?? 'full',
    ...(seed.volume === undefined ? {} : { volume: seed.volume }),
    ...(seed.muted === undefined ? {} : { muted: seed.muted }),
  };
  await page.addInitScript((seeded) => {
    // Hosted games share the origin; their frames must not touch the Hall's save.
    if (window.top !== window) return;
    window.localStorage.clear();
    const save = (key: string, version: number, data: unknown) =>
      window.localStorage.setItem(
        `usr-games:hall:${key}`,
        JSON.stringify({ v: version, savedAt: '', data }),
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
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-style', settings.style);
  await page.goto(`/#/run/${id}`);
  await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  return gameFrame(page);
}

export function gameFrame(page: Page): FrameLocator {
  return page.frameLocator('[data-testid="pl-frame"]');
}

/**
 * Runs `script` inside the game's own page. Adopted games expose test hooks of their own
 * (`window.__rr` in robots, `window.__seleneApp` in pom), reached this way.
 */
export async function inGame<T>(page: Page, script: string): Promise<T> {
  const frame = page.frame({ url: /\/play\// });
  if (!frame) throw new Error('The game frame is not loaded.');
  return (await frame.evaluate(script)) as T;
}

/** Waits until `readyExpression`, evaluated inside the game's page, is truthy. */
export async function waitForGame(page: Page, readyExpression: string, timeout = 60_000) {
  await expect
    .poll(
      async () =>
        page
          .frame({ url: /\/play\// })
          ?.evaluate(readyExpression)
          .catch(() => false),
      { timeout },
    )
    .toBeTruthy();
}

/**
 * The strip stays in view above the game (since prompt C1 it no longer tucks itself away); kept
 * so suites written before then still read naturally.
 */
export async function revealStrip(page: Page) {
  await expect(page.getByTestId('pl-strip')).toBeInViewport();
}

/**
 * The strip's layout promise: the game's frame starts where the strip ends and fills the rest
 * of the window, so the strip never covers any of the game.
 */
export async function expectStripAboveFrame(page: Page) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const strip = await page.getByTestId('pl-strip').boundingBox();
  const frame = await page.getByTestId('pl-frame').boundingBox();
  expect(strip && frame, 'strip and frame are on screen').toBeTruthy();
  expect(strip!.y).toBe(0);
  expect(Math.abs(frame!.y - (strip!.y + strip!.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(frame!.y + frame!.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(frame!.width).toBe(viewport.width);
}

/**
 * Stands in for the browser hiding the tab (headless pages never are): the Hall's page and the
 * game's both report hidden and hear `visibilitychange`, as they would for real.
 */
export async function setTabHidden(page: Page, hidden: boolean) {
  const script = `(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => ${hidden} });
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => '${hidden ? 'hidden' : 'visible'}',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  })()`;
  for (const frame of page.frames()) await frame.evaluate(script).catch(() => undefined);
}

/**
 * Keeps a log, inside the game's page, of every bridge message the Hall sends it, so a test can
 * check what reached the game (`bridgeLog`). Call before `runInHall`.
 */
export async function recordBridgeMessages(page: Page) {
  await page.addInitScript(`
    if (window.top !== window) {
      window.__bridgeLog = [];
      window.addEventListener('message', (event) => {
        const data = event.data;
        if (data && data.protocol === 'usr-games-bridge') window.__bridgeLog.push(data);
      });
    }
  `);
}

export interface LoggedHallMessage {
  type: string;
  payload: Record<string, unknown>;
}

/** The bridge messages the game's page has received so far (see `recordBridgeMessages`). */
export async function bridgeLog(page: Page): Promise<LoggedHallMessage[]> {
  return (await inGame<LoggedHallMessage[] | undefined>(page, 'window.__bridgeLog')) ?? [];
}

/** Home (`/` or `#/`) or the game's page, and no longer the player. */
export async function expectBackInHall(page: Page) {
  await expect(page).toHaveURL(/\/(#\/(man\/[a-z-]+)?)?$/);
  await expect(page.locator('html')).not.toHaveAttribute('data-style', 'player');
}

/** Resolves when the game's frame has loaded its page again (Game menu reloads it). */
export function frameReloaded(page: Page, id: string) {
  return page.waitForEvent('framenavigated', (frame) => frame.url().includes(`/play/${id}/`));
}

export function toasts(page: Page) {
  return page.getByTestId('pl-toasts');
}

export interface SavedGameStats {
  sessions: number;
  completed: number;
  wins: number;
  losses: number;
  bestScore: number | null;
  counters: Record<string, number>;
}

/** What the Hall's progression save holds for one game, or null before its first result. */
export async function savedGameStats(page: Page, id: string): Promise<SavedGameStats | null> {
  return page.evaluate((gameId) => {
    const raw = window.localStorage.getItem('usr-games:hall:progression');
    if (!raw) return null;
    const save = JSON.parse(raw) as { data?: { games?: Record<string, SavedGameStats> } };
    return save.data?.games?.[gameId] ?? null;
  }, id);
}

/**
 * Collects every request the page and its frames make to another origin. Hard rule 4: a game
 * in the collection makes no network requests beyond its own files.
 */
export function watchForeignRequests(page: Page): () => string[] {
  const hallOrigin = `http://localhost:${hallPort()}`;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== hallOrigin) foreign.push(request.url());
  });
  return () => [...foreign];
}

export interface HostedGameUnderTest {
  id: string;
  /** Evaluated inside the game's page: truthy once the game is ready for input. */
  ready: string;
  /** The game reports its own title screen, where Escape leads back to the Hall. */
  titleScreen?: boolean;
}

/**
 * The ways out every hosted game must offer (the navigation standard): the strip's Back to the
 * Hall, its Game menu (asking first when a round is under way), the browser's Back button and,
 * for games with a title screen, Escape there.
 */
export function describeWaysOut(game: HostedGameUnderTest) {
  test.describe('the ways out', () => {
    test('Back to the Hall on the strip', async ({ page }) => {
      await runInHall(page, game.id);
      await waitForGame(page, game.ready);
      await revealStrip(page);
      await page.locator('.pl-strip__hall').click();
      await expectBackInHall(page);
    });

    test('Game menu starts the game afresh', async ({ page }) => {
      await runInHall(page, game.id);
      await waitForGame(page, game.ready);
      await revealStrip(page);
      // On the game's own title screen the Hall reloads at once; mid-round it asks first.
      const reloaded = frameReloaded(page, game.id);
      await page.getByTestId('pl-strip-menu').click();
      const leave = page.getByRole('button', { name: 'Leave' });
      if (await leave.isVisible({ timeout: 1500 }).catch(() => false)) await leave.click();
      await reloaded;
      await waitForGame(page, game.ready);
      await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
    });

    test('the browser’s Back button', async ({ page }) => {
      await runInHall(page, game.id);
      await waitForGame(page, game.ready);
      await page.goBack();
      await expectBackInHall(page);
    });

    if (game.titleScreen) {
      test('Escape on the game’s title screen', async ({ page }) => {
        await runInHall(page, game.id);
        await waitForGame(page, game.ready);
        await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
        await page.keyboard.press('Escape');
        await expectBackInHall(page);
      });
    }
  });
}
