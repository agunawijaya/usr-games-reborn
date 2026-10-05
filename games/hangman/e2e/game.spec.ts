import { expect, type Page, test } from '@playwright/test';
import './hook';

/**
 * Before the Tide on its workbench, played the way a person plays it: keys and clicks, the
 * Lighthouse, the Daily's share line, a Duel's privacy screens, a Tide run's repairs, reduced
 * motion and every way out. `window.__bt` reads the session and can finish a word quickly.
 */
async function open(page: Page, query = '') {
  await page.goto(`/?fresh=1${query}`);
  await page.waitForFunction(() => window.__ready === true);
  await expect(page.getByTestId('bt-menu')).toBeVisible();
}

const hook = (page: Page) => page.evaluate(() => window.__bt.play()!.session);
const word = (page: Page) => page.evaluate(() => window.__bt.play()!.word);
const solve = (page: Page) => page.evaluate(() => window.__bt.play()!.solve());
const lose = (page: Page) => page.evaluate(() => window.__bt.play()!.lose());
const log = (page: Page) => page.evaluate(() => window.__log ?? []);

async function startBeach(page: Page) {
  await page.getByRole('button', { name: /Beach day/ }).click();
  await page
    .getByTestId('bt-decks')
    .getByRole('button', { name: /To the beach/ })
    .click();
  await expect(page.getByTestId('bt-keys')).toBeVisible();
}

function missingLetter(secret: string): string {
  return [...'zqxjkvwyfbgpmhd'].find((letter) => !secret.includes(letter))!;
}

test('keyboard play: letters fill the sand, wrong ones send waves, Enter moves on', async ({
  page,
}) => {
  await open(page);
  await startBeach(page);
  const secret = await word(page);
  await page.keyboard.press(`Key${secret[0]!.toUpperCase()}`);
  await expect(page.getByTestId('bt-word')).toHaveAttribute(
    'aria-label',
    new RegExp(secret[0]!.toUpperCase()),
  );
  const wrong = missingLetter(secret);
  await page.keyboard.press(`Key${wrong.toUpperCase()}`);
  expect((await hook(page)).round.waves).toBe(1);
  await expect(page.locator(`.bt-key[data-letter="${wrong}"]`)).toHaveClass(/bt-key--wrong/);
  await expect(page.getByTestId('bt-status')).toContainText('A wave comes in');

  // A repeat is turned away without a wave, as in the original.
  await page.keyboard.press(`Key${wrong.toUpperCase()}`);
  await expect(page.getByTestId('bt-status')).toContainText('No wave');
  expect((await hook(page)).round.waves).toBe(1);

  await solve(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bt-card')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bt-keys')).toBeVisible();
  expect((await hook(page)).round.tried).toEqual([]);
});

test('mouse play: shells are buttons, and used ones sink but stay readable', async ({ page }) => {
  await open(page);
  await startBeach(page);
  const secret = await word(page);
  const right = page.locator(`.bt-key[data-letter="${secret[0]}"]`);
  await right.click();
  await expect(right).toHaveClass(/bt-key--right/);
  await expect(right).toHaveAttribute('aria-label', /in the word/);
  await expect(right).toBeVisible();
});

test('the Lighthouse shows a letter for a wave, and rests at six', async ({ page }) => {
  await open(page);
  await startBeach(page);
  await page.getByTestId('bt-lighthouse').click();
  const session = await hook(page);
  expect(session.round.waves).toBe(1);
  expect(session.round.tried).toHaveLength(1);
  await expect(page.getByTestId('bt-status')).toContainText('The Lighthouse shows');
});

test('the Daily Word shares waves, never the word', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Daily Word/ }).click();
  await expect(page.getByTestId('bt-lighthouse')).toHaveCount(0);
  await solve(page);
  await page.keyboard.press('Enter');
  const results = page.getByTestId('bt-results');
  await expect(results).toBeVisible();
  const line = (await page.getByTestId('bt-share-line').textContent())!;
  expect(line).toMatch(/^Before the Tide #\d+ · 🏰 not a single wave · ⬜{7}$/);
  expect(line.toLowerCase()).not.toContain((await word(page)).toLowerCase());
  await results.getByRole('button', { name: 'Share' }).click();
  await expect
    .poll(() => log(page))
    .toContainEqual(expect.stringContaining('share Before the Tide #'));
  await expect.poll(() => log(page)).toContainEqual(expect.stringContaining('"daily":true'));
});

