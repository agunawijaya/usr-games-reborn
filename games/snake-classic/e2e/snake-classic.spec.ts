import { expect, type Page, test } from '@playwright/test';
import {
  describeWaysOut,
  expectStripAboveFrame,
  gameFrame,
  inGame,
  runInHall,
  savedGameStats,
  setTabHidden,
  toasts,
  waitForGame,
  watchForeignRequests,
} from '../../../packages/bridge/testing/hall';
import {
  beginFlight,
  calmDown,
  clearAndLeave,
  clearTheField,
  escapeOver,
  gather,
  openUpTo,
  READY,
  standUnderTheDive,
} from './flight';

/**
 * Talon's Shadow inside the Hall: the expedition desk as its title screen, a flight from the
 * briefing to the report with its stamps and the next region opening, being caught, the Daily
 * Flight's share line, the Hall's pause holding the flight still, and every way back out. The
 * tests move the snake's head through the game's own handle (window.TalonGame), as a quick and
 * careful snake would.
 */

async function openGame(page: Page) {
  const frame = await runInHall(page, 'snake-classic');
  await waitForGame(page, READY);
  return frame;
}

test.describe("Talon's Shadow in the Hall", () => {
  test('opens on its expedition desk, with no requests beyond the Hall', async ({ page }) => {
    const foreign = watchForeignRequests(page);
    const frame = await openGame(page);
    await expect(frame.getByRole('heading', { name: 'Talon’s Shadow' })).toBeVisible();
    await expect(frame.getByTestId('desk-region-savanna')).toBeEnabled();
    await expect(frame.getByTestId('desk-region-river')).toBeDisabled();
    await expect(page.locator('.pl-page')).toHaveClass(/is-on-title/);
    await page.waitForTimeout(1500);
    expect(foreign()).toEqual([]);
  });

  test('a flight: the field cleared, out over the north edge, the region cleared, two stamps and a new region', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginFlight(page, 'savanna', {});
    await expect(page.locator('.pl-page')).not.toHaveClass(/is-on-title/);
    await expect(frame.getByTestId('desk-status')).toContainText('🍎 0 of 4');
    const six = await gather(page, 6);
    await expect(frame.getByTestId('desk-status')).toContainText(`🍎 ${six} of 4`);
    const fruit = await clearAndLeave(page, 'north');
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Escaped!', { timeout: 15_000 });
    await expect(report).toContainText(`${fruit} brought home`);
    await expect(report).toContainText('Savanna cleared!');
    await expect(report).toContainText('New region open: River');
    await expect(report.locator('.desk-fresh')).toHaveCount(2);
    await expect(toasts(page)).toContainText('Achievement unlocked');
    await expect
      .poll(() => savedGameStats(page, 'snake-classic'))
      .toMatchObject({ sessions: 1, wins: 1, counters: { fruitSecured: fruit } });
    await report.getByRole('button', { name: 'Expedition' }).click();
    await expect(frame.getByTestId('desk-region-river')).toBeEnabled();
  });

  test('caught under the dive: a loss, and nothing kept', async ({ page }) => {
    const frame = await openGame(page);
    await beginFlight(page, 'savanna', { keepBird: true });
    const fruit = await gather(page, 2);
    await standUnderTheDive(page);
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Caught', { timeout: 25_000 });
    await expect(report).toContainText(`${fruit} dropped`);
    await expect.poll(() => savedGameStats(page, 'snake-classic')).toMatchObject({ losses: 1 });
  });

  test('R flies again from the report; H goes back to the Hall', async ({ page }) => {
    await openGame(page);
    await beginFlight(page, 'savanna', {});
    await clearAndLeave(page, 'east');
    const frame = gameFrame(page);
    await expect(frame.getByTestId('desk-report')).toContainText('Escaped!', { timeout: 15_000 });
    await page.keyboard.press('KeyR');
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    await calmDown(page);
    await clearAndLeave(page, 'west');
    await expect(frame.getByTestId('desk-report')).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('KeyH');
    await expect(page).toHaveURL(/\/(#\/(man\/[a-z-]+)?)?$/);
  });

  test('the Daily Flight ends with a share line and no link', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-daily').click();
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    await calmDown(page);
    const fruit = await clearAndLeave(page, 'south');
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('this one counts', { timeout: 15_000 });
    await expect(report).toContainText('Daily Flights do not clear or open regions');
    await report.getByRole('button', { name: 'Share' }).click();
    await expect(report.locator('.desk-share')).toHaveText(
      new RegExp(`Talon's Shadow #\\d+ · [A-Za-z ]+ · escaped with 🍎${fruit} · 🪶\\d+$`),
    );
    expect(await report.locator('.desk-share').textContent()).not.toMatch(/https?:/);
    await expect.poll(() => savedGameStats(page, 'snake-classic')).toMatchObject({ sessions: 1 });
  });

  test('a hidden tab holds the flight still, and it carries on when shown', async ({ page }) => {
    await openGame(page);
    await beginFlight(page);
    await inGame(page, 'window.TalonGame.placeHead(150, 300)');
    await setTabHidden(page, true);
    const before = await inGame<{ x: number }>(page, 'window.TalonGame.peek().head');
    await page.waitForTimeout(600);
    const after = await inGame<{ x: number }>(page, 'window.TalonGame.peek().head');
    expect(after.x).toBe(before.x);
    await setTabHidden(page, false);
    await expect
      .poll(async () => (await inGame<{ x: number }>(page, 'window.TalonGame.peek().head')).x)
      .not.toBe(before.x);
  });

  test('the edges stay closed while fruit is left, and open once the field is bare', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginFlight(page, 'savanna', {});
    await gather(page, 1);
    await escapeOver(page, 'north');
    await expect(frame.getByTestId('desk-banner')).toContainText('The edges are closed');
    const held = await inGame<{ y: number }>(page, 'window.TalonGame.peek().head');
    expect(held.y).toBeGreaterThanOrEqual(4);
    expect(await inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    await clearAndLeave(page, 'north');
    await expect(frame.getByTestId('desk-report')).toContainText('Escaped!', { timeout: 15_000 });
  });

  test('the expedition page puts the next region first, not the Daily Flight', async ({ page }) => {
    await openUpTo(page, 'river');
    const frame = await openGame(page);
    await expect(frame.getByTestId('desk-region-river')).toBeFocused();
    await expect(frame.locator('.desk-daily')).toContainText('does not clear or open regions');
  });

  test('the briefing names the goal, the harvest, the rivals and the fence', async ({ page }) => {
    await openUpTo(page, 'desert');
    const frame = await openGame(page);
    await frame.getByTestId('desk-region-desert').click();
    await expect(frame.getByTestId('desk-goal')).toContainText(
      'Bring home 7 fruit to clear Desert',
    );
    await expect(frame.locator('.desk-page')).toContainText(
      'The harvest: 16 fruit, shared with 2 rival snakes',
    );
    await expect(frame.locator('.desk-page')).toContainText('a fence like an H');
    await expect(frame.locator('.desk-page')).toContainText(
      'The edges open when the last fruit is gone',
    );
  });

  test('nothing slithers through a fence, and rivals eat from the same harvest', async ({
    page,
  }) => {
    await openUpTo(page, 'river');
    const frame = await openGame(page);
    await beginFlight(page, 'river', { keepBird: true, keepRivals: true });
    // The River's fence runs down the middle (x 444–456). Heading east just west of it, the
    // snake is stopped at its edge and stays on its own side.
    await inGame(page, 'window.TalonGame.placeHead(410, 300)');
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(250);
      const head = await inGame<{ x: number }>(page, 'window.TalonGame.peek().head');
      expect(head.x).toBeLessThanOrEqual(436.5);
    }
    await expect
      .poll(() => inGame<number>(page, 'window.TalonGame.peek().rivalsAte'), { timeout: 30_000 })
      .toBeGreaterThan(0);
    await expect(frame.getByTestId('desk-status')).toContainText(/rivals ate [1-9]/);
  });

  test('carrying makes the snake longer; a bare field makes the bird ravenous; the flight ends', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginFlight(page, 'savanna', {});
    const length = await inGame<number>(page, 'window.TalonGame.peek().length');
    const fruit = await gather(page, 3);
    await expect
      .poll(() => inGame<number>(page, 'window.TalonGame.peek().length'))
      .toBeGreaterThan(length);
    expect(fruit).toBeGreaterThanOrEqual(3);
    await clearTheField(page);
    await expect(frame.getByTestId('desk-banner')).toContainText('The field is bare');
    await expect(frame.getByTestId('desk-status')).toContainText('the field is bare');
    await escapeOver(page, 'south');
    // The flight goes on while the snake slithers off the field, out of the bird's reach.
    await expect
      .poll(() => inGame<string | null>(page, 'window.TalonGame.peek().leaving'))
      .toBe('south');
    expect(await inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Escaped!', { timeout: 15_000 });
    await expect(report).toContainText('the field was bare');
  });

  test('the bird hunts the nearest snake, and a rival under its dive is carried off', async ({
    page,
  }) => {
    await openUpTo(page, 'midnight');
    const frame = await openGame(page);
    await beginFlight(page, 'midnight', { keepBird: true, keepRivals: true });
    // The player keeps to whichever spot is farthest from the bird and the rivals (whose corners
    // are theirs, and who would run into its body), so the bird's nearest quarry is mostly one of
    // the three rivals; the flight plays on without drawing, half a
    // second at a time, until a rival is taken. Should the bird take the player first, or the
    // rivals all leave a bare field untouched, the next flight tries again.
    let outcome = { taken: 0, rivalLocks: 0, state: 'playing' };
    for (let attempt = 0; attempt < 4 && outcome.taken === 0; attempt++) {
      if (attempt > 0) {
        if (outcome.state === 'bare') await escapeOver(page, 'north');
        await expect(frame.getByTestId('desk-report')).toBeVisible({ timeout: 15_000 });
        await page.keyboard.press('KeyR');
        await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
        await calmDown(page, { keepBird: true, keepRivals: true });
      }
      const before = outcome.rivalLocks;
      outcome = await inGame<{ taken: number; rivalLocks: number; state: string }>(
        page,
        `(() => {
          let rivalLocks = ${before};
          let was = 'glide';
          const steer = (p) => {
            if (p.eagle.state === 'lock' && was !== 'lock' && p.eagle.quarry === 'rival') rivalLocks++;
            was = p.eagle.state;
            const spots = [[450, 80], [450, 520], [110, 300], [790, 300], [200, 150], [700, 150], [200, 450], [700, 450]];
            const away = (spot) => Math.min(
              Math.hypot(spot[0] - p.eagle.x, spot[1] - p.eagle.y),
              ...p.rivals.map((r) => Math.hypot(spot[0] - r.x, spot[1] - r.y) + 40),
            );
            const far = spots.sort((a, b) => away(b) - away(a))[0];
            window.TalonGame.placeHead(far[0], far[1]);
            return null;
          };
          const p = () => window.TalonGame.peek();
          for (let t = 0; t < 180000 && window.TalonGame.state === 'playing' && p().rivalsTaken === 0
            && !(p().bare && p().rivals.length === 0); t += 500) {
            window.TalonGame.fastForward(500, steer);
          }
          const state = window.TalonGame.state === 'playing' && p().rivalsTaken === 0 ? 'bare' : window.TalonGame.state;
          return { taken: p().rivalsTaken, rivalLocks, state };
        })()`,
      );
    }
    expect(outcome.rivalLocks).toBeGreaterThan(0);
    expect(outcome.taken).toBeGreaterThan(0);
    await expect(frame.getByTestId('desk-status')).toContainText('the bird took');
  });

  test('fruit nobody takes withers, so every harvest runs out', async ({ page }) => {
    await openGame(page);
    // A Savanna flight with a bird too patient ever to lock on, and the snake held in the middle,
    // where no fruit grows, and no rivals or hunters: what leaves the field in 26 seconds withered.
    const after = await inGame<{ withered: number; left: number; before: number; eaten: number }>(
      page,
      `(async () => {
        const { flightRules } = await import('./src/rules.mjs');
        const { regionById } = await import('./src/regions.mjs');
        const region = regionById('savanna');
        window.TalonGame.begin({ theme: region.theme, tuning: { ...region.tuning, patience: 1e9 }, rules: { ...flightRules(region), rivals: 0, hunters: 0 } });
        const before = window.TalonGame.peek().left;
        window.TalonGame.fastForward(26000, () => {
          window.TalonGame.placeHead(450, 300);
          return null;
        });
        const p = window.TalonGame.peek();
        return { withered: p.withered, left: p.left, before, eaten: p.carried + p.rivalsAte };
      })()`,
    );
    expect(after.withered).toBeGreaterThan(0);
    expect(after.left).toBe(after.before - after.withered - after.eaten);
  });

  test('a head that runs into another snake’s body ends that snake, rival or you', async ({
    page,
  }) => {
    await openGame(page);
    // Scripted rivals, so the meeting is certain: the snake starts mid-field heading east; one
    // rival crawls south into its body, one lies still across its path. The bird is too patient
    // to take part.
    const outcome = await inGame<{ out: number; spilled: number; cause: string; state: string }>(
      page,
      `(async () => {
        const { flightRules } = await import('./src/rules.mjs');
        const { regionById } = await import('./src/regions.mjs');
        const { makeRival } = await import('./src/rivals.mjs');
        const region = regionById('savanna');
        const across = (x0, y0, dx, dy) => ({ ...makeRival(0, 0), ate: 2,
          segments: Array.from({ length: 22 }, (_, i) => ({ x: x0 - dx * i * 7, y: y0 - dy * i * 7 })), dx, dy });
        let made = 0;
        const rules = { ...flightRules(region), hunters: 0, rivals: 2, harvest: 30,
          makeRival: () => (made++ === 0 ? across(300, 255, 0, 1) : across(640, 260, 0, -1)),
          stepRival: (rival, world, dt) => {
            if (rival.dy > 0) for (const s of rival.segments) s.y += 0.08 * dt;
            return -1;
          } };
        let cause = null;
        let apples = 0;
        window.TalonGame.on((e) => {
          if (e.type === 'caught') cause = e.cause;
          if (e.type === 'rival-out') apples = window.TalonGame.peek().apples.length;
        });
        window.TalonGame.begin({ theme: region.theme, tuning: { ...region.tuning, patience: 1e9 }, rules });
        const before = window.TalonGame.peek().apples.length;
        window.TalonGame.fastForward(6000, () => ({ dx: 1, dy: 0 }));
        return { out: window.TalonGame.peek().rivalsCutOff, spilled: apples - before, cause, state: window.TalonGame.state };
      })()`,
    );
    // The first rival ran into the snake's body and was cut off, spilling the two fruit it ate;
    // then the snake's head ran into the second rival's body.
    expect(outcome.out).toBe(1);
    expect(outcome.spilled).toBe(2);
    expect(outcome.state).toBe('dead');
    expect(outcome.cause).toBe('rival');
  });

  test('a peck on the body knocks a fruit loose and the hunter goes for it; on the head it ends the flight', async ({
    page,
  }) => {
    await openGame(page);
    const outcome = await inGame<{
      carried: number;
      pecks: number;
      lured: boolean;
      cause: string;
      state: string;
    }>(
      page,
      `(async () => {
        const { flightRules } = await import('./src/rules.mjs');
        const { regionById } = await import('./src/regions.mjs');
        const { makeHunter } = await import('./src/hens.mjs');
        const region = regionById('savanna');
        // A scripted hunter: its first peck lands on the body, its second on the head.
        let pecks = 0;
        const rules = { ...flightRules(region), rivals: 0, hunters: 1, harvest: 30,
          makeHunter: () => makeHunter(0, 0, 0),
          stepHunter: (hunter) => {
            if (hunter.waitFor === undefined) hunter.waitFor = 10;
            if (--hunter.waitFor > 0) return null;
            hunter.waitFor = 10;
            pecks++;
            const p = window.TalonGame.peek();
            if (pecks === 1) return { peck: window.__bodyPoint() };
            if (pecks === 2) { window.__lured = hunter.lure !== null; return { peck: { x: p.head.x, y: p.head.y } }; }
            return null;
          } };
        let cause = null;
        window.TalonGame.on((e) => { if (e.type === 'caught') cause = e.cause; });
        window.TalonGame.begin({ theme: region.theme, tuning: { ...region.tuning, patience: 1e9 }, rules });
        // Carry two fruit first.
        for (let i = 0; i < 2; i++) { const a = window.TalonGame.peek().apples[0]; window.TalonGame.placeHead(a.x, a.y); window.TalonGame.fastForward(32, () => null); }
        window.__bodyPoint = () => { const p = window.TalonGame.peek(); return { x: p.head.x - p.heading.dx * 120, y: p.head.y - p.heading.dy * 120 }; };
        window.TalonGame.fastForward(160, () => null);
        const carried = window.TalonGame.peek().carried;
        window.TalonGame.fastForward(200, () => null);
        return { carried, pecks: window.TalonGame.peek().pecks, lured: window.__lured, cause, state: window.TalonGame.state };
      })()`,
    );
    expect(outcome.pecks).toBe(1);
    expect(outcome.carried).toBe(1);
    expect(outcome.lured).toBe(true);
    expect(outcome.state).toBe('dead');
    expect(outcome.cause).toBe('peck');
  });

  test('Space sheds a third of the tail, and a third of the fruit, as a decoy', async ({
    page,
  }) => {
    const frame = await openGame(page);
    await beginFlight(page, 'savanna', {});
    const fruit = await gather(page, 3);
    const before = await inGame<number>(page, 'window.TalonGame.peek().length');
    await expect(frame.getByTestId('desk-status')).toContainText('Space: shed the tail');
    await page.keyboard.press('Space');
    await expect(frame.getByTestId('desk-banner')).toContainText('Tail shed');
    const after = await inGame<{ length: number; carried: number; decoys: number }>(
      page,
      '(() => { const p = window.TalonGame.peek(); return { length: p.length, carried: p.carried, decoys: p.decoys }; })()',
    );
    expect(after.length).toBeLessThan(before);
    expect(after.carried).toBe(fruit - Math.ceil(fruit / 3));
    expect(after.decoys).toBe(1);
    await expect(frame.getByTestId('desk-status')).toContainText(/tail again in \d+ s/);
  });

  test('clearing Midnight ends the expedition, and the ending stays to be read again', async ({
    page,
  }) => {
    await openUpTo(page, 'midnight');
    const frame = await openGame(page);
    await beginFlight(page, 'midnight', {});
    await gather(page, 12);
    await clearAndLeave(page, 'west');
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Midnight cleared!', { timeout: 15_000 });
    await expect(report).toContainText('The expedition is complete!');
    await expect(toasts(page)).toContainText('Achievement unlocked');
    await report.getByRole('button', { name: 'Read the ending' }).click();
    await expect(frame.getByTestId('desk-ending-page')).toContainText('8 of 8 regions cleared');
    await frame.getByTestId('desk-back').click();
    await expect(frame.getByTestId('desk-ending')).toBeVisible();
  });

  test('the Challenges page lists five, and a briefing names its stars', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-challenges').click();
    for (const id of ['fill', 'drift', 'coil', 'survival', 'courier']) {
      await expect(frame.getByTestId(`desk-challenge-${id}`)).toBeVisible();
    }
    await frame.getByTestId('desk-challenge-drift').click();
    await expect(frame.locator('.desk-page')).toContainText('Stars at 900 · 2200 · 3800 points');
    await expect(frame.getByTestId('desk-play')).toBeFocused();
  });

  test('a challenge plays to its end, and keeps its best and its stars', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-challenges').click();
    await frame.getByTestId('desk-challenge-drift').click();
    await page.keyboard.press('Enter');
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    await calmDown(page);
    await expect(frame.getByTestId('desk-status')).toContainText('King Drift');
    // A minute of zigzags, without drawing: a turn one way, then the other.
    await inGame(
      page,
      `(() => {
        let tick = 0;
        let up = true;
        window.TalonGame.fastForward(61000, (p) => {
          tick++;
          if (tick % 17 === 0) up = !up;
          const across = p.head.x < 200 ? 1 : p.head.x > 700 ? -1 : (window.__across || 1);
          window.__across = across;
          const vertical = p.head.y < 140 ? 1 : p.head.y > 460 ? -1 : up ? -1 : 1;
          return tick % 34 < 17 ? { dx: 0, dy: vertical } : { dx: across, dy: 0 };
        });
      })()`,
    );
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Time!');
    await expect(report.locator('.desk-stars-big')).toHaveText(/^[★☆]{3}$/);
    const record = await inGame<{ best: number; plays: number }>(
      page,
      'window.__talon.progress.challenges.drift',
    );
    expect(record.plays).toBe(1);
    expect(record.best).toBeGreaterThan(0);
    await report.getByRole('button', { name: 'Challenges' }).click();
    await expect(frame.getByTestId('desk-challenge-drift')).toContainText(
      `best ${record.best} points`,
    );
  });

  test('Fill the Field ends when the snake runs into itself', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-challenges').click();
    await frame.getByTestId('desk-challenge-fill').click();
    await frame.getByTestId('desk-play').click();
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    // A square smaller than the snake: east, north, west, south, and into its own body.
    await inGame(
      page,
      `(() => {
        let tick = 0;
        window.TalonGame.fastForward(4000, () => {
          tick++;
          return [{ dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }][Math.min(3, Math.floor(tick / 30))];
        });
      })()`,
    );
    const report = frame.getByTestId('desk-report');
    await expect(report).toContainText('Caught');
    await expect(report).toContainText('% of the field filled');
  });

  test('Coil takes every fruit inside a closed loop at once', async ({ page }) => {
    const frame = await openGame(page);
    await frame.getByTestId('desk-challenges').click();
    await frame.getByTestId('desk-challenge-coil').click();
    await frame.getByTestId('desk-play').click();
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    await calmDown(page);
    const coiled = await inGame<{ points: number; coils: number }>(
      page,
      `(() => {
        const api = window.TalonGame.modeApi;
        // Clear the field, put three fruit in a cluster, then go round them in a square smaller
        // than the snake is long: north, east, south, west, back to where the body still is.
        api.apples.length = 0;
        window.TalonGame.placeHead(300, 420);
        for (const [x, y] of [[355, 375], [368, 388], [350, 395]]) api.spawnFruitAt(x, y);
        let tick = 0;
        for (let i = 0; i < 200 && api.state.coils === 0; i++) {
          window.TalonGame.fastForward(16, () => {
            tick++;
            return [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }][Math.min(3, Math.floor(tick / 27))];
          });
        }
        return { points: api.state.points, coils: api.state.coils };
      })()`,
    );
    // The three placed fruit at least (a cluster the challenge grows may land inside too).
    expect(coiled.coils).toBe(1);
    expect(coiled.points).toBeGreaterThanOrEqual(9);
  });

  test('the strip sits above the game at 1280×720', async ({ page }) => {
    await openGame(page);
    await expectStripAboveFrame(page);
  });
});

describeWaysOut({ id: 'snake-classic', ready: READY, titleScreen: true });
