import { expect, type Page, test } from '@playwright/test';

/**
 * Gone Fishing on its workbench (port 5295), the whole game as a player meets it: the game
 * menu, a Quick game by mouse and by keyboard, every rule set, the notebook, the Tournament,
 * the Daily Pond and its share line, the album, and every way out. `?fresh=1` keeps each run's
 * saves in memory. Set `LOOK_DIR` to save a picture at each step for review.
 */

const lookDir = process.env.LOOK_DIR;

async function look(page: Page, name: string): Promise<void> {
  if (lookDir) await page.screenshot({ path: `${lookDir}/${name}.png` });
}

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/?game&fresh=1${query}${process.env.LOOK_QUERY ?? ''}`);
  await page.waitForFunction(() => window.__sceneReady === true && window.__gf !== undefined);
  await expect(page.getByTestId('gf-title')).toBeVisible();
}

const phase = (page: Page) => page.evaluate(() => window.__gf!.phase());

/** Plays your turns with any legal ask until the results card shows. */
async function playToTheEnd(page: Page): Promise<void> {
  await page.evaluate(() => window.__gf!.fast(40));
  for (let guard = 0; guard < 600; guard++) {
    const now = await phase(page);
    if (now === 'results') return;
    if (now === 'your-turn') await page.evaluate(() => window.__gf!.askAny());
    await page.waitForTimeout(30);
  }
  throw new Error('the game did not end');
}

const log = (page: Page) => page.evaluate(() => window.__gfLog ?? []);

test('the game menu offers every mode and says it is the title screen', async ({ page }) => {
  await open(page);
  await look(page, 'title');
  for (const id of ['quick', 'tournament', 'daily', 'album', 'help', 'settings']) {
    await expect(page.getByTestId(`gf-menu-${id}`)).toBeVisible();
  }
  const entries = await log(page);
  expect(entries.filter((e) => e.kind === 'title').at(-1)?.value).toBe(true);
});

test('a Quick game by mouse: choose a rival, click a rank, play to the results', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('gf-menu-quick').click();
  await look(page, 'quick');
  await page.getByTestId('gf-quick-start').click();
  await page.evaluate(() => window.__gf!.fast(6));
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe('your-turn');
  await look(page, 'your-turn');
  // Choose the first rival by its plate, then ask with a rank button.
  await page.getByTestId('gf-plate-1').click();
  const rank = page.locator('.gf-rank').first();
  await rank.click();
  await expect.poll(() => phase(page)).not.toBe('your-turn');
  await look(page, 'after-ask');
  await playToTheEnd(page);
  await expect(page.getByTestId('gf-results')).toBeVisible();
  await look(page, 'results');
  const result = (await log(page)).find((e) => e.kind === 'result')?.value as {
    outcome: string;
    presentation: string;
  };
  expect(['win', 'draw', 'loss']).toContain(result.outcome);
  expect(result.presentation).toBe('game');
});

test('a game by keyboard alone: Q, Enter, a rival number, a rank key', async ({ page }) => {
  await open(page);
  await page.keyboard.press('q');
  await expect(page.getByTestId('gf-quick')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.evaluate(() => window.__gf!.fast(6));
  await expect.poll(() => phase(page), { timeout: 30_000 }).toBe('your-turn');
  // 1 chooses Otto; then the first rank key of a held rank asks him.
  await page.keyboard.press('1');
  await expect(page.locator('.gf-askbar[data-mode="choose-rank"]')).toBeVisible();
  const label = await page
    .locator('.gf-rank')
    .first()
    .evaluate((el) => el.firstChild!.textContent!);
  await page.keyboard.press(label === '10' ? '0' : label.toLowerCase());
  await expect.poll(() => phase(page)).not.toBe('your-turn');
  await expect(page.getByTestId('gf-live')).not.toBeEmpty();
});

test('the notebook opens and closes with N, and the choice is remembered', async ({ page }) => {
  await open(page);
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-quick-start').click();
  await expect(page.locator('.gf-notebook-body')).toBeVisible();
  await page.keyboard.press('n');
  await expect(page.locator('.gf-notebook-body')).toHaveCount(0);
  await expect(page.getByTestId('gf-notebook-switch')).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('n');
  await expect(page.locator('.gf-notebook-body')).toBeVisible();
});

test('Classic 1993: one rival, seven cards, and P switches on pro mode', async ({ page }) => {
  await open(page);
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-choice-rules-classic').check();
  await expect(page.getByTestId('gf-rival-miso')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('gf-quick-start').click();
  await expect(page.locator('.gf-plate:not([hidden])')).toHaveCount(1);
  expect(await page.evaluate(() => window.__gf!.setup()!.rules)).toBe('classic');
  const items = await page.evaluate(() => window.__gfItems!().map((i) => i.id));
  expect(items).toContain('pro');
  await page.keyboard.press('p');
  await expect(page.getByTestId('gf-live')).toContainText('Pro mode');
  await playToTheEnd(page);
  await expect(page.getByTestId('gf-results')).toContainText('Classic 1993');
});

test('All 13 books plays until every book is made', async ({ page }) => {
  await open(page);
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-choice-rules-all-books').check();
  await page.getByTestId('gf-quick-start').click();
  await playToTheEnd(page);
  const counts = await page.locator('.gf-catch-count').allTextContents();
  expect(counts.reduce((sum, n) => sum + Number(n), 0)).toBe(13);
});

test('the Tournament: round one against Otto, then the ladder shows the result', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('gf-menu-tournament').click();
  await look(page, 'tournament');
  await page.getByTestId('gf-tournament-play').click();
  expect(await page.evaluate(() => window.__gf!.setup())).toMatchObject({
    kind: 'tournament',
    round: 0,
    rules: 'all-books',
    rivals: ['otto'],
  });
  await playToTheEnd(page);
  await expect(page.getByTestId('gf-results-again')).toContainText('Next round (2 of 5)');
  await page.getByTestId('gf-results-menu').click();
  await page.getByTestId('gf-menu-tournament').click();
  await expect(page.locator('.gf-round').first()).toHaveAttribute('data-result', /win|draw|loss/);
  await expect(page.getByTestId('gf-tournament-play')).toContainText('Play round 2');
});

test('the Daily Pond: everyone the same pond, then a share line with no address', async ({
  page,
}) => {
  await open(page, '&date=2026-10-15');
  await page.getByTestId('gf-menu-daily').click();
  await expect(page.getByTestId('gf-daily')).toContainText('Daily Pond #45');
  await page.getByTestId('gf-daily-play').click();
  const setup = await page.evaluate(() => window.__gf!.setup());
  expect(setup).toMatchObject({ kind: 'daily', rules: 'all-books', daily: 45 });
  expect([...setup!.rivals].sort()).toEqual(['hazel', 'miso', 'otto']);
  await playToTheEnd(page);
  await page.getByTestId('gf-results-share').click();
  const share = (await log(page)).find((e) => e.kind === 'share')?.value as string;
  expect(share).toMatch(/^Gone Fishing #45 · \d+ books? · .* · (no )?notebook$/u);
  expect(share).not.toMatch(/https?:|www\./);
  const result = (await log(page)).find((e) => e.kind === 'result')?.value as { daily: boolean };
  expect(result.daily).toBe(true);
});

test('the album, how to play and settings open, and Escape comes back to the menu', async ({
  page,
}) => {
  await open(page);
  for (const [menu, pageId] of [
    ['album', 'gf-album'],
    ['help', 'gf-help'],
    ['settings', 'gf-settings'],
  ] as const) {
    await page.getByTestId(`gf-menu-${menu}`).click();
    await expect(page.getByTestId(pageId)).toBeVisible();
    await look(page, pageId);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gf-title')).toBeVisible();
  }
});

test('every way out: Escape on the menu leaves, H on the results goes to the Hall', async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press('Escape');
  expect((await log(page)).some((e) => e.kind === 'navigate' && e.value === 'hall')).toBe(true);
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-quick-start').click();
  await playToTheEnd(page);
  await page.waitForTimeout(700);
  await page.keyboard.press('h');
  const navigations = (await log(page)).filter((e) => e.kind === 'navigate').map((e) => e.value);
  expect(navigations.at(-1)).toBe('hall');
});

test('pausing stops the pond, and the pause menu offers the notebook', async ({ page }) => {
  await open(page);
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-quick-start').click();
  const items = await page.evaluate(() => window.__gfItems!().map((i) => i.label));
  expect(items[0]).toContain('Notebook');
  await page.evaluate(() => window.__gfPause!());
  const before = await page.locator('[data-testid="gf-live"]').textContent();
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-testid="gf-live"]').textContent()).toBe(before);
  await page.evaluate(() => window.__gfPause!());
});
