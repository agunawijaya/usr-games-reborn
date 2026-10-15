import { expect, type Page, test } from '@playwright/test';
import {
  autoplay,
  card,
  COUP_READY,
  freshStorage,
  openGame,
  pileCentre,
  RUN_TO_700,
  stackFirstDeal,
  startQuickHand,
  table,
  waitForMode,
  workbenchLog,
} from './table';

/**
 * Detour on its workbench, played every way it can be: a whole hand by keyboard and another by
 * mouse (click, drag, double-click, the action bar), the coup fourré, the extension question,
 * the safety that asks before it goes, the helper on and off, partnerships, the Daily's share
 * line and every way out.
 */

test.beforeEach(async ({ page }) => {
  await freshStorage(page);
});

/** Picks the card by its key (P for the new card, else its number) and plays it with U. */
async function playByKeys(page: Page, name: string): Promise<void> {
  await waitForMode(page, 'play');
  const slot = Number(await card(page, name).getAttribute('data-slot'));
  await page.keyboard.press(slot === 0 ? 'p' : String(slot));
  await page.keyboard.press('u');
}

async function resultFromLog(page: Page) {
  const log = await workbenchLog(page);
  return log.filter((e) => e.kind === 'result').at(-1)?.value as
    { outcome: string; score: number; stats: Record<string, number> } | undefined;
}

test('a whole hand by keyboard alone, through the extension question to the results', async ({
  page,
}) => {
  await stackFirstDeal(page, RUN_TO_700);
  await openGame(page);
  await page.keyboard.press('Enter');
  await page.locator('.dt-setup').waitFor();
  await page.keyboard.press('Enter');
  await playByKeys(page, 'Green Light');
  await expect(page.locator('.dt-sr')).toContainText(/Green Light/);
  for (const name of ['200 miles', '200 miles', '100 miles', '100 miles', '100 miles']) {
    await playByKeys(page, name);
  }
  await waitForMode(page, 'extension');
  await expect(page.getByRole('dialog')).toContainText('Extend the trip to 1000?');
  await page.keyboard.press('n');
  const sheet = page.locator('.dt-sheet-wrap');
  await expect(sheet).toBeVisible({ timeout: 20_000 });
  // 700 miles, 400 for the trip and 500 for the shut-out: the rival never moved.
  await expect(sheet.locator('.dt-sheet__total')).toContainText('1,600');
  await expect(sheet).toContainText('Shut-out');
  await page.keyboard.press('Enter');
  await expect(page.locator('.dt-results')).toContainText('You win!');
  expect((await resultFromLog(page))?.outcome).toBe('win');
});

test('a whole hand by mouse: click a pile, drag, double-click and the action bar', async ({
  page,
}) => {
  await stackFirstDeal(page, RUN_TO_700);
  await openGame(page);
  await startQuickHand(page, 'Classic');

  await waitForMode(page, 'play');
  await card(page, 'Green Light').click();
  const battle = await pileCentre(page, 'battle-0');
  await page.mouse.click(battle.x, battle.y);

  await waitForMode(page, 'play');
  const from = await card(page, '200 miles').boundingBox();
  const miles = await pileCentre(page, 'miles-0');
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(miles.x, miles.y, { steps: 12 });
  await page.mouse.up();

  await waitForMode(page, 'play');
  await card(page, '200 miles').click();
  await page.locator('.dt-actions').getByRole('button', { name: /Drive/ }).click();

  await waitForMode(page, 'play');
  await card(page, '100 miles').dblclick();

  await waitForMode(page, 'play');
  await card(page, '100 miles').click();
  await page.mouse.click(miles.x, miles.y);

  await waitForMode(page, 'play');
  await card(page, '100 miles').click();
  await page.locator('.dt-actions').getByRole('button', { name: /Drive/ }).click();

  await waitForMode(page, 'extension');
  await page.getByRole('button', { name: /Stop at 700/ }).click();
  await page.getByRole('button', { name: /See the result/ }).click({ timeout: 20_000 });
  await expect(page.locator('.dt-results')).toBeVisible();
  await page.getByRole('button', { name: 'Game menu' }).click();
  await expect(page.locator('.dt-title')).toBeVisible();
});

test('a coup fourré: the hazard lands, the prompt asks, C slams the safety down', async ({
  page,
}) => {
  await stackFirstDeal(page, COUP_READY);
  await openGame(page);
  await startQuickHand(page, 'Rookie');
  await playByKeys(page, 'Green Light');
  await waitForMode(page, 'coup');
  await expect(page.locator('.dt-hud')).toContainText('Coup fourré!');
  await expect(page.getByRole('button', { name: /Coup fourré!/ })).toBeVisible();
  await page.keyboard.press('c');
  await expect(page.locator('.dt-sr')).toContainText(/coup fourré/i);
  await waitForMode(page, 'play');
  // 100 for the safety and 300 for the coup, before a single mile.
  await expect(page.locator('.dt-score--you .dt-score__hand')).toContainText('+400');
});

