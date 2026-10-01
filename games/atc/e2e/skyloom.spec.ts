import { expect, type Page, test } from '@playwright/test';

/**
 * Skyloom played in the workbench (port 5273): the tutorial, both ways of giving orders, the
 * Terminal, a lost sky and its replay, the Daily Sky and every way out. The workbench exposes the
 * live sky as `window.__skyloom` and lets the house controller fly with `__skyloomAutopilot`.
 */

test.use({ viewport: { width: 1600, height: 900 } });

async function openGame(page: Page): Promise<string[]> {
  const log: string[] = [];
  page.on('console', (message) => log.push(message.text()));
  page.on('pageerror', (error) => log.push(`page error: ${error.message}`));
  await page.goto('/?game=1&appearance=light');
  await expect(page.getByRole('button', { name: /^Shifts/ })).toBeVisible();
  return log;
}

async function choose(page: Page, entry: string): Promise<void> {
  await page
    .getByRole('button', { name: new RegExp(`^${entry}`) })
    .first()
    .click();
}

async function flyEndless(page: Page, arena = 'Harbour Lights'): Promise<void> {
  await choose(page, 'Endless');
  await page.getByRole('button', { name: new RegExp(arena) }).click();
  await page.waitForFunction(() => window.__skyloom !== undefined);
}

const radar = (page: Page) => page.locator('canvas[aria-label="Radar"]');

/** Drags from a plane to the centre of a gate or runway, as a player draws a route. */
async function dragRoute(
  page: Page,
  letter: number,
  place: { kind: 'gate' | 'runway'; index: number },
): Promise<void> {
  // A plane that has just come in is on the radar from the next frame.
  await page.waitForFunction(
    (letter) => window.__skyloom!.screen.radar.planeOnScreen(letter) !== null,
    letter,
  );
  const points = await page.evaluate(
    ({ letter, place }) => {
      const sky = window.__skyloom!;
      const box = sky.screen.radar.canvas.getBoundingClientRect();
      const from = sky.screen.radar.planeOnScreen(letter)!;
      const feature =
        place.kind === 'gate'
          ? sky.world.arena.gates[place.index]!
          : sky.world.arena.runways[place.index]!;
      const to = sky.screen.radar.cellOnScreen(sky.world.arena, feature.x, feature.y);
      return {
        ax: from.x + box.left,
        ay: from.y + box.top,
        bx: to.x + box.left,
        by: to.y + box.top,
      };
    },
    { letter, place },
  );
  await page.mouse.move(points.ax, points.ay);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) {
    await page.mouse.move(
      points.ax + ((points.bx - points.ax) * i) / 14,
      points.ay + ((points.by - points.ay) * i) / 14,
    );
  }
  await page.mouse.up();
}

async function planeState(page: Page, letter: number) {
  return page.evaluate((letter) => {
    const sky = window.__skyloom!;
    const plane = [...sky.world.air, ...sky.world.ground].find((p) => p.letter === letter);
    return plane
      ? {
          route: plane.route.length,
          target: plane.targetAltitude,
          heading: plane.targetHeading,
          hold: plane.hold,
        }
      : null;
  }, letter);
}

async function pressSpaceUntil(
  page: Page,
  done: () => Promise<boolean>,
  limit = 60,
): Promise<void> {
  for (let i = 0; i < limit && !(await done()); i++) {
    await radar(page).focus();
    await page.keyboard.press('Space');
  }
}

test('the tutorial teaches a route, a landing and a change of height, then opens Shift 1', async ({
  page,
}) => {
  const log = await openGame(page);
  await choose(page, 'Tutorial');
  const banner = page.locator('.sk-banner');
  await expect(banner).toContainText('Weave a route');

  await page.keyboard.press('Space');
  await expect(page.locator('.sk-toast')).toContainText('waits until this step is done');

  await dragRoute(page, 0, { kind: 'gate', index: 0 });
  expect((await planeState(page, 0))!.route).toBeGreaterThan(0);
  await expect(banner).toContainText('Let the sky move');

  await pressSpaceUntil(page, async () =>
    (await banner.innerText()).includes('Land on the runway'),
  );
  await dragRoute(page, 1, { kind: 'runway', index: 0 });
  await pressSpaceUntil(page, async () => (await banner.innerText()).includes('ring'));
  await expect(banner).toContainText('c and d are closing');

  await page.getByRole('button', { name: 'Next' }).click();
  await radar(page).focus();
  await page.keyboard.press('Shift+D');
  await page.keyboard.press('5');
  await expect(banner).toContainText('That is the job');

  await page.evaluate(() => window.__skyloomAutopilot!(120));
  const card = page.getByRole('region', { name: 'That is the job' });
  await expect(card).toContainText('4 / 4');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sk-shift')).toContainText('First runway');
  expect(log.filter((line) => line.startsWith('page error'))).toEqual([]);
});

test('a route drawn with the mouse, then orders by keyboard alone', async ({ page }) => {
  await openGame(page);
  await flyEndless(page);
  // The first flight can be a departure still on the ground; move on until one is airborne.
  await pressSpaceUntil(page, () => page.evaluate(() => window.__skyloom!.world.air.length > 0));
  const first = await page.evaluate(() => {
    const plane = window.__skyloom!.world.air[0]!;
    return { letter: plane.letter, destination: plane.destination };
  });
  await dragRoute(page, first.letter, first.destination);
  expect((await planeState(page, first.letter))!.route).toBeGreaterThan(0);

  await radar(page).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.sk-strip.is-selected')).toHaveCount(1);
  await page.keyboard.press('3');
  expect((await planeState(page, first.letter))!.target).toBe(3);
  await page.keyboard.press('d');
  const turned = (await planeState(page, first.letter))!;
  expect(turned.heading).toBe(2);
  expect(turned.route).toBe(0);
  await page.keyboard.press('[');
  expect((await planeState(page, first.letter))!.hold).toBe('left');
});

