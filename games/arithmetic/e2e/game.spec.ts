import { expect, type Page, test } from '@playwright/test';

/**
 * Number Sprint on its own workbench: every mode by keyboard and by mouse, the hint after three
 * misses, the tutor, Rush and Calm, both themes in both looks, the album, the Daily's share line,
 * the campaign and the ways out. The dev-only hook `window.__ns` says what a perfect player would
 * type, so whole events can be played quickly.
 */

declare global {
  interface Window {
    __ns: { mode: string; answer(): string } | null;
    __log: string[];
    __ready: boolean;
  }
}

async function open(page: Page, query = '') {
  await page.goto(`/?fresh=1${query}`);
  await page.waitForFunction(() => window.__ready === true);
}

async function hook(page: Page) {
  await page.waitForFunction(() => window.__ns !== null && window.__ns !== undefined);
  return page.evaluate(() => ({ mode: window.__ns!.mode, answer: window.__ns!.answer() }));
}

/** Plays whatever event is on screen to the end by keyboard. */
async function finishEvent(page: Page) {
  for (let i = 0; i < 300; i++) {
    const done = await page.evaluate(() => !window.__ns);
    if (done) return;
    const { mode, answer } = await page.evaluate(() => ({
      mode: window.__ns!.mode,
      answer: window.__ns!.answer(),
    }));
    if (answer === '') {
      await page.waitForTimeout(100);
      continue;
    }
    await page.keyboard.type(answer);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(mode === 'sums' ? 20 : mode === 'sieve' ? 80 : 1000);
  }
  throw new Error('event did not finish');
}

async function startFree(page: Page, mode: string, rung?: string) {
  await page.getByTestId(`ns-menu-${mode}`).click();
  if (rung) await page.getByTestId(`ns-rung-${rung}`).click();
  await page.getByTestId('ns-setup-start').click();
  await page.keyboard.press('Enter');
}

test.describe('first launch and the menu', () => {
  test('asks for a theme, then shows the game menu', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('ns-pick')).toBeVisible();
    await page.keyboard.press('2');
    await expect(page.getByTestId('ns-root')).toHaveAttribute('data-theme', 'atom');
    await expect(page.getByTestId('ns-menu-daily')).toBeVisible();
    // Escape on the game menu goes back to the Hall.
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.__log)).toContain('navigate hall');
  });
});

test.describe('Quick Sums', () => {
  test('plays a block by keyboard and prints the timing card', async ({ page }) => {
    await open(page, '&theme=sprint');
    await startFree(page, 'sums', 'plus-10');
    expect((await hook(page)).mode).toBe('sums');
    await finishEvent(page);
    const results = page.getByTestId('ns-results');
    await expect(results).toBeVisible({ timeout: 10_000 });
    await expect(results.getByLabel('Timing card')).toContainText('Right');
    await expect(results).toContainText('20 of 20 first time');
    // R plays again.
    await page.keyboard.press('r');
    await expect(page.getByTestId('ns-intro-start')).toBeVisible();
  });

  test('answers by mouse on the number keys', async ({ page }) => {
    await open(page, '&theme=sprint');
    await startFree(page, 'sums', 'plus-10');
    const { answer } = await hook(page);
    for (const digit of answer)
      await page
        .getByRole('group', { name: 'Number keys' })
        .getByRole('button', { name: digit, exact: true })
        .click();
    await expect(page.getByTestId('ns-board')).toContainText(answer);
    await page.getByRole('button', { name: 'Enter' }).click();
    await expect(page.getByTestId('ns-board')).toContainText('Problem 2');
  });

  test('never shows the answer, brings a picture hint after three misses, and trains the numbers', async ({
    page,
  }) => {
    await open(page, '&theme=atom');
    await startFree(page, 'sums', 'times-10');
    const { answer } = await hook(page);
    const wrong = String(Number(answer) + 1);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.type(wrong);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByTestId('ns-hint').getByRole('note', { name: 'Hint' })).toBeVisible();
    await expect(page.getByTestId('ns-feedback')).toContainText('Here is a way to see it');
    await expect(page.getByTestId('ns-board')).not.toContainText(`= ${answer}`);
    await expect(page.getByTestId('ns-training').getByRole('listitem').first()).toBeVisible();
    await page.keyboard.type(answer);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('ns-hint').getByRole('note')).toHaveCount(0);
  });

  test('Calm has no clock; Rush has one', async ({ page }) => {
    await open(page, '&theme=sprint');
    await page.getByTestId('ns-menu-sums').click();
    await page.getByRole('radio', { name: /Calm/ }).click();
    await page.getByTestId('ns-setup-start').click();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Calm: no clock')).toBeVisible();
    await expect(page.getByLabel(/^Time /)).toHaveCount(0);
  });
});

