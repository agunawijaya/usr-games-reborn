import { expect, type Page, test } from '@playwright/test';
import './hook';

/**
 * Double Cross on its own workbench: mouse and keyboard play, the tutorial from first line to
 * double cross, the chain lens, a puzzle, two players, a custom board, the Daily Board's share
 * line and every way out.
 */

const horizontal = (columns: number, row: number, column: number) => row * columns + column;
const vertical = (columns: number, rows: number, row: number, column: number) =>
  (rows + 1) * columns + row * (columns + 1) + column;

async function open(page: Page, query = '') {
  await page.goto(`/?fresh=1${query}`);
  await page.waitForFunction('window.__ready === true');
  await expect(page.getByTestId('dx-title')).toBeVisible();
}

async function startLadderMatch(page: Page, number = 1) {
  await page.getByTestId('dx-go-ladder').click();
  await page.getByTestId(`dx-rung-${number}`).click();
  await page.getByTestId('dx-start').click();
  await expect(page.getByTestId('dx-intro')).toBeHidden();
}

async function waitForTurn(page: Page) {
  await page.waitForFunction(
    `(() => { const p = window.__dx.play(); if (!p) return false; if (!p.humanToMove) p.skipWait(); return p.humanToMove || p.match.over; })()`,
  );
}

/** Plays every human line with Master's choice (or at random) until the game ends. */
async function playOut(page: Page, how: 'well' | 'randomly' = 'well') {
  await page.waitForFunction(
    `(() => {
      const p = window.__dx.play();
      if (!p) return true;
      if (p.match.over) return true;
      if (p.humanToMove) {
        const free = [...p.match.board.drawn.keys()].filter((e) => !p.match.board.drawn[e]);
        p.play(${how === 'well' ? 'p.suggest()' : 'free[Math.floor(Math.random() * free.length)]'});
      } else p.skipWait();
      return false;
    })()`,
    undefined,
    { polling: 50, timeout: 60_000 },
  );
}

test('a line drawn with the mouse, and one dragged from dot to dot', async ({ page }) => {
  await open(page);
  await startLadderMatch(page);
  const frame = await page.evaluate('window.__dx.play().frame');
  const f = frame as { x: number; y: number; spacing: number };
  const canvas = page.getByTestId('dx-board');
  // The top of the top-left box.
  await canvas.click({ position: { x: f.x + f.spacing / 2, y: f.y } });
  await expect.poll(() => page.evaluate('window.__dx.play().match.turns[0]?.edge')).toBe(0);
  await waitForTurn(page);
  const drawn = (await page.evaluate('[...window.__dx.play().match.board.drawn]')) as number[];
  // Drag down the right-hand border, from its top dot to the one below, if it is still free.
  const edge = vertical(3, 3, 0, 3);
  if (!drawn[edge]) {
    await page.mouse.move(f.x + 3 * f.spacing, f.y);
    await page.mouse.down();
    await page.mouse.move(f.x + 3 * f.spacing, f.y + f.spacing * 0.6, { steps: 4 });
    await page.mouse.move(f.x + 3 * f.spacing, f.y + f.spacing, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(`window.__dx.play().match.board.drawn[${edge}]`)).toBe(1);
  }
});

test('the keyboard aims from a dot and draws with Enter', async ({ page }) => {
  await open(page);
  await startLadderMatch(page);
  // The cursor starts on the left side of the top-left box; Down walks on to the box below.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect
    .poll(() => page.evaluate('window.__dx.play().match.turns[0]?.edge'))
    .toBe(vertical(3, 3, 1, 0));
  await waitForTurn(page);
  // The original's keys: l jumps to the next parallel line.
  await page.keyboard.press('KeyL');
  await page.keyboard.press('Space');
  await expect
    .poll(() => page.evaluate('window.__dx.play().match.turns.filter((t) => t.by === 0).length'))
    .toBe(2);
});