test('throwing a safety away asks first; Escape keeps it', async ({ page }) => {
  await stackFirstDeal(page, COUP_READY);
  await openGame(page);
  await startQuickHand(page, 'Rookie');
  await waitForMode(page, 'play');
  const slot = Number(await card(page, 'Run-Flat Tyres').getAttribute('data-slot'));
  await page.keyboard.press(String(slot));
  await page.keyboard.press('d');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Throw away Run-Flat Tyres?');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card(page, 'Run-Flat Tyres')).toBeVisible();
  // Still chosen: D asks again, and this time the answer is yes.
  await expect(card(page, 'Run-Flat Tyres')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('d');
  await dialog.getByRole('button', { name: 'Throw it away' }).click();
  await expect(page.locator('.dt-card[aria-label*="Run-Flat Tyres"]')).toHaveCount(0);
});

test('the helper explains a blocked card, and the pause menu turns it off', async ({ page }) => {
  await stackFirstDeal(page, RUN_TO_700);
  await openGame(page);
  await startQuickHand(page, 'Rookie');
  await waitForMode(page, 'play');
  await expect(table(page)).toHaveAttribute('data-helper', 'true');
  await card(page, '200 miles').focus();
  await expect(page.locator('.dt-tip')).toContainText(/green light/i);
  await expect(page.locator('.dt-hud')).toContainText('Click it, drag it, or press its number');

  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const items = (
      window as unknown as { __dtItems: () => { label: string; run(): void }[] }
    ).__dtItems();
    items.find((item) => item.label === 'Turn the helper off')!.run();
  });
  await page.keyboard.press('Escape');
  await expect(table(page)).toHaveAttribute('data-helper', 'false');
  await card(page, '100 miles').focus();
  await expect(page.locator('.dt-tip')).toBeHidden();
  await expect(page.locator('.dt-hud')).not.toContainText('Click it, drag it');
});

test('partnerships: a 1000-mile hand for two teams, scored as teams', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /Teams/ }).click();
  await page.locator('.dt-setup').waitFor();
  await page.locator('.dt-start').click();
  await waitForMode(page, 'play');
  await expect(page.locator('.dt-score--you')).toContainText('Your team');
  await expect(page.locator('.dt-score--rival')).toContainText('Rivals');
  await autoplay(page);
  const sheet = page.locator('.dt-sheet-wrap');
  await expect(sheet).toBeVisible({ timeout: 240_000 });
  await expect(sheet.locator('thead')).toContainText('Your team');
  await expect(sheet).toContainText(/takes? the hand|dead heat/);
});

test('Sly thinks in its worker and the hand plays to the end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openGame(page);
  await startQuickHand(page, 'Sly');
  await waitForMode(page, 'play');
  await autoplay(page);
  await expect(page.locator('.dt-sheet-wrap')).toBeVisible({ timeout: 120_000 });
  expect(errors).toEqual([]);
});

test('the Daily Road: one drive, then a share line in the agreed shape', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: /Daily Road/ }).click();
  await page.getByRole('button', { name: /Drive today/ }).click();
  await waitForMode(page, 'play');
  await autoplay(page);
  await page.getByRole('button', { name: /See the result/ }).click({ timeout: 120_000 });
  await page.locator('.dt-results').getByRole('button', { name: 'Share' }).click();
  const shared = (await workbenchLog(page)).filter((e) => e.kind === 'share').at(-1)?.value;
  const text = typeof shared === 'string' ? shared : JSON.stringify(shared);
  expect(text).toMatch(/Detour #\d+/);
  expect(text).toMatch(/[\d,]+ · ⚔️ \d+ coups? · 🛣️ \d+/);
});

test('a game in progress waits on the menu as Continue', async ({ page }) => {
  await stackFirstDeal(page, RUN_TO_700);
  await openGame(page);
  await page.getByRole('button', { name: /Full game/ }).click();
  await page.locator('.dt-start').click();
  await playByKeys(page, 'Green Light');
  await waitForMode(page, 'play');
  await page.reload();
  await expect(page.locator('.dt-title')).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await waitForMode(page, 'play');
  await expect(page.locator('.dt-card[aria-label*="Green Light"]')).toHaveCount(0);
});

test.describe('every way out', () => {
  test('Escape on the game menu goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Escape');
    const log = await workbenchLog(page);
    expect(log.at(-1)).toEqual({ kind: 'navigate', value: 'hall' });
  });

  test('the results card offers Play again, Game menu and Back to the Hall; H goes home', async ({
    page,
  }) => {
    await stackFirstDeal(page, RUN_TO_700);
    await openGame(page);
    await startQuickHand(page, 'Rookie');
    await waitForMode(page, 'play');
    await autoplay(page);
    await page.getByRole('button', { name: /See the result/ }).click({ timeout: 120_000 });
    const results = page.locator('.dt-results');
    await expect(results.getByRole('button')).toContainText([
      'Play again',
      'Game menu',
      'Back to the Hall',
    ]);
    await page.waitForTimeout(700);
    await page.keyboard.press('h');
    const log = await workbenchLog(page);
    expect(log.filter((e) => e.kind === 'navigate').at(-1)?.value).toBe('hall');
  });

  test('Play again deals afresh without leaving', async ({ page }) => {
    await openGame(page);
    await startQuickHand(page, 'Rookie');
    await waitForMode(page, 'play');
    await autoplay(page);
    await page.getByRole('button', { name: /See the result/ }).click({ timeout: 120_000 });
    await page.waitForTimeout(700);
    await page.keyboard.press('r');
    await expect(page.locator('.dt-results')).toBeHidden();
    await expect(table(page)).toBeVisible();
  });
});
