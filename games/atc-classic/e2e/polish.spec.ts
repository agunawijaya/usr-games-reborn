import { expect, type Page, test } from '@playwright/test';
import {
  expectBackInHall,
  gameFrame,
  inGame,
  runInHall,
  waitForGame,
} from '../../../packages/bridge/testing/hall';
import {
  beginShift,
  followTheHints,
  forceTick,
  forceTicksUntilLost,
  READY,
  seedTheShift,
  takePosition,
} from './shift';

/**
 * Prompt P1-C's on-ramp and polish, inside the Hall: the order buttons played by mouse alone, the
 * typed language by keyboard alone, the two mixed, the ways out of a shift, the results in the
 * collection's order, reduced motion, the setting's default for a seasoned controller, and AA
 * contrast for every line of text on every screen.
 */

const game = { id: 'atc-classic', ready: READY };
/** Easy's first plane on this seed is a prop, `a`, at exit 3 bound for exit 2. */
const SEED = 1986;
/** Easy's exits by label, in grid cells: the radar is clicked where a plane is. */
const EASY = {
  width: 20,
  height: 15,
  exits: { '0': [10, 0], '1': [19, 7], '2': [10, 14], '3': [0, 7] } as Record<
    string,
    [number, number]
  >,
};

test.beforeEach(({ page }) => seedTheShift(page, SEED));

async function open(page: Page, seed: Parameters<typeof runInHall>[2] = {}) {
  await runInHall(page, game.id, seed);
  await waitForGame(page, game.ready);
}

const commandLine = (page: Page) => gameFrame(page).locator('#cmd-input');

/** The pixel of a grid cell on the radar, as the game lays the grid out (main.js, fitCanvas). */
async function radarPoint(page: Page, gx: number, gy: number) {
  const box = await gameFrame(page).locator('#radar').boundingBox();
  if (!box) throw new Error('No radar on screen.');
  const cell = Math.floor(
    Math.min((box.width - 64) / (EASY.width - 1), (box.height - 64) / (EASY.height - 1)),
  );
  const left = box.x + (box.width - cell * (EASY.width - 1)) / 2;
  const top = box.y + (box.height - cell * (EASY.height - 1)) / 2;
  return { x: left + gx * cell, y: top + gy * cell };
}

