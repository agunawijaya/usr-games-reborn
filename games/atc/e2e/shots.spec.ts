import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The documentation screenshots in docs/media/screens/, at 1280 × 720 in both looks:
 * `pnpm exec playwright test -c games/atc --grep @shots` with the workbench on port 5273.
 */

test.use({ viewport: { width: 1280, height: 720 } });

const LOOKS = [
  { appearance: 'light', file: 'day-chart' },
  { appearance: 'dark', file: 'night-scope' },
] as const;

async function save(page: Page, name: string, file: string): Promise<void> {
  const target = new URL(`../docs/media/screens/${name}-${file}.webp`, import.meta.url);
  const kb = await saveScreenshot(page, fileURLToPath(target));
  expect(kb).toBeLessThan(400);
}

async function open(page: Page, appearance: string): Promise<void> {
  await page.goto(`/?game=1&appearance=${appearance}`);
  await expect(page.getByRole('button', { name: /^Shifts/ })).toBeVisible();
  await page.waitForTimeout(600);
}

for (const { appearance, file } of LOOKS) {
  test(`documentation screens in ${file} @shots`, async ({ page }) => {
    await open(page, appearance);
    await save(page, 'title', file);

    await page.getByRole('button', { name: /^Daily Sky/ }).click();
    await page.waitForTimeout(400);
    await save(page, 'daily', file);

    await open(page, appearance);
    await page.getByRole('button', { name: /^Puzzles/ }).click();
    await page.waitForTimeout(400);
    await save(page, 'puzzles', file);

    // A sky some way in, with Terminal mode open and an order half typed.
    await open(page, appearance);
    await page.getByRole('button', { name: /^Endless/ }).click();
    await page.getByRole('button', { name: /Harbour Lights/ }).click();
    await page.evaluate(() => window.__skyloomAutopilot!(70));
    const typed = await page.evaluate(() => {
      const plane = window.__skyloom!.world.air[0];
      return plane ? String.fromCharCode(97 + plane.letter) : 'a';
    });
    await page.locator('canvas[aria-label="Radar"]').focus();
    await page.keyboard.press('Backquote');
    await page.getByRole('textbox', { name: 'Terminal order' }).pressSequentially(`${typed}t`);
    await page.waitForTimeout(300);
    await save(page, 'terminal', file);

    await open(page, appearance);
    await page.getByRole('button', { name: /^Shifts/ }).click();
    await page.getByRole('button', { name: /Shift 1,/ }).click();
    await page.evaluate(() => window.__skyloomAutopilot!(200));
    await expect(page.locator('.sk-card--shift')).toBeVisible();
    await page.waitForTimeout(600);
    await save(page, 'shift-complete', file);
  });
}
