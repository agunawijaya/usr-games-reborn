import { expect, type FrameLocator, type Page, test } from '@playwright/test';
import { beginCareerDelve, READY, slayTheWumpus } from './delve';
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
 * The Rune Gates inside the Hall: the game menu as its title screen, a career delve from the
 * briefing to the chronicle, the Daily Delve's share line, leaving a delve half-way, the Hall's
 * sound, the strip and the keyboard, and every way back out. The engine is the game's own; the tests read its cave (window.game) to walk
 * safely and aim true, as a careful delver would after enough delves.
 */

async function openGame(page: Page): Promise<FrameLocator> {
  const frame = await runInHall(page, 'wump-classic');
  await waitForGame(page, READY);
  return frame;
}

test.describe('The Rune Gates in the Hall', () => {
  test('opens on its game menu, with no requests beyond the Hall', async ({ page }) => {
    const foreign = watchForeignRequests(page);
    const frame = await openGame(page);
    await expect(frame.getByRole('navigation', { name: 'Game menu' })).toBeVisible();
    await expect(frame.getByTestId('rank')).toContainText('Lamp-bearer');
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.waitForTimeout(1500);
    expect(foreign()).toEqual([]);
  });

  test('a career delve: briefing, the hunt, the chronicle and the Hall’s result', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginCareerDelve(page);
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await slayTheWumpus(page);
    await expect(frame.locator('.desk-report-title')).toHaveText('WUMPUS SLAIN!');
    await expect(frame.locator('.desk-chronicle li').first()).toContainText(
      'You passed through the rune gate',
    );
    await expect.poll(async () => (await savedGameStats(page, 'wump-classic'))?.wins ?? 0).toBe(1);
    // The gate to the second delve is open now.
    await frame.getByRole('button', { name: 'Game menu' }).click();
    await frame.getByRole('button', { name: /The Delves/ }).click();
    await expect(
      frame.getByRole('button', { name: /Delve 2: The Twelve-Pillared Hall/ }),
    ).toBeEnabled();
  });

  test('the Daily Delve gives a share line with no link', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByRole('button', { name: /Daily Delve/ }).click();
    await frame.getByRole('button', { name: /Begin the delve/ }).click();
    await slayTheWumpus(page);
    await expect(frame.getByTestId('share-line')).toHaveText(
      /^The Rune Gates #\d+ · slain in \d+ moves · 🏹\d · [◆◇]{3}$/,
    );
    await expect(frame.getByText('Your Daily Delve is in the ledger.')).toBeVisible();
  });

  test('leaving a delve half-way asks first and counts as a quit', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerDelve(page);
    const wall = await inGame<number>(
      page,
      `(() => { const g = window.game; for (let r = 1; r <= 20; r++) if (r !== g.playerLoc && !g.cave[g.playerLoc].includes(r)) return r; })()`,
    );
    await inGame(page, `window.handlePlayerMove(${wall})`);
    await frame.locator('#btn-desk-menu').click();
    await expect(frame.getByRole('heading', { name: 'Leave this delve?' })).toBeVisible();
    await frame.getByRole('button', { name: 'Keep delving' }).click();
    await expect(frame.locator('#btn-shoot-modal')).toBeVisible();
    await frame.locator('#btn-desk-menu').click();
    await frame.getByRole('button', { name: 'Leave' }).click();
    await expect(frame.getByRole('navigation', { name: 'Game menu' })).toBeVisible();
    await expect
      .poll(async () => (await savedGameStats(page, 'wump-classic'))?.sessions ?? 0)
      .toBe(1);
  });

  test('an arrow can be aimed from the keyboard alone', async ({ page }) => {
    const frame = await openGame(page);
    await beginCareerDelve(page);
    await page.keyboard.press('s');
    await expect(frame.locator('.tunnel-chip').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(frame.locator('#trajectory-display .traj-hop')).toHaveCount(2);
    await expect(frame.locator('.tunnel-chip').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(frame.locator('#modal-shoot')).not.toHaveClass(/open/);
  });

  test('Escape closes How to play without leaving for the Hall', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByRole('button', { name: /How to play/ }).click();
    await expect(frame.locator('#modal-lore')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(frame.locator('#modal-lore')).not.toHaveClass(/open/);
    await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
  });

  test('H on the chronicle goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await beginCareerDelve(page);
    await slayTheWumpus(page);
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });
});

