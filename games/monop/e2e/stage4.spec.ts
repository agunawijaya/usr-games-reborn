import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Stage 4 (`--grep @stage4`): Ring Colony and Pop-up 1904 played to the recap, a scenario from
 * the list to its verdict, the Daily Deal to its share line, a table of your own with a friend at
 * the same screen under Berkeley rules, and the career's touches on the board. The workbench's
 * autopilot plays the person's seat where a whole game is needed; `fresh=1` keeps saves in memory.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/stage4/', import.meta.url));

type Log = { kind: string; value: unknown }[];

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(() => document.fonts.ready);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

const log = (page: Page) => page.evaluate(() => (window as unknown as { __ddLog: Log }).__ddLog);

for (const board of ['colony', 'popup'] as const) {
  test(`@stage4 ${board} plays a whole Quick game to the recap`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = watchErrors(page);
    await page.goto(`/?game&fresh=1&auto=1&pace=10&rounds=6&board=${board}&chrome=0`);
    await ready(page);
    await expect(page.locator('.dd-board-pick[aria-checked="true"]')).toHaveAttribute(
      'data-board',
      board,
    );
    await page.keyboard.press('Enter');
    await page.waitForSelector('.dd-results', { timeout: 240_000 });
    const results = (await log(page)).filter((e) => e.kind === 'result');
    expect(results).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test('@stage4 a scenario goes from the list to its verdict and into the career', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto('/?game&fresh=1&auto=1&pace=10&chrome=0');
  await ready(page);
  await page.keyboard.press('s');
  await expect(page.locator('.dd-scenarios')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#dd-scenario-title')).toHaveText('The Fish Market Run');
  await page.keyboard.press('Enter');
  await expect(page.locator('.dd-goals li')).toHaveCount(2);
  await expect(page.locator('.dd-round')).toContainText('Scenario 2');
  await page.waitForSelector('.dd-results', { timeout: 240_000 });
  await expect(page.locator('#dd-results-title')).toHaveText(/Scenario complete!|Not this time/);
  await page.click('[data-act="menu"]');
  await page.keyboard.press('c');
  await expect(page.locator('.dd-career-stats')).toContainText('Games1');
  // Escape goes back to the menu without leaving for the Hall.
  await page.keyboard.press('Escape');
  await expect(page.locator('.dd-menu')).toBeVisible();
  expect((await log(page)).some((e) => e.kind === 'navigate')).toBe(false);
  expect(errors).toEqual([]);
});

test('@stage4 the Daily Deal counts once and shares its line', async ({ page }) => {
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto('/?game&fresh=1&auto=1&pace=10&chrome=0&date=2026-10-16');
  await ready(page);
  await page.keyboard.press('d');
  await expect(page.locator('.dd-daily h2')).not.toBeEmpty();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.dd-results', { timeout: 240_000 });
  await page.keyboard.press('s');
  const entries = await log(page);
  const result = entries.find((e) => e.kind === 'result')!.value as { daily: boolean };
  expect(result.daily).toBe(true);
  const share = entries.find((e) => e.kind === 'share')!.value as string;
  expect(share).toMatch(
    /^Deeds & Dice #46 · (won in \d+ turns?|not this time) · 🏙️ \d+ towers? · 🤝 \d+ deals?$/,
  );
  expect(errors).toEqual([]);
});

test('@stage4 a table of your own: a friend at the screen, Berkeley rules, Classic', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  // On this seed Player 1's first roll lands on the income tax.
  await page.goto('/?game&fresh=1&pace=6&chrome=0&seed=hotseat-1');
  await ready(page);
  await page.keyboard.press('n');
  await page.click('[data-act="add"]');
  await page.selectOption('select[data-seat="1"]', 'guest');
  await page.check('input[name="preset"][value="berkeley"]');
  await page.check('input[name="mode"][value="classic"]');
  await page.keyboard.press('Enter');
  await expect(page.locator('.dd-seat')).toHaveCount(4);
  await expect(page.locator('.dd-round')).toHaveText('Classic · Round 1');
  // Berkeley's income tax asks a person which way to pay, a flat sum or a tenth of their worth.
  await page.waitForSelector('.dd-actions .dd-action--primary:not(:disabled)');
  await page.keyboard.press(' ');
  await expect(page.locator('[data-action="tax-flat"]')).toContainText('Pay 180', {
    timeout: 30_000,
  });
  await expect(page.locator('[data-action="tax-tenth"]')).toBeEnabled();
  await page.keyboard.press('w');
  await expect(page.locator('[data-action="tax-tenth"]')).toHaveCount(0);
  // Player 1 finishes the turn; then the controls pass to Player 2.
  for (let step = 0; step < 8; step++) {
    await page.waitForSelector('.dd-actions .dd-action--primary:not(:disabled)', {
      timeout: 60_000,
    });
    if (
      (await page.locator('.dd-seat--active .dd-seat-name').textContent())?.startsWith('Player 2')
    )
      break;
    const primary = await page
      .locator('.dd-actions .dd-action--primary:not(:disabled)')
      .getAttribute('data-action');
    await page.keyboard.press(
      primary === 'buy' ? 'b' : primary === 'end' ? 'e' : primary === 'roll' ? ' ' : 'Enter',
    );
    await page.waitForTimeout(300);
  }
  await expect(page.locator('.dd-seat--active .dd-seat-name')).toHaveText(/^Player 2/);
  await expect(page.locator('.dd-seat--active .dd-seat-status')).toHaveText('Your move');
  expect(errors).toEqual([]);
});

test('@stage4 the career’s touches stand on the board', async ({ page }) => {
  await page.goto('/?game&fresh=1&chrome=0&honours=all&board=popup');
  await ready(page);
  const statue = await page.evaluate(() => {
    const world = (
      window as unknown as {
        __ddWorld: { stage: { scene: { getObjectByName(n: string): unknown } } };
      }
    ).__ddWorld;
    return world.stage.scene.getObjectByName('statue') !== undefined;
  });
  expect(statue).toBe(true);
});

test('@stage4 frames of the new pages for the record', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(MEDIA, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const look of ['light', 'dark'] as const) {
    await page.goto(`/?game&fresh=1&chrome=0&appearance=${look}&date=2026-10-16`);
    await ready(page);
    await page.waitForTimeout(1500);
    await saveScreenshot(page, `${MEDIA}menu-${look}.webp`);
    for (const [key, name] of [
      ['n', 'new-game'],
      ['s', 'scenarios'],
      ['d', 'daily'],
      ['c', 'career'],
    ] as const) {
      await page.keyboard.press(key);
      await page.waitForTimeout(1500);
      await saveScreenshot(page, `${MEDIA}${name}-${look}.webp`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
  }
});
