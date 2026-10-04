import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The polish pass's "after" frames at 1920×1080 in both looks (`docs/media/polish/`, with
 * POLISH.md beside them): play mid-watch in the new layout, the saved-world moment mid-bloom,
 * the results card, the flare preview and the title's beam, and play at 1280×720 to show the
 * orders still in reach on a short screen. Run with `SHOTS=1 pnpm exec playwright test -c games/lightkeeper
 * polish-shots`. Watches come from open-watch codes and the workbench's development autopilot;
 * `scripts/find-rescue.ts` found the code whose eleventh order saves a world in the ship's zone.
 */

const MEDIA = 'games/lightkeeper/docs/media/polish';
type Look = 'light' | 'dark';
const LOOKS: Look[] = ['light', 'dark'];
const name = (look: Look) => (look === 'light' ? 'chart' : 'night');
/** After the saving order (a flare, then the gleaners leave), the bloom is at its fullest about here. */
const BLOOM_AT_MS = Number(process.env.BLOOM_AT_MS ?? 2700);

test.use({ viewport: { width: 1920, height: 1080 } });
test.describe.configure({ timeout: 120_000 });

async function openWatch(page: Page, look: Look, code: string) {
  await openTitle(page, look);
  await page.getByTestId('lk-menu-open').click();
  await page.getByTestId('lk-open-code').fill(code);
  await page.getByRole('radio', { name: /^Cadet/ }).click();
  await page.getByRole('radio', { name: /Short/ }).click();
  await page.getByRole('radio', { name: /1976/ }).click();
  await page.getByTestId('lk-open-begin').click();
  await page.getByTestId('lk-begin').click();
  await expect(page.getByTestId('lk-play')).toBeVisible();
  // On a cold dev server the workbench's autopilot hook can arrive a moment after the screen.
  await page.waitForFunction(() => '__lightkeeperAutopilot' in window);
  await page.waitForTimeout(1600);
}

async function openTitle(page: Page, look: Look) {
  await runInHall(page, 'lightkeeper', { appearance: look, style: 'console' });
  await expect(page.getByTestId('lk-title')).toBeVisible();
}

function autopilot(page: Page, orders: number) {
  return page.evaluate(
    (n) =>
      (window as unknown as { __lightkeeperAutopilot(n: number): unknown }).__lightkeeperAutopilot(
        n,
      ),
    orders,
  );
}

for (const look of LOOKS) {
  test(`play mid-watch, ${name(look)}`, async ({ page }) => {
    await openWatch(page, look, 'lantern-rook');
    await autopilot(page, 9);
    // Let the last order land and the Hall's achievement notes fade before the picture.
    await page.waitForTimeout(7000);
    await page.mouse.move(1900, 1000);
    await saveScreenshot(page, `${MEDIA}/play-${name(look)}-1920.webp`);
  });

  test(`a world saved, mid-bloom, ${name(look)}`, async ({ page }) => {
    await openWatch(page, look, 'lantern-rook');
    await autopilot(page, 10);
    // Order by order until the Lantern sits in a zone whose world is under attack, with its
    // gleaners still there: the steady captain's next order, the beams, saves it.
    const world = page.getByTestId('lk-world');
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(3000);
      const underAttack = (await world.isVisible()) && /Under attack/.test(await world.innerText());
      const gleanersHere = /\d+ gleaners?/.test(await page.locator('.lk-zone__facts').innerText());
      if (underAttack && gleanersHere) break;
      await autopilot(page, 1);
    }
    await page.waitForTimeout(6000);
    await page.mouse.move(1900, 1000);
    await autopilot(page, 1);
    await page.waitForTimeout(BLOOM_AT_MS);
    await saveScreenshot(page, `${MEDIA}/saved-${name(look)}-1920.webp`);
  });

  test(`the results card, ${name(look)}`, async ({ page }) => {
    await openWatch(page, look, 'rookery');
    await autopilot(page, 60);
    await expect(page.getByTestId('lk-results')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(7000);
    await saveScreenshot(page, `${MEDIA}/results-${name(look)}-1920.webp`);
  });

  test(`the flare preview, ${name(look)}`, async ({ page }) => {
    // The opening zone of this code has two gleaners in line to the north-west of the Lantern.
    await openWatch(page, look, 'test-40');
    await page.keyboard.press('g');
    await page.waitForTimeout(1500);
    await page.keyboard.press('f');
    await page.waitForTimeout(800);
    await saveScreenshot(page, `${MEDIA}/flare-${name(look)}-1920.webp`);
  });

  test(`play on a short screen, ${name(look)}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openWatch(page, look, 'lantern-rook');
    await autopilot(page, 9);
    await page.waitForTimeout(7000);
    await page.mouse.move(1270, 700);
    await saveScreenshot(page, `${MEDIA}/play-${name(look)}-1280.webp`);
  });
}

test('the title, chart', async ({ page }) => {
  await openTitle(page, 'light');
  await page.waitForTimeout(1500);
  await saveScreenshot(page, `${MEDIA}/title-chart-1920.webp`);
});
