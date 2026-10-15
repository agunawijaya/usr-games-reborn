import { expect, type Locator, type Page } from '@playwright/test';
import type { Kind } from '../src/engine/cards';
import { rulesFor } from '../src/engine/match';
import { stackedOrder } from '../src/engine/stacked';

/**
 * Helpers for Detour's browser runs on the workbench: a clean save, a stacked first deal, the
 * table's mode, the cards in the player's hand by name, and the painted piles' centres.
 */

declare global {
  interface Window {
    __dtFirstDeal?: number[];
    __dtLog?: { kind: string; value: unknown }[];
    __dtTable?: {
      setAutoplay(on: boolean): void;
      pileCentre(key: string): { x: number; y: number } | null;
    };
  }
}

export type Mode = 'idle' | 'play' | 'coup' | 'extension' | 'thinking' | 'over' | 'paused';

export async function freshStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('dt-e2e-cleared')) {
      localStorage.clear();
      sessionStorage.setItem('dt-e2e-cleared', '1');
    }
  });
}

/** The next game's first hand is dealt from this stack instead of a shuffle. */
export async function stackFirstDeal(
  page: Page,
  hands: Kind[][],
  draws: Kind[] = [],
  teams = false,
): Promise<void> {
  const rules = rulesFor({ teams, length: 'single', seed: '', drivers: [] });
  const order = stackedOrder(rules, hands, draws);
  await page.addInitScript((stack) => {
    window.__dtFirstDeal = stack;
  }, order);
}

export async function openGame(
  page: Page,
  query = 'appearance=light&reduced=1&mute=1',
): Promise<void> {
  await page.goto(`/?game&${query}`);
  await expect(page.locator('.dt-title')).toBeVisible({ timeout: 30_000 });
}

export function table(page: Page): Locator {
  return page.locator('.dt-table');
}

export async function waitForMode(page: Page, mode: Mode, timeout = 30_000): Promise<void> {
  await expect(table(page)).toHaveAttribute('data-mode', mode, { timeout });
}

/** The first card in the player's hand with this name, as its aria-label gives it. */
export function card(page: Page, name: string): Locator {
  return page.locator(`.dt-card[aria-label*=": ${name},"]`).first();
}

export async function pileCentre(page: Page, key: string): Promise<{ x: number; y: number }> {
  const centre = await page.evaluate((k) => window.__dtTable!.pileCentre(k), key);
  if (!centre) throw new Error(`no pile called ${key}`);
  return centre;
}

export async function autoplay(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean(window.__dtTable));
  await page.evaluate(() => window.__dtTable!.setAutoplay(true));
}

export async function workbenchLog(page: Page): Promise<{ kind: string; value: unknown }[]> {
  return page.evaluate(() => window.__dtLog ?? []);
}

/** The menu's Quick hand: Start with the rival already chosen. */
export async function startQuickHand(
  page: Page,
  rival: 'Rookie' | 'Classic' | 'Sly' = 'Rookie',
): Promise<void> {
  await page.getByRole('button', { name: /Quick hand/ }).click();
  await page.locator('.dt-setup').waitFor();
  await page
    .locator('.dt-choice')
    .filter({ has: page.locator('.dt-choice__title', { hasText: new RegExp(`^${rival}$`) }) })
    .click();
  await page.locator('.dt-start').click();
  await expect(table(page)).toBeVisible();
}

/** A hand that reaches 700 in six turns while the rival, holding only remedies, cannot touch it. */
export const RUN_TO_700: Kind[][] = [
  ['greenLight', 'm200', 'm200', 'm100', 'm100', 'm100'],
  ['fillUp', 'spareTyre', 'mechanic', 'fillUp', 'spareTyre', 'mechanic'],
];

/** The rival holds nothing but hazards; the player holds the safety for each of them. */
export const COUP_READY: Kind[][] = [
  ['greenLight', 'runFlats', 'longRangeTank', 'roadSense', 'm25', 'm50'],
  ['flatTyre', 'noFuel', 'fenderBender', 'flatTyre', 'noFuel', 'fenderBender'],
];
