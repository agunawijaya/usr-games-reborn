import { readFileSync } from 'node:fs';
import { expect, type FrameLocator, type Page } from '@playwright/test';
import { gameFrame, inGame } from '../../../packages/bridge/testing/hall';

/** Readiness inside the game's page: the desk is up and listening to the orchard. */
export const READY = '!!window.__orchard && !!window.OrchardGame';

const BOT = readFileSync(new URL('../scripts/bot.js', import.meta.url), 'utf8');

/** The season's orchards in order, as the saved progress names them. */
const ORDER = ['neon-grid', 'savanna', 'river', 'jungle', 'desert', 'aztec', 'origami', 'midnight'];

/** From the orchards page, a crawl in an orchard: its briefing, then Crawl. */
export async function beginCrawl(page: Page, orchard = 'neon-grid'): Promise<FrameLocator> {
  const frame = gameFrame(page);
  await frame.getByTestId(`desk-orchard-${orchard}`).click();
  await frame.getByTestId('desk-crawl').click();
  await expect.poll(() => inGame<string>(page, 'window.OrchardGame.state')).toBe('playing');
  return frame;
}

/** Puts the careful bot (scripts/bot.js) into the game's page. */
async function loadBot(page: Page) {
  if (!(await inGame<boolean>(page, 'Boolean(window.__crawlBot)'))) await inGame(page, BOT);
}

/**
 * Plays on with the bot, without drawing, until `until` (a page expression over `p`, the
 * orchard's peek) holds or the crawl ends; then the orchard carries on in real time. The bot
 * heads home once the burrow is open when `home` is true, and keeps eating otherwise.
 */
export async function playUntil(page: Page, until: string, { home = false } = {}) {
  await loadBot(page);
  return inGame<{ state: string; harvested: number; score: number }>(
    page,
    `(() => {
      const game = window.OrchardGame;
      const steer = window.__crawlBot({ stayFor: ${home ? 0 : 'Infinity'} });
      game.fastForward(10 * 60 * 1000, steer, 16, (p) => ${until});
      const p = game.peek();
      return { state: game.state, harvested: p.harvested, score: p.score };
    })()`,
  );
}

/** Eats the orchard's harvest with the bot, and crawls home. Returns what was eaten. */
export async function crawlHome(page: Page) {
  // A careful bot still crashes now and then: this keeps to one that made it.
  for (let attempt = 0; attempt < 6; attempt++) {
    const end = await playUntil(page, 'false', { home: true });
    if (end.state === 'home' || end.state === 'burrowing') return end;
    await expect(gameFrame(page).getByTestId('desk-report')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('KeyR');
    await expect.poll(() => inGame<string>(page, 'window.OrchardGame.state')).toBe('playing');
  }
  throw new Error('the bot never made it home');
}

/** Steers straight for the top edge (or the right one, if heading down) until the crawl ends. */
export async function crashIntoTheEdge(page: Page) {
  await inGame(
    page,
    `window.OrchardGame.fastForward(60000, (p) => (p.heading.dy === 1 ? { dx: 1, dy: 0 } : { dx: 0, dy: -1 }), 16)`,
  );
}

/**
 * Opens every orchard up to `orchard` before the page loads, as if each before it had been
 * cleared with its first star (the progress the desk keeps, at its version 1).
 */
export async function openUpTo(page: Page, orchard: string) {
  await page.addInitScript(
    ({ order, last }) => {
      const stars = Object.fromEntries(
        order.slice(0, order.indexOf(last)).map((id) => [id, ['home']]),
      );
      localStorage.setItem(
        'usr-games:worm-classic:progress',
        JSON.stringify({ v: 1, data: { stars } }),
      );
    },
    { order: ORDER, last: orchard },
  );
}

/** From the orchards page, a challenge: the challenges page, its briefing, then Start. */
export async function beginChallenge(page: Page, id: string): Promise<FrameLocator> {
  const frame = gameFrame(page);
  await frame.getByTestId('desk-challenges').click();
  await frame.getByTestId(`challenge-${id}`).click();
  await frame.getByTestId('challenge-start').click();
  await expect.poll(() => inGame<string>(page, 'window.OrchardGame.state')).toBe('playing');
  return frame;
}

/** Puts an apple of `value` in the cell the worm moves into next, and waits until it is eaten. */
export async function eatPlanted(page: Page, value: number) {
  const before = await inGame<number>(page, 'window.OrchardGame.peek().harvested');
  await inGame(
    page,
    `(() => {
      const p = window.OrchardGame.peek();
      window.OrchardGame.plant(p.head.x + p.heading.dx, p.head.y + p.heading.dy, ${value});
    })()`,
  );
  await expect
    .poll(() => inGame<number>(page, 'window.OrchardGame.peek().harvested'))
    .toBeGreaterThan(before);
}
