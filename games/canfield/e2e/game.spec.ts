import { expect, type Page, test } from '@playwright/test';
import {
  challenge,
  commandMove,
  type Cursor,
  dragMove,
  expectResults,
  freshStorage,
  keyboardMove,
  layout,
  openGame,
  settle,
  sourceRect,
  placeRect,
  playProof,
  startChallenge,
  workbenchLog,
} from './table';

/**
 * Thirteen Down on its workbench, played every way it can be played: dragging, clicking, the
 * keyboard alone and the original's typed commands; Insight's price in both scorings; the
 * scoring choice; the play-money account; the Daily's share line; and every way out.
 */

test.beforeEach(async ({ page }) => {
  await freshStorage(page);
  await openGame(page);
});

async function resultFromLog(page: Page) {
  const log = await workbenchLog(page);
  return log.filter((e) => e.kind === 'result').at(-1)?.value as
    { outcome: string; stats: Record<string, number> } | undefined;
}

test('a one-pass challenge played by dragging, to the full bloom', async ({ page }) => {
  const c = challenge('c19');
  await startChallenge(page, c.id);
  await playProof(page, c.proof, (code) => dragMove(page, code));
  await expectResults(page, /In full bloom/);
  const result = await resultFromLog(page);
  expect(result?.outcome).toBe('win');
  expect(result?.stats.cardsHome).toBe(52);
  const packages = (await workbenchLog(page))
    .filter((e) => e.kind === 'package')
    .map((e) => e.value);
  expect(packages).toEqual(expect.arrayContaining(['first-bloom', 'one-pass']));
});

test('the tutorial deal won by clicks alone', async ({ page }) => {
  await page.getByTestId('td-menu-tutorial').click();
  await page.getByTestId('td-play').waitFor();
  await page.getByTestId('td-coach-skip').click();
  for (let i = 0; i < 400; i++) {
    const state = await layout(page);
    if (state.outcome !== null) break;
    if (state.stock.length + state.hand.length + state.talon.length === 0) {
      await settle(page, 300);
      continue;
    }
    // Every click the table offers, and what it would do; the first that leaves the deal
    // winnable is taken (homes first, the deal last).
    const choice = await page.evaluate(() => {
      type Move = { kind: string };
      const w = window as unknown as {
        __tdTable: {
          current: { layout: { tableau: number[][]; stock: number[]; talon: number[] } };
          clickMove(from: unknown, count: number): Move | null;
        };
        __tdAssist: {
          applyMove(l: unknown, m: Move): { layout: unknown } | null;
          solve(l: unknown, o: { nodeBudget: number }): { result: string };
        };
      };
      const l = w.__tdTable.current.layout;
      const options: { from: unknown; depth: number | null; move: Move }[] = [];
      const offer = (from: unknown, depth: number | null, count: number) => {
        const move = w.__tdTable.clickMove(from, count);
        if (move) options.push({ from, depth, move });
      };
      l.tableau.forEach((pile, i) => {
        if (pile.length > 0) offer(i, pile.length - 1, 1);
        if (pile.length > 1) offer(i, 0, pile.length);
      });
      if (l.stock.length) offer('stock', null, 1);
      if (l.talon.length) offer('talon', null, 1);
      options.push({ from: 'hand', depth: null, move: { kind: 'deal' } });
      options.sort((a, b) => Number(b.move.kind === 'home') - Number(a.move.kind === 'home'));
      for (const option of options) {
        const next = w.__tdAssist.applyMove(l, option.move);
        if (next && w.__tdAssist.solve(next.layout, { nodeBudget: 4000 }).result === 'winnable')
          return { from: option.from, depth: option.depth };
      }
      return { from: 'hand', depth: null };
    });
    const rect =
      choice.from === 'hand'
        ? await placeRect(page, 'hand')
        : await sourceRect(page, choice.from as 'stock', choice.depth ?? undefined);
    await page.mouse.click(rect.x + rect.w / 2, rect.y + 14);
    await settle(page, 40);
  }
  await expectResults(page, /In full bloom/);
});

test('a challenge played from the keyboard alone', async ({ page }) => {
  const c = challenge('c21');
  await page.keyboard.press('g');
  await page.getByTestId(`td-challenge-${c.id}`).focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('td-play').waitFor();
  await settle(page);
  const cursor: Cursor = { row: 0, index: 5 };
  await playProof(page, c.proof, (code) => keyboardMove(page, code, cursor));
  await expectResults(page, /In full bloom/);
  await expect(page.locator('.td-results__notes')).toContainText('Challenge done');
});

test('a challenge played in the original’s typed commands', async ({ page }) => {
  const c = challenge('c24');
  await startChallenge(page, c.id);
  await commandMove(page, 'zz');
  await expect(page.getByTestId('td-notice')).toContainText('Moves look like');
  await playProof(page, c.proof, (code) => commandMove(page, code));
  await expectResults(page, /In full bloom/);
});

test('Insight costs a point a card in Points, once each', async ({ page }) => {
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-deal-go').click();
  await page.getByTestId('td-play').waitFor();
  for (let i = 0; i < 4; i++) await page.keyboard.press('d');
  const score = async () => Number(await page.locator('[data-stat="score"] dd').textContent());
  const before = await score();
  await page.keyboard.press('c');
  await expect(page.getByTestId('td-insight')).toBeVisible();
  const listed = Number(await page.getByTestId('td-insight-charged').textContent());
  expect(listed).toBeGreaterThan(0);
  await expect.poll(score).toBe(before - listed);
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await expect.poll(score).toBe(before - listed);
});

