import { expect, type Page } from '@playwright/test';
import { gameFrame, inGame } from '../../../packages/bridge/testing/hall';

/**
 * Driving a shift of Control Room 1986 from its own keyboard, for the in-Hall suite and the
 * screenshots. The game has no test hooks or URL options, so everything goes through the keys a
 * player would press, and the state is read back from the page.
 */

/** Truthy inside the game's page once the game menu's desk has its tabs and the logbook. */
export const READY = "document.querySelectorAll('#title-desk .desk-tab').length === 5";

/** The desk's tabs by their number keys. */
const MODE_KEYS = { career: '1', open: '2', daily: '3' } as const;
export type ShiftMode = keyof typeof MODE_KEYS;

/**
 * Seeds `Math.random` inside the game's frame (never the Hall's). The engine takes its seed from
 * the first draw, so the shift's traffic is the same on every run.
 */
export async function seedTheShift(page: Page, seed: number) {
  await page.addInitScript((initial) => {
    if (window.top === window) return;
    let state = initial >>> 0;
    Math.random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

/**
 * Begins a shift from the game menu: picks the tab, reads the briefing (Enter takes the
 * position) and closes the tutorial the first shift of a visit opens.
 */
export async function beginShift(page: Page, mode: ShiftMode = 'open') {
  const briefing = gameFrame(page).locator('#briefing-overlay');
  const help = gameFrame(page).locator('#help-overlay');
  await page.keyboard.press(MODE_KEYS[mode]);
  await page.keyboard.press('Enter');
  await expect(briefing).toHaveClass(/shown/);
  await takePosition(page);
  await expect(help).toHaveClass(/shown/);
  await page.keyboard.press('Escape');
  await expect(help).not.toHaveClass(/shown/);
}

/** Enter on the briefing clipboard starts the clock. */
export async function takePosition(page: Page) {
  const briefing = gameFrame(page).locator('#briefing-overlay');
  await page.keyboard.press('Enter');
  await expect(briefing).not.toHaveClass(/shown/);
}

/** The cheat panel is kept out of sight; its hidden key brings it up for the suites. */
export async function showCheat(page: Page) {
  const panel = gameFrame(page).locator('#cheat-live-panel');
  if (!(await panel.evaluate((el) => el.classList.contains('shown')))) {
    await page.keyboard.press('Control+Alt+KeyC');
  }
  await expect(panel).toHaveClass(/shown/);
}

export function shiftIsOver(page: Page): Promise<boolean> {
  return inGame(page, "document.getElementById('game-over').classList.contains('shown')");
}

/** The planes brought home so far, read from the strip under the radar. */
export async function planesSafe(page: Page): Promise<number> {
  const info = await inGame<string>(page, "document.getElementById('info').textContent");
  return Number(/PLANES (\d+) SAFE/.exec(info)?.[1] ?? 0);
}

/** An empty Enter forces the next tick at once, as in the original. */
export async function forceTick(page: Page) {
  await page.keyboard.press('Enter');
}

/**
 * Types every command the cheat panel suggests, then forces a tick, until `target` planes are
 * home or the shift is over. Returns the planes safe.
 */
export async function followTheHints(page: Page, target: number, maxTicks = 200): Promise<number> {
  await showCheat(page);
  for (let tick = 0; tick < maxTicks; tick++) {
    if ((await planesSafe(page)) >= target || (await shiftIsOver(page))) break;
    const commands = await inGame<string[]>(
      page,
      "[...document.querySelectorAll('#cheat-live-list .hint-cmd')].map((cmd) => cmd.textContent)",
    );
    // A refused command stays on the command line, so Escape clears it before each new line.
    for (const command of commands) {
      await page.keyboard.press('Escape');
      await page.keyboard.type(command);
      await page.keyboard.press('Enter');
    }
    await page.keyboard.press('Escape');
    await forceTick(page);
  }
  return planesSafe(page);
}

/** Forces ticks with nobody at the controls until a plane is lost. */
export async function forceTicksUntilLost(page: Page, maxTicks = 600) {
  for (let tick = 0; tick < maxTicks && !(await shiftIsOver(page)); tick++) await forceTick(page);
  expect(await shiftIsOver(page), 'the shift ended with a plane lost').toBe(true);
}