test('a Duel hides the secret word behind privacy screens', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Duel/ }).click();
  await page.getByTestId('bt-duel-name-1').fill('Ada');
  await page.getByTestId('bt-duel-name-2').fill('Ken');
  await page.getByRole('radio', { name: '1 each' }).click();
  await page.getByRole('button', { name: 'Start the duel' }).click();

  const privacy = page.getByTestId('bt-privacy');
  await expect(privacy).toContainText('Pass the device to Ada');
  await expect(page.getByTestId('bt-keys')).toHaveCount(0);
  await privacy.getByRole('button', { name: /I am Ada/ }).click();
  const secret = page.getByTestId('bt-secret');
  await expect(secret).toHaveAttribute('type', 'password');
  await secret.fill('sand castle');
  await privacy.getByRole('button', { name: 'Hide it in the sand' }).click();
  await expect(privacy).toContainText('Letters only');
  await secret.fill('lagoon');
  await privacy.getByRole('button', { name: 'Hide it in the sand' }).click();
  await expect(privacy).toContainText('Pass the device to Ken');
  await privacy.getByRole('button', { name: /I am Ken/ }).click();
  await expect(privacy).toHaveCount(0);
  expect(await word(page)).toBe('lagoon');
  await solve(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bt-card')).toBeVisible();
  await page.getByRole('button', { name: 'Next turn' }).click();
  await expect(page.getByTestId('bt-privacy')).toContainText('Pass the device to Ken');
});

test('a Tide run mends a section after a clean word', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Tide run/ }).click();
  const secret = await word(page);
  await page.keyboard.press(`Key${missingLetter(secret).toUpperCase()}`);
  await solve(page);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /Word 2 of 10/ }).click();
  expect((await hook(page)).run!.standing).toBe(6);
  await expect(page.locator('.bt-gauge')).toContainText('1 of 7');
  await solve(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bt-card')).toContainText('mends a section');
  expect((await hook(page)).run!.standing).toBe(7);
});

test('reduced motion: waves become fades, the sea stays calm', async ({ page }) => {
  await open(page, '&motion=reduce');
  await expect(page.getByTestId('bt-root')).toHaveAttribute('data-motion', 'reduce');
  await startBeach(page);
  const secret = await word(page);
  await page.keyboard.press(`Key${missingLetter(secret).toUpperCase()}`);
  await page.waitForTimeout(150);
  const beach = await page.evaluate(() => window.__bt.play()!.beach());
  expect(beach.still).toBe(true);
  expect(beach.swell).toBe(0);
  expect(beach.surge).toBe(0);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.__bt.play()!.beach());
  expect(after.sections.moat!.slump).toBe(1);
});

test('every way out: Back to the Hall, the game menu, play again', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '← Back to the Hall' }).click();
  await expect.poll(() => log(page)).toContainEqual('navigate hall');

  await page.getByRole('button', { name: /Classic/ }).click();
  expect((await word(page)).length).toBeGreaterThanOrEqual(6);
  await expect(page.getByTestId('bt-lighthouse')).toHaveCount(0);
  await lose(page);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Head home' }).click();
  const results = page.getByTestId('bt-results');
  await expect(results).toContainText('Tide average');
  await expect(results).toContainText('9.000');
  await page.keyboard.press('KeyR');
  await expect(page.getByTestId('bt-keys')).toBeVisible();
  await lose(page);
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Head home' }).click();
  await page.getByTestId('bt-results').getByRole('button', { name: 'Game menu' }).click();
  await expect(page.getByTestId('bt-menu')).toBeVisible();
  await page.getByRole('button', { name: /Tutorial/ }).click();
  await expect(page.getByTestId('bt-coach')).toContainText('Try E');
  await solve(page);
  await page.keyboard.press('Enter');
  await page.keyboard.press('KeyH');
  await expect.poll(() => log(page)).toContainEqual('navigate hall');
});