test('Insight costs a dollar a card in Bank, in the account book', async ({ page }) => {
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-scoring-bank').check();
  await page.getByTestId('td-deal-go').click();
  await page.getByTestId('td-play').waitFor();
  await expect(page.getByTestId('td-stage')).toContainText('Inspect');
  await page.keyboard.press('i');
  await page.keyboard.press('p');
  for (let i = 0; i < 3; i++) await page.keyboard.press('d');
  await page.keyboard.press('c');
  const listed = Number(await page.getByTestId('td-insight-charged').textContent());
  await page.keyboard.press('l');
  const book = page.getByTestId('td-account-book');
  await expect(book).toBeVisible();
  const row = (label: string) =>
    book
      .locator('tr')
      .filter({ has: page.locator('th', { hasText: new RegExp(`^${label}$`) }) })
      .locator('td')
      .first();
  await expect(row('Insight')).toHaveText(`$${listed}`);
  await expect(row('Deals')).toHaveText('$13');
  await expect(row('Inspections')).toHaveText('$13');
  await expect(row('Games')).toHaveText('$26');
});

test('a change of scoring waits for the next deal', async ({ page }) => {
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-deal-go').click();
  await page.getByTestId('td-play').waitFor();
  await page.keyboard.press('d');
  await settle(page, 200);
  await openGame(page);
  await page.getByTestId('td-menu-settings').click();
  await page.getByTestId('td-settings-scoring-bank').check();
  await page.getByTestId('td-settings-back').click();
  await page.getByTestId('td-menu-continue').click();
  await page.getByTestId('td-play').waitFor();
  // The deal in progress keeps its points.
  await expect(page.locator('[data-stat="score"]')).toBeVisible();
  await commandMove(page, 'q');
  await page.getByTestId('td-confirm-yes').click();
  await expect(page.getByTestId('td-results')).toBeVisible();
  await page.getByTestId('td-results-again').click();
  await page.getByTestId('td-play').waitFor();
  await expect(page.getByTestId('td-stage')).toBeVisible();
  await expect(page.locator('[data-stat="balance"]')).toBeVisible();
});

test('the play-money account resets for nothing', async ({ page }) => {
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-scoring-bank').check();
  await page.getByTestId('td-deal-go').click();
  await page.getByTestId('td-play').waitFor();
  await page.keyboard.press('w');
  await expect(page.getByTestId('td-results')).toBeVisible();
  await expect(page.locator('.td-results__title')).toHaveText('Walked away');
  await page.getByTestId('td-results-menu').click();
  await page.getByTestId('td-menu-settings').click();
  await expect(page.getByTestId('td-reset-bank')).toContainText('now $487');
  await page.getByTestId('td-reset-bank').click();
  await page.getByTestId('td-confirm-yes').click();
  await expect(page.getByTestId('td-reset-bank')).toContainText('now $500');
});

test('the Daily Deal shares a line with no money in it', async ({ page }) => {
  await page.getByTestId('td-menu-daily').click();
  await page.getByTestId('td-daily-play').click();
  await page.getByTestId('td-play').waitFor();
  await page.keyboard.press('d');
  await commandMove(page, 'q');
  await page.getByTestId('td-confirm-yes').click();
  await expect(page.getByTestId('td-results')).toBeVisible();
  await page.getByTestId('td-results-share').click();
  const shared = (await workbenchLog(page)).filter((e) => e.kind === 'share').at(-1)
    ?.value as string;
  expect(shared).toMatch(/^Thirteen Down #\d+ · \d+\/52 · \d+:\d\d · 🔍\d+$/);
  expect(shared).not.toContain('$');
  const result = await resultFromLog(page);
  expect(result).toMatchObject({ daily: true });
});

test('every way out: Escape on the menu, the results’ buttons and keys', async ({ page }) => {
  await page.keyboard.press('Escape');
  expect((await workbenchLog(page)).at(-1)).toEqual({ kind: 'navigate', value: 'hall' });
  await page.getByTestId('td-menu-help').click();
  await expect(page.getByTestId('td-help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('td-title')).toBeVisible();
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-deal-go').click();
  await page.getByTestId('td-play').waitFor();
  await commandMove(page, 'i');
  await expect(page.getByTestId('td-help-back')).toHaveText(/Back to the deal/);
  await page.getByTestId('td-help-back').click();
  await expect(page.getByTestId('td-play')).toBeVisible();
  await commandMove(page, 'q');
  await page.getByTestId('td-confirm-yes').click();
  await expect(page.getByTestId('td-results')).toBeVisible();
  await page.getByTestId('td-results-menu').click();
  await expect(page.getByTestId('td-title')).toBeVisible();
  await page.getByTestId('td-menu-new').click();
  await page.getByTestId('td-deal-go').click();
  await page.getByTestId('td-play').waitFor();
  await commandMove(page, 'q');
  await page.getByTestId('td-confirm-yes').click();
  await expect(page.getByTestId('td-results')).toBeVisible();
  await page.waitForTimeout(700);
  await page.keyboard.press('h');
  expect((await workbenchLog(page)).at(-1)).toEqual({ kind: 'navigate', value: 'hall' });
});
