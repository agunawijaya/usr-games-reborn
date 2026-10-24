import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Fifteen-Two on its workbench (the game outside the Hall, with a stand-in for the Hall's
 * context): whole short games played by mouse and by keyboard, the three counting modes, the
 * coach, the counting trainer, the Daily Discard and its share line, Continue, and every way
 * out. The development hook `window.__ft` reads the game's state; moves are made the way a
 * player makes them unless a test says otherwise.
 */

type Phase =
  | 'menu'
  | 'lay-away'
  | 'play'
  | 'claim'
  | 'next-hand'
  | 'busy'
  | 'over'
  | 'results'
  | 'trainer'
  | 'daily';

const phase = (page: Page) => page.evaluate(() => window.__ft!.phase() as Phase);

async function open(page: Page, query = '') {
  await page.goto(`/?game&fresh=1&appearance=light${query}`);
  await page.waitForFunction(() => window.__sceneReady === true && window.__ft !== undefined);
}

async function waitForPhase(page: Page, wanted: Phase[], timeout = 60_000): Promise<Phase> {
  await page.waitForFunction(
    (list: string[]) => list.includes(window.__ft!.phase()),
    wanted as string[],
    { timeout },
  );
  return phase(page);
}

async function startGame(
  page: Page,
  options: { counting?: string; length?: string; level?: string; seed: string },
) {
  await page.getByTestId('ft-menu-new').click();
  await page.getByTestId(`ft-choice-length-${options.length ?? '61'}`).check();
  await page.getByTestId(`ft-choice-counting-${options.counting ?? 'automatic'}`).check();
  if (options.level) await page.getByTestId(`ft-choice-level-${options.level}`).check();
  await page.evaluate((seed) => {
    window.__ft!.nextSeed(seed);
    window.__ft!.fast(8);
  }, options.seed);
  await page.getByTestId('ft-start').click();
}

const results = (page: Page) =>
  page.evaluate(() =>
    (window.__ftLog ?? [])
      .filter((entry) => entry.kind === 'result')
      .map((entry) => entry.value as { outcome: string; daily?: boolean; score?: number }),
  );

test('a short game played with the mouse', async ({ page }) => {
  await open(page);
  await startGame(page, { seed: 'mouse-1' });
  for (let moves = 0; moves < 300; moves++) {
    const now = await waitForPhase(page, ['lay-away', 'play', 'next-hand', 'results']);
    if (now === 'results') break;
    if (now === 'lay-away') {
      const cards = page.getByTestId('ft-hand-card');
      await expect(cards).toHaveCount(6);
      await cards.nth(0).click();
      await cards.nth(5).click();
      await expect(page.getByTestId('ft-throw')).toBeEnabled();
      await page.getByTestId('ft-throw').click();
    } else if (now === 'play') {
      const playable = page.locator('[data-testid="ft-hand-card"][aria-disabled="false"]');
      await playable.first().click();
    } else {
      await page.getByTestId('ft-next-hand').click();
    }
    await page.waitForFunction((before) => window.__ft!.phase() !== before, now, {
      timeout: 30_000,
    });
  }
  await expect(page.getByTestId('ft-results')).toBeVisible();
  const [result] = await results(page);
  expect(['win', 'loss']).toContain(result!.outcome);
  // Results in the standard order, then back to the game menu.
  const order = await page.locator('.ft-results-actions button').allTextContents();
  expect(order.map((label) => label.replace(/[RH]$/, '').trim())).toEqual([
    'Play again',
    'Game menu',
    'Back to the Hall',
  ]);
  await page.getByTestId('ft-results-menu').click();
  await expect(page.getByTestId('ft-title')).toBeVisible();
});