/**
 * Keeps every gain node the game's audio context makes, inside the game's frame, and counts the
 * ones wired straight to the speakers. The first gain is the master every sound passes through.
 */
async function listenToTheCave(page: Page) {
  await page.addInitScript(() => {
    if (window.top === window) return;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        const cave = { gains: [] as GainNode[], straightOut: 0 };
        Object.assign(window, { __cave: cave });
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          const isMaster = cave.gains.length === 0;
          cave.gains.push(gain);
          const connect = gain.connect.bind(gain) as (target: AudioNode) => AudioNode;
          gain.connect = ((target: AudioNode) => {
            if (!isMaster && target === this.destination) cave.straightOut += 1;
            return connect(target);
          }) as typeof gain.connect;
          return gain;
        };
      }
    };
  });
}

/** The level every sound plays at, or null before the first sound starts the audio. */
function masterLevel(page: Page) {
  return inGame<number | null>(page, 'window.__cave ? window.__cave.gains[0].gain.value : null');
}

test.describe('the Hall’s sound', () => {
  test('a muted Hall silences every sound; the strip’s mute brings them back', async ({ page }) => {
    await listenToTheCave(page);
    const frame = await runInHall(page, 'wump-classic', { muted: true });
    await waitForGame(page, READY);
    await beginCareerDelve(page);
    // The drone is the delver's own choice, and stays on through the Hall's mute.
    const drone = frame.locator('#btn-audio');
    await drone.click();
    await expect(drone).toHaveCSS('color', 'rgb(254, 240, 138)');
    expect(await masterLevel(page)).toBe(0);
    // The bow and the victory call pass through the silent master too.
    await slayTheWumpus(page);
    expect(await masterLevel(page)).toBe(0);
    expect(await inGame<number>(page, 'window.__cave.straightOut')).toBe(0);

    const mute = page.getByTestId('pl-strip-mute');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => masterLevel(page)).toBe(1);
    await mute.click();
    await expect.poll(() => masterLevel(page)).toBe(0);
    await expect(drone).toHaveCSS('color', 'rgb(254, 240, 138)');
  });

  test('the Hall’s volume sets the level every sound plays at', async ({ page }) => {
    await listenToTheCave(page);
    const frame = await runInHall(page, 'wump-classic', { volume: 0.175 });
    await waitForGame(page, READY);
    await beginCareerDelve(page);
    await frame.locator('#btn-audio').click();
    // Half the Hall's default volume: half as loud as designed.
    await expect.poll(() => masterLevel(page)).toBeCloseTo(0.5, 5);
  });
});

test.describe('the strip and the keyboard', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`the strip sits above the game at ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const frame = await openGame(page);
      await expectStripAboveFrame(page);
      await beginCareerDelve(page);
      await expectStripAboveFrame(page);
      // The delve's top bar, with Menu, Map, Lore and Drone, is whole inside the frame.
      await expect(frame.locator('#top-hud')).toBeInViewport({ ratio: 1 });
    });
  }

  /** Presses `key` until `focused` holds, at most `limit` times. */
  async function pressUntil(page: Page, key: string, focused: () => Promise<boolean>, limit = 80) {
    for (let press = 0; press < limit && !(await focused()); press++) {
      await page.keyboard.press(key);
    }
    expect(await focused()).toBe(true);
  }

  test('Tab moves between the game and the strip; a delve starts and is left by keyboard', async ({
    page,
  }) => {
    const frame = await openGame(page);
    const back = page.getByRole('link', { name: 'Back to the Hall' });
    const backFocused = () => back.evaluate((link) => link === document.activeElement);
    await pressUntil(page, 'Shift+Tab', backFocused);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('pl-frame')).toBeFocused();
    await pressUntil(page, 'Tab', () =>
      inGame<boolean>(page, "/^Continue/.test(document.activeElement?.textContent ?? '')"),
    );
    await page.keyboard.press('Enter');
    await expect(frame.getByText('Your quests')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(frame.locator('#btn-shoot-modal')).toBeVisible();
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await pressUntil(page, 'Shift+Tab', backFocused);
    await page.keyboard.press('Enter');
    await expectBackInHall(page);
  });
});

describeWaysOut({ id: 'wump-classic', ready: READY, titleScreen: true });
