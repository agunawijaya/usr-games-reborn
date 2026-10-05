import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/**
 * Helpers for driving the table in a browser: open the workbench, start a challenge, and play
 * one move of a challenge's proof by dragging, from the keyboard or by typing the original's
 * command. The table is reached through the workbench's development hook (`__tdTable`).
 */

export interface ChallengeData {
  id: string;
  number: number;
  title: string;
  rules: 'standard' | 'relaxed';
  proof: string[];
}

export const CHALLENGES: ChallengeData[] = JSON.parse(
  readFileSync(new URL('../src/modes/challenges.json', import.meta.url), 'utf8'),
) as ChallengeData[];

export function challenge(id: string): ChallengeData {
  return CHALLENGES.find((c) => c.id === id)!;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type From = 'stock' | 'talon' | number;

interface Decoded {
  kind: 'deal' | 'home' | 'build';
  from?: From;
  to?: number;
  count?: number;
}

export function decode(code: string): Decoded {
  if (code === 'd') return { kind: 'deal' };
  const source = (c: string): From => (c === 's' ? 'stock' : c === 't' ? 'talon' : Number(c) - 1);
  const from = source(code[0]!);
  if (code[1] === 'f') return { kind: 'home', from };
  const count = code.includes(':') ? Number(code.split(':')[1]) : 1;
  return { kind: 'build', from, to: Number(code[1]) - 1, count };
}

/** Opens the whole game on the workbench, with motion reduced so moves land at once. */
export async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`/?game=1&mute=1&reduced=1${query}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  await page.getByTestId('td-title').waitFor();
}

/** A clean slate for each test: the workbench's saves live in this origin's storage. */
export async function freshStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('td-fresh')) {
      localStorage.clear();
      sessionStorage.setItem('td-fresh', '1');
    }
  });
}

export async function startChallenge(page: Page, id: string): Promise<void> {
  await page.getByTestId('td-menu-challenges').click();
  await page.getByTestId(`td-challenge-${id}`).click();
  await page.getByTestId('td-play').waitFor();
  await settle(page);
}

export async function settle(page: Page, ms = 60): Promise<void> {
  await page.waitForTimeout(ms);
}

export function layout(page: Page) {
  return page.evaluate(() => {
    const table = (
      window as unknown as { __tdTable: { current: { layout: Record<string, unknown> } } }
    ).__tdTable;
    return table.current.layout as {
      stock: number[];
      talon: number[];
      hand: number[];
      tableau: number[][];
      foundations: number[][];
      outcome: string | null;
      stage: string;
      run: number;
    };
  });
}

export function placeRect(page: Page, kind: string, index?: number): Promise<Rect> {
  return page.evaluate(
    ([k, i]) =>
      (window as unknown as { __tdTable: { placeRect(p: unknown): Rect } }).__tdTable.placeRect(
        i === null ? { kind: k } : { kind: k, index: i },
      ),
    [kind, index ?? null] as const,
  );
}

export function sourceRect(page: Page, from: From, depth?: number): Promise<Rect> {
  return page.evaluate(
    ([f, d]) =>
      (
        window as unknown as { __tdTable: { sourceRect(f: unknown, d?: number): Rect } }
      ).__tdTable.sourceRect(f, d === null ? undefined : d),
    [from, depth ?? null] as const,
  );
}

/** The foundation a card from this source would go to. */
async function foundationFor(page: Page, from: From): Promise<number> {
  const state = await layout(page);
  const card =
    from === 'stock'
      ? state.stock.at(-1)!
      : from === 'talon'
        ? state.talon.at(-1)!
        : state.tableau[from]!.at(-1)!;
  const suit = Math.floor(card / 13);
  return state.foundations.findIndex((pile) => Math.floor(pile.at(-1)! / 13) === suit);
}

const centreTop = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + 14 });

async function dragBetween(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(
      start.x + ((end.x - start.x) * i) / 8,
      start.y + ((end.y - start.y) * i) / 8,
    );
  await page.mouse.up();
}

function movesMade(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __tdTable: { current: { counters: { moves: number } } } }).__tdTable
        .current.counters.moves,
  );
}

/** Plays a move with `play`, and fails at once if the table did not take it. */
export async function expectMove(
  page: Page,
  code: string,
  play: () => Promise<void>,
): Promise<void> {
  const before = await movesMade(page);
  await play();
  const after = await movesMade(page);
  // The sweep home may already be making moves of its own after this one.
  expect(after, `the move ${code} was not made`).toBeGreaterThan(before);
}

/**
 * Plays a challenge's proof move by move until the deal ends or the sweep home takes over
 * (nothing left in the reserve, hand or talon).
 */
export async function playProof(
  page: Page,
  proof: readonly string[],
  play: (code: string) => Promise<void>,
): Promise<void> {
  for (const code of proof) {
    const state = await layout(page);
    if (
      state.outcome !== null ||
      (state.stock.length === 0 && state.hand.length === 0 && state.talon.length === 0)
    )
      return;
    await expectMove(page, code, () => play(code));
  }
}

/** Plays one move of a proof by dragging (and clicking the hand to deal). */
export async function dragMove(page: Page, code: string): Promise<void> {
  const move = decode(code);
  if (move.kind === 'deal') {
    const hand = await placeRect(page, 'hand');
    await page.mouse.click(hand.x + hand.w / 2, hand.y + hand.h / 2);
    return settle(page);
  }
  const state = await layout(page);
  const from = move.from!;
  const length = typeof from === 'number' ? state.tableau[from]!.length : 1;
  const count = move.kind === 'build' ? move.count! : 1;
  const start = centreTop(
    await sourceRect(page, from, typeof from === 'number' ? length - count : undefined),
  );
  let end: { x: number; y: number };
  if (move.kind === 'home')
    end = centreTop(await placeRect(page, 'foundation', await foundationFor(page, from)));
  else {
    const to = move.to!;
    const target = await sourceRect(page, to);
    end = {
      x: target.x + target.w / 2,
      y: target.y + 14 + (state.tableau[to]!.length > 0 ? target.h * 0.24 : 0),
    };
  }
  await dragBetween(page, start, end);
  await settle(page);
}

/** Plays one move by typing it in the command bar, as in the original. */
export async function commandMove(page: Page, code: string): Promise<void> {
  const typed = code === 'd' ? 'ht' : code.split(':')[0]!;
  await page.keyboard.press('/');
  await page.keyboard.type(typed);
  await page.keyboard.press('Enter');
  await settle(page);
}

const TOP_ROW = ['stock', 'f0', 'f1', 'f2', 'f3', 'talon', 'hand'];

export interface Cursor {
  row: number;
  index: number;
}

async function moveCursor(page: Page, cursor: Cursor, row: number, index: number): Promise<void> {
  if (cursor.row !== row) {
    await page.keyboard.press(row === 1 ? 'ArrowDown' : 'ArrowUp');
    cursor.index = cursor.row === 0 ? Math.max(0, Math.min(3, cursor.index - 1)) : cursor.index + 1;
    cursor.row = row;
  }
  while (cursor.index < index) {
    await page.keyboard.press('ArrowRight');
    cursor.index++;
  }
  while (cursor.index > index) {
    await page.keyboard.press('ArrowLeft');
    cursor.index--;
  }
}

function placeOf(from: From): { row: number; index: number } {
  if (from === 'stock') return { row: 0, index: 0 };
  if (from === 'talon') return { row: 0, index: TOP_ROW.indexOf('talon') };
  return { row: 1, index: from };
}

/** Plays one move with the keyboard cursor: arrows, Enter to pick up, Enter to put down; D deals. */
export async function keyboardMove(page: Page, code: string, cursor: Cursor): Promise<void> {
  const move = decode(code);
  if (move.kind === 'deal') {
    await page.keyboard.press('d');
    return settle(page);
  }
  const source = placeOf(move.from!);
  const target =
    move.kind === 'home'
      ? { row: 0, index: 1 + (await foundationFor(page, move.from!)) }
      : { row: 1, index: move.to! };
  await moveCursor(page, cursor, source.row, source.index);
  await page.keyboard.press('Enter');
  await moveCursor(page, cursor, target.row, target.index);
  await page.keyboard.press('Enter');
  await settle(page);
}

export async function expectResults(page: Page, title: RegExp): Promise<void> {
  await expect(page.getByTestId('td-results')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.td-results__title')).toHaveText(title);
}

export function workbenchLog(page: Page) {
  return page.evaluate(() => window.__tdLog ?? []);
}
