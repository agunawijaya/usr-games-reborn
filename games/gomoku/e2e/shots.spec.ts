import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { newGame, play } from '../src/engine/game';
import { winningFirstMoves } from '../src/engine/solver';
import { boardGeometry } from '../src/render/geometry';
import { PUZZLES } from '../src/modes/puzzles';

/**
 * Screens of the whole game for the docs and the critique rounds, in both looks:
 * `pnpm exec playwright test -c games/gomoku --grep @shots`. `SHOTS_OUT=<folder>` writes
 * somewhere else, `SHOTS_SIZE=1920` takes them at 1920 × 1080 instead of 1280 × 720.
 */

const out =
  process.env.SHOTS_OUT ?? fileURLToPath(new URL('../docs/media/screens/', import.meta.url));
const size =
  process.env.SHOTS_SIZE === '1920' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
const LOOKS = [
  { appearance: 'light', file: 'sand' },
  { appearance: 'dark', file: 'lake' },
] as const;
const DATE = '2026-10-04';

async function shot(page: Page, name: string, look: string) {
  await page.mouse.move(size.width - 2, size.height - 2);
  await page.waitForTimeout(300);
  const file = `${name}-${look}${size.width === 1920 ? '-1920' : ''}.webp`;
  const kb = await saveScreenshot(page, join(out, file));
  console.log(`${file} ${kb} KB`);
}

function save(key: string, data: unknown) {
  return {
    key: `usr-games:gomoku-workbench:${key}`,
    value: JSON.stringify({ v: 1, savedAt: '', data }),
  };
}

/** Opens the workbench part-way up the ladder, with some puzzles solved, so pages have something to show. */
async function open(page: Page, appearance: string) {
  await page.setViewportSize(size);
  await page.goto(`/?game&mute=1&appearance=${appearance}&date=${DATE}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  const records = {
    pebble: { wins: 2, star: true, games: 3 },
    reed: { wins: 2, star: false, games: 4 },
    heron: { wins: 1, star: false, games: 3 },
    koi: { wins: 0, star: false, games: 0 },
    campbell: { wins: 0, star: false, games: 0 },
    referee: { wins: 0, star: false, games: 0 },
  };
  const puzzles = Object.fromEntries(
    PUZZLES.slice(0, 14).map((p) => [p.id, { solved: true, tries: 1 }]),
  );
  const entries = [
    save('ladder', { records, chosen: 'heron', beaten: ['pebble', 'reed', 'heron'] }),
    save('puzzles', puzzles),
    save('counters', { games: 12, wins: 6, leagueMatches: 1, tutorialDone: true }),
  ];
  await page.evaluate((list) => {
    for (const { key, value } of list) localStorage.setItem(key, value);
  }, entries);
  await page.reload();
  await page.waitForFunction(() => window.__sceneReady === true);
}

async function pointAt(page: Page, boardSize: number, p: number) {
  const box = (await page.locator('[data-testid="board"]:visible').boundingBox())!;
  const g = boardGeometry({ x: box.x, y: box.y, width: box.width, height: box.height }, boardSize);
  return { x: g.left + (p % boardSize) * g.cell, y: g.top + Math.floor(p / boardSize) * g.cell };
}

async function click(page: Page, p: number, boardSize = 15) {
  const { x, y } = await pointAt(page, boardSize, p);
  await page.mouse.click(x, y);
}

async function boardMoves(page: Page): Promise<number[]> {
  const text =
    (await page.locator('[data-testid="board"]:visible').getAttribute('data-moves')) ?? '';
  return text ? text.split(',').map(Number) : [];
}

for (const look of LOOKS) {
  test(`screens in ${look.file} @shots`, async ({ page }) => {
    test.setTimeout(300_000);
    await open(page, look.appearance);
    await shot(page, 'title', look.file);

    await page.getByRole('button', { name: /^Ladder/ }).click();
    await shot(page, 'ladder', look.file);
    await page.keyboard.press('Escape');

    // Two players, with Read the board on, part-way into a game.
    await page.getByRole('button', { name: /Two players/ }).click();
    await shot(page, 'local-setup', look.file);
    await page.getByRole('button', { name: /Start the game/ }).click();
    const opening = [112, 98, 113, 128, 114, 126, 97, 142, 99, 81, 129];
    for (const p of opening) await click(page, p);
    const toggle = page.getByTestId('read-the-board');
    if (!(await toggle.isChecked())) await page.keyboard.press('t');
    await page.mouse.move(10, 10);
    await shot(page, 'local-read', look.file);
    // Finish the first player's five and show the results.
    for (const p of [144, 115, 143, 111]) await click(page, p);
    await page.getByRole('dialog').waitFor({ timeout: 15_000 });
    await shot(page, 'results', look.file);
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Puzzles/ }).click();
    await shot(page, 'puzzles', look.file);
    const puzzle = PUZZLES.find((p) => p.band === 'keen') ?? PUZZLES[0]!;
    await page.locator(`[data-puzzle="${puzzle.id}"]`).click();
    await shot(page, 'puzzle', look.file);
    const game = newGame(15, 'freestyle');
    for (const p of await boardMoves(page)) play(game, p);
    const first = winningFirstMoves(game, {
      moves: puzzle.moves,
      threes: puzzle.threes,
      nodes: 400_000,
    }).moves[0]!;
    await click(page, first);
    await page.waitForTimeout(900);
    await shot(page, 'puzzle-move', look.file);
    await page.getByRole('button', { name: 'Game menu' }).click();

    await page.getByRole('button', { name: /^Daily Puzzle/ }).click();
    await shot(page, 'daily', look.file);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /Bot League/ }).click();
    await shot(page, 'league-setup', look.file);
    await page.getByRole('button', { name: 'Brisk' }).click();
    await page.getByRole('button', { name: /Start the match/ }).click();
    await page.keyboard.press('w');
    await page.waitForTimeout(9000);
    await shot(page, 'league', look.file);
    await page.getByRole('button', { name: 'Game menu' }).click();

    await page.getByRole('button', { name: /How to play/ }).click();
    await shot(page, 'help', look.file);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Settings/ }).click();
    await shot(page, 'settings', look.file);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /^Tutorial/ }).click();
    await shot(page, 'tutorial', look.file);
  });
}
