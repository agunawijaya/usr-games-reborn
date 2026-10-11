import { expect, type Page, test } from '@playwright/test';
import { boardWords, cellCentre, foundWords, trace, waitForPlay } from './hook';

/**
 * Chain Letter on its workbench: every way to make a word, the feedback for words that do not
 * count, the reveal, each mode, the Daily share and the ways out.
 */

const LOG = () => (window as unknown as { __log: string[] }).__log;

async function open(page: Page, query = '') {
  await page.goto(`/?fresh=1&date=2026-10-11${query}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await expect(page.getByTestId('chl-title')).toBeVisible();
}

async function startClassic(page: Page, query = '') {
  await open(page, query);
  await page.getByTestId('chl-mode-classic').click();
  await waitForPlay(page);
}

async function revealNow(page: Page) {
  await page.getByTestId('mock-pill').click();
  await page.getByTestId('mock-item-show-board').click();
  await expect(page.getByTestId('chl-reveal')).toBeVisible({ timeout: 10_000 });
}

async function wallCount(page: Page): Promise<number> {
  return page.locator('.chl-wall__list > .chl-tag').count();
}

test('dragging across cubes claims the word and files it on the wall', async ({ page }) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 4)!;
  await trace(page, word.path);
  await expect(page.locator('.chl-wall__list .chl-tag__word').first()).toHaveText(
    word.word.toUpperCase(),
  );
  expect(await foundWords(page)).toEqual([word.word]);
  await expect(page.locator('.chl-cover__counts')).toContainText('1 of');
});

test('typing a word and pressing Enter claims it; letters not on the board are marked', async ({
  page,
}) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => !w.word.includes('qu') && w.word.length === 4)!;
  await page.keyboard.type(word.word);
  await expect(page.locator('.chl-chip')).toHaveCount(4);
  await page.keyboard.press('Enter');
  expect(await foundWords(page)).toContain(word.word);
  await page.keyboard.type('zzzz');
  await expect(page.locator('.chl-current')).toHaveAttribute('data-stray', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('.chl-feedback')).toContainText('cannot be traced');
});

test('a repeated word pulses instead of scoring twice, and a non-word is refused', async ({
  page,
}) => {
  await startClassic(page);
  const words = await boardWords(page);
  const word = words.find((w) => w.word.length >= 4)!;
  await trace(page, word.path);
  await trace(page, word.path);
  await expect(page.locator('.chl-feedback')).toContainText('on your wall already');
  expect(await wallCount(page)).toBe(1);
  // A three-cube path that spells no word on the board's list.
  const known = new Set(words.map((w) => w.word));
  const path = await page.evaluate(
    (list) => {
      const app = (
        window as unknown as { __chl: { live: { deal: { roll: { board: { faces: string[] } } } } } }
      ).__chl;
      const faces = app.live.deal.roll.board.faces;
      const rows = [
        [0, 1, 2],
        [4, 5, 6],
        [8, 9, 10],
        [12, 13, 14],
        [1, 2, 3],
      ];
      return rows.find((p) => !list.includes(p.map((c) => faces[c]).join(''))) ?? rows[0]!;
    },
    [...known],
  );
  await trace(page, path);
  await expect(page.locator('.chl-feedback')).toContainText(/not in the dictionary|Words need/);
  expect(await wallCount(page)).toBe(1);
});

test('cubes can be clicked one by one, the last clicked again to claim', async ({ page }) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 3)!;
  for (const cell of word.path) {
    const point = await cellCentre(page, cell);
    await page.mouse.click(point.x, point.y);
  }
  const last = await cellCentre(page, word.path.at(-1)!);
  await page.mouse.click(last.x, last.y);
  expect(await foundWords(page)).toContain(word.word);
});

test('the arrow keys and Space build a word cube by cube', async ({ page }) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 3)!;
  for (const cell of word.path) {
    await page.locator(`.chl-cube[data-cell="${cell}"]`).focus();
    await page.keyboard.press('Space');
  }
  await page.getByTestId('chl-claim').click();
  expect(await foundWords(page)).toContain(word.word);
});

test('typed letters are claimed by Enter even while a cube has focus', async ({ page }) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => !w.word.includes('qu') && w.word.length >= 4)!;
  await page.locator('.chl-cube[data-cell="0"]').focus();
  await page.keyboard.type(word.word);
  await page.keyboard.press('Enter');
  expect(await foundWords(page)).toContain(word.word);
});

test('the reveal traces any word pointed at and names its sources', async ({ page }) => {
  await startClassic(page);
  await revealNow(page);
  const first = page.locator('.chl-word').first();
  await first.hover();
  await expect(page.locator('.chl-source')).toBeVisible();
  await expect(page.locator('.chl-source')).toHaveText('SCOWL + ENABLE');
  await page.getByTestId('chl-menu').click();
  await expect(page.getByTestId('chl-title')).toBeVisible();
});

test('the reveal reports the round to the Hall and offers the ways out', async ({ page }) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 4)!;
  await trace(page, word.path);
  await revealNow(page);
  const log = await page.evaluate(LOG);
  expect(
    log.some((line) => line.startsWith('result ') && line.includes('"presentation":"game"')),
  ).toBe(true);
  expect(log).toContain('package first-chain');
  await page.keyboard.press('h');
  expect(await page.evaluate(LOG)).toContain('navigate hall');
  await page.keyboard.press('r');
  await waitForPlay(page);
});

test('New board asks first once words are on the wall', async ({ page }) => {
  await startClassic(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 4)!;
  await trace(page, word.path);
  await page.getByTestId('mock-pill').click();
  await page.getByTestId('mock-item-new-board').click();
  await expect(page.locator('.chl-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.chl-dialog')).toHaveCount(0);
  expect(await foundWords(page)).toContain(word.word);
});

test('the tutorial holds the clock until a word is traced and one typed', async ({ page }) => {
  await open(page);
  await page.getByTestId('chl-mode-tutorial').click();
  await waitForPlay(page);
  await expect(page.getByTestId('chl-coach')).toContainText('Drag across the glowing cubes');
  await page.waitForTimeout(1500);
  await expect(page.locator('.chl-clock__digits')).toHaveText('1:00');
  const words = await boardWords(page);
  const hinted = await page.evaluate(() => {
    const coach = document.querySelector('[data-testid="chl-coach"]')!.textContent ?? '';
    return /spell ([A-Z]+)/.exec(coach)?.[1]?.toLowerCase() ?? '';
  });
  await trace(page, words.find((w) => w.word === hinted)!.path);
  await expect(page.getByTestId('chl-coach')).toContainText('type');
});

test('the Daily Grid shares a link-free line with its number, share and squares', async ({
  page,
}) => {
  await open(page);
  await page.getByTestId('chl-mode-daily').click();
  await waitForPlay(page);
  const word = (await boardWords(page)).find((w) => w.word.length >= 4)!;
  await trace(page, word.path);
  await revealNow(page);
  await page.getByTestId('chl-share').click();
  const share = (await page.evaluate(LOG)).find((line) => line.startsWith('share '))!;
  expect(share).toMatch(
    /^share Chain Letter #\d+ · 1 word · \d+% of the board · longest: [A-Z]+ · [🟩🟨⬛⬜]{3}$/u,
  );
  expect(share).not.toMatch(/https?:/);
});

test('Zen has no clock and ends when asked', async ({ page }) => {
  await open(page);
  await page.getByTestId('chl-mode-zen').click();
  await page.getByTestId('chl-start').click();
  await waitForPlay(page);
  await expect(page.locator('.chl-clock__label')).toHaveText('untimed');
  await page.locator('.chl-finish').click();
  await expect(page.getByTestId('chl-reveal')).toBeVisible({ timeout: 10_000 });
});

test('a Duel shows the hunter at work and a verdict at the end', async ({ page }) => {
  await open(page);
  await page.getByTestId('chl-mode-duel').click();
  await page.getByTestId('chl-pick-strength-5').check();
  await page.getByTestId('chl-start').click();
  await waitForPlay(page);
  await expect(page.getByTestId('chl-hunter')).toContainText('Lexicon');
  await page.waitForTimeout(4500);
  await revealNow(page);
  await expect(page.getByTestId('chl-banner')).toContainText('Lexicon');
  await expect(page.locator('[data-tab="hunter"]')).toBeVisible();
});

test('Pass and play hands the same board to the second player', async ({ page }) => {
  await open(page);
  await page.getByTestId('chl-mode-pass').click();
  await page.getByTestId('chl-name-0').fill('Ada');
  await page.getByTestId('chl-name-1').fill('Grace');
  await page.getByTestId('chl-start').click();
  await waitForPlay(page);
  const firstBoard = await page.evaluate(() =>
    (
      window as unknown as { __chl: { live: { deal: { roll: { board: { faces: string[] } } } } } }
    ).__chl.live.deal.roll.board.faces.join(''),
  );
  await page.getByTestId('mock-pill').click();
  await page.getByTestId('mock-item-show-board').click();
  await expect(page.getByTestId('chl-handoff')).toBeVisible({ timeout: 10_000 });
  await page.getByTestId('chl-handoff-go').click();
  await waitForPlay(page);
  const secondBoard = await page.evaluate(() =>
    (
      window as unknown as { __chl: { live: { deal: { roll: { board: { faces: string[] } } } } } }
    ).__chl.live.deal.roll.board.faces.join(''),
  );
  expect(secondBoard).toBe(firstBoard);
  await revealNow(page);
  await expect(page.getByTestId('chl-banner')).toContainText('Ada');
  await expect(page.getByTestId('chl-banner')).toContainText('Grace');
});

test('larger grids stay locked until the board-reading level opens them', async ({ page }) => {
  await open(page);
  await page.getByTestId('chl-mode-setup').click();
  await expect(page.getByTestId('chl-pick-size-5')).toBeDisabled();
  await expect(page.getByTestId('chl-pick-size-6')).toBeDisabled();
  await page.getByTestId('chl-pick-rule-echo').check();
  await page.getByTestId('chl-start').click();
  await waitForPlay(page);
  await expect(page.locator('.chl-rule')).toContainText('Echo');
});

test('with reduced motion the cubes are simply there', async ({ page }) => {
  await startClassic(page, '&motion=reduce');
  await expect(page.locator('.chl-cube').first()).toBeEnabled();
});
