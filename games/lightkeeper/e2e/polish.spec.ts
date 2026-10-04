import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { type HallSeed, runInHall } from '../../../packages/bridge/testing/hall';

/**
 * The polish pass (prompt P1-L): the log drawer by mouse and by keyboard, the saved-world moment
 * (played, skipped, and under reduced motion), the flare preview agreeing with its card, the
 * results card at 1280×720 and 1920×1080, and axe on the play screen in both looks.
 *
 * Open-watch codes keep every watch the same: `test-40` starts a Cadet beside two gleaners, and
 * in `lantern-rook` the workbench's autopilot saves a world in the Lantern's zone with its
 * eleventh order (found with `scripts/find-rescue.ts`).
 */

interface FlareGuide {
  from: { x: number; y: number };
  to: { x: number; y: number };
  wedges: { from: number; to: number; faint: boolean }[];
}

type Workbench = Window & {
  __lightkeeperAutopilot(orders: number): unknown;
  __lightkeeperBlooming(): string | null;
  __lightkeeperFlareGuide(): FlareGuide | null;
};

async function openWatch(page: Page, code: string, seed: HallSeed = {}) {
  await runInHall(page, 'lightkeeper', seed);
  await expect(page.getByTestId('lk-title')).toBeVisible();
  await page.getByTestId('lk-menu-open').click();
  await page.getByTestId('lk-open-code').fill(code);
  await page.getByRole('radio', { name: /^Cadet/ }).click();
  await page.getByRole('radio', { name: /Short/ }).click();
  await page.getByRole('radio', { name: /1976/ }).click();
  await page.getByTestId('lk-open-begin').click();
  await page.getByTestId('lk-begin').click();
  await expect(page.getByTestId('lk-play')).toBeVisible();
  // On a cold dev server the workbench's hooks can arrive a moment after the screen.
  await page.waitForFunction(() => '__lightkeeperAutopilot' in window);
}

function autopilot(page: Page, orders: number) {
  return page.evaluate((n) => (window as unknown as Workbench).__lightkeeperAutopilot(n), orders);
}

function blooming(page: Page) {
  return page.evaluate(() => (window as unknown as Workbench).__lightkeeperBlooming());
}

function flareGuide(page: Page) {
  return page.evaluate(() => (window as unknown as Workbench).__lightkeeperFlareGuide());
}

/** Plays `lantern-rook` to the order before the rescue, with the zone's world under attack. */
async function upToTheRescue(page: Page, seed: HallSeed = {}) {
  await openWatch(page, 'lantern-rook', seed);
  await autopilot(page, 10);
  await expect(page.getByTestId('lk-world')).toContainText('Under attack', { timeout: 10_000 });
}

const savedLine = (world: string) => new RegExp(`${world} is (safe|lit again)`);

