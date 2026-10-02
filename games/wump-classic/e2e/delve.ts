import { expect, type Page } from '@playwright/test';
import { gameFrame, inGame } from '../../../packages/bridge/testing/hall';

/**
 * Shared moves for the suites: the game reads its cave from window.game, so a test can walk
 * through calm chambers and aim true, as a delver who knows the cave would.
 */

/** Truthy inside the game once its menu is up. */
export const READY = 'Boolean(window.RuneGatesDesk && document.body.dataset.desk === "menu")';

/** From the menu, the next career delve begun from its briefing. */
export async function beginCareerDelve(page: Page) {
  await gameFrame(page)
    .getByRole('button', { name: /Continue/ })
    .click();
  await expect(gameFrame(page).getByText('Your quests')).toBeVisible();
  await page.keyboard.press('Enter');
}

/** Calm chambers from here to `goal(room)`, as rooms to walk through. */
async function calmRouteTo(page: Page, goal: string): Promise<number[]> {
  return inGame<number[]>(
    page,
    `(() => {
      const g = window.game;
      const goal = ${goal};
      const calm = (r) => !g.pits.has(r) && !g.bats.has(r) && r !== g.wumpusLoc;
      const prev = new Map([[g.playerLoc, 0]]);
      const queue = [g.playerLoc];
      let end = null;
      while (queue.length) {
        const r = queue.shift();
        if (goal(r)) { end = r; break; }
        for (const n of g.cave[r]) if (!prev.has(n) && calm(n)) { prev.set(n, r); queue.push(n); }
      }
      const walk = [];
      if (end !== null) for (let at = end; at !== g.playerLoc; at = prev.get(at)) walk.unshift(at);
      return walk;
    })()`,
  );
}

async function walk(page: Page, rooms: number[]) {
  for (const room of rooms) await inGame(page, `window.handlePlayerMove(${room})`);
}

/** Walks next to a pit, where the wind curls out of one gate. */
export async function walkToADraft(page: Page) {
  await walk(
    page,
    await calmRouteTo(page, '(r) => window.game.cave[r].some((n) => window.game.pits.has(n))'),
  );
}

/** The tunnels from the delver's chamber to the wumpus's, shortest first. */
const ARROW_PATH = `(() => {
  const g = window.game;
  const prev = new Map([[g.playerLoc, 0]]);
  const queue = [g.playerLoc];
  while (queue.length) {
    const r = queue.shift();
    if (r === g.wumpusLoc) break;
    for (const n of g.cave[r]) if (!prev.has(n)) { prev.set(n, r); queue.push(n); }
  }
  const path = [];
  for (let at = g.wumpusLoc; at !== g.playerLoc; at = prev.get(at)) path.unshift(at);
  return path;
})()`;

/**
 * Walks through calm chambers to one at most two tunnels from the wumpus (an arrow never falls
 * short within two chambers), then names the arrow's path in the planner without loosing it.
 */
export async function aimAtTheWumpus(page: Page) {
  const within = `(r) => { const g = window.game; return g.cave[r].includes(g.wumpusLoc) || g.cave[r].some((n) => g.cave[n].includes(g.wumpusLoc)); }`;
  await walk(page, await calmRouteTo(page, within));
  const path = await inGame<number[]>(page, ARROW_PATH);
  await page.keyboard.press('s');
  for (const room of path.slice(0, 5)) {
    await gameFrame(page)
      .locator('.tunnel-chip', { hasText: new RegExp(`^Chamber ${room}$`) })
      .first()
      .click();
  }
}

/**
 * Walks within reach of the wumpus and shoots it; the chronicle opens. A long shot can fall
 * short (the original's rule past the third chamber), so the delver tries again while the
 * quiver lasts.
 */
export async function slayTheWumpus(page: Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await aimAtTheWumpus(page);
    await gameFrame(page).locator('#btn-traj-fire').click();
    await expect
      .poll(() => inGame<string>(page, 'window.game.status'), { timeout: 10_000 })
      .not.toBe('IN_PROGRESS')
      .catch(() => undefined);
    if ((await inGame<string>(page, 'window.game.status')) !== 'IN_PROGRESS') break;
  }
  await expect(gameFrame(page).getByTestId('report')).toBeVisible({ timeout: 10_000 });
}
