import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { describeScenes } from '../../../packages/bridge/testing/shots';
import { inGame } from '../../../packages/bridge/testing/hall';
import { enterRoom, loseCipher, READY } from './gallows';

/**
 * Documentation screenshots of Escape the Gallows inside the Hall at 1280×720: each of the five
 * rooms mid-cipher, the hold and the tomb four misses in (their people near panic), and three of
 * their ends. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

/** Wrong letters, so the room's trap is under way and its people are afraid. */
async function misses(page: Page, count: number) {
  const target = await inGame<string>(page, 'window.__gallows.target');
  const wrong = [...'QZXJKVWYB'].filter((letter) => !target.includes(letter)).slice(0, count);
  for (const letter of wrong)
    await inGame(page, `window.__gallows.guess(${JSON.stringify(letter)})`);
}

const threeMisses = (page: Page) => misses(page, 3);

describeScenes({ id: 'hangman-classic', ready: READY }, MEDIA, [
  { name: 'hold', stage: threeMisses, waitMs: 2200 },
  {
    name: 'lab',
    stage: async (page) => {
      await enterRoom(page, 'lab');
      await threeMisses(page);
    },
    waitMs: 2200,
  },
  {
    name: 'tomb',
    stage: async (page) => {
      await enterRoom(page, 'temple');
      await threeMisses(page);
    },
    waitMs: 2400,
  },
  {
    name: 'crypt',
    stage: async (page) => {
      await enterRoom(page, 'crypt');
      await threeMisses(page);
    },
    waitMs: 2200,
  },
  {
    name: 'void',
    stage: async (page) => {
      await enterRoom(page, 'void');
      await threeMisses(page);
    },
    waitMs: 2200,
  },
  { name: 'hold-panic', stage: (page) => misses(page, 4), waitMs: 2200 },
  {
    name: 'tomb-panic',
    stage: async (page) => {
      await enterRoom(page, 'temple');
      await misses(page, 4);
    },
    waitMs: 2600,
  },
  { name: 'hold-end', stage: loseCipher, waitMs: 3200 },
  {
    name: 'crypt-end',
    stage: async (page) => {
      await enterRoom(page, 'crypt');
      await loseCipher(page);
    },
    waitMs: 3600,
  },
  {
    name: 'lab-end',
    stage: async (page) => {
      await enterRoom(page, 'lab');
      await loseCipher(page);
    },
    waitMs: 2600,
  },
]);
