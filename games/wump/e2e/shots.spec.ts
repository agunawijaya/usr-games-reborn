import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailySeed } from '@usr-games/kit';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { isMagic, tunnelsFrom } from '../src/engine/cave';
import { CAMPAIGN } from '../src/engine/campaign';
import { dailyExpedition } from '../src/engine/daily';
import { HALL_PORT } from './ports';

/**
 * Screens of the whole game for the docs and the critique rounds, in both looks:
 * `pnpm exec playwright test -c games/wump --grep @shots`. `SHOTS_OUT=<folder>` writes somewhere
 * else, `SHOTS_SIZE=1920` takes them at 1920 × 1080 instead of 1280 × 720.
 */

const out =
  process.env.SHOTS_OUT ?? fileURLToPath(new URL('../docs/media/screens/', import.meta.url));
const size =
  process.env.SHOTS_SIZE === '1920' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
const LOOKS = [
  { appearance: 'light', file: 'scrap-paper' },
  { appearance: 'dark', file: 'lantern-dark' },
] as const;
const DATE = '2026-10-04';

/** The screens the docs keep; a run with `SHOTS_OUT` writes every screen, for critique rounds. */
const DOCS = new Set([
  'in-the-hall',
  'menu-in-the-hall',
  'title',
  'trail',
  'play',
  'notebook',
  'aim',
  'ride',
  'results',
  'bowled-over',
  'custom',
  'tutorial',
]);

async function shot(page: Page, name: string, look: string) {
  if (!process.env.SHOTS_OUT && !DOCS.has(name)) return;
  await page.mouse.move(size.width - 2, size.height - 2);
  await page.waitForTimeout(250);
  const file = `${name}-${look}${size.width === 1920 ? '-1920' : ''}.webp`;
  const kb = await saveScreenshot(page, join(out, file));
  console.log(`${file} ${kb} KB`);
}

/** Opens the workbench with the first six expeditions done, so the trail and records have something to show. */
async function open(page: Page, appearance: string) {
  await page.setViewportSize(size);
  await page.goto(`/?game=1&mute=1&appearance=${appearance}&date=${DATE}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  const caves = Object.fromEntries(
    CAMPAIGN.slice(0, 6).map((cave, i) => [
      cave.id,
      {
        stars: [3, 2, 3, 1, 2, 1][i],
        bestScore: 120 + i * 9,
        fewestMoves: 6 + i,
        tries: 1 + (i % 3),
        hushes: 1,
      },
    ]),
  );
  await page.evaluate((data) => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'usr-games:wump-workbench:progress',
      JSON.stringify({ v: 1, savedAt: '', data: { tutorialDone: true, caves: data } }),
    );
  }, caves);
  await page.reload();
  await page.waitForFunction(() => window.__sceneReady === true);
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
  await page.waitForTimeout(400);
}

/** A route through calm rooms to a room next to the wumpus in the day's cave. */
function dailyPlan() {
  const expedition = dailyExpedition(dailySeed('wump', DATE));
  const { cave } = expedition;
  const calm = (room: number) =>
    !expedition.pits[room] && !expedition.bats[room] && room !== expedition.wumpus;
  const previous = new Map<number, number>([[expedition.player, 0]]);
  const queue = [expedition.player];
  while (queue.length > 0) {
    const room = queue.shift()!;
    if (tunnelsFrom(cave, room).includes(expedition.wumpus)) {
      const route: number[] = [];
      for (let at = room; at !== expedition.player; at = previous.get(at)!) route.unshift(at);
      const onward = tunnelsFrom(cave, expedition.wumpus).filter(
        (r) => r !== room && !isMagic(cave, r),
      );
      return { route, wumpus: expedition.wumpus, beyond: onward[0]! };
    }
    for (const next of tunnelsFrom(cave, room)) {
      if (isMagic(cave, next) || previous.has(next) || !calm(next)) continue;
      previous.set(next, room);
      queue.push(next);
    }
  }
  throw new Error(`No calm route on ${DATE}.`);
}

async function walk(page: Page, to: number) {
  await page.getByRole('button', { name: new RegExp(`^Walk to room ${to}\\b`) }).click();
  await expect(page.locator('.hw-room__name')).toHaveText(`Room ${to}`);
  await page.waitForTimeout(700);
}

for (const { appearance, file } of LOOKS) {
  test(`screens in ${file} @shots`, async ({ page }) => {
    test.setTimeout(180_000);
    page.on('pageerror', (error) =>
      console.log(`[pageerror] ${error.message}
${error.stack}`),
    );
    await open(page, appearance);
    await shot(page, 'title', file);
    await page.getByRole('button', { name: /Expeditions/ }).click();
    await shot(page, 'trail', file);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Records/ }).click();
    await shot(page, 'records', file);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /How to play/ }).click();
    await shot(page, 'how-to-play', file);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Custom Cave/ }).click();
    await shot(page, 'custom', file);
    await page.keyboard.press('Escape');

    const plan = dailyPlan();
    await page.getByRole('button', { name: /Daily Cave/ }).click();
    await shot(page, 'daily', file);
    await page.getByRole('button', { name: 'Explore today’s cave' }).click();
    for (const room of plan.route) await walk(page, room);
    await shot(page, 'play', file);
    await page.keyboard.press('m');
    await shot(page, 'map-view', file);
    await page.keyboard.press('m');
    await page.keyboard.press('n');
    await page.getByRole('button', { name: `Notebook marks for room ${plan.wumpus}` }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Wumpus\?/ })
      .click();
    await shot(page, 'notebook', file);
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('a');
    await page.getByRole('button', { name: `Aim the dart at room ${plan.wumpus}` }).click();
    await shot(page, 'aim', file);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    await shot(page, 'ride', file);
    await page.keyboard.press('Space');
    await page.waitForTimeout(2600);
    await shot(page, 'hushed', file);
    if ((await page.locator('.hw-results').count()) === 0) await page.keyboard.press('Space');
    await expect(page.locator('.hw-results__title')).toHaveText('Hushed!');
    await shot(page, 'results', file);

    // The same cave again, this time walking straight into the wumpus.
    await page.keyboard.press('r');
    for (const room of plan.route) await walk(page, room);
    await page.getByRole('button', { name: new RegExp(`^Walk to room ${plan.wumpus}\\b`) }).click();
    await expect(page.locator('.hw-results')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(600);
    await shot(page, 'bowled-over', file);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Tutorial/ }).click();
    await page.waitForTimeout(600);
    await shot(page, 'tutorial', file);
  });
}

test.describe('inside the Hall', () => {
  test.use({ baseURL: `http://localhost:${HALL_PORT}/` });
  for (const { appearance, file } of LOOKS) {
    test(`the game inside the Hall in ${file} @shots`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'wump', { appearance });
      await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(600);
      await shot(page, 'menu-in-the-hall', file);
      await page.getByRole('button', { name: /Tutorial/ }).click();
      await page.keyboard.press('1');
      await expect(page.locator('.hw-room__name')).toHaveText('Room 2');
      await page.waitForTimeout(1200);
      await shot(page, 'in-the-hall', file);
    });
  }
});
