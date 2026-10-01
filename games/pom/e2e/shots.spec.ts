import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import {
  gameFrame,
  revealStrip,
  runInHall,
  toasts,
  waitForGame,
} from '../../../packages/bridge/testing/hall';
import { describeScenes, saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Documentation screenshots of Selene inside the Hall, by day and by night (the Hall's
 * appearance; Selene has a single night look). Run with `SHOTS=1`, see playwright.config.ts.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

/** Waits for the Hall's XP toasts to arrive and fade, and for the strip to tuck itself away. */
async function settle(page: Page) {
  await page.mouse.move(960, 600);
  await expect(toasts(page)).toContainText('Next full moon', { timeout: 20_000 });
  await expect(toasts(page).locator('.pl-toast')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(3000);
}

for (const appearance of ['dark', 'light'] as const) {
  test(`the coming full moon, Hall ${appearance}, 1920×1080`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const frame = await runInHall(page, 'pom', { appearance });
    await waitForGame(page, 'window.__selene?.ready === true');
    await frame.locator('#btn-calendar').click();
    await frame.locator('#events button', { hasText: 'Full Moon' }).first().click();
    await frame.locator('#cal-close').click();
    await settle(page);
    // Selene has one night look, so the uncovered play frame is taken once.
    if (appearance === 'dark') {
      const size = await saveScreenshot(page, `${MEDIA}full-moon-1920.webp`);
      console.log(`pom full-moon-1920.webp ${size} KB`);
    }
    await revealStrip(page);
    await page.waitForTimeout(400);
    const size = await saveScreenshot(page, `${MEDIA}in-the-hall-${appearance}-1920.webp`);
    console.log(`pom in-the-hall-${appearance}-1920.webp ${size} KB`);
  });
}

// The Hall's XP toasts fade after a few seconds; the chosen moments wait them out.
describeScenes({ id: 'pom', ready: 'window.__selene?.ready === true' }, MEDIA, [
  { name: 'title', waitMs: 1200 },
  {
    name: 'play',
    stage: async (page) => {
      await gameFrame(page).locator('#btn-calendar').click();
    },
    waitMs: 2000,
  },
  {
    name: 'signature',
    // A two-day-old crescent, when moonlight is faint enough for the Milky Way to show.
    query: 'date=2026101219',
    waitMs: 7000,
  },
]);