test('the tutorial runs from a first line to the double cross', async ({ page }) => {
  await open(page);
  await page.getByTestId('dx-go-tutorial').click();
  const coach = page.getByTestId('dx-coach');
  const next = page.getByTestId('dx-coach-next');
  const play = (edge: number) => page.evaluate(`window.__dx.play().play(${edge})`);

  await expect(coach).toContainText('Draw a line');
  await play(0);
  await next.click();

  await expect(coach).toContainText('Close a box');
  await play(vertical(2, 2, 0, 1));
  await play(horizontal(2, 2, 1));
  await next.click();

  await expect(coach).toContainText('Take a chain');
  for (const column of [1, 2, 3]) await play(vertical(3, 1, 0, column));
  await next.click();

  await expect(coach).toContainText('The loony move');
  await play(horizontal(3, 0, 0));
  await playOut(page);
  await expect(coach).toContainText('One box given, five taken');
  await next.click();

  await expect(coach).toContainText('The double cross');
  await play(vertical(4, 2, 0, 1));
  await play(vertical(4, 2, 0, 2));
  await play(vertical(4, 2, 0, 4));
  await expect(page.getByTestId('dx-cut-banner')).toContainText('Double cross!');
  await playOut(page);
  await expect(coach).toContainText('Two given, six taken');
  await next.click();
  await expect(page.getByTestId('dx-title')).toBeVisible();
  await expect(page.getByTestId('dx-go-tutorial')).not.toContainText('New? Start here');
});

test('taking everything in the last step can be tried again', async ({ page }) => {
  await open(page);
  await page.getByTestId('dx-go-tutorial').click();
  // Skip ahead through the first four steps by finishing each one well.
  for (let i = 0; i < 4; i++) {
    if (i === 0) await page.evaluate('window.__dx.play().play(0)');
    if (i === 1) {
      await page.evaluate(`window.__dx.play().play(${vertical(2, 2, 0, 1)})`);
      await page.evaluate(`window.__dx.play().play(${horizontal(2, 2, 1)})`);
    }
    if (i === 2)
      for (const c of [1, 2, 3])
        await page.evaluate(`window.__dx.play().play(${vertical(3, 1, 0, c)})`);
    if (i === 3) {
      await page.evaluate(`window.__dx.play().play(${horizontal(3, 0, 0)})`);
      await playOut(page);
    }
    await page.getByTestId('dx-coach-next').click();
  }
  for (const column of [1, 2, 3, 4])
    await page.evaluate(`window.__dx.play().play(${vertical(4, 2, 0, column)})`);
  await playOut(page, 'randomly');
  await expect(page.getByTestId('dx-coach')).toContainText('Try again');
  await page.getByTestId('dx-coach-retry').click();
  await expect(page.getByTestId('dx-coach')).toContainText('The double cross');
});