test('a short game played with the keyboard, counting your own hands', async ({ page }) => {
  await open(page);
  await page.getByTestId('ft-menu-new').focus();
  await page.keyboard.press('n');
  await page.getByTestId('ft-choice-length-61').check();
  await page.getByTestId('ft-choice-counting-yourself').check();
  await page.evaluate(() => {
    window.__ft!.nextSeed('keys-1');
    window.__ft!.fast(8);
  });
  await page.getByTestId('ft-start').focus();
  await page.keyboard.press('Enter');
  for (let moves = 0; moves < 300; moves++) {
    const now = await waitForPhase(page, ['lay-away', 'play', 'claim', 'next-hand', 'results']);
    if (now === 'results') break;
    if (now === 'lay-away') {
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-testid') === 'ft-hand-card',
      );
      await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
    } else if (now === 'play') {
      await page.waitForFunction(
        () => document.activeElement?.getAttribute('data-testid') === 'ft-hand-card',
      );
      // The first playable card has the focus when the turn begins.
      await page.keyboard.press('Enter');
    } else if (now === 'claim') {
      const truth = await page.evaluate(() => window.__ft!.trueCount());
      await page.getByTestId('ft-claim-input').waitFor();
      await page.keyboard.type(String(truth));
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForFunction((before) => window.__ft!.phase() !== before, now, {
      timeout: 30_000,
    });
  }
  await expect(page.getByTestId('ft-results')).toBeVisible();
  await expect(page.getByTestId('ft-results')).toContainText(/Counted right/);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ft-title')).toBeVisible();
});

/** Plays on with the hook until the next claim is asked for. */
async function toNextClaim(page: Page): Promise<number> {
  for (let i = 0; i < 200; i++) {
    const now = await waitForPhase(page, ['lay-away', 'play', 'claim', 'next-hand', 'results']);
    if (now === 'claim') return (await page.evaluate(() => window.__ft!.trueCount()))!;
    if (now === 'results') throw new Error('the game ended before a claim');
    if (now === 'next-hand') await page.evaluate(() => window.__ft!.next());
    else await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
    await page.waitForFunction((before) => window.__ft!.phase() !== before, now, {
      timeout: 30_000,
    });
  }
  throw new Error('no claim came');
}

test('Classic 1980: an over-count pegs 2 for the computer, an under-count is lost, 19 is nothing', async ({
  page,
}) => {
  await open(page);
  await startGame(page, { counting: 'classic-1980', length: '121', seed: 'classic-claims-2' });
  // Over-count.
  let truth = await toNextClaim(page);
  let before = await page.evaluate(() => window.__ft!.state()!.scores);
  await page.evaluate(
    (v) => window.__ft!.claim(v),
    Math.min(29, truth + 3) === truth ? 28 : Math.min(29, truth + 3),
  );
  await page.waitForFunction(() => window.__ft!.phase() !== 'claim');
  let after = await page.evaluate(() => window.__ft!.state()!.scores);
  expect(after[0]).toBe(Math.min(121, before[0] + truth));
  expect(after[1]).toBe(before[1] + 2);
  await expect(page.locator('.ft-ledger__note')).toContainText('pegs 2 for the over-count', {
    timeout: 30_000,
  });
  // Under-count (or 19 for a hand worth nothing).
  truth = await toNextClaim(page);
  before = await page.evaluate(() => window.__ft!.state()!.scores);
  const claim = truth > 0 ? truth - 1 : 19;
  await page.evaluate((v) => window.__ft!.claim(v), claim);
  await page.waitForFunction(() => window.__ft!.phase() !== 'claim');
  after = await page.evaluate(() => window.__ft!.state()!.scores);
  expect(after[0]).toBe(before[0] + (truth > 0 ? truth - 1 : 0));
  expect(after[1]).toBe(before[1]);
});

test('Count yourself shows the true count and pegs it in full', async ({ page }) => {
  await open(page);
  await startGame(page, { counting: 'yourself', length: '121', seed: 'yourself-1' });
  const truth = await toNextClaim(page);
  const before = await page.evaluate(() => window.__ft!.state()!.scores);
  await page.evaluate((v) => window.__ft!.claim(v), truth + 2);
  await page.waitForFunction(() => window.__ft!.phase() !== 'claim');
  const after = await page.evaluate(() => window.__ft!.state()!.scores);
  expect(after[0]).toBe(before[0] + truth);
  expect(after[1]).toBe(before[1]);
  await expect(page.locator('.ft-ledger__note')).toContainText('Pegged in full', {
    timeout: 30_000,
  });
});

