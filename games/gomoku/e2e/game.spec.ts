import { expect, type Page, test } from '@playwright/test';
import { newGame, play } from '../src/engine/game';
import { fivePoints, winningFirstMoves } from '../src/engine/solver';
import { boardGeometry } from '../src/render/geometry';
import { DAILY_POOL, PUZZLES, puzzleGame } from '../src/modes/puzzles';

/**
 * Fivefold in the browser, on its workbench (a stand-in for the Hall that logs results, packages,
 * shares and exits to `window.__fivefoldLog`): mouse and keyboard play, Read the board, the
 * replay, a puzzle solved and one failed, a game for two, a Bot League match, the Daily Puzzle's
 * share line, and the ways out.
 */

declare global {
  interface Window {
    __fivefoldLog?: { kind: string; value: unknown }[];
  }
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/?game&appearance=light${query}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  await expect(page.getByRole('heading', { name: 'Fivefold' })).toBeVisible();
}

async function log(page: Page, kind: string): Promise<unknown[]> {
  return page.evaluate(
    (k) => (window.__fivefoldLog ?? []).filter((e) => e.kind === k).map((e) => e.value),
    kind,
  );
}

/** The page position of a board point (x, y from the top left). */
async function pointAt(page: Page, size: number, x: number, y: number) {
  const box = (await page.locator('[data-testid="board"]:visible').boundingBox())!;
  const g = boardGeometry({ x: box.x, y: box.y, width: box.width, height: box.height }, size);
  return { x: g.left + x * g.cell, y: g.top + y * g.cell };
}

async function clickPoint(page: Page, size: number, p: number): Promise<void> {
  const { x, y } = await pointAt(page, size, p % size, Math.floor(p / size));
  await page.mouse.click(x, y);
}

async function movesOnBoard(page: Page): Promise<number[]> {
  // During a replay the finished game waits hidden behind it: read the board on show.
  const text =
    (await page.locator('[data-testid="board"]:visible').getAttribute('data-moves')) ?? '';
  return text ? text.split(',').map(Number) : [];
}

async function startLocal(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Two players/ }).click();
  await page.getByRole('button', { name: /Start the game/ }).click();
  await expect(page.getByTestId('board')).toBeVisible();
}

test('two players by mouse: five wins, the replay, and play again', async ({ page }) => {
  await open(page);
  await startLocal(page);
  const size = 15;
  // First player along row 7, second along row 9.
  for (let i = 0; i < 5; i++) {
    await clickPoint(page, size, 7 * size + 3 + i);
    if (i < 4) await clickPoint(page, size, 9 * size + 3 + i);
  }
  await expect(page.getByRole('dialog')).toContainText('Slate wins', { timeout: 10_000 });
  expect(await log(page, 'result')).toHaveLength(1);
  await page.getByRole('button', { name: /Watch the replay/ }).click();
  await expect(page.getByText(/What it weighed/)).toBeVisible();
  await page.keyboard.press('Home');
  expect(await movesOnBoard(page)).toEqual([]);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await movesOnBoard(page)).toHaveLength(2);
  await page.getByRole('button', { name: 'Back to the results' }).click();
  await expect(page.getByRole('dialog')).toContainText('Slate wins');
  // Results cards ignore keys for a moment, so a key held from play cannot land on them.
  await page.waitForTimeout(700);
  await page.keyboard.press('r');
  await expect(page.locator('.ff-seat__turn', { hasText: 'Slate to move.' })).toBeVisible();
  expect(await movesOnBoard(page)).toEqual([]);
});

test('the keyboard plays, takes back, and reads the board', async ({ page }) => {
  await open(page);
  await startLocal(page);
  await page.getByTestId('board').focus();
  // The cursor starts in the middle; Enter places there.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect(await movesOnBoard(page)).toEqual([7 * 15 + 7]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  expect(await movesOnBoard(page)).toEqual([7 * 15 + 7, 9 * 15 + 7]);
  await page.keyboard.press('z');
  expect(await movesOnBoard(page)).toEqual([7 * 15 + 7]);
  // An open three for the first player, then Read the board counts it.
  await page.keyboard.press('Enter');
  for (const p of [7 * 15 + 8, 12 * 15 + 1, 7 * 15 + 9]) await clickPoint(page, 15, p);
  const toggle = page.getByTestId('read-the-board');
  if (!(await toggle.isChecked())) await page.keyboard.press('t');
  await expect(toggle).toBeChecked();
  await expect(page.locator('.ff-tally .is-mine')).toContainText('1 open three');
  await page.keyboard.press('t');
  await expect(toggle).not.toBeChecked();
});

test('a ranked ladder game: Read the board is off and Pebble answers', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /^Ladder/ }).click();
  await page.getByRole('button', { name: /^Play Pebble/ }).click();
  await expect(page.getByTestId('read-the-board')).toBeDisabled();
  await clickPoint(page, 15, 7 * 15 + 7);
  await expect.poll(async () => (await movesOnBoard(page)).length, { timeout: 15_000 }).toBe(2);
  // Leaving asks first.
  await page.getByRole('button', { name: 'Game menu' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Leave this game?');
  await page.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByRole('heading', { name: 'Fivefold' })).toBeVisible();
});

