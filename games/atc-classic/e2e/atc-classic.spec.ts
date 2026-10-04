import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectBackInHall,
  expectStripAboveFrame,
  gameFrame,
  inGame,
  runInHall,
  savedGameStats,
  setTabHidden,
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
 * shift that ends reports to the Hall, the radio never reaches for a network voice, the room
 * follows the Hall's sound, motion and pause, and it leaves by every door.
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

test('switching sector in the middle of a shift asks first, then reports the old one as quit', async ({
  page,
}) => {
  await runInHall(page, game.id);
  await waitForGame(page, game.ready);
  await beginShift(page);
  await forceTick(page);
  const frame = gameFrame(page);
  await frame.locator('.pf-btn[data-pf="default"]').click();
  // Keeping on working changes nothing; the second time the controller switches.
  await frame.locator('[data-action="confirm-no"]').click();
  await expect(frame.locator('#menu-overlay')).not.toHaveClass(/shown/);
  await expect(frame.locator('#bezel-sector')).toContainText('Training');
  await frame.locator('.pf-btn[data-pf="default"]').click();
  await frame.locator('[data-action="confirm-yes"]').click();
  await expect(frame.locator('#briefing-overlay')).toHaveClass(/shown/);
  await expect
    .poll(() => savedGameStats(page, game.id))
    .toMatchObject({ sessions: 1, completed: 0 });
});

test.describe('Escape and the tutorial', () => {
  test('on the title, ? opens how to play, Escape closes it, and Escape again leads back to the Hall', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.keyboard.press('?');
    await expect(gameFrame(page).locator('#help-overlay')).toHaveClass(/shown/);
    await page.keyboard.press('Escape');
    await expect(gameFrame(page).locator('#help-overlay')).not.toHaveClass(/shown/);
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
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
  const ON_DEVICE_VOICE = { name: 'On-device voice', lang: 'en-GB', localService: true };

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
      const spoken: { text: string; voice: string | null; volume: number }[] = [];
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
        spoken.push({
          text: recorded.text,
          voice: recorded.voice?.name ?? null,
          volume: recorded.volume,
        });
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

  test('speaks as loud as the Hall’s volume allows', async ({ page }) => {
    await offerVoices(page, [ON_DEVICE_VOICE]);
    // Half the Hall's default volume: half the 0.9 the radio is designed at.
    await runInHall(page, game.id, { volume: 0.175 });
    await waitForGame(page, game.ready);
    await beginShift(page);
    await expect
      .poll(() => inGame<{ volume: number }[]>(page, 'window.__spoken'))
      .not.toHaveLength(0);
    const spoken = await inGame<{ volume: number }[]>(page, 'window.__spoken');
    for (const line of spoken) expect(line.volume).toBeCloseTo(0.45, 5);
  });

  test('says nothing while the Hall is muted, and the subtitles carry on', async ({ page }) => {
    await offerVoices(page, [ON_DEVICE_VOICE]);
    await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    await beginShift(page);
    await expect(gameFrame(page).locator('#subtitle-bar')).toHaveClass(/shown/);
    await expect(gameFrame(page).locator('#subtitle-text')).not.toBeEmpty();
    expect(await inGame<unknown[]>(page, 'window.__spoken')).toEqual([]);
  });
});

/**
 * Keeps every gain node the game's audio context makes, inside the game's frame. The first is the
 * room hum's master (createAmbientBed), whose level says how loud the room is.
 */
async function listenToTheRoom(page: Page) {
  await page.addInitScript(() => {
    if (window.top === window) return;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        const gains: GainNode[] = [];
        Object.assign(window, { __room: { context: this, gains } });
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          gains.push(gain);
          return gain;
        };
      }
    };
  });
}

/** The room hum's level inside the game, or null before the first shift starts the audio. */
function roomHum(page: Page) {
  return inGame<number | null>(page, 'window.__room ? window.__room.gains[0].gain.value : null');
}

test.describe('the Hall’s sound', () => {
  test('a muted Hall starts the room silent; the strip’s mute turns it on and off', async ({
    page,
  }) => {
    await listenToTheRoom(page);
    await runInHall(page, game.id, { muted: true });
    await waitForGame(page, game.ready);
    await beginShift(page);
    const soundSwitch = gameFrame(page).locator('#audio-toggle');
    await expect(soundSwitch).toHaveText('♪ sound off');
    expect(await roomHum(page)).toBe(0);

    const mute = page.getByTestId('pl-strip-mute');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await expect(soundSwitch).toHaveText('♪ sound on');
    // At the Hall's default volume the room hums at its designed 0.10.
    await expect.poll(() => roomHum(page)).toBeCloseTo(0.1, 5);

    await mute.click();
    await expect(soundSwitch).toHaveText('♪ sound off');
    await expect.poll(() => roomHum(page)).toBe(0);
  });

  test('the Hall’s volume sets how loud the room hums, and its own switch still works', async ({
    page,
  }) => {
    await listenToTheRoom(page);
    await runInHall(page, game.id, { volume: 0.7 });
    await waitForGame(page, game.ready);
    await beginShift(page);
    const soundSwitch = gameFrame(page).locator('#audio-toggle');
    await expect(soundSwitch).toHaveText('♪ sound on');
    await expect.poll(() => roomHum(page)).toBeCloseTo(0.2, 5);
    await soundSwitch.click();
    await expect(soundSwitch).toHaveText('♪ sound off');
    expect(await roomHum(page)).toBe(0);
    await soundSwitch.click();
    await expect.poll(() => roomHum(page)).toBeCloseTo(0.2, 5);
  });
});

