import { createRng, dailyNumber, dailySeed } from '@usr-games/kit';
import { expect, type Page, test } from '@playwright/test';
import { chooseMove } from '../src/engine/bot';
import { continueDash, type Game, move, type MoveEvent, startDash } from '../src/engine/game';
import { type Dir, OPPOSITE, step } from '../src/engine/geometry';
import { PUZZLES } from '../src/gardens/puzzles';
import { dailyGarden } from '../src/modes/daily';
import { gardenGame } from '../src/modes/gardens-play';
import { Tutorial } from '../src/modes/tutorial';

/**
 * The whole game on its workbench (`?game`), played the way a player would: keyboard first, a
 * click or two, through the tutorial, a fill puzzle, a bonk, the Daily Garden and every way out.
 * Where a test needs to know the board, it builds the same game with the engine (same seed, same
 * code) and plans its keys on that.
 */

const FORBIDDEN = /\b(kill\w*|dead|death|dies?|died|blood\w*|hurt\w*|starv\w*)\b/i;
const KEYS: Record<Dir, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

interface WorkbenchLog {
  kind: string;
  value: unknown;
}

async function open(page: Page, query = '') {
  await page.goto(`/?game&mute=1${query}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__sceneReady === true);
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
}

function log(page: Page): Promise<WorkbenchLog[]> {
  return page.evaluate(() => window.__noodleLog ?? []);
}

function stat(page: Page, label: string) {
  return page.locator('.nn-bar .nn-stat', { hasText: label }).locator('.nn-stat__value');
}

async function expectAllAges(page: Page) {
  expect(await page.locator('#app').innerText()).not.toMatch(FORBIDDEN);
}

/** The digit lies straight ahead along a clear line of soil: a dash will reach it. */
function inLine(game: Game): Dir | null {
  const head = game.body[0]!;
  const digit = game.digit;
  if (!digit) return null;
  for (const dir of ['up', 'right', 'down', 'left'] as const) {
    if (game.heading && dir === OPPOSITE[game.heading]) continue;
    let at = head;
    for (let k = 0; k < 9; k++) {
      at = step(at, dir);
      if (at.x === digit.at.x && at.y === digit.at.y)
        return k < (dir === 'up' || dir === 'down' ? 5 : 9) ? dir : null;
      if (game.occupied.has(at.y * game.board.width + at.x)) break;
    }
  }
  return null;
}

test.describe('Noodle Nine on its workbench @game', () => {
  test('the tutorial, played with the keyboard alone, teaches steering, a dash and a chain', async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('.nn-coach__title')).toHaveText('Steer to the number');
    // The same lessons, run beside the page: the house noodle picks each step.
    const tutorial = new Tutorial();
    for (let guard = 0; guard < 120 && tutorial.lesson !== 'done'; guard++) {
      const lesson = tutorial.lesson;
      const dashDir = lesson === 'dash' ? inLine(tutorial.game) : null;
      if (dashDir) {
        const events: MoveEvent[] = [...startDash(tutorial.game, dashDir)];
        tutorial.after(events);
        while (tutorial.game.dashLeft > 0) tutorial.after(continueDash(tutorial.game));
        await page.keyboard.press(`Shift+${KEYS[dashDir]}`);
        await page.waitForTimeout(450);
        continue;
      }
      const dir = chooseMove(tutorial.game)!;
      tutorial.after(move(tutorial.game, dir));
      await page.keyboard.press(KEYS[dir]);
      if (tutorial.lesson !== lesson)
        await expect(page.locator('.nn-coach__title')).not.toHaveText(lessonTitle(lesson));
    }
    await expect(page.locator('.nn-results__title')).toHaveText('Ready for the garden', {
      timeout: 5000,
    });
    await expectAllAges(page);
  });

  test('a garden from the keyboard alone: menu, start, creep, bonk, play again', async ({
    page,
  }) => {
    await open(page, '&reduced=1');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'Twelve beds, one new idea each' }),
    ).toBeVisible();
    // From the back button, the first garden is the next stop.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('.nn-start-hint')).toBeVisible();
    await expect(stat(page, 'Length')).toHaveText('6');
    // Up into the top edge: the noodle creeps on by itself after the first press.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.nn-start-hint')).toHaveCount(0);
    await expect(page.locator('.nn-results__title')).toHaveText('Bonk!', { timeout: 10_000 });
    await expect(page.locator('.nn-results__star')).toHaveCount(3);
    await page.waitForTimeout(700);
    await page.keyboard.press('r');
    await expect(page.locator('.nn-start-hint')).toBeVisible();
    await expectAllAges(page);
  });

  test('a dash stops on the number it reaches', async ({ page }) => {
    // A day whose first number sits straight ahead of the noodle on clear soil.
    const day = new Date(Date.UTC(2026, 9, 1));
    let found: { date: string; distance: number; value: number } | null = null;
    for (let i = 0; i < 400 && !found; i++, day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const seed = dailySeed('worm', date);
      const game = gardenGame(dailyGarden(seed, dailyNumber(date)), createRng(seed));
      const head = game.body[0]!;
      const digit = game.digit!;
      const distance = digit.at.x - head.x;
      if (digit.at.y !== head.y || distance < 3 || distance > 8) continue;
      const clear = Array.from(
        { length: distance },
        (_, k) => game.board.terrain[head.y * game.board.width + head.x + k + 1],
      );
      if (clear.every((t) => t === 'soil')) found = { date, distance, value: digit.value };
    }
    expect(found).not.toBeNull();
    await open(page, `&date=${found!.date}`);
    await page.getByRole('button', { name: /Daily Garden/ }).click();
    await page.getByRole('button', { name: 'Play today’s garden' }).click();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(stat(page, 'Length')).toHaveText(String(6 + found!.value));
    // The dash ended on the bite: no further steps were taken past it.
    expect(Number(await stat(page, 'Score').innerText())).toBeGreaterThan(0);
  });

  test('a fill puzzle filled along its route: chains on the way, three stars at the end', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: 'Fill puzzles' }).click();
    await page.getByRole('button', { name: /^Fill puzzle 1,/ }).click();
    const puzzle = PUZZLES[0]!;
    let sawChain = false;
    for (const ch of puzzle.route) {
      await page.keyboard.press(
        { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[ch]!,
      );
      if ((await page.locator('.nn-bar .nn-chain.is-on').count()) > 0) sawChain = true;
    }
    expect(sawChain).toBe(true);
    await expect(page.locator('.nn-results__title')).toHaveText('Box filled!', { timeout: 6000 });
    await expect(page.locator('.nn-results__star.is-earned')).toHaveCount(3);
    await expect(page.getByRole('button', { name: /Next: Corner Shop/ })).toBeVisible();
  });

  test('a slip in a fill puzzle can be taken back', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Fill puzzles' }).click();
    await page.getByRole('button', { name: /^Fill puzzle 1,/ }).click();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.nn-results__title')).toHaveText('Bonk!', { timeout: 5000 });
    await page.waitForTimeout(700);
    await page.keyboard.press('z');
    await expect(page.locator('.nn-results')).toHaveCount(0);
    await expect(stat(page, 'Moves')).toContainText('1');
  });

  test('the Daily Garden shares a line with no link, and only the first run counts', async ({
    page,
  }) => {
    await open(page, '&date=2026-10-02');
    await page.getByRole('button', { name: /Daily Garden/ }).click();
    await page.getByRole('button', { name: 'Play today’s garden' }).click();
    // Straight up into the top edge.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.nn-results__title')).toHaveText('Bonk!', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Share' }).click();
    const shares = (await log(page)).filter((e) => e.kind === 'share').map((e) => String(e.value));
    expect(shares.at(-1)).toMatch(
      /^Noodle Nine #32 · length \d+ · (best chain ×\d+|no chain yet) · [🟩🟨⬜]{3}$/u,
    );
    expect(shares.at(-1)).not.toMatch(/https?:|www\./);
    const results = (await log(page)).filter((e) => e.kind === 'result');
    expect(results).toHaveLength(1);
    expect(results[0]!.value).toMatchObject({ daily: true, presentation: 'game' });
    // The share sheet may still hold the keyboard here, so leave by the card's own button.
    await page.getByRole('button', { name: 'Game menu' }).last().click();
    await page.getByRole('button', { name: /Daily Garden/ }).click();
    await expect(page.getByRole('button', { name: /Play it again/ })).toBeVisible();
  });

  test('every way out: Escape on the menu, a page, the Game menu button with its question, the results', async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press('Escape');
    expect((await log(page)).some((e) => e.kind === 'navigate' && e.value === 'hall')).toBe(true);
    await page.getByRole('button', { name: 'Records' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Endless' }).click();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Game menu' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
    await page.getByRole('button', { name: 'Endless' }).click();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.nn-results__title')).toHaveText('Bonk!', { timeout: 15_000 });
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    const navigations = (await log(page)).filter((e) => e.kind === 'navigate');
    expect(navigations.at(-1)!.value).toBe('hall');
  });

  test('Escape pauses a run, and the pause menu carries the game’s items', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Endless' }).click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('workbench-pause');
    await expect(pause).toContainText('Classic tempo: off');
    await expect(pause).toContainText('Grid lines: on');
    // Paused, the garden holds perfectly still.
    await page.waitForTimeout(300);
    const canvas = page.locator('.nn-stage canvas');
    const before = await canvas.screenshot();
    await page.waitForTimeout(1200);
    expect((await canvas.screenshot()).equals(before)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
  });
});

function lessonTitle(lesson: Tutorial['lesson']): string {
  return {
    steer: 'Steer to the number',
    dash: 'Dash',
    chain: 'Chain the bites',
    done: 'Ready for the garden',
  }[lesson];
}

declare global {
  interface Window {
    __noodleLog?: { kind: string; value: unknown }[];
    __sceneReady?: boolean;
  }
}
