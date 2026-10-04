import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { gameFrame, inGame, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { beginShift, forceTick, READY, seedTheShift, showCheat, shiftIsOver } from './shift';

/**
 * The polish pass's "after" frames at 1920×1080 (docs/media/polish/, see POLISH.md beside them):
 * the game menu, a new career's first shift with the order panel typing a command, a busy radar
 * at Standard text size with the reference card docked, and the moment a plane comes home. Run with
 * `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/polish/', import.meta.url));
const SEED = 1986;

test.use({ viewport: { width: 1920, height: 1080 } });
test.beforeEach(({ page }) => seedTheShift(page, SEED));

async function open(page: Page) {
  await runInHall(page, 'atc-classic');
  await waitForGame(page, READY);
}

/** Types the cheat panel's suggestions for one tick, then forces it; the cheat stays hidden in shots. */
async function workOneTick(page: Page) {
  await showCheat(page);
  const commands = await inGame<string[]>(
    page,
    "[...document.querySelectorAll('#cheat-live-list .hint-cmd')].map((cmd) => cmd.textContent)",
  );
  for (const command of commands) {
    await page.keyboard.press('Escape');
    await page.keyboard.type(command);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+Alt+KeyC');
  await forceTick(page);
}

/** The first shift's tips are for players; a tip still up is dismissed for the picture. */
async function dismissTips(page: Page) {
  const close = gameFrame(page).locator('#tip:not([hidden]) .tip-close');
  while (await close.count()) await close.click();
}

function trafficCount(page: Page) {
  return inGame<number>(page, "document.querySelectorAll('#planes .strip:not(.arrived)').length");
}

async function shoot(page: Page, name: string) {
  await page.mouse.move(1900, 1060);
  const size = await saveScreenshot(page, `${MEDIA}${name}-1920.webp`);
  expect(size, 'a documentation screenshot stays under 900 KB').toBeLessThan(900);
}

test('the game menu with its miniature scope', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1200);
  await shoot(page, 'menu');
});

test('first shift: the order panel typing a command', async ({ page }) => {
  await open(page);
  await beginShift(page, 'career');
  const frame = gameFrame(page);
  await forceTick(page);
  await forceTick(page);
  const strip = frame.locator('#planes button.plane-row').first();
  await strip.click();
  await expect(frame.locator('#order-panel .op-letter')).toBeVisible();
  // Presses "head for" the plane's own exit and catches the command on the line during the beat
  // before it is sent.
  const goal = frame.locator('#order-panel [data-order^="exit-"].goal');
  await goal.click();
  await page.waitForTimeout(220);
  await shoot(page, 'order-panel');
});

test('a busy radar at Standard text size, the reference card docked', async ({ page }) => {
  await open(page);
  await page.keyboard.press('2');
  await gameFrame(page).locator('.title-sector-btn[data-pf="default"]').click();
  await beginShift(page, 'open');
  await dismissTips(page);
  for (let i = 0; i < 90 && !(await shiftIsOver(page)) && (await trafficCount(page)) < 7; i++) {
    await workOneTick(page);
  }
  await page.keyboard.press('\\');
  await expect(gameFrame(page).locator('#help-panel')).toHaveClass(/shown/);
  await page.waitForTimeout(600);
  await shoot(page, 'busy-radar');
});

function landings(page: Page) {
  return inGame<number>(
    page,
    "[...document.querySelectorAll('#events .event.ok')].filter((e) => e.textContent.includes('landed')).length",
  );
}

test('the moment a plane comes home', async ({ page }) => {
  await open(page);
  await beginShift(page, 'daily');
  await dismissTips(page);
  // The cheat's suggestions until a second plane lands: the Hall's notes for the first landing's
  // achievements have gone by then.
  let landed = 0;
  for (let i = 0; i < 300 && landed < 2 && !(await shiftIsOver(page)); i++) {
    const before = await landings(page);
    await workOneTick(page);
    landed += (await landings(page)) - before;
  }
  expect(landed, 'two planes landed').toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(260);
  await shoot(page, 'landing-stamp');
});