test.describe('the order buttons', () => {
  test('a first shift by mouse alone: select on the radar, press orders, pause and leave', async ({
    page,
  }) => {
    await open(page);
    const frame = gameFrame(page);
    await frame.locator('#title-begin').click();
    await expect(frame.locator('#briefing-overlay')).toHaveClass(/shown/);
    await frame.locator('#briefing-overlay').click({ position: { x: 8, y: 8 } });
    await frame.locator('#help-close').click();
    // A new career's first tip points at the plane.
    await expect(frame.locator('#tip')).toContainText('Click it');

    const strip = frame.locator('#planes button.plane-row').first();
    const origin = /Exit (\d) →/.exec((await strip.textContent()) ?? '')?.[1] ?? '3';
    const [gx, gy] = EASY.exits[origin] ?? [0, 7];
    const point = await radarPoint(page, gx, gy);
    await page.mouse.click(point.x, point.y);
    await expect(frame.locator('#order-panel .op-letter')).toHaveText('a');
    await expect(commandLine(page)).toHaveText('a');
    await expect(frame.locator('#planes .strip.selected')).toHaveCount(1);
    await expect(frame.locator('#tip')).toContainText('types the command for you');

    // The button types its command on the line, then sends it; the strip and the log follow.
    await frame.locator('#order-panel [data-order="alt-9"]').click();
    await expect(commandLine(page)).toHaveText('aa9');
    await expect(frame.locator('#order-panel .op-echo code')).toHaveText('aa9');
    await expect(frame.locator('#order-panel .op-parts')).toContainText('9,000 feet');
    await expect(frame.locator('#planes .strip').first()).toContainText('FL070→090');
    await expect(frame.locator('#events')).toContainText('A altitude 9000ft');
    await expect(frame.locator('#tip')).toContainText('aa9');

    await frame.locator('#pause-btn').click();
    await expect(frame.locator('#next-tick')).toHaveText('PAUSED');
    await frame.locator('[data-action="resume"]').click();
    await expect(frame.locator('#next-tick')).toContainText('NEXT TICK');
    await frame.locator('#pause-btn').click();
    await frame.locator('[data-action="menu"]').click();
    await frame.locator('[data-action="confirm-no"]').click();
    await expect(frame.locator('.menu-sheet.pause')).toBeVisible();
    await frame.locator('[data-action="menu"]').click();
    await frame.locator('[data-action="confirm-yes"]').click();
    await expect(frame.locator('#title-screen')).toBeVisible();
    await expect(frame.locator('#title-screen')).not.toHaveClass(/hiding/);
  });

  test('a shift by keyboard alone: the typed language as in 1986, the buttons switched off by key', async ({
    page,
  }) => {
    await open(page);
    const frame = gameFrame(page);
    await beginShift(page, 'career');
    await page.keyboard.type('aa9');
    await expect(commandLine(page)).toHaveText('aa9');
    await page.keyboard.press('Enter');
    await expect(frame.locator('#events')).toContainText('A altitude 9000ft');
    // Alt+O: no buttons, no sheet beside the radar; Alt+T: the radar's text grows.
    await page.keyboard.press('Alt+KeyO');
    await expect(frame.locator('#order-panel')).toBeHidden();
    await expect(frame.locator('#app')).not.toHaveClass(/with-sheet/);
    await expect(frame.locator('#planes button')).toHaveCount(0);
    await page.keyboard.press('Alt+KeyT');
    await expect(frame.locator('#events')).toContainText('radar text: large');
    await page.keyboard.press('Alt+KeyP');
    await expect(frame.locator('.menu-sheet.pause')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(frame.locator('#menu-overlay')).not.toHaveClass(/shown/);
    // The first assignment, flown to its relief by keyboard.
    await followTheHints(page, 2);
    await expect(frame.locator('#game-over')).toHaveClass(/shown/);
    await page.keyboard.press('Shift');
    await expect(frame.locator('.report-btn')).toHaveText([
      /NEXT ASSIGNMENT/,
      /PLAY AGAIN/,
      /GAME MENU/,
      /BACK TO THE HALL/,
    ]);
    await page.keyboard.press('m');
    await expect(frame.locator('#title-screen')).toBeVisible();
    // The choice is kept with the career.
    await page.keyboard.press('Enter');
    await takePosition(page);
    await expect(frame.locator('#order-panel')).toBeHidden();
  });

  test('mixed: a click selects, a typed key takes over, and a key typed while a button types wins', async ({
    page,
  }) => {
    await open(page);
    const frame = gameFrame(page);
    await beginShift(page, 'career');
    await frame.locator('#planes button.plane-row').first().click();
    await expect(commandLine(page)).toHaveText('a');
    // Typing the rest by hand closes the panel and keeps the letter the click put there.
    await page.keyboard.type('tw');
    await expect(frame.locator('#order-panel .op-letter')).toHaveCount(0);
    await expect(commandLine(page)).toHaveText('atw');
    await page.keyboard.press('Enter');
    await expect(frame.locator('#events')).toContainText('A turn to N');
    // Enter on the letter alone brings the next tick, as an empty line does.
    await frame.locator('#planes button.plane-row').first().click();
    const clock = await inGame<string>(page, "document.getElementById('info').textContent");
    await page.keyboard.press('Enter');
    await expect
      .poll(() => inGame<string>(page, "document.getElementById('info').textContent"))
      .not.toBe(clock);
    // A key pressed while a button is typing drops the button's order: the keys are the player's.
    await frame.locator('#order-panel [data-order="alt-5"]').click();
    await page.keyboard.press('x');
    await expect(commandLine(page)).toHaveText('x');
    await expect(frame.locator('#events')).not.toContainText('A altitude 5000ft');
  });

  test('a controller with fifty orders typed by hand starts with the buttons off', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (window.top === window) return;
      const service = {
        shifts: 6,
        planesHome: 20,
        landings: 6,
        exits: 14,
        takeoffs: 3,
        orders: 60,
        buttonOrders: 4,
        seconds: 1800,
        stamps: 5,
        bestOpen: {},
        dailies: {},
      };
      localStorage.setItem(
        'usr-games:atc-classic:service',
        JSON.stringify({ v: 1, data: service }),
      );
    });
    await open(page);
    await beginShift(page, 'open');
    await expect(gameFrame(page).locator('#order-panel')).toBeHidden();
    await expect(gameFrame(page).locator('#tip')).toBeHidden();
  });
});

