import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { gameFrame } from '../../../packages/bridge/testing/hall';
import { describeScenes } from '../../../packages/bridge/testing/shots';
import { beginShift, followTheHints, READY, seedTheShift } from './shift';

/**
 * Documentation screenshots of Control Room 1986 inside the Hall: its title, a shift on the
 * Default sector and its signature moment, a plane brought home with the radio reading it back,
 * at 1280×720. Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));
const SEED = 1986;

test.beforeEach(({ page }) => seedTheShift(page, SEED));

/**
 * Begins a Default shift with the radar in full view: the reference panel (\) is put away, and
 * the Hall's strip, which lingers a moment after the title, has tucked itself away.
 */
async function beginOnDefault(page: Page) {
  await gameFrame(page).locator('.title-sector-btn[data-pf="default"]').click();
  await beginShift(page);
  await page.keyboard.press('\\');
  await expect(page.locator('.pl-page')).not.toHaveClass(/is-strip-open/, { timeout: 10_000 });
}

describeScenes({ id: 'atc-classic', ready: READY }, MEDIA, [
  { name: 'title', waitMs: 2500 },
  {
    name: 'play',
    stage: async (page) => {
      await beginOnDefault(page);
      await followTheHints(page, Number.POSITIVE_INFINITY, 20);
    },
    waitMs: 1200,
  },
  {
    name: 'signature',
    stage: async (page) => {
      await beginOnDefault(page);
      await followTheHints(page, 1);
    },
    waitMs: 400,
  },
]);