/** Plays the puzzle on screen to the end with the solver's moves. */
async function solveOnScreen(page: Page, threes: boolean, moves: number): Promise<void> {
  for (let left = moves; left > 0; left--) {
    const game = newGame(15, 'freestyle');
    for (const p of await movesOnBoard(page)) play(game, p);
    const { moves: winners } = winningFirstMoves(game, { moves: left, threes, nodes: 400_000 });
    const before = game.moves.length;
    await clickPoint(page, 15, winners[0]!);
    if (left > 1)
      await expect
        .poll(async () => (await movesOnBoard(page)).length, { timeout: 15_000 })
        .toBe(before + 2);
  }
}

test('a puzzle solved, and one failed', async ({ page }) => {
  const puzzle = PUZZLES[0]!;
  await open(page);
  await page.getByRole('button', { name: /^Puzzles/ }).click();
  await page.locator(`[data-puzzle="${puzzle.id}"]`).click();
  await solveOnScreen(page, puzzle.threes, puzzle.moves);
  await expect(page.getByRole('dialog')).toContainText('Solved', { timeout: 15_000 });
  await page.waitForTimeout(700);
  await page.keyboard.press('r');
  // A move that does not keep the win: the first empty point far from the action.
  const game = puzzleGame(puzzle);
  const winners = winningFirstMoves(game, {
    moves: puzzle.moves,
    threes: puzzle.threes,
    nodes: 400_000,
  }).moves;
  const wrong = game.board.findIndex((s, p) => s === null && !winners.includes(p));
  await clickPoint(page, 15, wrong);
  await expect(page.locator('.ff-seat__turn', { hasText: 'off the hook' })).toBeVisible({
    timeout: 15_000,
  });
  await page.keyboard.press('s');
  await expect(page.locator('.ff-seat__turn', { hasText: 'That was the answer' })).toBeVisible({
    timeout: 60_000,
  });
});

test('the Daily Puzzle solved and shared', async ({ page }) => {
  await open(page, '&date=2026-10-03');
  await page.getByRole('button', { name: /^Daily Puzzle/ }).click();
  await page.getByRole('button', { name: /Play today’s puzzle/ }).click();
  const moves = await movesOnBoard(page);
  const puzzle = DAILY_POOL.find((p) => p.position.join(',') === moves.join(','))!;
  expect(puzzle).toBeTruthy();
  await expect(page.getByTestId('read-the-board')).toHaveCount(0);
  await solveOnScreen(page, puzzle.threes, puzzle.moves);
  await expect(page.getByRole('dialog')).toContainText('Solved', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Share' }).click();
  const shares = (await log(page, 'share')) as string[];
  expect(shares.at(-1)).toMatch(
    new RegExp(`^Fivefold #\\d+ · solved in ${puzzle.moves} · 🔵{${puzzle.moves}}$`, 'u'),
  );
});

test('a Bot League match, watched to the end', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await page.getByRole('button', { name: /Bot League/ }).click();
  await page.locator('.ff-picker').nth(0).locator('[data-opponent="pebble"]').click();
  await page.locator('.ff-picker').nth(1).locator('[data-opponent="reed"]').click();
  await page.getByRole('button', { name: 'Swift' }).click();
  await page.getByRole('button', { name: /Start the match/ }).click();
  await page.keyboard.press('w');
  await expect(page.getByRole('button', { name: /Hide their thinking/ })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/takes the match|ends level/, {
    timeout: 200_000,
  });
  expect(await log(page, 'package')).toContain('league-fan');
});

test('the tutorial, all four steps', async ({ page }) => {
  await open(page);
  await page
    .getByRole('button', { name: /tutorial/i })
    .first()
    .click();
  const at = (x: number, y: number) => y * 15 + x;
  const current = async () => {
    const game = newGame(15, 'freestyle');
    for (const p of await movesOnBoard(page)) play(game, p);
    return game;
  };
  // 1. Five in a row.
  await clickPoint(page, 15, at(4, 7));
  await expect(page.locator('.ff-coach .ff-kicker')).toHaveText('Step 2 of 4', { timeout: 15_000 });
  // 2. Block the four.
  await clickPoint(page, 15, at(9, 9));
  await expect(page.locator('.ff-coach .ff-kicker')).toHaveText('Step 3 of 4', { timeout: 15_000 });
  // 3. An open four, then five at the end they leave open.
  await clickPoint(page, 15, at(5, 7));
  await expect.poll(async () => (await movesOnBoard(page)).length, { timeout: 10_000 }).toBe(8);
  const game = await current();
  await clickPoint(page, 15, fivePoints(game, game.toMove)[0]!);
  await expect(page.locator('.ff-coach .ff-kicker')).toHaveText('Step 4 of 4', { timeout: 15_000 });
  // 4. Read the board, then block.
  await page.keyboard.press('t');
  await expect(page.getByTestId('read-the-board')).toBeChecked();
  await clickPoint(page, 15, at(7, 6));
  await expect(page.getByRole('dialog')).toContainText('Ready to play', { timeout: 15_000 });
  expect(await log(page, 'result')).toHaveLength(1);
});

test('the ways out: Escape on a page, the game menu, and back to the Hall', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /How to play/ }).click();
  await expect(page.getByRole('heading', { name: 'Five in a row' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Fivefold' })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await log(page, 'navigate')).toContain('hall');
  await startLocal(page);
  for (let i = 0; i < 5; i++) {
    await clickPoint(page, 15, 3 * 15 + 3 + i);
    if (i < 4) await clickPoint(page, 15, 5 * 15 + 3 + i);
  }
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(700);
  await page.keyboard.press('h');
  expect((await log(page, 'navigate')).filter((v) => v === 'hall').length).toBeGreaterThanOrEqual(
    2,
  );
});
