import { dailySeed } from '@usr-games/kit';
import { expect, type Page, test } from '@playwright/test';
import { plunge } from '../src/engine/game';
import { dailyGame } from '../src/modes/daily';

/**
 * The whole game on its workbench (`?game`), played the way a player would: keyboard first,
 * through the tutorial, both rule sets, a plunge, a burst, the Daily Dive and every way out. Where
 * a test needs to know the sinkers, it builds the same game with the engine (same seed, same code).
 */

const UNKIND = /\b(kill\w*|dead|death|dies?|died|blood\w*|hurt\w*|drown\w*)\b/i;
const DATE = '2026-10-02';

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
  return page.evaluate(() => window.__sinkersLog ?? []);
}

function stat(page: Page, label: string) {
  return page.locator('.snk-bar .snk-stat', { hasText: label }).locator('.snk-stat__value');
}

async function expectAllAges(page: Page) {
  expect(await page.locator('#app').innerText()).not.toMatch(UNKIND);
}

/** Plunges until the tank fills and the card comes up. */
async function fillTheTank(page: Page) {
  for (let i = 0; i < 80; i++) {
    if ((await page.locator('.snk-results__title').count()) > 0) break;
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
  await expect(page.locator('.snk-results__title')).toBeVisible({ timeout: 15_000 });
  // Keys held from play are kept off the card for a moment.
  await page.waitForTimeout(700);
}

test.describe('Sinkers on its workbench @game', () => {
  test('the tutorial from the keyboard alone: menu, three lessons, a burst, the card', async ({
    page,
  }) => {
    await open(page);
    // Continue is focused and, the first time, starts the tutorial.
    await page.keyboard.press('Enter');
    await expect(page.locator('.snk-coach__title')).toHaveText('Slide and turn');
    // The tee hangs over the gap: two turns and a sink fill the bottom row, which bursts.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.down('ArrowDown');
    await expect(page.locator('.snk-coach__title')).toHaveText('Plunge', { timeout: 10_000 });
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(1300);
    await page.keyboard.press('Space');
    await expect(page.locator('.snk-coach__title')).toHaveText('Four at once', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(page.locator('.snk-results__title')).toHaveText('Ready to dive', {
      timeout: 10_000,
    });
    await expectAllAges(page);
  });

  test('a plunge scores twice the rows it falls, times the level, plus its landing', async ({
    page,
  }) => {
    await open(page, `&date=${DATE}`);
    await page.getByRole('button', { name: /^Daily Dive/ }).click();
    await page.getByRole('button', { name: 'Dive today’s tank' }).click();
    await page.keyboard.press('Space');
    const game = dailyGame(dailySeed('blocks', DATE));
    plunge(game);
    await expect(stat(page, 'Score')).toHaveText(game.points.toLocaleString('en-GB'));
    await expect(stat(page, 'Sinkers')).toContainText('1');
  });

  test('Standard rules: a dive played out to a full tank, its stars, play again', async ({
    page,
  }) => {
    await open(page, '&reduced=1');
    await page.getByRole('button', { name: /^Dives/ }).click();
    await page.getByRole('button', { name: /^Dive 1,/ }).click();
    await expect(stat(page, 'Rows')).toContainText('0');
    await fillTheTank(page);
    await expect(page.locator('.snk-results__title')).toHaveText('The tank is full');
    await expect(page.locator('.snk-results__star')).toHaveCount(3);
    await page.keyboard.press('r');
    await expect(page.locator('.snk-context')).toContainText('Dive 1');
    await expectAllAges(page);
  });

  test('Classic 1992: left turns only, points times the level at the end', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /^Classic 1992/ }).click();
    await page.getByRole('radio', { name: 'Level 3' }).click();
    await page.getByRole('button', { name: 'Play at level 3' }).click();
    await expect(stat(page, 'Turns')).toHaveText('↺ only');
    await fillTheTank(page);
    await expect(page.locator('.snk-results__title')).toHaveText('The well is full');
    const value = (label: string) =>
      page.locator('.snk-results__stat', { hasText: label }).locator('dd').innerText();
    const points = Number((await value('Points')).replace(/,/g, ''));
    expect(Number((await value('Score')).replace(/,/g, ''))).toBe(points * 3);
    expect(points).toBeGreaterThan(0);
  });

  test('the Daily Dive shares a line with no link, and only the first dive counts', async ({
    page,
  }) => {
    await open(page, `&date=${DATE}`);
    await page.getByRole('button', { name: /^Daily Dive/ }).click();
    await page.getByRole('button', { name: 'Dive today’s tank' }).click();
    await fillTheTank(page);
    await page.getByRole('button', { name: 'Share' }).click();
    const shares = (await log(page)).filter((e) => e.kind === 'share').map((e) => String(e.value));
    expect(shares.at(-1)).toMatch(
      /^Sinkers #32 · [\d,]+ · (deepest combo ×\d+|no combo yet) · [🫧○]{3}$/u,
    );
    expect(shares.at(-1)).not.toMatch(/https?:|www\./);
    const results = (await log(page)).filter((e) => e.kind === 'result');
    expect(results).toHaveLength(1);
    expect(results[0]!.value).toMatchObject({ daily: true, presentation: 'game' });
    await page.getByRole('button', { name: 'Game menu' }).last().click();
    await page.getByRole('button', { name: /^Daily Dive/ }).click();
    await expect(page.getByRole('button', { name: /Dive it again/ })).toBeVisible();
  });

  test('every way out: Escape on the menu, a page, the Game menu with its question, the card', async ({
    page,
  }) => {
    await open(page);
    await page.keyboard.press('Escape');
    expect((await log(page)).some((e) => e.kind === 'navigate' && e.value === 'hall')).toBe(true);
    await page.getByRole('button', { name: /^Records/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
    await page.getByRole('button', { name: /^Marathon/ }).click();
    await page.getByRole('button', { name: /^Dive at level/ }).click();
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Game menu' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Game menu' }).click();
    await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
    await page.getByRole('button', { name: /^Marathon/ }).click();
    await page.getByRole('button', { name: /^Dive at level/ }).click();
    await fillTheTank(page);
    await page.keyboard.press('h');
    const navigations = (await log(page)).filter((e) => e.kind === 'navigate');
    expect(navigations.at(-1)!.value).toBe('hall');
  });

  test('Escape pauses a run, the pause menu carries the sonar, and the tank holds still', async ({
    page,
  }) => {
    await open(page);
    await page.getByRole('button', { name: /^Marathon/ }).click();
    await page.getByRole('button', { name: /^Dive at level/ }).click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');
    const pause = page.getByTestId('workbench-pause');
    await expect(pause).toContainText('Sonar: on');
    await page.waitForTimeout(300);
    const canvas = page.locator('.snk-stage canvas');
    const before = await canvas.screenshot();
    await page.waitForTimeout(1200);
    expect((await canvas.screenshot()).equals(before)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(pause).toBeHidden();
  });
});

declare global {
  interface Window {
    __sinkersLog?: { kind: string; value: unknown }[];
  }
}