test.describe('the ways out of a shift', () => {
  test('the pause menu asks before Back to the Hall', async ({ page }) => {
    await open(page);
    const frame = gameFrame(page);
    await beginShift(page, 'open');
    await forceTick(page);
    await page.keyboard.press('Alt+KeyP');
    await frame.locator('[data-action="hall"]').click();
    await expect(frame.locator('#confirm-title')).toHaveText('BACK TO THE HALL?');
    await page.keyboard.press('Escape');
    await expect(frame.locator('.menu-sheet.pause')).toBeVisible();
    await frame.locator('[data-action="hall"]').click();
    await frame.locator('[data-action="confirm-yes"]').click();
    await expectBackInHall(page);
  });

  test('a lost open shift reports in the collection’s order, and each way works', async ({
    page,
  }) => {
    await open(page);
    const frame = gameFrame(page);
    await beginShift(page, 'open');
    await forceTicksUntilLost(page);
    await page.keyboard.press('Shift');
    await expect(frame.locator('.report-btn')).toHaveText([
      /PLAY AGAIN/,
      /GAME MENU/,
      /BACK TO THE HALL/,
    ]);
    await expect(frame.locator('.report-btn.primary')).toHaveText(/PLAY AGAIN/);
    await page.keyboard.press('r');
    await expect(frame.locator('#briefing-overlay')).toHaveClass(/shown/);
    await takePosition(page);
    await forceTicksUntilLost(page);
    await page.keyboard.press('Shift');
    await page.keyboard.press('h');
    await expectBackInHall(page);
  });

  test('Daily Traffic puts its share line after the ways on', async ({ page }) => {
    await open(page);
    await beginShift(page, 'daily');
    await forceTicksUntilLost(page);
    await page.keyboard.press('Shift');
    await expect(gameFrame(page).locator('.report-btn')).toHaveText([
      /PLAY AGAIN/,
      /GAME MENU/,
      /BACK TO THE HALL/,
      /COPY SHARE LINE/,
    ]);
  });
});

test.describe('reduced motion', () => {
  test('asked for in the Hall: the menu goes at once, a button types at once, no cursor blinks', async ({
    page,
  }) => {
    await open(page, { motion: 'reduce' });
    const frame = gameFrame(page);
    await page.keyboard.press('Enter');
    await expect(frame.locator('#title-screen')).toBeHidden({ timeout: 300 });
    await takePosition(page);
    await expect(frame.locator('#help-overlay')).toHaveClass(/shown/);
    await page.keyboard.press('Escape');
    const cursor = await inGame<string>(
      page,
      "getComputedStyle(document.getElementById('cmd-input'), '::after').animationName",
    );
    expect(cursor).toBe('none');
    await frame.locator('#planes button.plane-row').first().click();
    await frame.locator('#order-panel [data-order="alt-8"]').click();
    // Whole at once, never part-typed.
    await expect(commandLine(page)).toHaveText('aa8', { timeout: 150 });
  });
});

/**
 * Every visible line of text under `root`, measured against what lies behind it: the nearest
 * opaque background, through translucent layers and the stops of linear gradients (the worst
 * stop counts). Returns the lines below AA: 4.5:1, or 3:1 for large text.
 */
