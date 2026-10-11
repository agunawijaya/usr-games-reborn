import { expect, type Page } from '@playwright/test';
import { punchCard } from '../src/codecs/bcd';
import { morseFor } from '../src/codecs/morse';
import { punchTape } from '../src/codecs/ppt';
import { encodeSemaphore } from '../src/codecs/semaphore';
import { readingTurn } from '../src/engine/generate';
import type { Step } from '../src/engine/message';

/**
 * Helpers every browser test shares: the workbench's hook into the desk (`window.__dd`, the
 * game's App, development builds only), and a keyboard-only player that can work any step.
 */
declare global {
  interface Window {
    __dd: { go: Record<string, (...args: unknown[]) => void> };
    __log: string[];
    __ready: boolean;
  }
}

export async function openDesk(page: Page, query = '') {
  await page.goto(`/?fresh=1${query}`);
  await page.waitForFunction(() => window.__ready === true);
}

/** Calls one of the desk's routes, e.g. `go(page, 'message', 'c1-m1')`. */
export async function go(page: Page, route: string, ...args: unknown[]) {
  await page.evaluate(([name, rest]) => window.__dd.go[name as string]!(...(rest as unknown[])), [
    route,
    args,
  ] as const);
}

export async function log(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__log ?? []);
}

const NEAR_KEYS = ['KeyX', 'KeyZ', 'KeyA', 'KeyQ', 'KeyW', 'KeyE', 'KeyD', 'KeyC'];
const FAR_KEYS = [
  'Numpad2',
  'Numpad1',
  'Numpad4',
  'Numpad7',
  'Numpad8',
  'Numpad9',
  'Numpad6',
  'Numpad3',
];

/** Keys a message on the telegraph with a steady, slow hand. */
export async function keyMorse(page: Page, text: string) {
  const dit = 90;
  for (const word of text.split(' ')) {
    for (const char of word) {
      for (const mark of morseFor(char)!) {
        await page.keyboard.down('Space');
        await page.waitForTimeout(mark === '.' ? dit : dit * 3);
        await page.keyboard.up('Space');
        await page.waitForTimeout(dit);
      }
      await page.waitForTimeout(dit * 3);
    }
    await page.waitForTimeout(dit * 6);
  }
}

/** Works one step with the keyboard alone, as a player who knows the answer would. */
export async function workStep(page: Page, step: Step) {
  const typed =
    step.mode === 'read' &&
    (step.machine === 'telegraph' ||
      step.machine === 'punch' ||
      step.machine === 'tape' ||
      step.machine === 'printer' ||
      step.machine === 'semaphore');
  if (typed) {
    const input = page.getByTestId('dd-input');
    await input.fill(step.text);
    await input.press('Enter');
    return;
  }
  switch (step.machine) {
    case 'telegraph':
      await keyMorse(page, step.text);
      return;
    case 'cipher': {
      const turns = step.keyword
        ? [...step.keyword].map((char) => readingTurn(char.charCodeAt(0) - 65))
        : [readingTurn(step.shift)];
      for (const [ring, turn] of turns.entries()) {
        for (let i = 0; i < turn; i++) await page.keyboard.press('ArrowRight');
        if (ring < turns.length - 1) await page.keyboard.press('ArrowDown');
      }
      await page.keyboard.press('Enter');
      return;
    }
    case 'punch': {
      let row = 0;
      for (const [column, { holes }] of punchCard(step.text).entries()) {
        for (let target = 0; target < 12; target++) {
          if (!(holes & (1 << (11 - target)))) continue;
          while (row < target) {
            await page.keyboard.press('ArrowDown');
            row++;
          }
          while (row > target) {
            await page.keyboard.press('ArrowUp');
            row--;
          }
          await page.keyboard.press('Space');
        }
        await page.keyboard.press('Enter');
        void column;
      }
      return;
    }
    case 'tape':
      for (const byte of punchTape(step.text)) {
        for (let hole = 0; hole < 8; hole++)
          if (byte & (128 >> hole)) await page.keyboard.press(String(hole + 1));
        await page.keyboard.press('Enter');
      }
      return;
    case 'semaphore':
      for (const target of encodeSemaphore(step.text)) {
        await page.keyboard.press(NEAR_KEYS[target.pose.near]!);
        await page.keyboard.press(FAR_KEYS[target.pose.far]!);
        await page.waitForTimeout(80);
      }
      return;
  }
}

/** Starts the message on screen (past its telegram) if there is a brief. */
export async function begin(page: Page) {
  const brief = page.getByTestId('dd-brief');
  if (await brief.isVisible().catch(() => false)) await page.keyboard.press('Enter');
  await expect(brief).toBeHidden();
}

/** Moves on from a "next machine" card. */
export async function nextMachine(page: Page) {
  await page.getByRole('button', { name: /On to it/ }).click();
}
