import { expect, type FrameLocator, type Page } from '@playwright/test';
import { gameFrame, inGame } from '../../../packages/bridge/testing/hall';

/** Readiness inside the game's page: the desk is up and listening to the game. */
export const READY = '!!window.__talon && !!window.TalonGame';

/**
 * From the expedition desk, a flight in a region: its briefing, then Fly. `calm` sends the
 * hunters away, and the rivals and the bird's dives unless kept, for tests of the desk's flow
 * rather than of play.
 */
export async function beginFlight(
  page: Page,
  region = 'savanna',
  calm: false | { keepBird?: boolean; keepRivals?: boolean } = false,
): Promise<FrameLocator> {
  const frame = gameFrame(page);
  await frame.getByTestId(`desk-region-${region}`).click();
  await frame.getByTestId('desk-fly').click();
  await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
  if (calm) await calmDown(page, calm);
  return frame;
}

/** Sends the hunters away, and the rivals and the bird's dives unless they are kept. */
export async function calmDown(
  page: Page,
  keep: { keepBird?: boolean; keepRivals?: boolean } = {},
) {
  await inGame(page, `window.TalonGame.clearThreats(${JSON.stringify(keep)})`);
}

/**
 * Gathers at least `count` fruit as a quick snake would: the head slips to the nearest fruit, one
 * after another. The flight's own physics still decide the pickup, so a second fruit lying close
 * by may come along too. Returns the fruit carried.
 */
export async function gather(page: Page, count: number): Promise<number> {
  const target = (await inGame<number>(page, 'window.TalonGame.score')) + count;
  for (;;) {
    const before = await inGame<number>(page, 'window.TalonGame.score');
    if (before >= target) return before;
    await inGame(
      page,
      `(() => {
        const p = window.TalonGame.peek();
        const near = p.apples.reduce((best, a) =>
          Math.hypot(a.x - p.head.x, a.y - p.head.y) < Math.hypot(best.x - p.head.x, best.y - p.head.y) ? a : best);
        window.TalonGame.placeHead(near.x, near.y);
      })()`,
    );
    await expect.poll(() => inGame<number>(page, 'window.TalonGame.score')).toBeGreaterThan(before);
  }
}

/**
 * Opens every region up to `region` before the page loads, as if each before it had been cleared
 * (the progress the desk keeps, at its version 1).
 */
export async function openUpTo(page: Page, region: string) {
  await page.addInitScript((last) => {
    const order = [
      'savanna',
      'river',
      'jungle',
      'desert',
      'neon-grid',
      'aztec',
      'origami',
      'midnight',
    ];
    const goals = [4, 5, 6, 7, 7, 8, 8, 9];
    const bestHaul = Object.fromEntries(
      order.slice(0, order.indexOf(last)).map((id, i) => [id, goals[i]]),
    );
    localStorage.setItem(
      'usr-games:snake-classic:progress',
      JSON.stringify({ v: 1, data: { bestHaul } }),
    );
  }, region);
}

/** Gathers every fruit left, quickly, until the field is bare (the rivals may take some). */
export async function clearTheField(page: Page) {
  for (let i = 0; i < 40; i++) {
    const left = await inGame<number>(page, 'window.TalonGame.peek().left');
    if (left === 0) return;
    await gather(page, 1).catch(() => undefined);
  }
}

/**
 * Takes what is left of the harvest, then leaves over `edge` (the edges open only once the
 * field is bare). Returns the fruit carried out.
 */
export async function clearAndLeave(page: Page, edge: 'north' | 'east' | 'south' | 'west') {
  await clearTheField(page);
  const carried = await inGame<number>(page, 'window.TalonGame.peek().carried');
  await escapeOver(page, edge);
  return carried;
}

/**
 * Over an edge: the head is set just past it, whichever way the snake is heading. While fruit is
 * left the edge holds it back; on a bare field the snake slithers out.
 */
export async function escapeOver(page: Page, edge: 'north' | 'east' | 'south' | 'west') {
  const at = { north: [450, -10], south: [450, 610], west: [-10, 300], east: [910, 300] }[edge];
  await inGame(page, `window.TalonGame.placeHead(${at[0]}, ${at[1]})`);
}

/**
 * Keeps the snake in the middle of the field while the bird makes up its mind, then keeps it
 * right where the bird is diving until the strike lands. (Done inside the page: a dive lasts a
 * fifth of a second, too quick to catch from outside.)
 */
export async function standUnderTheDive(page: Page) {
  await inGame(
    page,
    `window.__hold = setInterval(() => {
      const game = window.TalonGame;
      if (game.state !== 'playing') return clearInterval(window.__hold);
      const eagle = game.peek().eagle;
      if (eagle.state === 'dive' || eagle.state === 'strike') game.placeHead(eagle.targetX, eagle.targetY);
      else game.placeHead(450, 300);
    }, 16)`,
  );
}