async function lowContrast(page: Page, root: string) {
  const frame = page.frame({ url: /\/play\// });
  if (!frame) throw new Error('The game frame is not loaded.');
  return frame.evaluate((rootSelector) => {
    type Rgba = [number, number, number, number];
    const parse = (colour: string): Rgba[] =>
      [...colour.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
        const [r = 0, g = 0, b = 0, a = 1] = (m[1] ?? '')
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return [r, g, b, a];
      });
    const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba => [
      r * a + br * (1 - a),
      g * a + bg * (1 - a),
      b * a + bb * (1 - a),
      1,
    ];
    const luminance = ([r, g, b]: Rgba) => {
      const c = (v: number) =>
        v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4;
      return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [la, lb] = [luminance(a), luminance(b)];
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    /**
     * The colour stops of the linear gradients among a background's layers. Radial layers are
     * left out: here they only draw small rounds (the report paper's tractor holes) or a vignette
     * at the edges, never behind text, and fully transparent stops show what lies underneath.
     */
    const linearStops = (image: string): Rgba[] => {
      const layers: string[] = [];
      let depth = 0;
      let start = 0;
      for (let i = 0; i < image.length; i++) {
        if (image[i] === '(') depth += 1;
        else if (image[i] === ')') depth -= 1;
        else if (image[i] === ',' && depth === 0) {
          layers.push(image.slice(start, i));
          start = i + 1;
        }
      }
      layers.push(image.slice(start));
      return layers
        .filter((layer) => /^\s*(repeating-)?linear-gradient/.test(layer))
        .flatMap(parse)
        .filter((stop) => stop[3] > 0);
    };
    // The briefing's paper is drawn by the clipboard's ::before, which no ancestor walk can see.
    const PAPER: Rgba = [226, 220, 198, 1];
    /** The colours that may lie behind an element: its layers down to the first opaque one. */
    const backgrounds = (el: Element): Rgba[] => {
      const layers: Rgba[][] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        if (node.classList.contains('clipboard')) {
          layers.push([PAPER]);
          break;
        }
        const style = getComputedStyle(node);
        const stops = linearStops(style.backgroundImage);
        const colour = parse(style.backgroundColor)[0];
        if (stops.length) layers.push(stops);
        if (colour && colour[3] > 0) {
          layers.push([colour]);
          if (colour[3] === 1) break;
        }
      }
      let under: Rgba[] = [[10, 13, 10, 1]];
      for (const layer of layers.reverse())
        under = layer.flatMap((top) => under.map((u) => over(top, u)));
      return under;
    };
    const failures: string[] = [];
    for (const el of document.querySelectorAll(`${rootSelector}, ${rootSelector} *`)) {
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!text || !(el instanceof HTMLElement) || !el.getClientRects().length) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      let alpha = 1;
      for (let node: Element | null = el; node; node = node.parentElement)
        alpha *= Number(getComputedStyle(node).opacity);
      if (alpha === 0) continue; // faded right out: not on screen
      const [r, g, b, a] = parse(style.color)[0] ?? [0, 0, 0, 0];
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      const worst = Math.min(
        ...backgrounds(el).map((bg) => ratio(over([r, g, b, a * alpha], bg), bg)),
      );
      if (worst < (large ? 3 : 4.5))
        failures.push(
          `${worst.toFixed(2)}:1 "${text.slice(0, 40)}" (${el.className || el.tagName})`,
        );
    }
    return failures;
  }, root);
}

test.describe('AA contrast', () => {
  test('every line of text on the game menu, its tabs, the settings and the logbook', async ({
    page,
  }) => {
    await open(page);
    const frame = gameFrame(page);
    expect(await lowContrast(page, '#title-screen')).toEqual([]);
    for (const key of ['2', '3']) {
      await page.keyboard.press(key);
      expect(await lowContrast(page, '#title-desk')).toEqual([]);
    }
    await page.keyboard.press('s');
    await expect(frame.locator('.menu-sheet')).toBeVisible();
    expect(await lowContrast(page, '#menu-overlay')).toEqual([]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('l');
    expect(await lowContrast(page, '#logbook-overlay')).toEqual([]);
  });

  test('every line of text in a shift: briefing, console, order panel, reference, pause menu, report', async ({
    page,
  }) => {
    await open(page);
    const frame = gameFrame(page);
    await page.keyboard.press('Enter');
    await expect(frame.locator('#briefing-overlay')).toHaveClass(/shown/);
    expect(await lowContrast(page, '#briefing-overlay')).toEqual([]);
    await takePosition(page);
    await expect(frame.locator('#help-overlay')).toHaveClass(/shown/);
    expect(await lowContrast(page, '#help-overlay')).toEqual([]);
    await page.keyboard.press('Escape');
    await forceTick(page);
    await frame.locator('#planes button.plane-row').first().click();
    await page.keyboard.press('\\');
    await expect(frame.locator('#help-panel')).toHaveClass(/shown/);
    await page.mouse.move(5, 700);
    expect(await lowContrast(page, '#app')).toEqual([]);
    await page.keyboard.press('Alt+KeyP');
    expect(await lowContrast(page, '#menu-overlay')).toEqual([]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await forceTicksUntilLost(page);
    await page.keyboard.press('Shift');
    expect(await lowContrast(page, '#game-over')).toEqual([]);
  });
});
