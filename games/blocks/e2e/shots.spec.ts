import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dailySeed } from '@usr-games/kit';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { choosePlacement, playStep, type Step } from '../src/engine/bot';
import { DIVES } from '../src/dives/dives';
import { dailyGame } from '../src/modes/daily';
import { HALL_PORT } from './ports';

/**
 * Screens of the whole game for the docs and the critique rounds, in both looks:
 * `pnpm exec playwright test -c games/blocks --grep @shots`. `SHOTS_OUT=<folder>` writes
 * somewhere else, `SHOTS_SIZE=1920` takes them at 1920 × 1080 instead of 1280 × 720.
 */

const out =
  process.env.SHOTS_OUT ?? fileURLToPath(new URL('../docs/media/screens/', import.meta.url));
const size =
  process.env.SHOTS_SIZE === '1920' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
const LOOKS = [
  { appearance: 'light', file: 'sunlit' },
  { appearance: 'dark', file: 'abyss' },
] as const;
const DATE = '2026-10-04';
export const KEYS: Record<Step, string> = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  turnLeft: 'z',
  turnRight: 'ArrowUp',
  sink: 'ArrowDown',
  plunge: 'Space',
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
    key: `usr-games:blocks-workbench:${key}`,
    value: JSON.stringify({ v: 1, savedAt: '', data }),
  };
}

/** Opens the workbench part-way through the dives, so the pages have something to show. */
async function open(page: Page, appearance: string) {
  await page.setViewportSize(size);
  await page.goto(`/?game&mute=1&appearance=${appearance}&date=${DATE}`);
  await page.waitForFunction(() => window.__sceneReady === true);
  const dives = Object.fromEntries(
    DIVES.slice(0, 7).map((d, i) => [
      d.id,
      {
        stars: [3, 2, 3, 1, 2, 3, 1][i],
        bestScore: d.goal.kind === 'rows' ? d.stars[0] + i * 37 : 0,
        fewestSinkers: d.goal.kind === 'coral' ? d.stars[0] : null,
        tries: 1 + (i % 2),
      },
    ]),
  );
  const level = (bestScore: number, rows: number, bestCombo: number) => ({
    bestScore,
    rows,
    bestCombo,
    runs: 2,
    date: '2026-10-03',
  });
  const entries = [
    save('progress', { tutorialDone: true, dives }),
    save('marathon', {
      1: level(18_240, 61, 7),
      2: level(21_905, 58, 6),
      4: level(30_118, 49, 9),
    }),
    save('classic', { 2: level(1_284, 37, 0), 5: level(2_715, 22, 0) }),
    save('counters', { runs: 23, rowsBurst: 412, fourRowBursts: 9, bestCombo: 9 }),
    save('daily', {
      '2026-10-02': {
        number: 32,
        name: 'Pearl Grotto',
        score: 11_402,
        bestCombo: 6,
        rows: 31,
        bubbles: 2,
        par: 13_731,
      },
    }),
  ];
  await page.evaluate((all) => {
    window.localStorage.clear();
    for (const { key, value } of all) window.localStorage.setItem(key, value);
  }, entries);
  await page.reload();
  await page.waitForFunction(() => window.__sceneReady === true);
  await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible();
  await page.waitForTimeout(600);
}

/** Plays the day's sinkers with the house diver's choices, pressed as keys. */
async function playDaily(page: Page, sinkers: number) {
  const game = dailyGame(dailySeed('blocks', DATE));
  for (let i = 0; i < sinkers && !game.over; i++) {
    for (const step of choosePlacement(game)!.steps) {
      const events = playStep(game, step);
      await page.keyboard.press(KEYS[step]);
      if (events.some((e) => e.kind === 'burst')) await page.waitForTimeout(1100);
    }
    await page.waitForTimeout(40);
  }
}

for (const { appearance, file } of LOOKS) {
  test(`the screens in ${file} @shots`, async ({ page }) => {
    await open(page, appearance);
    await shot(page, 'title', file);
    for (const [button, name] of [
      ['Dives', 'dives'],
      ['Marathon', 'marathon'],
      ['Classic 1992', 'classic'],
      ['Daily Dive', 'daily'],
      ['Records', 'records'],
      ['How to play', 'help'],
      ['Settings', 'settings'],
    ] as const) {
      await page
        .getByRole('button', { name: new RegExp(`^${button}`) })
        .first()
        .click();
      await page.waitForTimeout(400);
      await shot(page, name, file);
      await page.keyboard.press('Escape');
    }

    // The tutorial's first lesson.
    await page.getByRole('button', { name: /^Tutorial/ }).click();
    await page.waitForTimeout(400);
    await shot(page, 'tutorial', file);
    await page.getByRole('button', { name: 'Game menu' }).first().click();
    await page.getByRole('button', { name: 'Leave' }).click();

    // A dive with coral, and the night dive, just begun.
    await page.getByRole('button', { name: /^Dives/ }).click();
    await page.getByRole('button', { name: /^Dive 2,/ }).click();
    await page.waitForTimeout(900);
    await shot(page, 'coral', file);
    await page.getByRole('button', { name: 'Game menu' }).first().click();
    await page.getByRole('button', { name: 'Leave' }).click();
    await page.getByRole('button', { name: /^Dives/ }).click();
    await page.getByRole('button', { name: /^Dive 6,/ }).click();
    await page.waitForTimeout(1600);
    await shot(page, 'currents', file);
    await page.getByRole('button', { name: 'Game menu' }).first().click();
    await page.getByRole('button', { name: 'Leave' }).click();
    await page.getByRole('button', { name: /^Dives/ }).click();
    await page.getByRole('button', { name: /^Dive 7,/ }).click();
    await page.waitForTimeout(1600);
    await shot(page, 'night', file);
    await page.getByRole('button', { name: 'Game menu' }).first().click();
    await page.getByRole('button', { name: 'Leave' }).click();

    // The day's tank, part-way down, then its results.
    await page.getByRole('button', { name: /^Daily Dive/ }).click();
    await page.getByRole('button', { name: /Dive today/ }).click();
    await page.waitForTimeout(300);
    await playDaily(page, 26);
    await shot(page, 'play', file);
    for (let i = 0; i < 40; i++) await page.keyboard.press('Space');
    await expect(page.locator('.snk-results__title')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(400);
    await shot(page, 'results', file);
    await page.keyboard.press('Escape');

    // Classic 1992 in its ten-wide tank.
    await page.getByRole('button', { name: /^Classic 1992/ }).click();
    await page.getByRole('button', { name: /^Play at level/ }).click();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await page.keyboard.press('Space');
      await page.waitForTimeout(700);
    }
    await shot(page, 'classic-play', file);
  });
}

test.describe('in the Hall', () => {
  test.use({ baseURL: `http://localhost:${HALL_PORT}/` });
  for (const { appearance, file } of LOOKS) {
    test(`the game menu in the Hall in ${file} @shots`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'blocks', { appearance });
      await expect(page.getByRole('list', { name: 'Game menu' })).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(900);
      await shot(page, 'menu-in-the-hall', file);
    });
  }
});
