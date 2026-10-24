import { fileURLToPath } from 'node:url';
import { type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The documentation screens, at 1280 × 720 and 1920 × 1080, on the porch and by the fire, into
 * `docs/media/`. Every game is dealt from a fixed seed through the development hook, so the
 * pictures come out the same each run. `SHOT` narrows the run to one screen.
 */

const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const LOOKS = [
  { id: 'porch', appearance: 'light' },
  { id: 'fireside', appearance: 'dark' },
] as const;
const only = process.env.SHOT;

type Phase = string;

async function open(page: Page, appearance: string, extra = '') {
  await page.goto(`/?game&sample=1&date=2026-10-24&appearance=${appearance}${extra}`);
  await page.waitForFunction(() => window.__sceneReady === true && window.__ft !== undefined);
  await page.waitForTimeout(400);
}

async function waitForPhase(page: Page, wanted: Phase[], timeout = 60_000) {
  await page.waitForFunction((list: string[]) => list.includes(window.__ft!.phase()), wanted, {
    timeout,
  });
  return page.evaluate(() => window.__ft!.phase());
}

async function startGame(page: Page, seed: string, counting = 'automatic', level = 'sharp') {
  await page.getByTestId('ft-menu-new').click();
  await page.getByTestId(`ft-choice-counting-${counting}`).check();
  await page.getByTestId(`ft-choice-level-${level}`).check();
  await page.evaluate((s) => window.__ft!.nextSeed(s), seed);
  await page.getByTestId('ft-start').click();
}

/** Plays your seat with the hook (fast) until `stop` says so. */
async function playUntil(page: Page, stop: (phase: Phase, step: number) => Promise<boolean>) {
  for (let step = 0; step < 400; step++) {
    const now = await waitForPhase(page, ['lay-away', 'play', 'claim', 'next-hand', 'results']);
    if (await stop(now, step)) return now;
    if (now === 'results') return now;
    if (now === 'next-hand') await page.evaluate(() => window.__ft!.next());
    else if (now === 'claim')
      await page.evaluate(() => window.__ft!.claim(window.__ft!.trueCount() ?? 0));
    else await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
    await page.waitForFunction((before) => window.__ft!.phase() !== before, now, {
      timeout: 30_000,
    });
  }
  throw new Error('stopped too late');
}

const SCREENS: Record<string, (page: Page, appearance: string) => Promise<void>> = {
  'game-menu': async (page, appearance) => {
    await open(page, appearance);
  },
  'new-game': async (page, appearance) => {
    await open(page, appearance);
    await page.getByTestId('ft-menu-new').click();
  },
  'lay-away': async (page, appearance) => {
    await open(page, appearance);
    await startGame(page, 'docs-deal-7');
    await waitForPhase(page, ['lay-away']);
    await page.waitForTimeout(900);
    const cards = page.getByTestId('ft-hand-card');
    await cards.nth(4).click();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(500);
  },
  play: async (page, appearance) => {
    await open(page, appearance);
    await startGame(page, 'docs-deal-7');
    await page.evaluate(() => window.__ft!.fast(4));
    // Until a few cards are on the table and it is your turn again.
    await playUntil(
      page,
      async (phase) =>
        phase === 'play' &&
        (await page.evaluate(() => window.__ft!.state()?.play?.pile.length ?? 0)) >= 3,
    );
    await page.evaluate(() => window.__ft!.fast(1));
    await page.waitForTimeout(500);
  },
  counting: async (page, appearance) => {
    await open(page, appearance);
    await startGame(page, 'docs-deal-7');
    await page.evaluate(() => window.__ft!.fast(4));
    await playUntil(
      page,
      async (phase) =>
        phase === 'play' &&
        (await page.evaluate(() => window.__ft!.state()?.play?.inHand[0].length ?? 4)) === 1,
    );
    await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
    await page.evaluate(() => window.__ft!.fast(1));
    // The first hand on the counting stage, part-way through its count.
    await page.waitForFunction(
      () => document.querySelectorAll('.ft-ledger__item').length >= 2,
      undefined,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(300);
  },
  claim: async (page, appearance) => {
    await open(page, appearance);
    await startGame(page, 'docs-deal-7', 'classic-1980');
    await page.evaluate(() => window.__ft!.fast(4));
    await playUntil(page, async (phase) => phase === 'claim');
    await page.evaluate(() => window.__ft!.fast(1));
    await page.getByTestId('ft-claim-input').fill('8');
    await page.waitForTimeout(300);
  },
  'skunk-stamp': async (page, appearance) => {
    await open(page, appearance);
    await startGame(page, 'docs-skunk-3', 'automatic', 'beginner');
    await waitForPhase(page, ['lay-away']);
    await page.evaluate(() => window.__ft!.rig(112, 40));
    await page.evaluate(() => window.__ft!.fast(4));
    // Moves are made as soon as they are asked for, until the stamp comes down on the board.
    for (let step = 0; step < 2000; step++) {
      if ((await page.locator('[data-stamp="on"]').count()) > 0) break;
      await page.evaluate(() => {
        const ft = window.__ft!;
        const phase = ft.phase();
        if (phase === 'lay-away' || phase === 'play') ft.act(ft.best());
        else if (phase === 'next-hand') ft.next();
      });
      await page.waitForTimeout(40);
    }
    await page.evaluate(() => window.__ft!.fast(1));
    await page.waitForTimeout(900);
  },
  results: async (page, appearance) => {
    await open(page, appearance);
    await startGame(page, 'docs-skunk-3', 'automatic', 'beginner');
    await waitForPhase(page, ['lay-away']);
    await page.evaluate(() => window.__ft!.rig(108, 64));
    await page.evaluate(() => window.__ft!.fast(8));
    await playUntil(page, async (phase) => phase === 'results');
    await page.waitForTimeout(600);
  },
  trainer: async (page, appearance) => {
    await open(page, appearance);
    await page.getByTestId('ft-menu-trainer').click();
    await page.evaluate(() => window.__ft!.nextSeed('docs-trainer-2'));
    await page.getByTestId('ft-trainer-sprint').click();
    await page.waitForFunction(() => window.__ft!.trainerAnswer() !== null);
    const answer = await page.evaluate(() => window.__ft!.trainerAnswer()!);
    await page.evaluate((v) => window.__ft!.trainerSubmit(v), answer);
    await page.waitForTimeout(2200);
  },
  'daily-discard': async (page, appearance) => {
    await page.goto(`/?game&fresh=1&date=2026-10-24&appearance=${appearance}`);
    await page.waitForFunction(() => window.__ft !== undefined);
    await page.getByTestId('ft-menu-daily').click();
    await page.getByTestId('ft-daily-play').click();
    await page.waitForTimeout(1000);
    await page.getByTestId('ft-hand-card').nth(0).click();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(400);
  },
  'daily-verdict': async (page, appearance) => {
    await page.goto(`/?game&fresh=1&date=2026-10-24&appearance=${appearance}`);
    await page.waitForFunction(() => window.__ft !== undefined);
    await page.getByTestId('ft-menu-daily').click();
    await page.getByTestId('ft-daily-play').click();
    await page.waitForTimeout(600);
    const hand = await page.evaluate(() => window.__ft!.dailyHand());
    await page.evaluate((h) => window.__ft!.dailyChoose([h[1]!, h[4]!]), hand);
    await waitForPhase(page, ['results']);
    await page.waitForTimeout(500);
  },
  'hand-records': async (page, appearance) => {
    await open(page, appearance);
    await page.getByTestId('ft-menu-album').click();
  },
  'how-to-play': async (page, appearance) => {
    await open(page, appearance);
    await page.getByTestId('ft-menu-help').click();
  },
};

for (const [name, stage] of Object.entries(SCREENS)) {
  if (only && only !== name) continue;
  for (const look of LOOKS) {
    for (const size of SIZES) {
      test(`${name} ${look.id} ${size.width} @shots`, async ({ page }) => {
        await page.setViewportSize(size);
        await stage(page, look.appearance);
        await page.waitForTimeout(250);
        const target = new URL(
          `../docs/media/${name}-${look.id}-${size.width}.webp`,
          import.meta.url,
        );
        await saveScreenshot(page, fileURLToPath(target));
      });
    }
  }
}
