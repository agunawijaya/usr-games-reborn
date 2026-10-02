import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng, dailyNumber, dailySeed } from '@usr-games/kit';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { chooseMove } from '../src/engine/bot';
import { move } from '../src/engine/game';
import type { Dir } from '../src/engine/geometry';
import { GARDENS } from '../src/gardens/gardens';
import { PUZZLES } from '../src/gardens/puzzles';
import { dailyGarden } from '../src/modes/daily';
import { gardenGame } from '../src/modes/gardens-play';
import { HALL_PORT } from './ports';

/**
 * Screens of the whole game for the docs and the critique rounds, in both looks:
 * `pnpm exec playwright test -c games/worm --grep @shots`. `SHOTS_OUT=<folder>` writes somewhere
 * else, `SHOTS_SIZE=1920` takes them at 1920 × 1080 instead of 1280 × 720.
 */

const out =
  process.env.SHOTS_OUT ?? fileURLToPath(new URL('../docs/media/screens/', import.meta.url));
const size =
  process.env.SHOTS_SIZE === '1920' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
const LOOKS = [
  { appearance: 'light', file: 'garden-bed' },
  { appearance: 'dark', file: 'glow-soil' },
] as const;
const DATE = '2026-10-04';
const KEYS: Record<Dir, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

async function shot(page: Page, name: string, look: string) {
  await page.mouse.move(size.width - 2, size.height - 2);
  await page.waitForTimeout(250);
  const file = `${name}-${look}${size.width === 1920 ? '-1920' : ''}.webp`;
  const kb = await saveScreenshot(page, join(out, file));
  console.log(`${file} ${kb} KB`);
}

function save(key: string, data: unknown) {
  return {
    key: `usr-games:worm-workbench:${key}`,
    value: JSON.stringify({ v: 1, savedAt: '', data }),
  };
}

/** Opens the workbench part-way through the campaign, so the maps and records have something to show. */
async function open(page: Page, appearance: string) {
  await page.setViewportSize(size);
  await page.goto(`/?game&mute=1&appearance=${appearance}&date=${DATE}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  const gardens = Object.fromEntries(
    GARDENS.slice(0, 7).map((g, i) => [
      g.id,
      {
        stars: [3, 2, 3, 1, 2, 2, 1][i],
        bestScore: 140 + i * 37,
        bestChain: 2 + (i % 3),
        tries: 1 + (i % 2),
      },
    ]),
  );
  const puzzles = Object.fromEntries(
    PUZZLES.slice(0, 4).map((p, i) => [
      p.id,
      { stars: [3, 3, 2, 1][i], fewestMoves: p.par + [0, 0, 3, 9][i]!, tries: 2 },
    ]),
  );
  const entries = [
    save('progress', { tutorialDone: true, gardens, puzzles }),
    save('endless', {
      creep: { bestScore: 214, longest: 61, bestChain: 4, runs: 6 },
      rush: { bestScore: 388, longest: 48, bestChain: 5, runs: 3 },
      classic: { bestScore: 96, longest: 40, bestChain: 2, runs: 2 },
    }),
    save('counters', { runs: 23, bites: 187, dailies: 3, longest: 61, bestChain: 5 }),
  ];
  await page.evaluate((all) => {
    window.localStorage.clear();
    for (const { key, value } of all) window.localStorage.setItem(key, value);
  }, entries);
  await page.reload();
  await page.waitForFunction(() => window.__sceneReady === true);
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
  await page.waitForTimeout(500);
}

/** Plays the day's garden with the house noodle's choices, pressed as keys. */
async function playDaily(page: Page, moves: number) {
  const seed = dailySeed('worm', DATE);
  const game = gardenGame(dailyGarden(seed, dailyNumber(DATE)), createRng(seed));
  for (let i = 0; i < moves; i++) {
    const dir = chooseMove(game);
    if (!dir) break;
    move(game, dir);
    await page.keyboard.press(KEYS[dir]);
    if (game.status !== 'playing') break;
  }
}

for (const { appearance, file } of LOOKS) {
  test(`the screens in ${file} @shots`, async ({ page }) => {
    await open(page, appearance);
    await shot(page, 'title', file);
    for (const [button, name] of [
      ['Gardens', 'gardens'],
      ['Fill puzzles', 'puzzles'],
      ['Daily Garden', 'daily'],
      ['Records', 'records'],
      ['How to play', 'help'],
      ['Settings', 'settings'],
    ] as const) {
      await page
        .getByRole('button', { name: new RegExp(`^${button}`) })
        .first()
        .click();
      await page.waitForTimeout(300);
      await shot(page, name, file);
      await page.keyboard.press('Escape');
    }

    // A run of the day's garden: the noodle part-way grown, a bite just taken.
    await page.getByRole('button', { name: /^Daily Garden/ }).click();
    await page.getByRole('button', { name: 'Play today’s garden' }).click();
    await page.waitForTimeout(300);
    await shot(page, 'start', file);
    await playDaily(page, 70);
    await page.waitForTimeout(120);
    await shot(page, 'play', file);
    await page.getByRole('button', { name: 'Game menu' }).first().click();
    await page.getByRole('button', { name: 'Leave' }).click();

    // The night garden.
    await page.getByRole('button', { name: /^Gardens/ }).click();
    await page.getByRole('button', { name: /^Garden 7,/ }).click();
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight', 'ArrowRight'])
      await page.keyboard.press(key);
    await page.waitForTimeout(200);
    await shot(page, 'night', file);
    await page.getByRole('button', { name: 'Game menu' }).first().click();
    await page.getByRole('button', { name: 'Leave' }).click();

    // The Snail Shell, filled along its route: the mosaic, then the card.
    await page.getByRole('button', { name: /^Fill puzzles/ }).click();
    await page.getByRole('button', { name: /^Fill puzzle 4,/ }).click();
    await page.waitForTimeout(200);
    await shot(page, 'puzzle', file);
    const puzzle = PUZZLES[3]!;
    for (const ch of puzzle.route)
      await page.keyboard.press(
        { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[ch]!,
      );
    await page.waitForTimeout(900);
    await shot(page, 'filled', file);
    await expect(page.locator('.nn-results__title')).toHaveText('Box filled!', { timeout: 6000 });
    await shot(page, 'results', file);
    await page.keyboard.press('Escape');

    // A bonk in Endless.
    await page.getByRole('button', { name: /^Endless/ }).click();
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(4700);
    await shot(page, 'bonk', file);

    // The tutorial's first lesson.
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Tutorial/ }).click();
    await page.waitForTimeout(300);
    await shot(page, 'tutorial', file);
  });
}

test.describe('in the Hall', () => {
  test.use({ baseURL: `http://localhost:${HALL_PORT}/` });
  for (const { appearance, file } of LOOKS) {
    test(`the game menu in the Hall in ${file} @shots`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'worm', { appearance });
      await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(900);
      await shot(page, 'menu-in-the-hall', file);
    });
  }
});