test.describe('the ship’s log', () => {
  test('shows its last three lines and opens in full by mouse', async ({ page }) => {
    await openWatch(page, 'test-40');
    // Lower, raise and lower the shield: three orders, each answered by gleaner fire.
    for (let i = 0; i < 3; i++) await page.keyboard.press('g');
    await expect(page.getByTestId('lk-act-shield')).toContainText('Raise shield');
    const recent = page.getByTestId('lk-log').locator('li');
    await expect(recent).toHaveCount(3);
    // Every line carries a named mark, so its tone never rests on colour alone.
    for (const mark of await recent.getByRole('img').all()) {
      await expect(mark).toHaveAccessibleName(/^(Good news|Harm|Warning|Radio|Note)$/);
    }
    const newest = (await recent.first().textContent())!;

    const opener = page.getByTestId('lk-log-open');
    await opener.click();
    const full = page.getByRole('dialog', { name: 'Ship’s log' });
    await expect(full).toBeVisible();
    await expect(page.getByTestId('lk-log-close')).toBeFocused();
    // One heading per order, newest first, each over an ordered list of its lines.
    const headings = full.getByRole('heading', { level: 3 });
    await expect(headings.first()).toHaveText(/^Order 4 · day /);
    await expect(headings.last()).toHaveText(/^Order 1 · day 0\.0$/);
    expect(await full.locator('li').count()).toBeGreaterThan(3);
    // The drawer's newest line is the last line of the newest order.
    await expect(full.locator('section').first().locator('ol > li').last()).toHaveText(newest);
    // The play screen behind is out of reach while the log is open.
    expect(
      await page.getByTestId('lk-act-flare').evaluate((el) => el.closest('[inert]') !== null),
    ).toBe(true);

    await page.getByTestId('lk-log-close').click();
    await expect(full).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('opens and closes from the keyboard, and Escape closes it before the pause menu', async ({
    page,
  }) => {
    await openWatch(page, 'test-40');
    await page.keyboard.press('g');
    const full = page.getByTestId('lk-log-full');
    await page.keyboard.press('l');
    await expect(full).toBeVisible();
    await expect(page.getByTestId('lk-log-close')).toBeFocused();
    await page.keyboard.press('l');
    await expect(full).toBeHidden();
    await expect(page.getByTestId('lk-zone')).toBeFocused();

    await page.keyboard.press('l');
    await expect(full).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(full).toBeHidden();
    await expect(page.getByTestId('pl-pause')).toBeHidden();
    await expect(page.getByTestId('lk-zone')).toBeFocused();
  });
});

test.describe('a world saved', () => {
  test('blooms after the shots land, and only then do the panels and the log tell of it', async ({
    page,
  }) => {
    await upToTheRescue(page);
    const log = page.getByTestId('lk-log');
    const card = page.getByTestId('lk-world');
    await autopilot(page, 1);
    await expect.poll(() => blooming(page), { timeout: 8_000 }).not.toBeNull();
    const world = (await blooming(page))!;
    await expect(log).not.toContainText(savedLine(world));
    await expect(card).toContainText('Under attack');
    await expect(page.getByTestId('lk-act-beams')).toContainText(/\d+ gleaners? here/);

    await expect(log).toContainText(savedLine(world), { timeout: 5_000 });
    expect(await blooming(page)).toBeNull();
    await expect(card).toContainText(world);
    await expect(card).toContainText('Lit');
    await expect(page.getByTestId('lk-act-beams')).toContainText('no gleaners here');
  });

  test('any key lands it at once', async ({ page }) => {
    await upToTheRescue(page);
    await autopilot(page, 1);
    await expect.poll(() => blooming(page), { timeout: 8_000 }).not.toBeNull();
    const world = (await blooming(page))!;
    await page.keyboard.press('x');
    // The bloom has well over a second still to run; the skip must not wait for it.
    await expect(page.getByTestId('lk-log')).toContainText(savedLine(world), { timeout: 400 });
    expect(await blooming(page)).toBeNull();
  });

  test('under reduced motion the moment still shows, and the log still waits for it', async ({
    page,
  }) => {
    await upToTheRescue(page, { motion: 'reduce' });
    await expect(page.getByTestId('lk-root')).toHaveAttribute('data-motion', 'reduce');
    await autopilot(page, 1);
    await expect.poll(() => blooming(page), { timeout: 8_000 }).not.toBeNull();
    const world = (await blooming(page))!;
    await expect(page.getByTestId('lk-log')).not.toContainText(savedLine(world));
    await expect(page.getByTestId('lk-log')).toContainText(savedLine(world), { timeout: 5_000 });
  });
});

test('the flare preview draws the bearing and the stray its card describes', async ({ page }) => {
  await openWatch(page, 'test-40');
  await page.keyboard.press('g');
  await expect(page.getByTestId('lk-log')).toContainText('Shield lowered.');
  await page.keyboard.press('f');
  const tip = page.getByTestId('lk-tip');
  await expect(tip).toContainText('Flare, bearing');
  const words = (await tip.textContent())!;
  const bearing = Number(/bearing (\d+)°/.exec(words)![1]);
  const stray = Number(/±(\d+)°/.exec(words)![1]);
  expect(words).toContain('it meets the gleaner first');

  const guide = (await flareGuide(page))!;
  expect(guide).not.toBeNull();
  const drawn = (Math.atan2(guide.to.x - guide.from.x, guide.from.y - guide.to.y) * 180) / Math.PI;
  expect(Math.abs(((drawn - bearing + 540) % 360) - 180)).toBeLessThan(0.01);
  const toCompass = (angle: number) => ((((angle * 180) / Math.PI + 90) % 360) + 360) % 360;
  const aimed = guide.wedges.at(-1)!;
  expect(aimed.faint).toBe(false);
  expect(((aimed.to - aimed.from) * 90) / Math.PI).toBeCloseTo(stray, 6);
  expect(toCompass((aimed.from + aimed.to) / 2)).toBeCloseTo(bearing, 6);
  // "Shift: a spread of three": the two outer flares are drawn faint either side.
  if (words.includes('spread of three')) {
    expect(guide.wedges.filter((w) => w.faint)).toHaveLength(2);
  }
});

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
] as const) {
  test(`the results card is centred and whole at ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWatch(page, 'test-40');
    await page.keyboard.press('Escape');
    await page.getByTestId('pl-pause').getByRole('button', { name: 'End this watch' }).click();
    await expect(page.getByTestId('lk-results')).toBeVisible({ timeout: 15_000 });
    const card = (await page.locator('.lk-results__card').boundingBox())!;
    const main = (await page.locator('.lk-results__main').boundingBox())!;
    const side = (await page.locator('.lk-results__side').boundingBox())!;
    expect(Math.abs(card.x - (width - card.x - card.width))).toBeLessThanOrEqual(2);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(height);
    expect(side.x).toBeGreaterThanOrEqual(main.x + main.width);
    for (const id of ['lk-again', 'lk-results-menu', 'lk-results-hall', 'lk-score-total']) {
      await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });
    }
    // The Hall's Pause pill keeps clear of the card.
    const pause = await page.locator('.pl-corner').boundingBox();
    if (pause)
      expect(pause.y + pause.height <= card.y || pause.x >= card.x + card.width).toBe(true);
  });
}

for (const appearance of ['light', 'dark'] as const) {
  test(`axe finds nothing on the play screen, ${appearance}`, async ({ page }) => {
    await openWatch(page, 'test-40', { appearance });
    await page.keyboard.press('g');
    await expect(page.getByTestId('lk-log')).toContainText('Shield lowered.');
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page })
        .include('[data-testid="lk-play"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`,
        ),
      ).toEqual([]);
    };
    await scan('play');
    await page.keyboard.press('f');
    await expect(page.getByTestId('lk-tip')).toContainText('Flare, bearing');
    await scan('aiming a flare');
    await page.keyboard.press('f');
    await page.keyboard.press('l');
    await expect(page.getByTestId('lk-log-full')).toBeVisible();
    await scan('the whole log');
  });
}