test('the chain lens counts chains, and stays off in the Daily Board', async ({ page }) => {
  await open(page);
  await startLadderMatch(page, 1);
  await expect(page.getByTestId('dx-reading')).toBeHidden();
  await page.keyboard.press('KeyC');
  await expect(page.getByTestId('dx-reading')).toContainText('Long chains');
  await expect(page.getByTestId('dx-lens')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('dx-menu').click();
  await page.getByTestId('dx-go-daily').click();
  await page.getByTestId('dx-start').click();
  await expect(page.getByTestId('dx-lens')).toBeDisabled();
  await page.keyboard.press('KeyC');
  await expect(page.getByTestId('dx-reading')).toBeHidden();
});

test('a puzzle is solved by giving boxes away', async ({ page }) => {
  await open(page);
  await page.getByTestId('dx-go-puzzles').click();
  await page.getByTestId('dx-puzzle-1').click();
  await expect(page.getByTestId('dx-intro')).toContainText('Take at least');
  await page.getByTestId('dx-start').click();
  await expect(page.getByTestId('dx-goal')).toBeVisible();
  await playOut(page);
  await expect(page.getByTestId('dx-results')).toContainText('Solved!', { timeout: 15_000 });
  await page.getByRole('button', { name: /Puzzle 2/ }).click();
  await expect(page.getByTestId('dx-intro')).toContainText('puzzle 2 of 40');
});

test('two players share the board, and nobody else moves', async ({ page }) => {
  await open(page);
  await page.getByTestId('dx-go-local').click();
  await page.getByTestId('dx-name-1').fill('Ada');
  await page.getByTestId('dx-local-start').click();
  await expect(page.getByTestId('dx-score')).toContainText('Ada');
  await playOut(page, 'randomly');
  await expect(page.getByTestId('dx-results')).toBeVisible({ timeout: 15_000 });
  const log = (await page.evaluate('window.__log')) as string[];
  expect(
    log.some((line) => line.startsWith('result') && line.includes('"outcome":"complete"')),
  ).toBe(true);
});

test('a custom board takes any size', async ({ page }) => {
  await open(page);
  await page.getByTestId('dx-go-custom').click();
  const columns = page.getByTestId('dx-columns');
  await columns.getByRole('button', { name: 'More columns' }).click();
  await columns.getByRole('button', { name: 'More columns' }).click();
  const rows = page.getByTestId('dx-rows');
  for (let i = 0; i < 3; i++) await rows.getByRole('button', { name: 'Fewer rows' }).click();
  await page.getByRole('radio', { name: /Greedy Gus/ }).check();
  await page.getByTestId('dx-custom-start').click();
  await expect(page.getByTestId('dx-intro')).toContainText('7 × 2 boxes');
  await page.getByTestId('dx-start').click();
  const frame = (await page.evaluate('window.__dx.play().frame')) as {
    columns: number;
    rows: number;
  };
  expect([frame.columns, frame.rows]).toEqual([7, 2]);
  await playOut(page);
  await expect(page.getByTestId('dx-results')).toBeVisible({ timeout: 15_000 });
});

test('the Daily Board ends with a share line', async ({ page }) => {
  await open(page);
  await page.getByTestId('dx-go-daily').click();
  await expect(page.getByTestId('dx-intro')).toContainText('same dozen lines');
  await page.getByTestId('dx-start').click();
  await playOut(page);
  const results = page.getByTestId('dx-results');
  await expect(results).toContainText('this one counts', { timeout: 20_000 });
  await results.locator('[data-choice="share"]').click();
  await expect
    .poll(async () =>
      ((await page.evaluate('window.__log')) as string[]).find((l) => l.startsWith('share')),
    )
    .toMatch(/^share Double Cross #\d+ · \d+–\d+ · ✂️\d+$/);
});

test.describe('the ways out', () => {
  test('the game menu asks before leaving a game in progress', async ({ page }) => {
    await open(page);
    await startLadderMatch(page);
    await page.evaluate('window.__dx.play().play(0)');
    await page.getByTestId('dx-menu').click();
    const confirm = page.getByTestId('dx-confirm');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Keep playing' }).click();
    await expect(confirm).toBeHidden();
    await page.getByTestId('dx-menu').click();
    await page.getByTestId('dx-confirm').getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByTestId('dx-title')).toBeVisible();
  });

  test('a won match opens the next; R plays again and H goes back to the Hall', async ({
    page,
  }) => {
    await open(page);
    await startLadderMatch(page, 1);
    await playOut(page);
    const results = page.getByTestId('dx-results');
    await expect(results).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('KeyR');
    await expect(page.getByTestId('dx-intro')).toContainText('match 1 of 10');
    await page.getByTestId('dx-start').click();
    await playOut(page);
    await expect(results).toBeVisible({ timeout: 15_000 });
    if (await results.locator('[data-choice="next"]').count()) {
      await expect(results).toContainText('Match won!');
    }
    await page.keyboard.press('KeyH');
    await expect.poll(() => page.evaluate('window.__log.includes("navigate hall")')).toBe(true);
  });

  test('the game menu is where the Hall offers its way back', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: '← Back to the Hall' })).toBeVisible();
    await page.getByTestId('dx-go-puzzles').click();
    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('dx-title')).toBeVisible();
  });
});
