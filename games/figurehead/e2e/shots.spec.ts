import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { playLife } from '../src/bots/sim';
import { chooseRefit, chapterOptions, closeChapter, launchLife, lifeEncounter, readBattle } from '../src/voyage/life';
import { botPrizeCrews, playEncounter } from '../src/bots/sim';
import type { Life } from '../src/voyage/types';

/**
 * The documentation screenshots, inside the Hall, at 1280×720 and 1920×1080, by day and by
 * night: `SHOTS=1 pnpm exec playwright test -c games/figurehead`. Lives are made by the bots in
 * Node and laid in the game's save, so every picture is the same each run.
 */

const MEDIA = join(import.meta.dirname, '..', 'docs', 'media');

/** A life some chapters in: scars, a refit or two, a squadron. */
function midLife(): Life {
  let life = launchLife({ id: 'shots-life', dateKey: '2026-10-04', shipName: 'Larkspur', captain: '', figurehead: 'heron' });
  for (let i = 0; i < 7 && !life.ending; i++) {
    if (life.dockyard) life = chooseRefit(life, life.dockyard[0]!);
    const encounter = lifeEncounter(life, chapterOptions(life)[0]!);
    const { battle, tally } = playEncounter(encounter, 'gunner');
    const outcome = readBattle(life, encounter, battle, tally);
    life = closeChapter(life, outcome, battle, botPrizeCrews(outcome.prizes, outcome.spare)).life;
  }
  if (life.dockyard) life = chooseRefit(life, life.dockyard[0]!);
  return life;
}

async function layLife(page: Page, life: Life) {
  await page.evaluate((data) => {
    window.localStorage.setItem('usr-games:figurehead:life', JSON.stringify({ v: 1, savedAt: '', data }));
  }, life);
}

async function go(page: Page, screen: string) {
  await page.waitForFunction(() => '__figureheadGo' in window);
  await page.evaluate((s) => (window as unknown as { __figureheadGo(s: string): void }).__figureheadGo(s), screen);
}

async function autopilot(page: Page, turns: number, style = 'gunner') {
  await page.waitForFunction(() => '__figureheadAutopilot' in window);
  await page.evaluate(
    ([n, s]) => (window as unknown as { __figureheadAutopilot(n: number, s: string): unknown }).__figureheadAutopilot(n as number, s as string),
    [turns, style] as const,
  );
}

interface Scene {
  name: string;
  stage(page: Page): Promise<void>;
}

const SCENES: Scene[] = [
  { name: 'title', stage: async () => undefined },
  {
    name: 'launch',
    stage: async (page) => {
      await page.getByTestId('fh-menu-voyage').click();
      await page.getByTestId('fh-launch-name').fill('Larkspur');
      await page.getByTestId('fh-carving-heron').click();
    },
  },
  {
    name: 'voyage',
    stage: async (page) => {
      await layLife(page, midLife());
      await go(page, 'voyage');
    },
  },
  {
    name: 'briefing',
    stage: async (page) => {
      await page.getByTestId('fh-menu-daily').click();
      await expect(page.getByTestId('fh-briefing')).toBeVisible();
    },
  },
  {
    name: 'battle',
    stage: async (page) => {
      await layLife(page, midLife());
      await go(page, 'voyage');
      await page.getByTestId('fh-choice-0').click();
      await page.getByTestId('fh-make-sail').click();
      await autopilot(page, 3);
      await page.waitForTimeout(600);
    },
  },
  {
    name: 'aftermath',
    stage: async (page) => {
      await layLife(page, launchLife({ id: 'shots-prize', dateKey: '2026-10-04', shipName: 'Larkspur', captain: '', figurehead: 'heron' }));
      await go(page, 'voyage');
      await page.getByTestId('fh-choice-0').click();
      await page.getByTestId('fh-make-sail').click();
      await autopilot(page, 400, 'seaman');
      await page.getByTestId('fh-to-report').click();
      await expect(page.getByTestId('fh-aftermath')).toBeVisible();
    },
  },
  {
    name: 'epilogue',
    stage: async (page) => {
      await layLife(page, playLife('shots-ended', 'gunner'));
      await go(page, 'epilogue');
      await expect(page.getByTestId('fh-epilogue')).toBeVisible();
    },
  },
];

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

for (const scene of SCENES) {
  for (const appearance of ['light', 'dark'] as const) {
    for (const size of SIZES) {
      const look = appearance === 'light' ? 'day' : 'night';
      test(`${scene.name}, ${look}, ${size.width}`, async ({ page }) => {
        await page.setViewportSize(size);
        await runInHall(page, 'figurehead', { appearance });
        await expect(page.getByTestId('fh-title')).toBeVisible({ timeout: 30_000 });
        await scene.stage(page);
        await page.waitForTimeout(500);
        const kb = await saveScreenshot(page, join(MEDIA, `${scene.name}-${look}-${size.width}.webp`));
        expect(kb).toBeLessThan(800);
      });
    }
  }
}
