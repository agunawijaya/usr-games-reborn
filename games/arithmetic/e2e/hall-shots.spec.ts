import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Number Sprint inside the Hall, for the documentation: the game menu and Quick Sums with the
 * Hall's own Pause pill, in Console Home by day and the Machine Room by night, at 1920 × 1080.
 * Run with `SHOTS=1 pnpm exec playwright test -c games/arithmetic --project hall-shots`.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

declare global {
  interface Window {
    __ns: { mode: string; answer(): string } | null;
  }
}

for (const { style, appearance, key } of [
  { style: 'console', appearance: 'light', key: '1' },
  { style: 'machine-room', appearance: 'dark', key: '2' },
] as const) {
  test(`@shots in the Hall, ${style}, ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await runInHall(page, 'arithmetic', { style, appearance });
    await expect(page.getByTestId('ns-pick')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press(key);
    await page.waitForTimeout(1200);
    await saveScreenshot(page, `${MEDIA}hall-menu-${style}-${appearance}-1920.webp`);
    await page.getByTestId('ns-menu-sums').click();
    await page.getByTestId('ns-rung-times-10').click();
    await page.getByTestId('ns-setup-start').click();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => Boolean(window.__ns));
    for (let i = 0; i < 5; i++) {
      const next = await page.evaluate(() => window.__ns!.answer());
      await page.keyboard.type(next);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);
    await saveScreenshot(page, `${MEDIA}hall-quick-sums-${style}-${appearance}-1920.webp`);
  });
}