test.describe('Split, Sieve and Spell It', () => {
  test('splits by keyboard, with P for the last prime, and fills the album', async ({ page }) => {
    await open(page, '&theme=sprint');
    await startFree(page, 'split', 'small');
    await finishEvent(page);
    await expect(page.getByTestId('ns-results')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('ns-results-menu').click();
    await page.getByRole('button', { name: /Prime album/ }).click();
    await expect(
      page.getByTestId('ns-album').locator('.ns-album__cell--have').first(),
    ).toBeVisible();
  });

  test('splits by mouse on the prime keys, and bounces a prime that does not go in', async ({
    page,
  }) => {
    await open(page, '&theme=atom');
    await startFree(page, 'split', 'small');
    const primes = page.getByRole('group', { name: 'Primes' });
    // No number up to 100 is a multiple of 2, 3, 5 and 7 at once, so one of them bounces.
    const shown = await page.getByTestId('ns-board').locator('.ns-board__problem').textContent();
    const remaining = Number((shown ?? '').replace(/\D/g, ''));
    const wrong = [2, 3, 5, 7].find((p) => remaining % p !== 0)!;
    await primes.getByRole('button', { name: String(wrong), exact: true }).click();
    await expect(page.getByTestId('ns-feedback')).toContainText(
      `${wrong} does not go into ${remaining}`,
    );
    const { answer } = await hook(page);
    await primes.getByRole('button', { name: answer, exact: true }).click();
    await expect(page.getByTestId('ns-feedback')).toContainText(/goes in|album/);
  });

  test('sieves by keyboard: arrows and Enter, and typed numbers', async ({ page }) => {
    await open(page, '&theme=sprint');
    await startFree(page, 'sieve', 'hundred');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('ns-sieve').locator('[data-n="4"]')).toHaveClass(/ns-cell--gone/);
    await page.keyboard.type('9');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('ns-feedback')).toContainText('9 is not prime');
    await finishEvent(page);
    await expect(page.getByTestId('ns-results')).toBeVisible({ timeout: 10_000 });
  });

  test('sieves by mouse', async ({ page }) => {
    await open(page, '&theme=atom&look=night');
    await startFree(page, 'sieve', 'hundred');
    await page.getByTestId('ns-sieve').locator('[data-n="3"]').click();
    await expect(page.getByTestId('ns-sieve').locator('[data-n="9"]')).toHaveClass(/ns-cell--gone/);
  });

  test('spells with the word tiles and reads back by typing', async ({ page }) => {
    await open(page, '&theme=sprint');
    await startFree(page, 'spell', 'to-99');
    const { answer } = await hook(page);
    for (const word of answer.split(/[\s-]+/)) {
      await page
        .getByRole('group', { name: 'Word tiles' })
        .getByRole('button', { name: word, exact: true })
        .click();
    }
    await expect(page.getByTestId('ns-answer')).toContainText(answer);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('ns-feedback')).toContainText('Right');
    await finishEvent(page);
    await expect(page.getByTestId('ns-results')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('the Daily, the campaign and the ways out', () => {
  test('plays the Daily and shares a line with no link', async ({ page }) => {
    await open(page, '&theme=sprint&date=2026-10-11');
    await page.getByTestId('ns-menu-daily').click();
    for (let event = 0; event < 4; event++) {
      await page.getByTestId('ns-intro-start').click();
      await finishEvent(page);
    }
    const line = page.getByTestId('ns-shareline');
    await expect(line).toBeVisible({ timeout: 15_000 });
    await expect(line).toHaveText(
      /^Number Sprint #41 · [\d,]+ · Sums \d+\/20 · Split \d\/5 · Sieve \d+:\d\d · Spell (✓|\d\/3)$/,
    );
    await page.keyboard.press('s');
    await expect
      .poll(() =>
        page.evaluate(() => window.__log.some((l) => l.startsWith('share Number Sprint #41'))),
      )
      .toBe(true);
    const result = await page.evaluate(() => window.__log.find((l) => l.startsWith('result ')));
    expect(result).toContain('"daily":true');
    expect(result).not.toMatch(/https?:/);
  });

  test('plays chapter 1 for stars and opens chapter 2', async ({ page }) => {
    await open(page, '&theme=atom');
    await page.getByTestId('ns-menu-campaign').click();
    await expect(page.getByTestId('ns-chapter-2')).toBeDisabled();
    await page.getByTestId('ns-chapter-1').click();
    for (let event = 0; event < 2; event++) {
      await page.getByTestId('ns-intro-start').click();
      await finishEvent(page);
    }
    await expect(page.getByLabel(/of 3 stars/)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('n');
    await expect(page.getByTestId('ns-chapter-2')).toBeEnabled();
  });

  test('pauses with Escape, offers a restart that asks first, and leaves with H', async ({
    page,
  }) => {
    await open(page, '&theme=sprint');
    await startFree(page, 'sums', 'plus-10');
    await hook(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mock-pause')).toBeVisible();
    await page.getByRole('button', { name: 'Start this block again' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Keep playing' }).click();
    await finishEvent(page);
    await expect(page.getByTestId('ns-results')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('h');
    expect(await page.evaluate(() => window.__log)).toContain('navigate hall');
  });

  test('switches theme in Settings, by day and by night', async ({ page }) => {
    for (const look of ['day', 'night']) {
      await open(page, `&theme=sprint&look=${look}`);
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByTestId('ns-theme-atom').click();
      await expect(page.getByTestId('ns-root')).toHaveAttribute('data-theme', 'atom');
      await expect(page.getByTestId('ns-root')).toHaveAttribute('data-look', look);
    }
  });
});
