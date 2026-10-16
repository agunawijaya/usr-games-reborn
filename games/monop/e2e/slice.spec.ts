import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The vertical slice for the owner's checkpoint (`--grep @slice`): a Quick game on Harbour City
 * against Dex and Marlowe, played by keys and mouse from a table staged ten rounds in (dev
 * `stages.ts`), recorded as video with frames at its moments; and a whole Quick game from the
 * deal to the recap, played by the workbench's autopilot at ten times the pace.
 */
const SLICE = fileURLToPath(new URL('../docs/media/slice/', import.meta.url));

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(() => document.fonts.ready);
}

/** Waits until the person can act: the main button is on, or a panel offers a choice. */
async function yourMove(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () =>
      document.querySelector('.dd-actions .dd-action--primary:not(:disabled)') !== null ||
      document.querySelector('.dd-auction-bids') !== null ||
      document.querySelector('.dd-results') !== null,
    null,
    { timeout },
  );
}

async function frame(page: Page, name: string): Promise<void> {
  const size = await saveScreenshot(page, `${SLICE}${name}.webp`);
  console.log(`${name}.webp ${size} KB`);
}

test('@slice a staged Quick game: landmark, counter-offer, auction, recap', async ({ browser }) => {
  test.setTimeout(300_000);
  mkdirSync(`${SLICE}raw`, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: `${SLICE}raw`, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?game&fresh=1&seed=slice-1&stage=slice&rounds=11&chrome=0&appearance=light');
  await ready(page);
  await page.waitForTimeout(1800);
  await frame(page, '01-menu');

  await page.keyboard.press('Enter');
  await yourMove(page);
  await page.waitForTimeout(1500);
  await frame(page, '02-table-with-coach-heat');

  // Top out Lighthouse Hill: the fourth storey on Beacon Rise, then the district's landmark.
  await page.keyboard.press('h');
  await page.waitForTimeout(700);
  await page.keyboard.press('1');
  await page.waitForTimeout(2600);
  await page.keyboard.press('1');
  await page.waitForTimeout(2300);
  await frame(page, '03-first-landmark');
  // The build list closed for the celebration; wait for it to finish.
  await yourMove(page);
  await page.waitForTimeout(400);

  // Ask Dex for Chowder Court with a low offer; Dex counters with a reason; accept.
  await page.keyboard.press('t');
  await page.waitForTimeout(600);
  await page.click('[data-act="toggle"][data-space="9"]');
  await page.click('[data-act="coins"][data-side="give"][data-delta="50"]');
  await page.waitForTimeout(900);
  await frame(page, '04-trade-offer');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.dd-reply--counter', { timeout: 15_000 });
  await page.waitForTimeout(900);
  await frame(page, '05-counter-offer');
  await page.keyboard.press('Enter');
  // The deal makes the Fish Market whole, and the table says so before it is your move again.
  await yourMove(page);
  await page.waitForTimeout(400);

  // Roll onto the ferry, let it go to auction, bid once, then drop out.
  await page.keyboard.press(' ');
  await page.waitForSelector('[data-action="pass"]:not(:disabled)', { timeout: 20_000 });
  await page.waitForTimeout(900);
  await frame(page, '06-buy-or-auction');
  await page.keyboard.press('p');
  await page.waitForSelector('.dd-auction-bids', { timeout: 20_000 });
  await page.waitForTimeout(700);
  await frame(page, '07-auction');
  await page.keyboard.press('1');
  for (let call = 0; call < 6; call++) {
    const open = await page
      .waitForSelector('.dd-auction-bids', { timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (!open) break;
    await page.keyboard.press('p');
    await page.waitForTimeout(400);
  }

  // Play on to the end of the Quick game.
  for (let turn = 0; turn < 12; turn++) {
    await yourMove(page, 60_000);
    if (await page.locator('.dd-results').count()) break;
    const primary = await page
      .locator('.dd-actions .dd-action--primary:not(:disabled)')
      .getAttribute('data-action');
    if (primary === 'buy') await page.keyboard.press('b');
    else if (primary === 'end') await page.keyboard.press('e');
    else await page.keyboard.press(' ');
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('.dd-results', { timeout: 120_000 });
  await page.waitForTimeout(1200);
  await frame(page, '08-recap');
  expect(errors).toEqual([]);

  const video = page.video();
  await context.close();
  const recorded = await video?.path();
  if (recorded) renameSync(recorded, `${SLICE}slice-quick-game.webm`);
  for (const stray of readdirSync(`${SLICE}raw`)) rmSync(`${SLICE}raw/${stray}`);
  rmSync(`${SLICE}raw`, { recursive: true, force: true });
});

test('@slice the same table at night', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?game&fresh=1&seed=slice-1&stage=slice&rounds=12&chrome=0&appearance=dark');
  await ready(page);
  await page.keyboard.press('Enter');
  await yourMove(page);
  await page.waitForTimeout(1500);
  await frame(page, '09-table-night');
  await page.keyboard.press('h');
  await page.waitForTimeout(700);
  await page.keyboard.press('1');
  await page.waitForTimeout(2600);
  await page.keyboard.press('1');
  await page.waitForTimeout(2600);
  await frame(page, '10-first-landmark-night');
});

test('@slice a whole Quick game against two rivals reaches the recap', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?game&fresh=1&seed=full-1&auto=1&pace=10&chrome=0');
  await ready(page);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.dd-results', { timeout: 540_000 });
  const results = await page.evaluate(() =>
    (
      window as unknown as {
        __ddLog: { kind: string; value: { outcome: string; presentation: string } }[];
      }
    ).__ddLog.filter((entry) => entry.kind === 'result'),
  );
  expect(results).toHaveLength(1);
  expect(['win', 'loss']).toContain(results[0]!.value.outcome);
  expect(results[0]!.value.presentation).toBe('game');
  await expect(page.locator('.dd-results [data-act="again"]')).toBeVisible();
  expect(errors).toEqual([]);
});