test('Automatic counts for you and never asks', async ({ page }) => {
  await open(page);
  await startGame(page, { seed: 'auto-1' });
  for (let i = 0; i < 60; i++) {
    const now = await waitForPhase(page, ['lay-away', 'play', 'claim', 'next-hand', 'results']);
    expect(now).not.toBe('claim');
    if (now === 'next-hand') break;
    await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
    await page.waitForFunction((before) => window.__ft!.phase() !== before, now, {
      timeout: 30_000,
    });
  }
  await expect(page.locator('.ft-ledger')).toBeHidden();
});

test('the coach shows the throw and the play, and goes quiet when switched off', async ({
  page,
}) => {
  await open(page);
  await startGame(page, { seed: 'coach-1' });
  await waitForPhase(page, ['lay-away']);
  await expect(page.getByTestId('ft-coach')).toBeVisible();
  await expect(page.getByTestId('ft-coach')).toContainText('Throw');
  const items = await page.evaluate(() => window.__ftItems!().map((item) => item.label));
  expect(items).toContain('Coach off');
  await page.keyboard.press('c');
  await expect(page.getByTestId('ft-coach')).toBeHidden();
  expect(await page.evaluate(() => window.__ftItems!().map((item) => item.label))).toContain(
    'Coach on',
  );
  await page.keyboard.press('c');
  await expect(page.getByTestId('ft-coach')).toBeVisible();
  await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
  const now = await waitForPhase(page, ['play', 'next-hand']);
  if (now === 'play') await expect(page.getByTestId('ft-coach')).toContainText('Lay the');
});

test('the counting trainer: ten hands, results, and the record kept', async ({ page }) => {
  await open(page);
  await page.getByTestId('ft-menu-trainer').click();
  await page.evaluate(() => window.__ft!.nextSeed('trainer-e2e'));
  await page.getByTestId('ft-trainer-relaxed').click();
  for (let hand = 0; hand < 10; hand++) {
    await page.waitForFunction(() => window.__ft!.trainerAnswer() !== null, undefined, {
      timeout: 20_000,
    });
    const answer = await page.evaluate(() => window.__ft!.trainerAnswer()!);
    await page.getByTestId('ft-claim-input').fill(String(hand === 3 ? answer + 1 : answer));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__ft!.trainerAnswer() === null);
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
  }
  await waitForPhase(page, ['results']);
  await expect(page.getByTestId('ft-results')).toContainText('9 counted right');
  const [result] = await results(page);
  expect(result).toMatchObject({ outcome: 'complete', score: 9 });
  await page.getByTestId('ft-results-menu').click();
  await page.getByTestId('ft-menu-trainer').click();
  await expect(page.getByTestId('ft-trainer')).toContainText('Hands counted right so far: 9');
});