test.describe('the Hall’s reduced motion', () => {
  test('asked for in the Hall, it stills the title and prints the report at once', async ({
    page,
  }) => {
    await runInHall(page, game.id, { motion: 'reduce' });
    await waitForGame(page, game.ready);
    const frame = gameFrame(page);
    await expect(frame.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await expect(frame.locator('#title-name')).toHaveCSS('animation-name', 'none');
    await expect(frame.locator('#title-begin')).toHaveCSS('animation-name', 'none');
    await beginShift(page);
    await forceTicksUntilLost(page);
    // Printed in one go: the ways on are offered as soon as the report is up.
    expect(
      await inGame<boolean>(page, "!document.querySelector('#game-over .report-actions').hidden"),
    ).toBe(true);
  });

  test('following the device, it switches live both ways', async ({ page }) => {
    await runInHall(page, game.id, { motion: 'system' });
    await waitForGame(page, game.ready);
    const frame = gameFrame(page);
    await expect(frame.locator('html')).toHaveAttribute('data-motion', 'full');
    await expect(frame.locator('#title-name')).toHaveCSS('animation-name', 'title-pulse');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(frame.locator('html')).toHaveAttribute('data-motion', 'reduce');
    await expect(frame.locator('#title-name')).toHaveCSS('animation-name', 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(frame.locator('html')).toHaveAttribute('data-motion', 'full');
    await expect(frame.locator('#title-name')).toHaveCSS('animation-name', 'title-pulse');
  });
});

test.describe('the Hall’s pause', () => {
  function shiftClock(page: Page) {
    return inGame<string>(page, "document.getElementById('shift-timer').textContent");
  }

  test('a hidden tab stops the clock and quiets the room; back, both run on', async ({ page }) => {
    await listenToTheRoom(page);
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await beginShift(page);
    const nextTick = gameFrame(page).locator('#next-tick');
    await expect(nextTick).toHaveText(/NEXT TICK/);
    await expect.poll(() => roomHum(page)).toBeCloseTo(0.1, 5);

    await setTabHidden(page, true);
    await expect(nextTick).toHaveText('PAUSED');
    expect(await roomHum(page)).toBe(0);
    const clock = await shiftClock(page);
    await page.waitForTimeout(2500);
    expect(await shiftClock(page)).toBe(clock);

    await setTabHidden(page, false);
    await expect(nextTick).toHaveText(/NEXT TICK/);
    await expect.poll(() => roomHum(page)).toBeCloseTo(0.1, 5);
    await expect.poll(() => shiftClock(page), { timeout: 5000 }).not.toBe(clock);
  });

  test('a pause the controller made holds when the tab comes back', async ({ page }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await beginShift(page);
    const help = gameFrame(page).locator('#help-overlay');
    const nextTick = gameFrame(page).locator('#next-tick');
    await page.keyboard.press('?');
    await expect(help).toHaveClass(/shown/);
    await expect(nextTick).toHaveText('PAUSED');
    await setTabHidden(page, true);
    await setTabHidden(page, false);
    await page.waitForTimeout(500);
    await expect(nextTick).toHaveText('PAUSED');
    await page.keyboard.press('Escape');
    await expect(help).not.toHaveClass(/shown/);
    await expect(nextTick).toHaveText(/NEXT TICK/);
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
      await runInHall(page, game.id);
      await waitForGame(page, game.ready);
      await expectStripAboveFrame(page);
      await beginShift(page);
      await expectStripAboveFrame(page);
      // The console's top bar, with the sector and the clocks, is whole inside the frame.
      await expect(gameFrame(page).locator('#bezel-top')).toBeInViewport({ ratio: 1 });
    });
  }

  /** Shift+Tab until the strip's Back to the Hall has the focus. */
  async function shiftTabToTheStrip(page: Page) {
    const back = page.getByRole('link', { name: 'Back to the Hall' });
    for (let press = 0; press < 80; press++) {
      await page.keyboard.press('Shift+Tab');
      if (await back.evaluate((link) => link === document.activeElement)) break;
    }
    await expect(back).toBeFocused();
  }

  test('Tab moves between the game and the strip; a shift starts and ends by keyboard', async ({
    page,
  }) => {
    await runInHall(page, game.id);
    await waitForGame(page, game.ready);
    await shiftTabToTheStrip(page);
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('pl-frame')).toBeFocused();
    await beginShift(page);
    await forceTick(page);
    await expect(gameFrame(page).locator('#next-tick')).toHaveText(/NEXT TICK/);
    await shiftTabToTheStrip(page);
    await page.keyboard.press('Enter');
    await expectBackInHall(page);
  });
});

describeWaysOut(game);
