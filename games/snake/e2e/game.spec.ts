import { expect, type Page, test } from '@playwright/test';
import './hook';

/**
 * Full Pockets on its workbench (port 5276), with a stand-in for the Hall: the tutorial, a run
 * played from the keyboard with counts, a mouse walk with its preview, the warp confirmation,
 * the Lucky Break both ways, banking and going deeper, the wink, the Daily Run's share line and
 * Classic's debt. Rounds are staged through the play screen's test hook, `window.__fp`.
 */

async function open(page: Page, query = '') {
  await page.goto(`/?fresh=1&${query}`);
  await page.waitForFunction(() => window.__ready === true);
}

async function startRun(page: Page) {
  await page.getByRole('button', { name: /Start a run/ }).click();
  await page.getByTestId('fp-map').waitFor();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('fp-map')).toBeHidden();
}

const you = (page: Page) => page.evaluate(() => window.__fp.play()!.session.round.you);
const log = (page: Page) => page.evaluate(() => window.__log ?? []);

/** Clears the way: the snake far off in a corner, the glint and the door where the test says. */
async function stage(
  page: Page,
  patch: {
    glint?: [number, number];
    door?: [number, number];
    pockets?: number;
    snakeAt?: Array<[number, number]>;
  },
) {
  await page.evaluate((p) => {
    const play = window.__fp.play()!;
    const round = play.session.round as unknown as {
      you: { x: number; y: number };
      garden: { width: number; height: number; door: { x: number; y: number } };
    };
    const corner = {
      x: round.you.x < round.garden.width / 2 ? round.garden.width - 1 : 0,
      y: round.garden.height - 1,
    };
    const snake = p.snakeAt
      ? p.snakeAt.map(([x, y]) => ({ x, y }))
      : Array.from({ length: 6 }, (_, i) => ({
          x: corner.x === 0 ? i : corner.x - i,
          y: corner.y,
        }));
    const next: Record<string, unknown> = { snake, heading: 0 };
    if (p.glint) next.glints = [{ x: p.glint[0], y: p.glint[1] }];
    if (p.door) next.garden = { ...round.garden, door: { x: p.door[0], y: p.door[1] } };
    if (p.pockets !== undefined) {
      next.ledger = { gross: p.pockets, spent: 0 };
      next.loot = 300;
    }
    play.stage(next);
  }, patch);
}