test('the Daily Discard: lay away by drag, see the verdict, share it', async ({ page }) => {
  await open(page, '&date=2026-10-12');
  await page.getByTestId('ft-menu-daily').click();
  await page.getByTestId('ft-daily-play').click();
  await waitForPhase(page, ['daily']);
  await expect(page.getByTestId('ft-coach')).toHaveCount(0);
  const cards = page.getByTestId('ft-hand-card');
  await expect(cards).toHaveCount(6);
  await cards.nth(1).click();
  // The second card is dragged to the crib, which lays the two away.
  const box = (await cards.nth(4).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Between the two crib places, near enough to whichever one is today's.
  await page.mouse.move(400, 600, { steps: 12 });
  await page.mouse.move(234, 513, { steps: 6 });
  await page.mouse.up();
  await waitForPhase(page, ['results']);
  await expect(page.getByTestId('ft-results')).toContainText('of the best');
  const [result] = await results(page);
  expect(result).toMatchObject({ outcome: 'complete', daily: true });
  await page.getByTestId('ft-results-share').click();
  const shared = await page.evaluate(
    () => (window.__ftLog ?? []).find((entry) => entry.kind === 'share')?.value as string,
  );
  expect(shared).toMatch(/^Fifteen-Two #42 · discard \d+% of best · 🃏{1,3}$/);
  // A second look the same day shows the verdict again and reports nothing new.
  await page.getByTestId('ft-results-menu').click();
  await page.getByTestId('ft-menu-daily').click();
  await page.getByTestId('ft-daily-review').click();
  await waitForPhase(page, ['results']);
  expect(await results(page)).toHaveLength(1);
});

test('a game left part-way can be continued', async ({ page }) => {
  await page.goto('/?game&appearance=light');
  await page.waitForFunction(() => window.__ft !== undefined);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__ft !== undefined);
  await startGame(page, { seed: 'continue-1' });
  await waitForPhase(page, ['lay-away']);
  await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
  await waitForPhase(page, ['play', 'next-hand']);
  const scores = await page.evaluate(() => window.__ft!.state()!.scores);
  await page.reload();
  await page.waitForFunction(() => window.__ft !== undefined);
  await expect(page.getByTestId('ft-menu-continue')).toBeVisible();
  await page.getByTestId('ft-menu-continue').click();
  await waitForPhase(page, ['play', 'next-hand', 'busy']);
  expect(await page.evaluate(() => window.__ft!.state()!.scores)).toEqual(scores);
  await page.evaluate(() => localStorage.clear());
});

test('every way out', async ({ page }) => {
  await open(page);
  const log = () =>
    page.evaluate(() =>
      (window.__ftLog ?? []).filter((e) => e.kind === 'navigate').map((e) => e.value),
    );
  // Escape on a page returns to the game menu; on the game menu it leaves for the Hall.
  await page.getByTestId('ft-menu-help').click();
  await expect(page.getByTestId('ft-help')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ft-title')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await log()).toEqual(['hall']);
  // H on a results card goes back to the Hall.
  await page.getByTestId('ft-menu-trainer').click();
  await page.evaluate(() => window.__ft!.nextSeed('exit-trainer'));
  await page.getByTestId('ft-trainer-relaxed').click();
  for (let hand = 0; hand < 10; hand++) {
    await page.waitForFunction(() => window.__ft!.trainerAnswer() !== null, undefined, {
      timeout: 20_000,
    });
    await page.evaluate((v) => window.__ft!.trainerSubmit(v), 0);
    await page.waitForFunction(() => window.__ft!.trainerAnswer() === null);
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
  }
  await waitForPhase(page, ['results']);
  await page.waitForTimeout(700);
  await page.keyboard.press('h');
  expect(await log()).toEqual(['hall', 'hall']);
  // The game menu tells the Hall it is the title screen; play does not.
  const titles = await page.evaluate(() =>
    (window.__ftLog ?? []).filter((e) => e.kind === 'title').map((e) => e.value),
  );
  expect(titles[0]).toBe(true);
  expect(titles).toContain(false);
});

test('reduced motion: a hand plays through with cards put in place', async ({ page }) => {
  await open(page, '&reduced=1');
  await startGame(page, { seed: 'reduced-1' });
  for (let i = 0; i < 80; i++) {
    const now = await waitForPhase(page, ['lay-away', 'play', 'next-hand', 'results']);
    if (now === 'next-hand' || now === 'results') break;
    await page.evaluate(() => window.__ft!.act(window.__ft!.best()));
    await page.waitForFunction((before) => window.__ft!.phase() !== before, now, { timeout: 30_000 });
  }
  expect(['next-hand', 'results']).toContain(await phase(page));
});

for (const appearance of ['light', 'dark'] as const) {
  test(`no serious accessibility problems on the main screens (${appearance})`, async ({ page }) => {
    await page.goto(`/?game&fresh=1&appearance=${appearance}&chrome=0`);
    await page.waitForFunction(() => window.__ft !== undefined);
    const check = async (where: string) => {
      const results = await new AxeBuilder({ page })
        .include('.ft-app')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${where}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    };
    await check('game menu');
    await page.getByTestId('ft-menu-new').click();
    await check('new game');
    await page.evaluate(() => window.__ft!.nextSeed('axe-1'));
    await page.getByTestId('ft-start').click();
    await waitForPhase(page, ['lay-away']);
    await page.waitForTimeout(1500);
    await check('lay-away');
    await page.keyboard.press('Escape');
  });
}
