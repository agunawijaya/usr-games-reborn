import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { gameFrame } from '../../../packages/bridge/testing/hall';
import { describeScenes } from '../../../packages/bridge/testing/shots';
import { aimAtTheWumpus, beginCareerDelve, READY, slayTheWumpus, walkToADraft } from './delve';

/**
 * Documentation screenshots of The Rune Gates inside the Hall at 1280×720: the game menu over the
 * cave, a briefing, a chamber with wind curling out of a gate, the arrow planner, the chronicle
 * of a first delve, the trail of delves afterwards and a page of the lore codex. Run with
 * `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

describeScenes({ id: 'wump-classic', ready: READY }, MEDIA, [
  { name: 'title', waitMs: 2500 },
  {
    name: 'briefing',
    stage: async (page) => {
      await gameFrame(page)
        .getByRole('button', { name: /Continue/ })
        .click();
      await expect(gameFrame(page).getByText('Your quests')).toBeVisible();
    },
    waitMs: 600,
  },
  {
    name: 'play',
    stage: async (page) => {
      await beginCareerDelve(page);
      await walkToADraft(page);
    },
    waitMs: 2600,
  },
  {
    name: 'aim',
    stage: async (page) => {
      await beginCareerDelve(page);
      await aimAtTheWumpus(page);
    },
    waitMs: 600,
  },
  {
    name: 'chronicle',
    stage: async (page) => {
      await beginCareerDelve(page);
      await slayTheWumpus(page);
    },
    waitMs: 800,
  },
  {
    name: 'trail',
    stage: async (page) => {
      await beginCareerDelve(page);
      await slayTheWumpus(page);
      await gameFrame(page).getByRole('button', { name: 'Game menu' }).click();
      await gameFrame(page)
        .getByRole('button', { name: /The Delves/ })
        .click();
    },
    waitMs: 600,
  },
  {
    name: 'codex',
    stage: async (page) => {
      await beginCareerDelve(page);
      await slayTheWumpus(page);
      await gameFrame(page).getByRole('button', { name: 'Game menu' }).click();
      await gameFrame(page)
        .getByRole('button', { name: /Lore codex/ })
        .click();
      await gameFrame(page)
        .getByRole('button', { name: /The Wumpus/ })
        .click();
    },
    waitMs: 600,
  },
]);
