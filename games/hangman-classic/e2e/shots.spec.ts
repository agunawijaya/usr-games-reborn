import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { describeScenes } from '../../../packages/bridge/testing/shots';
import { inGame } from '../../../packages/bridge/testing/hall';
import { enterRoom, loseCipher, READY } from './gallows';

/**
 * Documentation screenshots of Escape the Gallows inside the Hall at 1280×720: each of the five
 * rooms mid-cipher, and three of their ends. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

/** A few wrong letters, so the room's trap is under way. */
async function threeMisses(page: Page) {
  const target = await inGame<string>(page, 'window.__gallows.target');
  const wrong = [...'QZXJKV'].filter((letter) => !target.includes(letter)).slice(0, 3);
  for (const letter of wrong)
    await inGame(page, `window.__gallows.guess(${JSON.stringify(letter)})`);
}

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