test('the strips work as a list: arrow keys select, number keys give a height', async ({
  page,
}) => {
  await openGame(page);
  await flyEndless(page);
  await pressSpaceUntil(page, () => page.evaluate(() => window.__skyloom!.world.air.length > 0));
  const strips = page.getByRole('listbox', { name: 'Flight strips' });
  await strips.focus();
  await page.keyboard.press('ArrowDown');
  const selected = strips.getByRole('option', { selected: true });
  await expect(selected).toHaveCount(1);
  const letter = await selected.getAttribute('data-letter');
  await expect(strips).toHaveAttribute('aria-activedescendant', `sk-strip-${letter}`);
  await page.keyboard.press('2');
  const code = letter!.toLowerCase().charCodeAt(0) - 97;
  expect((await planeState(page, code))!.target).toBe(2);
});

test('Terminal mode takes typed orders, lists its choices and holds both ways', async ({
  page,
}) => {
  await openGame(page);
  await flyEndless(page);
  const name = await page.evaluate(() => {
    const plane = window.__skyloom!.world.air[0]!;
    return {
      letter: plane.letter,
      typed: String.fromCharCode((plane.kind === 'prop' ? 65 : 97) + plane.letter),
    };
  });
  await radar(page).focus();
  await page.keyboard.press('Backquote');
  const input = page.getByRole('textbox', { name: 'Terminal order' });
  await expect(input).toBeFocused();

  await input.press('?');
  await expect(page.locator('.sk-terminal__choices')).not.toBeEmpty();
  await input.pressSequentially(`${name.typed.toLowerCase()}a6`);
  await input.press('Enter');
  expect((await planeState(page, name.letter))!.target).toBe(6);

  await input.pressSequentially(`${name.typed.toLowerCase()}cl`);
  await input.press('Enter');
  expect((await planeState(page, name.letter))!.hold).toBe('left');
  await input.pressSequentially(`${name.typed.toLowerCase()}cr`);
  await input.press('Enter');
  expect((await planeState(page, name.letter))!.hold).toBe('right');

  await input.pressSequentially(`${name.typed.toLowerCase()}a+0`);
  await expect(page.locator('.sk-terminal__message')).toContainText(
    'would not change its altitude',
  );
});

test('a lost sky shows the moment, replays its last ticks and starts again with R', async ({
  page,
}) => {
  await openGame(page);
  await flyEndless(page);
  await pressSpaceUntil(page, () => page.evaluate(() => window.__skyloom!.isEnded), 300);
  const card = page.locator('.sk-scrim--left .sk-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(/—/);
  const ticks = card.locator('[data-tick]');
  expect(await ticks.count()).toBeGreaterThan(1);
  await ticks.first().click();
  await expect(ticks.first()).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('r');
  await expect(card).toBeHidden();
  expect(await page.evaluate(() => window.__skyloom!.world.clock)).toBe(0);
});

test('the Daily Sky hides behind the blinds while paused and ends with a one-line share', async ({
  page,
}) => {
  await openGame(page);
  await choose(page, 'Daily Sky');
  await page.getByRole('button', { name: /Fly today/ }).click();
  await page.waitForFunction(() => window.__skyloom !== undefined);

  await page.keyboard.press('Escape');
  await expect(page.locator('.sk-break')).toContainText('Tower on break');
  await page.keyboard.press('Escape');
  await expect(page.locator('.sk-break')).toHaveCount(0);

  await page.evaluate(() => window.__skyloomAutopilot!(200));
  const card = page.locator('.sk-card--shift');
  await expect(card).toBeVisible();
  await expect(card).toContainText(/Skyloom #\d+ · \d+ safe · /);
  await expect(card.getByRole('button', { name: 'Share' })).toBeVisible();

  await page
    .getByRole('button', { name: /Game menu/ })
    .last()
    .click();
  await choose(page, 'Daily Sky');
  await expect(page.locator('.sk-daily__today')).toContainText('Flown today');
});

test('every way out: sub-pages, a live sky, a finished sky and the title', async ({ page }) => {
  const log = await openGame(page);
  await choose(page, 'Records');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Shifts/ })).toBeVisible();

  await flyEndless(page);
  await page.getByRole('button', { name: 'Game menu' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Leave this sky?' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__skyloom!.isEnded)).toBe(false);
  await page.getByRole('button', { name: 'Game menu' }).click();
  await dialog.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByRole('button', { name: /^Shifts/ })).toBeVisible();

  await flyEndless(page);
  await pressSpaceUntil(page, () => page.evaluate(() => window.__skyloom!.isEnded), 300);
  await expect(page.locator('.sk-scrim--left .sk-card')).toBeVisible();
  await page.keyboard.press('h');
  await expect.poll(() => log.some((line) => line.includes('navigate hall'))).toBe(true);

  await page.goto('/?game=1&appearance=light');
  await expect(page.getByRole('button', { name: /^Shifts/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect.poll(() => log.some((line) => line.includes('Escape on the title'))).toBe(true);
});

test('a puzzle opens on its planes with time standing still', async ({ page }) => {
  await openGame(page);
  await choose(page, 'Puzzles');
  await page.getByRole('button', { name: /Departures/ }).click();
  await expect(page.locator('.sk-banner')).toContainText('Par 6');
  const ground = await page.evaluate(() => window.__skyloom!.world.ground.length);
  expect(ground).toBe(3);
  const clock = await page.evaluate(() => window.__skyloom!.world.clock);
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => window.__skyloom!.world.clock)).toBe(clock);
});
