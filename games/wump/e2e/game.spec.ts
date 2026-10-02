import { dailySeed } from '@usr-games/kit';
import { expect, type Page, test } from '@playwright/test';
import { isMagic, tunnelsFrom } from '../src/engine/cave';
import { dailyExpedition } from '../src/engine/daily';
import { type Expedition, move, type TurnEvent } from '../src/engine/expedition';

/**
 * The whole game on its workbench (`?game=1`), played the way a player would: with the keyboard
 * alone, with the mouse, through wins, losses, a bat ride and a ledge. Daily Caves on fixed dates
 * make every cave known in advance: the test digs the same cave with the engine and plans its
 * moves on it, and the screen must agree with the engine turn by turn.
 */

const FORBIDDEN = /\b(kill\w*|dead|death|dies?|died|eat(s|en)?|shoot\w*|shot|blood)\b/i;

interface WorkbenchLog {
  kind: string;
  value: unknown;
}

async function open(page: Page, query = '') {
  await page.goto(`/?game=1&mute=1${query}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__sceneReady === true);
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
}

function log(page: Page): Promise<WorkbenchLog[]> {
  return page.evaluate(() => window.__wumpLog ?? []);
}

async function expectAllAges(page: Page) {
  const text = await page.locator('#app').innerText();
  expect(text).not.toMatch(FORBIDDEN);
}

function caption(page: Page) {
  return page.locator('.hw-room__name');
}

function stat(page: Page, label: string) {
  return page.locator('.hw-stat', { hasText: label }).locator('.hw-stat__value');
}

async function walk(page: Page, to: number) {
  await page.getByRole('button', { name: new RegExp(`^Walk to room ${to}\\b`) }).click();
  await expect(caption(page)).toHaveText(new RegExp(`\\b${to}\\b|wumpus|den|ledge`, 'i'));
}

/** Rooms you can walk through without meeting anything, and where they lead. */
function safeRoute(expedition: Expedition, goal: (room: number) => boolean): number[] | null {
  const { cave } = expedition;
  const calm = (room: number) =>
    !expedition.pits[room] && !expedition.bats[room] && room !== expedition.wumpus;
  const previous = new Map<number, number>([[expedition.player, 0]]);
  const queue = [expedition.player];
  while (queue.length > 0) {
    const room = queue.shift()!;
    if (goal(room)) {
      const route: number[] = [];
      for (let at = room; at !== expedition.player; at = previous.get(at)!) route.unshift(at);
      return route;
    }
    for (const next of tunnelsFrom(cave, room)) {
      if (isMagic(cave, next) || previous.has(next) || !calm(next)) continue;
      previous.set(next, room);
      queue.push(next);
    }
  }
  return null;
}

/** The first date from 2026-10-01 whose Daily Cave passes `test`, with that test's answer. */
function findDate<T>(test: (expedition: Expedition) => T | null): { date: string; plan: T } {
  const day = new Date(Date.UTC(2026, 9, 1));
  for (let i = 0; i < 400; i++) {
    const date = day.toISOString().slice(0, 10);
    const plan = test(dailyExpedition(dailySeed('wump', date)));
    if (plan !== null) return { date, plan };
    day.setUTCDate(day.getUTCDate() + 1);
  }
  throw new Error('No date fits.');
}

test.describe('Hush the Wumpus on the workbench @game', () => {
  test('the tutorial with the keyboard alone', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: /Continue/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.hw-coach')).toContainText('A quiet room');
    await page.keyboard.press('1');
    await expect(caption(page)).toHaveText('Room 2');
    await expect(page.locator('.hw-coach')).toContainText('A draft, and a whiff');
    await page.keyboard.press('1');
    await page.keyboard.press('3');
    await expect(caption(page)).toHaveText('Room 6');
    await page.keyboard.press('2');
    await expect(caption(page)).toHaveText('Room 7');
    await page.keyboard.press('a');
    await expect(page.getByRole('group', { name: 'Aiming a sleep dart' })).toBeVisible();
    await page.keyboard.press('3');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(page.locator('.hw-banner__word')).toHaveText('Hushed!');
    await page.keyboard.press('Space');
    await expect(page.locator('.hw-results__title')).toHaveText('Hushed!');
    await expect(page.locator('.hw-results__button.is-primary')).toBeFocused();
    await expectAllAges(page);
    const entries = await log(page);
    const result = entries.find((entry) => entry.kind === 'result')?.value as {
      outcome: string;
      stats: { moves: number };
    };
    expect(result.outcome).toBe('win');
    expect(result.stats.moves).toBe(4);
    expect(
      entries.filter((entry) => entry.kind === 'package').map((entry) => entry.value),
    ).toContain('first-hush');

    // R plays the same kind of expedition again; Escape pauses; Escape again resumes.
    await page.keyboard.press('r');
    await expect(page.locator('.hw-coach')).toContainText('A quiet room');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('workbench-pause')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('workbench-pause')).toBeHidden();
  });

  test('the tutorial with the mouse, and the notebook', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Tutorial/ }).click();
    await walk(page, 2);
    // The notebook: a mark on room 3, through its tunnel's mouth.
    await page.keyboard.press('n');
    await page.getByRole('button', { name: 'Notebook marks for room 3' }).click();
    const marks = page.getByRole('dialog', { name: 'Notebook marks for room 3' });
    await marks.getByRole('button', { name: /Pit\?/ }).click();
    await expect(marks.getByRole('button', { name: /Pit\?/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await marks.getByRole('button', { name: 'Done' }).click();
    await page.keyboard.press('Escape');
    await walk(page, 1);
    await walk(page, 6);
    await walk(page, 7);
    // Right-click the chamber to aim, then pick the tunnel to 8 and throw.
    await page.locator('.hw-room').click({ button: 'right', position: { x: 40, y: 40 } });
    await page.getByRole('button', { name: 'Aim the dart at room 8' }).click();
    await page.getByRole('button', { name: /^Throw/ }).click();
    await page.locator('.hw-ride').click();
    await page.locator('.hw-banner').click();
    await expect(page.locator('.hw-results__title')).toHaveText('Hushed!');
    await page.getByRole('button', { name: /Back to the Hall/ }).click();
    expect(
      (await log(page)).some((entry) => entry.kind === 'navigate' && entry.value === 'hall'),
    ).toBe(true);
  });

  test('a dart path of five rooms, and no more', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Tutorial/ }).click();
    await page.keyboard.press('a');
    // Rooms beyond the known tunnels are typed by number, one after another.
    await page.getByRole('textbox', { name: 'Add a room by its number' }).focus();
    for (const room of ['6', '7', '8', '9', '10', '5']) {
      await page.keyboard.type(room);
      await page.keyboard.press('Enter');
    }
    const path = page.getByRole('group', { name: 'Aiming a sleep dart' }).locator('.hw-aim__hop');
    // The explorer's own room, then five rooms: the sixth is refused.
    await expect(path).toHaveCount(6);
    await expect(page.locator('.hw-toast')).toContainText('Five rooms');
    await page.locator('body').click({ position: { x: 5, y: 700 } });
    await page.keyboard.press('Backspace');
    await expect(path).toHaveCount(5);
    await page.getByRole('textbox', { name: 'Add a room by its number' }).fill('2');
    await page.keyboard.press('Enter');
    await expect(path).toHaveCount(6);
    await page.locator('body').click({ position: { x: 5, y: 700 } });
    await page.keyboard.press('Enter');
    // Past the third room the string may snap and past the fourth the dart may waver: 3 to 5 hops.
    await expect(page.locator('.hw-ride__chip').nth(3)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('.hw-log__line', { hasText: /dart/i })).toBeVisible();
  });

  test('a Daily Cave hushed along a planned route, then shared', async ({ page }) => {
    const { date, plan } = findDate((expedition) => {
      const route = safeRoute(expedition, (room) =>
        tunnelsFrom(expedition.cave, room).includes(expedition.wumpus),
      );
      return route && route.length >= 2 ? { route, wumpus: expedition.wumpus } : null;
    });
    await open(page, `&date=${date}&appearance=dark`);
    await page.getByRole('button', { name: /Daily Cave/ }).click();
    await page.getByRole('button', { name: 'Explore today’s cave' }).click();
    for (const room of plan.route) await walk(page, room);
    await expect(page.locator('.hw-sense--whiff')).toHaveClass(/is-on/);
    await page.keyboard.press('a');
    await page.getByRole('button', { name: `Aim the dart at room ${plan.wumpus}` }).click();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect(page.locator('.hw-results__title')).toHaveText('Hushed!');
    await expect(page.locator('.hw-results__kicker')).toContainText('Daily Cave #');
    await page.getByRole('button', { name: 'Share' }).click();
    const shared = (await log(page)).find((entry) => entry.kind === 'share')?.value as string;
    expect(shared).toContain(`hushed in ${plan.route.length} moves`);
    await expectAllAges(page);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Daily Cave/ }).click();
    await expect(page.locator('.hw-daily__result')).toHaveText(
      `You hushed today’s wumpus in ${plan.route.length} moves.`,
    );
  });

  test('walking into the wumpus ends the expedition kindly', async ({ page }) => {
    const { date, plan } = findDate((expedition) => {
      const route = safeRoute(expedition, (room) =>
        tunnelsFrom(expedition.cave, room).includes(expedition.wumpus),
      );
      return route ? [...route, expedition.wumpus] : null;
    });
    await open(page, `&date=${date}`);
    await page.getByRole('button', { name: /Daily Cave/ }).click();
    await page.getByRole('button', { name: 'Explore today’s cave' }).click();
    for (const room of plan.slice(0, -1)) await walk(page, room);
    await page.getByRole('button', { name: new RegExp(`^Walk to room ${plan.at(-1)}\\b`) }).click();
    await expect(page.locator('.hw-results')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.hw-results')).toHaveClass(/is-lost/);
    await expectAllAges(page);
    const result = (await log(page)).find((entry) => entry.kind === 'result')?.value as {
      outcome: string;
    };
    expect(result.outcome).toBe('loss');
    await page.keyboard.press('h');
    expect(
      (await log(page)).some((entry) => entry.kind === 'navigate' && entry.value === 'hall'),
    ).toBe(true);
  });

  test('bats carry you where the engine says', async ({ page }) => {
    const { date, plan } = findDate((expedition) => {
      const roostNear = (room: number) =>
        tunnelsFrom(expedition.cave, room).find((to) => expedition.bats[to]);
      const route = safeRoute(expedition, (room) => roostNear(room) !== undefined);
      if (!route) return null;
      for (const room of route) move(expedition, room);
      const roost = roostNear(expedition.player)!;
      const events: TurnEvent[] = move(expedition, roost);
      const ride = events.find((event) => event.kind === 'carried');
      return ride && !expedition.ending ? { route, roost, landing: expedition.player } : null;
    });
    await open(page, `&date=${date}`);
    await page.getByRole('button', { name: /Daily Cave/ }).click();
    await page.getByRole('button', { name: 'Explore today’s cave' }).click();
    for (const room of plan.route) await walk(page, room);
    await page.getByRole('button', { name: new RegExp(`^Walk to room ${plan.roost}\\b`) }).click();
    await expect(stat(page, 'Bat rides')).toHaveText('1');
    await expect(caption(page)).toHaveText(`Room ${plan.landing}`, { timeout: 10_000 });
  });

  test('a pit with a ledge leaves you standing', async ({ page }) => {
    const { date, plan } = findDate((expedition) => {
      const pitNear = (room: number) =>
        tunnelsFrom(expedition.cave, room).find((to) => expedition.pits[to]);
      const route = safeRoute(expedition, (room) => pitNear(room) !== undefined);
      if (!route) return null;
      for (const room of route) move(expedition, room);
      const pit = pitNear(expedition.player)!;
      const events = move(expedition, pit);
      return events.some((event) => event.kind === 'ledge') ? { route, pit } : null;
    });
    await open(page, `&date=${date}`);
    await page.getByRole('button', { name: /Daily Cave/ }).click();
    await page.getByRole('button', { name: 'Explore today’s cave' }).click();
    for (const room of plan.route) await walk(page, room);
    await page.getByRole('button', { name: new RegExp(`^Walk to room ${plan.pit}\\b`) }).click();
    await expect(page.locator('.hw-log', { hasText: /ledge/i })).toBeVisible();
    await expect(caption(page)).toHaveText(`Room ${plan.pit}`);
    await expect(page.locator('.hw-results')).toHaveCount(0);
  });

  test('leaving an expedition asks first', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Expeditions/ }).click();
    await page.getByRole('button', { name: /Expedition 1:/ }).click();
    await page.getByRole('button', { name: 'Game menu' }).click();
    const question = page.getByRole('alertdialog', { name: 'Leave this expedition?' });
    await expect(question.getByRole('button', { name: 'Keep exploring' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(question).toHaveCount(0);
    await expect(caption(page)).toBeVisible();
    await page.getByRole('button', { name: 'Game menu' }).click();
    await question.getByRole('button', { name: 'Leave' }).click();
    await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
    expect((await log(page)).some((entry) => entry.kind === 'result')).toBe(false);
  });

  test('Classic rules from the settings', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Settings/ }).click();
    await page.getByRole('radio', { name: /Classic/ }).check();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Settings/ })).toContainText('Classic rules');
    await page.getByRole('button', { name: /Expeditions/ }).click();
    await page.getByRole('button', { name: /Expedition 1:/ }).click();
    await expect(page.locator('.hw-chip--rules')).toHaveText('Classic rules');
  });

  test('the custom cave refuses what the original refused', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Custom Cave/ }).click();
    const tunnels = page.getByRole('slider', { name: 'Tunnels from each room' });
    await tunnels.fill('25');
    await expect(page.locator('.hw-refusal')).toHaveClass(/is-refusing/);
    await expect(page.getByRole('button', { name: 'Dig this cave' })).toBeDisabled();
    await tunnels.fill('3');
    await expect(page.getByRole('button', { name: 'Dig this cave' })).toBeEnabled();
    await page.getByRole('button', { name: 'Dig this cave' }).click();
    await expect(page.locator('.hw-title__chapter')).toHaveText('Custom cave');
  });
});
