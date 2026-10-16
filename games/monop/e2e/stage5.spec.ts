import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * Stage 5 (`--grep @stage5`): a game saved and continued after a reload, the second press that
 * guards it, the flat map, settings that stick, the winner's moment before the recap, and frames
 * of the new moments for the record. Saves here live in the browser, one context per test.
 */

const MEDIA = fileURLToPath(new URL('../docs/media/stage5/', import.meta.url));

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(() => document.fonts.ready);
}

async function yourMove(page: Page): Promise<void> {
  await page.waitForSelector('.dd-actions .dd-action--primary:not(:disabled)', { timeout: 60_000 });
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('@stage5 a game carries on after the page is closed, and a new one asks twice', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.goto('/?game&pace=6&chrome=0&seed=resume-1');
  await ready(page);
  await page.keyboard.press('Enter');
  await yourMove(page);
  await page.keyboard.press(' ');
  await page.waitForTimeout(400);
  for (let step = 0; step < 6; step++) {
    await yourMove(page);
    const primary = await page
      .locator('.dd-actions .dd-action--primary:not(:disabled)')
      .getAttribute('data-action');
    if (primary === 'roll') break;
    await page.keyboard.press(primary === 'buy' ? 'b' : 'e');
    await page.waitForTimeout(300);
  }
  await yourMove(page);
  const coins = await page
    .locator('.dd-seat')
    .first()
    .locator('.dd-seat-coins .dd-amount')
    .textContent();
  const round = await page.locator('.dd-round').textContent();
  await page.reload();
  await ready(page);
  await expect(page.locator('.dd-menu-continue')).toContainText('Quick game on Harbour City');
  await page.keyboard.press('Enter');
  await yourMove(page);
  await expect(page.locator('.dd-round')).toHaveText(round!);
  await expect(page.locator('.dd-seat').first().locator('.dd-seat-coins .dd-amount')).toHaveText(
    coins!,
  );
  // Back at the menu, a fresh game needs a second press while this one is saved.
  await page.reload();
  await ready(page);
  await page.click('[data-act="play"]');
  await expect(page.locator('.dd-page-notice')).toContainText('Press again');
  await expect(page.locator('.dd-menu')).toBeVisible();
  await page.click('[data-act="play"]');
  await expect(page.locator('.dd-round')).toContainText('Round 1');
  expect(errors).toEqual([]);
});

test('@stage5 the flat map shows the same game and picks lots', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await page.goto('/?game&fresh=1&chrome=0&seed=slice-1&stage=slice&rounds=11');
  await ready(page);
  await page.keyboard.press('Enter');
  await yourMove(page);
  await page.keyboard.press('v');
  await expect(page.locator('canvas.dd-map')).toBeVisible();
  await expect(page.locator('canvas.dd-world')).toBeHidden();
  await expect(page.locator('.dd-view-toggle')).toContainText('Town view');
  // Signal Street (21) is the first lot of the top row, the board's top left after the corner.
  const box = (await page.locator('canvas.dd-map').boundingBox())!;
  const size = Math.min(box.width - 2 * 300, box.height - 72 - 92);
  const corner = size / 7.5;
  const left = 300 + (box.width - 600 - size) / 2;
  const top = 72 + (box.height - 164 - size) / 2;
  await page.mouse.click(left + corner + (size - 2 * corner) / 18, top + corner / 2);
  await expect(page.locator('.dd-card-name')).toHaveText('Signal Street');
  await page.keyboard.press('v');
  await expect(page.locator('canvas.dd-map')).toHaveCount(0);
  await expect(page.locator('canvas.dd-world')).toBeVisible();
  expect(errors).toEqual([]);
});

test('@stage5 settings stick, and the menu has help', async ({ page }) => {
  await page.goto('/?game&chrome=0');
  await ready(page);
  await page.keyboard.press('o');
  await page.uncheck('input[data-field="music"]');
  await page.check('input[data-field="mapView"]');
  await page.reload();
  await ready(page);
  await page.keyboard.press('o');
  await expect(page.locator('input[data-field="music"]')).not.toBeChecked();
  await expect(page.locator('input[data-field="mapView"]')).toBeChecked();
  await page.keyboard.press('Escape');
  await page.keyboard.press('?');
  await expect(page.locator('.dd-keys')).toContainText('Map view');
  await page.keyboard.press('Escape');
  // With the map chosen, a game opens on it.
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas.dd-map')).toBeVisible();
});

test('@stage5 the winner’s moment comes before the recap', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto('/?game&fresh=1&auto=1&pace=2&rounds=2&chrome=0');
  await ready(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('.dd-moment-kicker')?.textContent?.includes('final reckoning'),
    null,
    { timeout: 200_000 },
  );
  await expect(page.locator('.dd-results')).toHaveCount(0);
  await page.waitForSelector('.dd-results', { timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('@stage5 frames of the new moments for the record', async ({ page }) => {
  test.setTimeout(300_000);
  mkdirSync(MEDIA, { recursive: true });
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const look of ['light', 'dark'] as const) {
    await page.goto(
      `/?game&fresh=1&chrome=0&seed=slice-1&stage=slice&rounds=11&appearance=${look}`,
    );
    await ready(page);
    await page.keyboard.press('o');
    await page.waitForTimeout(900);
    await saveScreenshot(page, `${MEDIA}settings-${look}.webp`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('?');
    await page.waitForTimeout(900);
    await saveScreenshot(page, `${MEDIA}how-to-play-${look}.webp`);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await yourMove(page);
    await page.keyboard.press('v');
    await page.waitForTimeout(800);
    await saveScreenshot(page, `${MEDIA}map-view-${look}.webp`);
    await page.keyboard.press('v');
    // Buy Chowder Court from Dex: the Fish Market is whole and its bunting goes up.
    await page.keyboard.press('t');
    await page.waitForTimeout(500);
    await page.click('[data-act="toggle"][data-space="9"]');
    for (let i = 0; i < 4; i++)
      await page.click('[data-act="coins"][data-side="give"][data-delta="50"]');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
    if (await page.locator('.dd-reply--counter').count()) await page.keyboard.press('Enter');
    await page.waitForFunction(
      () => document.querySelector('.dd-moment-kicker')?.textContent?.includes('District complete'),
      null,
      { timeout: 20_000 },
    );
    await page.waitForTimeout(1300);
    await saveScreenshot(page, `${MEDIA}district-complete-${look}.webp`);
  }
  await page.goto('/?game&fresh=1&chrome=0&auto=1&pace=1.5&rounds=2&board=colony&appearance=dark');
  await ready(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => document.querySelector('.dd-moment-kicker')?.textContent?.includes('final reckoning'),
    null,
    { timeout: 240_000 },
  );
  await page.waitForTimeout(1500);
  await saveScreenshot(page, `${MEDIA}final-reckoning-colony-dark.webp`);
});
