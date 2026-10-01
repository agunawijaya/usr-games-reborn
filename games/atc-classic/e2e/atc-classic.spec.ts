import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectBackInHall,
  gameFrame,
  inGame,
  runInHall,
  savedGameStats,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import {
  beginShift,
  followTheHints,
  forceTick,
  forceTicksUntilLost,
  READY,
  seedTheShift,
} from './shift';

/**
 * Control Room 1986, the adopted atc port, inside the Hall: the title screen is the game menu, a
 * shift that ends reports to the Hall, the radio never reaches for a network voice, and it leaves
 * by every door.
 */

const game = { id: 'atc-classic', ready: READY, titleScreen: true };
/** A seed whose first Easy plane the cheat panel's suggestions bring home. */
const SEED = 1986;

test('opens on its title screen in the Hall’s frame and makes no outside requests', async ({
  page,
}) => {
  const foreign = watchForeignRequests(page);
  await runInHall(page, game.id);
  await expect(page.getByTestId('pl-strip')).toContainText('Control Room 1986');
  await waitForGame(page, game.ready);
  await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
  await beginShift(page);
  await forceTick(page);
  expect(foreign()).toEqual([]);
});

test('a shift with nobody at the controls ends in a loss and reports it', async ({ page }) => {
  await seedTheShift(page, SEED);
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await beginShift(page);
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  await forceTicksUntilLost(page);
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 1, wins: 0, losses: 1, bestScore: 0 });
});

test('a shift that brings a plane home counts as a win, with its package and planes safe', async ({
  page,
}) => {
  await seedTheShift(page, SEED);
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await beginShift(page);
  expect(await followTheHints(page, 1)).toBeGreaterThanOrEqual(1);
  await expect(toasts(page)).toContainText(/Achievement unlocked: (Wheels down|Handed off)/);
  await forceTicksUntilLost(page);
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, wins: 1, losses: 0 });
  const saved = await savedGameStats(page, game.id);
  expect(saved?.bestScore).toBeGreaterThanOrEqual(1);
  expect(saved?.counters.planesSafe).toBe(saved?.bestScore);
});

test('offers the Hall one still of the radar a few seconds into the shift', async ({ page }) => {
  await page.addInitScript(() => {
    if (window.top !== window) return;
    const posters: { width: number; height: number }[] = [];
    Object.assign(window, { __posters: posters });
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'poster') posters.push(event.data.payload);
    });
  });
  await seedTheShift(page, SEED);
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await beginShift(page);
  await expect.poll(() => page.evaluate('window.__posters.length'), { timeout: 30_000 }).toBe(1);
  const [poster] = await page.evaluate<{ width: number; height: number }[]>('window.__posters');
  expect(poster!.width).toBeGreaterThan(poster!.height);
  await page.waitForTimeout(1500);
  expect(await page.evaluate('window.__posters.length')).toBe(1);
});

test('switching sector in the middle of a shift reports the old one as quit', async ({ page }) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await beginShift(page);
  await forceTick(page);
  await gameFrame(page).locator('.pf-btn[data-pf="default"]').click();
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 0 });
});

test.describe('Escape and the tutorial', () => {
  test('on the title, ? opens nothing and Escape leads back to the Hall', async ({ page }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.keyboard.press('?');
    await expect(gameFrame(page).locator('#help-overlay')).not.toHaveClass(/shown/);
    await page.keyboard.press('Escape');
    await expectBackInHall(page);
  });

  test('during a shift, Escape closes the tutorial and the game stays', async ({ page }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    // beginShift closes the tutorial the first shift opens with Escape.
    await beginShift(page);
    await page.keyboard.press('?');
    await expect(gameFrame(page).locator('#help-overlay')).toHaveClass(/shown/);
    await page.keyboard.press('Escape');
    await expect(gameFrame(page).locator('#help-overlay')).not.toHaveClass(/shown/);
    await page.waitForTimeout(300);
    await expect(page.locator('html')).toHaveAttribute('data-style', 'player');
    await expect(page).toHaveURL(/#\/run\/atc-classic$/);
  });
});

test.describe('the radio voice', () => {
  /**
   * Replaces the frame's speech synthesis with a recorder offering the given voices, and turns
   * the game's voice switch on before it loads.
   */
  async function offerVoices(
    page: Page,
    voices: { name: string; lang: string; localService: boolean }[],
  ) {
    await page.addInitScript((offered) => {
      if (window.top === window) return;
      window.localStorage.setItem('atc-fancyweb-voice', '1');
      const spoken: { text: string; voice: string | null }[] = [];
      Object.assign(window, { __spoken: spoken });
      class RecordedUtterance extends EventTarget {
        text: string;
        voice: { name: string } | null = null;
        rate = 1;
        pitch = 1;
        volume = 1;
        constructor(text: string) {
          super();
          this.text = text;
        }
      }
      Object.assign(window, { SpeechSynthesisUtterance: RecordedUtterance });
      window.speechSynthesis.getVoices = () => offered as unknown as SpeechSynthesisVoice[];
      window.speechSynthesis.speak = (utterance) => {
        const recorded = utterance as unknown as RecordedUtterance;
        spoken.push({ text: recorded.text, voice: recorded.voice?.name ?? null });
      };
    }, voices);
  }

  test('speaks only with a voice that runs on the device', async ({ page }) => {
    await offerVoices(page, [
      { name: 'Online voice', lang: 'en-US', localService: false },
      { name: 'On-device voice', lang: 'en-GB', localService: true },
    ]);
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await beginShift(page);
    await expect
      .poll(() => inGame<{ voice: string | null }[]>(page, 'window.__spoken'))
      .not.toHaveLength(0);
    const spoken = await inGame<{ voice: string | null }[]>(page, 'window.__spoken');
    expect(new Set(spoken.map((line) => line.voice))).toEqual(new Set(['On-device voice']));
  });

  test('stays silent without one, and the subtitles carry on', async ({ page }) => {
    await offerVoices(page, [{ name: 'Online voice', lang: 'en-US', localService: false }]);
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await beginShift(page);
    await expect(gameFrame(page).locator('#subtitle-bar')).toHaveClass(/shown/);
    await expect(gameFrame(page).locator('#subtitle-text')).not.toBeEmpty();
    expect(await inGame<unknown[]>(page, 'window.__spoken')).toEqual([]);
  });
});

describeWaysOut(game);
