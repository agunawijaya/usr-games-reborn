import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectStripAboveFrame,
  inGame,
  runInHall,
  savedGameStats,
  setTabHidden,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import {
  READY,
  beginChallenge,
  beginCrawl,
  crashIntoTheEdge,
  crawlHome,
  eatPlanted,
  openUpTo,
  playUntil,
} from './crawl';

/**
 * Orchard Crawl inside the Hall: the orchards page as its title screen, a crawl from the briefing
 * to the burrow and the report with its stars and the next orchard opening, a crash, the Daily
 * Orchard's share line, the game's own pause and the Hall's, the free orchard, the almanac, the
 * end of the season, the Hall's appearance, and every way back out. The tests let the careful bot
 * (scripts/bot.js) steer through the game's own handle, window.OrchardGame.
 */

async function openGame(page: Page, seed: Parameters<typeof runInHall>[2] = {}) {
  const frame = await runInHall(page, 'worm-classic', seed);
  await waitForGame(page, READY);
  return frame;
}

const state = (page: Page) => inGame<string>(page, 'window.OrchardGame.state');

test.describe('Orchard Crawl in the Hall', () => {
  test('opens on its orchards page, with no requests beyond the Hall', async ({ page }) => {
    const foreign = watchForeignRequests(page);
    const frame = await openGame(page);
    await expect(frame.getByRole('heading', { name: 'Orchard Crawl' })).toBeVisible();
    await expect(frame.getByTestId('desk-orchard-neon-grid')).toBeEnabled();
    await expect(frame.getByTestId('desk-continue')).toBeFocused();
    await expect(frame.getByTestId('desk-continue')).toContainText('Crawl 1. Neon Grid');
    await expect(frame.getByTestId('desk-orchard-savanna')).toBeDisabled();
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    // Behind the desk a worm crawls the orchard on its own.
    await expect.poll(() => state(page)).toBe('menu');
    await page.waitForTimeout(1500);
    expect(foreign()).toEqual([]);
  });

  test('a crawl home: the harvest, the burrow, the stars and the next orchard', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginCrawl(page);
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await expect(frame.getByTestId('run-harvest')).toContainText('0 / 10');
    await playUntil(page, 'p.burrow !== null');
    await expect(frame.getByTestId('run-harvest-note')).toContainText('Your burrow is open');
    const end = await crawlHome(page);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Home!', { timeout: 15_000 });
    await expect(report).toContainText(`${end.score} points`);
    await expect(report).toContainText('Neon Grid cleared!');
    await expect(report).toContainText('New orchard open: Savanna');
    await expect(report.locator('.is-fresh')).not.toHaveCount(0);
    await expect(toasts(page)).toContainText('Achievement unlocked');
    await expect
      .poll(() => savedGameStats(page, 'worm-classic'))
      .toMatchObject({ wins: 1, counters: { homes: 1 } });
    await report.getByRole('button', { name: 'Go to Savanna' }).click();
    await expect(frame.getByTestId('desk-goal')).toContainText('Eat 12 apples');
  });

  test('Enter on the orchards page goes straight into the next orchard', async ({ page }) => {
    await openUpTo(page, 'river');
    const frame = await openGame(page);
    await expect(frame.getByTestId('desk-continue')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => state(page)).toBe('playing');
    await expect(frame.getByTestId('run-harvest')).toContainText('0 / 12');
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
  });

  test('before its game menu the page shows only a title card with a progress bar', async ({
    page,
  }) => {
    await openGame(page);
    expect(
      await inGame<boolean>(page, "document.documentElement.classList.contains('is-starting')"),
    ).toBe(false);
    // While starting, the field and its HUD are hidden; the desk shows them only behind the menu.
    const starting = await inGame<{ stage: string; card: string }>(
      page,
      `(() => {
        document.documentElement.classList.add('is-starting');
        const seen = {
          stage: getComputedStyle(document.querySelector('.stage')).visibility,
          card: getComputedStyle(document.querySelector('.loading')).visibility,
        };
        document.documentElement.classList.remove('is-starting');
        return seen;
      })()`,
    );
    // Meanwhile only the title card and its progress bar show.
    expect(starting).toEqual({ stage: 'hidden', card: 'visible' });
    expect(
      await inGame<string>(page, "getComputedStyle(document.querySelector('.loading')).display"),
    ).toBe('none');
  });

  test('a crash: a loss, and no stars', async ({ page }) => {
    const frame = await openGame(page);
    await beginCrawl(page);
    await crashIntoTheEdge(page);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Crashed', { timeout: 10_000 });
    await expect(report).toContainText('Into the edge of the orchard.');
    await expect(report).toContainText('Stars are earned on a crawl that comes home.');
    await expect.poll(() => savedGameStats(page, 'worm-classic')).toMatchObject({ losses: 1 });
  });

  test('R crawls again from the report; H goes back to the Hall', async ({ page }) => {
    const frame = await openGame(page);
    await beginCrawl(page);
    await crashIntoTheEdge(page);
    await expect(frame.getByTestId('desk-report')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('KeyR');
    await expect.poll(() => state(page)).toBe('playing');
    await crashIntoTheEdge(page);
    await expect(frame.getByTestId('desk-report')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('KeyH');
    await expect(page).toHaveURL(/\/(#\/(man\/[a-z-]+)?)?$/);
  });

  test('the Daily Orchard ends with a share line and no link', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-daily').click();
    await expect.poll(() => state(page)).toBe('playing');
    await crashIntoTheEdge(page);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('this one counts', { timeout: 10_000 });
    await report.getByRole('button', { name: 'Share' }).click();
    await expect(report.locator('.desk-share')).toHaveText(
      /Orchard Crawl #\d+ · [A-Za-z ]+ · crashed · 🍎\d+ · \d+ pts · [★☆]{3}$/,
    );
    expect(await report.locator('.desk-share').textContent()).not.toMatch(/https?:/);
    await expect.poll(() => savedGameStats(page, 'worm-classic')).toMatchObject({ sessions: 1 });
  });

  test('Esc pauses the crawl and holds it still; leaving from the pause asks first', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginCrawl(page);
    await page.keyboard.press('Escape');
    const pause = frame.getByTestId('pause-card');
    await expect(pause).toBeVisible();
    await expect(pause.getByRole('button')).toHaveText([
      /Resume/,
      'Restart this crawl',
      'How to play',
      'Settings',
      'Game menu',
      'Back to the Hall',
    ]);
    const before = await inGame<{ x: number }>(page, 'window.OrchardGame.peek().head');
    await page.waitForTimeout(800);
    expect(await inGame<{ x: number }>(page, 'window.OrchardGame.peek().head')).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
    await expect
      .poll(async () => (await inGame<{ x: number }>(page, 'window.OrchardGame.peek().head')).x)
      .not.toBe(before.x);
    await page.keyboard.press('KeyP');
    await pause.getByRole('button', { name: 'Game menu' }).click();
    await expect(pause).toContainText('This crawl will not be recorded');
    await frame.getByTestId('pause-leave').click();
    await expect(frame.getByTestId('desk-orchard-neon-grid')).toBeVisible();
    expect(await savedGameStats(page, 'worm-classic')).toBeNull();
  });

  test('a hidden tab holds the crawl still, and it carries on when shown', async ({ page }) => {
    await openGame(page);
    await beginCrawl(page);
    await setTabHidden(page, true);
    const before = await inGame<{ x: number }>(page, 'window.OrchardGame.peek().head');
    await page.waitForTimeout(800);
    expect(await inGame<{ x: number }>(page, 'window.OrchardGame.peek().head')).toEqual(before);
    await setTabHidden(page, false);
    await expect
      .poll(async () => (await inGame<{ x: number }>(page, 'window.OrchardGame.peek().head')).x)
      .not.toBe(before.x);
  });

  test('the briefing names the harvest, the ground, the creatures and the stars', async ({
    page,
  }) => {
    await openUpTo(page, 'desert');
    const frame = await openGame(page);
    await expect(frame.getByTestId('desk-continue')).toContainText('Crawl 5. Desert');
    await frame.getByTestId('desk-orchard-desert').click();
    await expect(frame.getByTestId('desk-goal')).toContainText(
      'Eat 13 apples and your burrow opens.',
    );
    const page_ = frame.locator('.desk-page');
    await expect(page_).toContainText('a fence like an H');
    await expect(page_).toContainText('a spoiled apple hatches a wasp');
    await expect(page_.locator('.desk-creatures canvas')).toHaveCount(3);
    await expect(page_.locator('.desk-starlist li')).toHaveText([
      /Crawl home/,
      /Score 130 points/,
      /Eat two over-ripe apples/,
    ]);
  });

  test('the free orchard plays by the port’s own choices, with no burrow', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-free').click();
    await expect(frame.getByTestId('free-creature-rival')).toBeDisabled();
    await frame.getByTestId('free-mode-wild').click();
    await expect(frame.getByTestId('free-mode-wild')).toHaveAttribute('aria-pressed', 'true');
    await expect(frame.getByTestId('free-mode-wild')).toBeFocused();
    await frame.getByTestId('free-creature-rival').click();
    await frame.getByTestId('free-fence-box').click();
    await frame.getByTestId('desk-free-crawl').click();
    await expect.poll(() => state(page)).toBe('playing');
    const peek = await inGame<{ apples: unknown[]; fences: unknown[] }>(
      page,
      'window.OrchardGame.peek()',
    );
    expect(peek.apples.length).toBe(10);
    expect(peek.fences.length).toBeGreaterThan(0);
    await playUntil(page, 'p.harvested >= 20 || p.rival !== null');
    expect(await inGame<unknown>(page, 'window.OrchardGame.peek().burrow')).toBeNull();
    await crashIntoTheEdge(page);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Free orchard · a full orchard', { timeout: 10_000 });
    await expect(report.locator('.desk-starlist')).toHaveCount(0);
  });

  test('the almanac draws what has been met, and keeps the rest in shadow', async ({ page }) => {
    const frame = await openGame(page);
    await beginCrawl(page);
    await crawlHome(page);
    await expect(frame.getByTestId('desk-report')).toContainText(
      'New in the almanac: Numbered apple',
      { timeout: 15_000 },
    );
    await frame.getByTestId('desk-report').getByRole('button', { name: 'Game menu' }).click();
    await frame.getByTestId('desk-almanac').click();
    await expect(frame.getByTestId('almanac-apple')).toContainText('Numbered apple');
    await expect(frame.getByTestId('almanac-burrow')).toContainText('Your burrow');
    await expect(frame.getByTestId('almanac-gardener')).toContainText('Not yet met');
    await expect(frame.getByTestId('almanac-gardener').locator('canvas')).toHaveClass(/is-unseen/);
  });

  test('clearing Midnight ends the season, and the ending stays to be read again', async ({
    page,
  }) => {
    await openUpTo(page, 'midnight');
    const frame = await openGame(page);
    await beginCrawl(page, 'midnight');
    await crawlHome(page);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Midnight cleared!', { timeout: 15_000 });
    await expect(report).toContainText('The season is complete!');
    await report.getByRole('button', { name: 'Read the ending' }).click();
    await expect(frame.getByTestId('desk-ending-page')).toContainText('8 of 8 orchards cleared');
    await frame.getByTestId('desk-back').click();
    await expect(frame.getByTestId('desk-ending')).toBeVisible();
  });

  test('the challenges page: families with their tiers, King Drift weighted, the first tier of each open', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await expect(frame.getByTestId('desk-challenges')).toContainText('0/81');
    await frame.getByTestId('desk-challenges').click();
    await expect(frame.getByRole('heading', { name: 'Challenges' })).toBeVisible();
    await expect(frame.locator('.desk-group')).toContainText(
      'the zigzag ×1, the lane ×2, no long straights ×3',
    );
    await expect(frame.getByTestId('challenge-fill-bed-1')).toBeEnabled();
    await expect(frame.getByTestId('challenge-fill-bed-2')).toBeDisabled();
    await expect(frame.getByTestId('challenge-fill-orchard')).toBeEnabled();
    await page.keyboard.press('Backspace');
    await expect(frame.getByTestId('desk-continue')).toBeVisible();
  });

  test('a small bed is its own board, drawn to fit', async ({ page }) => {
    await openGame(page);
    await beginChallenge(page, 'fill-bed-1');
    const board = await inGame<{ cols: number; rows: number; length: number; freeCells: number }>(
      page,
      'window.OrchardGame.peek()',
    );
    expect(board).toMatchObject({ cols: 8, rows: 6, length: 3, freeCells: 48 });
  });

  test('the zigzag lane: home through the hedge, two points, and the next tier opens', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginChallenge(page, 'lane-1');
    await playUntil(page, 'false', { home: true });
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Done!', { timeout: 10_000 });
    await expect(report).toContainText('+2 challenge points: 2 of 81');
    await expect(report).toContainText('Next one open: The narrow lane');
    await expect.poll(() => savedGameStats(page, 'worm-classic')).toMatchObject({ wins: 1 });
    await report.getByRole('button', { name: 'Challenges' }).click();
    await expect(frame.getByTestId('challenge-lane-2')).toBeEnabled();
  });

  test('exactly 20: a bite that lands on it wins, one past it loses', async ({ page }) => {
    const frame = await openGame(page);
    await beginChallenge(page, 'exact-1');
    await eatPlanted(page, 9);
    await eatPlanted(page, 6);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Done!', { timeout: 10_000 });
    await page.keyboard.press('KeyR');
    await expect.poll(() => inGame<string>(page, 'window.OrchardGame.state')).toBe('playing');
    await eatPlanted(page, 9);
    await eatPlanted(page, 7);
    await expect(report).toContainText('Not this time', { timeout: 10_000 });
    await expect(report).toContainText('One cell too long');
  });

  test('in order: any other number ends it', async ({ page }) => {
    const frame = await openGame(page);
    await beginChallenge(page, 'order-1');
    await expect(frame.getByTestId('run-challenge')).toContainText('Next: 1');
    await eatPlanted(page, 2);
    await expect(frame.getByTestId('desk-report')).toContainText('not the number that came next', {
      timeout: 10_000,
    });
  });

  test('right turns only: a left turn is not taken', async ({ page }) => {
    await openGame(page);
    await beginChallenge(page, 'right-1');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(800);
    expect(
      await inGame<{ dx: number; dy: number }>(page, 'window.OrchardGame.peek().heading'),
    ).toEqual({
      dx: 1,
      dy: 0,
    });
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(() => inGame<{ dx: number; dy: number }>(page, 'window.OrchardGame.peek().heading'))
      .toEqual({ dx: 0, dy: 1 });
  });

  test('no long straights: one cell too many in a line ends it', async ({ page }) => {
    const frame = await openGame(page);
    await beginChallenge(page, 'drift-1');
    await expect(frame.getByTestId('desk-report')).toContainText(
      'Straight on for one cell too many',
      {
        timeout: 15_000,
      },
    );
  });

  test('a light Hall gives the page its light look', async ({ page }) => {
    await openGame(page, { appearance: 'light' });
    await expect
      .poll(() => inGame<string>(page, 'document.documentElement.dataset.appearance'))
      .toBe('light');
  });

  test('a dark Hall gives the page its dark look', async ({ page }) => {
    await openGame(page, { appearance: 'dark' });
    await expect
      .poll(() => inGame<string>(page, 'document.documentElement.dataset.appearance'))
      .toBe('dark');
  });

  test('the strip sits above the game at 1280×720', async ({ page }) => {
    await openGame(page);
    await expectStripAboveFrame(page);
  });
});

describeWaysOut({ id: 'worm-classic', ready: READY, titleScreen: true });
