import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { gameFrame, inGame, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { READY, beginCrawl, crawlHome, playUntil } from './crawl';

/**
 * Documentation screenshots of Orchard Crawl inside the Hall, at 1280×720 and 1920×1080: the
 * orchards page (four orchards cleared), a briefing, a crawl with the bird after an apple, the
 * burrow open, the report, Midnight with everyone out, the almanac, the free orchard, the
 * challenges page, a small bed and the zigzag lane, in the light appearance, and the orchards page
 * and a crawl in the dark one. Run with `SHOTS=1`, see
 * playwright.config.ts.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

async function save(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  const kb = await saveScreenshot(page, `${MEDIA}${name}-${width}.webp`);
  process.stdout.write(`${name}-${width}.webp ${kb} KB\n`);
}

/** Four orchards cleared with some stars, a few almanac pages, two Daily Orchards. */
async function seedSeason(page: Page) {
  await page.addInitScript(() => {
    const data = {
      stars: {
        'neon-grid': ['home', 'points', 'feat'],
        savanna: ['home', 'feat'],
        river: ['home', 'points'],
        jungle: ['home'],
      },
      best: { 'neon-grid': 96, savanna: 141, river: 152, jungle: 118 },
      pages: ['apple', 'burrow', 'frog', 'rotten', 'bird'],
      dailies: {
        '2026-10-01': { home: true, score: 131, apples: 13, stars: 2 },
        '2026-10-02': { home: false, score: 74, apples: 9, stars: 0 },
      },
      crawls: 23,
      homes: 14,
      crashes: 9,
      apples: 241,
      frogs: 6,
      longest: 88,
      bestBite: 21,
      dailyCrawls: 2,
      lastOrchard: 'jungle',
    };
    localStorage.setItem('usr-games:worm-classic:progress', JSON.stringify({ v: 1, data }));
  });
}

/**
 * Plays on until `until` holds, then holds the orchard still for the picture. When the bot
 * crashes first, the crawl starts again (R on the report).
 */
async function holdWhen(page: Page, until: string) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const end = await playUntil(page, until);
    if (end.state === 'playing') {
      await inGame(page, 'window.OrchardGame.setPaused(true)');
      await page.waitForTimeout(400);
      return;
    }
    await expect(gameFrame(page).getByTestId('desk-report')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('KeyR');
    await expect.poll(() => inGame<string>(page, 'window.OrchardGame.state')).toBe('playing');
  }
  throw new Error(`the bot never reached ${until}`);
}

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`Orchard Crawl in the Hall, light, ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await seedSeason(page);
    await runInHall(page, 'worm-classic', { appearance: 'light' });
    await waitForGame(page, READY);
    const frame = gameFrame(page);
    await page.waitForTimeout(2500);
    await save(page, 'orchards');

    await frame.getByTestId('desk-orchard-desert').click();
    await page.waitForTimeout(800);
    await save(page, 'briefing');
    await frame.getByTestId('desk-back').click();

    await beginCrawl(page, 'jungle');
    await holdWhen(
      page,
      "p.bird !== null && p.bird.state === 'approach' && p.bird.x > 120 && p.bird.x < 780 && p.harvested >= 4",
    );
    await save(page, 'crawl');
    await inGame(page, 'window.OrchardGame.setPaused(false)');

    await holdWhen(page, 'p.burrow !== null');
    await save(page, 'burrow');
    await inGame(page, 'window.OrchardGame.setPaused(false)');
    await crawlHome(page);
    await expect(frame.getByTestId('desk-report')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(600);
    await save(page, 'report');
    // The Hall's toasts for that crawl pass before the next pictures.
    await page.waitForTimeout(6000);

    await frame.getByTestId('desk-report').getByRole('button', { name: 'Game menu' }).click();
    await frame.getByTestId('desk-almanac').click();
    await page.waitForTimeout(400);
    await save(page, 'almanac');
    await frame.getByTestId('desk-back').click();
    await frame.getByTestId('desk-free').click();
    await frame.getByTestId('free-mode-wild').click();
    await frame.getByTestId('free-look-midnight').click();
    await page.waitForTimeout(800);
    await save(page, 'free');

    await frame.getByTestId('desk-back').click();
    await frame.getByTestId('desk-challenges').click();
    await page.waitForTimeout(500);
    await save(page, 'challenges');
    for (const [id, name] of [
      ['fill-bed-1', 'challenge-bed'],
      ['lane-1', 'challenge-lane'],
    ] as const) {
      await frame.getByTestId(`challenge-${id}`).click();
      await frame.getByTestId('challenge-start').click();
      await expect.poll(() => inGame<string>(page, 'window.OrchardGame.state')).toBe('playing');
      await page.waitForTimeout(1600);
      await inGame(page, 'window.OrchardGame.setPaused(true)');
      await page.waitForTimeout(300);
      await save(page, name);
      await inGame(page, 'window.OrchardGame.setPaused(false)');
      await page.keyboard.press('Escape');
      await frame.getByTestId('pause-menu').click();
      await frame.getByTestId('pause-leave').click();
      await expect(frame.getByTestId('challenge-fill-bed-1')).toBeVisible();
    }
  });

  test(`Orchard Crawl at Midnight and in the dark, ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await seedSeason(page);
    await page.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('usr-games:worm-classic:progress') ?? '{}');
      for (const id of ['desert', 'aztec', 'origami']) raw.data.stars[id] = ['home'];
      raw.data.lastOrchard = 'origami';
      localStorage.setItem('usr-games:worm-classic:progress', JSON.stringify(raw));
    });
    await runInHall(page, 'worm-classic', { appearance: 'dark' });
    await waitForGame(page, READY);
    await page.waitForTimeout(2500);
    await save(page, 'orchards-dark');
    await beginCrawl(page, 'midnight');
    await holdWhen(page, 'p.gardener !== null && p.rival !== null && p.harvested >= 5');
    await save(page, 'midnight-dark');
  });
}