test.describe('Full Pockets', () => {
  test('opens on the game menu, with the Hall’s way back', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('fp-title')).toBeVisible();
    await expect(page.getByRole('button', { name: /Daily Run #\d+/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '← Back to the Hall' })).toBeVisible();
  });

  test('the tutorial walks you through a step, a glint, a peek and the door', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Tutorial/ }).click();
    await expect(page.locator('.fp-coach')).toContainText('Step toward the glint');
    for (const key of ['ArrowRight', 'ArrowRight']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
    }
    await expect(page.getByTestId('fp-pockets')).not.toContainText(/^0/);
    await expect(page.locator('.fp-coach')).toContainText('Press P');
    await page.keyboard.press('KeyP');
    await expect(page.locator('.fp-coach')).toContainText('walk to the door');
    await stage(page, { door: [6, 3] });
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('fp-results')).toContainText('Well walked.', { timeout: 8000 });
  });

  test('a count before a step walks that far, and . repeats it', async ({ page }) => {
    await open(page);
    await startRun(page);
    await stage(page, { glint: [0, 0], door: [17, 10] });
    const start = await you(page);
    const room = await page.evaluate(
      () =>
        (window.__fp.play()!.session.round as unknown as { garden: { width: number } }).garden
          .width,
    );
    const steps = Math.min(3, room - 1 - start.x);
    await page.keyboard.press(`Digit${steps}`);
    await expect(page.getByTestId('fp-pockets')).toContainText(`×${steps}`);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => you(page)).toEqual({ x: start.x + steps, y: start.y });
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Period');
    await expect.poll(() => you(page)).toEqual({ x: start.x + steps - 2, y: start.y });
  });

  test('a click further along a line shows the walk; a second click walks it', async ({ page }) => {
    await open(page);
    await startRun(page);
    await stage(page, { glint: [0, 0], door: [17, 10] });
    const start = await you(page);
    const frame = await page.evaluate(() => window.__fp.play()!.frame);
    const box = (await page.getByTestId('fp-board').boundingBox())!;
    const square = {
      x: box.x + frame.x + (start.x + 3.5) * frame.cell,
      y: box.y + frame.y + (start.y + 0.5) * frame.cell,
    };
    await page.mouse.move(square.x, square.y);
    await page.mouse.click(square.x, square.y);
    await page.waitForTimeout(300);
    expect(await you(page)).toEqual(start);
    await page.mouse.click(square.x, square.y);
    await expect.poll(() => you(page), { timeout: 4000 }).toEqual({ x: start.x + 3, y: start.y });
  });

  test('warping asks first and says what it costs', async ({ page }) => {
    await open(page);
    await startRun(page);
    await stage(page, { pockets: 400 });
    await page.keyboard.press('KeyT');
    await expect(page.getByTestId('fp-warp')).toContainText('costs 40 glints');
    await page.keyboard.press('KeyN');
    await expect(page.getByTestId('fp-warp')).toBeHidden();
    const before = await you(page);
    await page.keyboard.press('KeyT');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__fp.play()!.session.pockets)).toBe(360);
    expect(await you(page)).not.toEqual(before);
  });

  test('every door asks: go deeper, then bank', async ({ page }) => {
    await open(page);
    await startRun(page);
    const start = await you(page);
    await stage(page, { door: [start.x + 1, start.y], pockets: 250 });
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('fp-door')).toContainText('Bank it, or go deeper?');
    await page.keyboard.press('KeyD');
    await page.getByTestId('fp-map').waitFor();
    await expect(page.getByTestId('fp-map')).toContainText('Chamber 2 of 10');
    await page.keyboard.press('Enter');
    const next = await you(page);
    await stage(page, { door: [next.x + 1, next.y] });
    await page.keyboard.press('ArrowRight');
    await page.getByTestId('fp-door').waitFor();
    await page.keyboard.press('KeyB');
    await expect(page.getByTestId('fp-results')).toContainText('Banked!', { timeout: 8000 });
    await expect(page.getByTestId('fp-results')).toContainText('250');
    expect(
      (await log(page)).some(
        (line) => line.includes('"outcome":"win"') && line.includes('"presentation":"game"'),
      ),
    ).toBe(true);
  });

  for (const lucky of [true, false]) {
    test(`caught: the snake winks, the dial spins, and you ${lucky ? 'scramble free' : 'leave empty-handed'}`, async ({
      page,
    }) => {
      await open(page);
      await startRun(page);
      const start = await you(page);
      // One snake step, then the dial: pockets ending on the dial's digit, or one off it.
      const roll = await page.evaluate(() => window.__fp.play()!.session.luckyRollAfter(1));
      const pockets = 400 + (lucky ? roll : (roll + 1) % 10);
      await stage(page, {
        pockets,
        snakeAt: [
          [start.x + 2, start.y],
          [start.x + 1, start.y],
          [start.x + 1, start.y + 1],
          [start.x + 2, start.y + 1],
          [start.x + 3, start.y + 1],
          [start.x + 3, start.y],
        ],
      });
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('[data-card="wink"]')).toContainText('It winked.', {
        timeout: 4000,
      });
      await expect(page.locator('[data-card="dial"]')).toBeVisible({ timeout: 6000 });
      if (lucky) {
        await expect(page.locator('.fp-toast')).toContainText('Lucky break!', { timeout: 8000 });
        expect(await page.evaluate(() => window.__fp.play()!.overlay)).toBe('none');
        expect((await log(page)).some((line) => line === 'package lucky-break')).toBe(true);
      } else {
        await expect(page.getByTestId('fp-results')).toContainText('Caught.', { timeout: 8000 });
        expect((await log(page)).some((line) => line.includes('"outcome":"loss"'))).toBe(true);
      }
      expect((await log(page)).some((line) => line === 'package winked-at')).toBe(true);
    });
  }

  test('the Daily Run shares a line with its number and no link', async ({ page }) => {
    await open(page, 'date=2026-10-02');
    await page.getByRole('button', { name: /Daily Run #32/ }).click();
    await page.getByTestId('fp-map').waitFor();
    await expect(page.getByTestId('fp-map')).toContainText('Daily Run #32 · chamber 1 of 5');
    await page.keyboard.press('Enter');
    const start = await you(page);
    await stage(page, { door: [start.x + 1, start.y], pockets: 1240 });
    await page.keyboard.press('ArrowRight');
    await page.getByTestId('fp-door').waitFor();
    await page.keyboard.press('KeyB');
    await page.getByRole('button', { name: 'Share' }).click();
    const shared = (await log(page)).find((line) => line.startsWith('share '));
    expect(shared).toBe('share Full Pockets #32 · banked 💎1,240 at chamber 1 · 🍀0');
    expect((await log(page)).some((line) => line.includes('"daily":true'))).toBe(true);
  });

  test('Classic walks four ways, and can leave you owing glints', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Classic/ }).click();
    const start = await you(page);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
    expect(await you(page)).toEqual(start);
    // The original lays out carelessly, so the snake may start beside you: move it off first.
    await stage(page, {});
    await page.evaluate(() => {
      const play = window.__fp.play()!;
      const round = play.session.round as unknown as {
        you: { x: number; y: number };
        garden: { width: number; height: number };
      };
      const door = {
        x: round.you.x === round.garden.width - 1 ? round.you.x - 1 : round.you.x + 1,
        y: round.you.y,
      };
      play.stage({ loot: 25, penalty: 40, garden: { ...round.garden, door } });
    });
    const door = await page.evaluate(() => window.__fp.play()!.session.round.garden.door);
    await page.keyboard.press(door.x > start.x ? 'ArrowRight' : 'ArrowLeft');
    await expect(page.getByTestId('fp-results')).toContainText('owing', { timeout: 8000 });
    expect((await log(page)).some((line) => line === 'package in-the-red')).toBe(true);
  });
});
