import { expect, type Page, test } from '@playwright/test';
import { runInHall } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';

/**
 * The documentation screenshots in `docs/media/`, taken inside the Hall:
 * `SHOTS=1 pnpm exec playwright test -c games/lightkeeper`. Watches are staged from open-watch
 * codes (the same code always gives the same Reach) and, for mid-watch frames, the workbench's
 * development autopilot, which plays the steady captain through the real screen.
 */

const MEDIA = 'games/lightkeeper/docs/media';
type Look = 'light' | 'dark';
const LOOKS: Look[] = ['light', 'dark'];
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];
const name = (look: Look) => (look === 'light' ? 'chart' : 'night');

async function open(page: Page, look: Look, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await runInHall(page, 'lightkeeper', { appearance: look, style: 'console' });
  await expect(page.getByTestId('lk-title')).toBeVisible();
}

async function openWatch(page: Page, code: string, rank = 'Cadet', rules = '1976') {
  await page.getByTestId('lk-menu-open').click();
  await page.getByTestId('lk-open-code').fill(code);
  await page.getByRole('radio', { name: new RegExp(`^${rank}`) }).click();
  await page.getByRole('radio', { name: /Short/ }).click();
  await page.getByRole('radio', { name: new RegExp(rules) }).click();
  await page.getByTestId('lk-open-begin').click();
  await page.getByTestId('lk-begin').click();
  await expect(page.getByTestId('lk-play')).toBeVisible();
  await page.waitForTimeout(1600);
}

async function autopilot(page: Page, orders: number) {
  await page.evaluate(
    (n) =>
      (window as unknown as { __lightkeeperAutopilot(n: number): unknown }).__lightkeeperAutopilot(
        n,
      ),
    orders,
  );
}

test.describe.configure({ timeout: 120_000 });

for (const look of LOOKS) {
  for (const { width, height } of SIZES) {
    test(`game menu, ${name(look)}, ${width}`, async ({ page }) => {
      await open(page, look, width, height);
      await page.waitForTimeout(2500);
      await saveScreenshot(page, `${MEDIA}/title-${name(look)}-${width}.webp`);
    });

    test(`a volley aimed, ${name(look)}, ${width}`, async ({ page }) => {
      await open(page, look, width, height);
      await openWatch(page, 'test-40');
      await page.keyboard.press('g');
      await page.waitForTimeout(1500);
      await page.keyboard.press('b');
      await page.getByTestId('lk-beam-sure').click();
      await page.waitForTimeout(500);
      await saveScreenshot(page, `${MEDIA}/play-${name(look)}-${width}.webp`);
    });
  }

  test(`flare aimed, ${name(look)}`, async ({ page }) => {
    await open(page, look, 1280, 720);
    await openWatch(page, 'test-40');
    await page.keyboard.press('g');
    await page.waitForTimeout(1500);
    await page.keyboard.press('f');
    await page.waitForTimeout(600);
    await saveScreenshot(page, `${MEDIA}/flare-${name(look)}-1280.webp`);
  });

  test(`mid-watch with calls, ${name(look)}`, async ({ page }) => {
    await open(page, look, 1280, 720);
    await openWatch(page, 'lantern-lark', 'Keeper', 'Career');
    await autopilot(page, 21);
    // Let the Hall's achievement toasts fade before the picture.
    await page.waitForTimeout(7000);
    await saveScreenshot(page, `${MEDIA}/watch-${name(look)}-1280.webp`);
  });

  test(`the end of a watch, ${name(look)}`, async ({ page }) => {
    await open(page, look, 1280, 720);
    await openWatch(page, 'rookery');
    await autopilot(page, 60);
    await expect(page.getByTestId('lk-results')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1200);
    await saveScreenshot(page, `${MEDIA}/results-${name(look)}-1280.webp`);
  });
}

test('the briefing and the service record, night', async ({ page }) => {
  await open(page, 'dark', 1280, 720);
  await page.getByTestId('lk-menu-commission').click();
  await page.waitForTimeout(500);
  await saveScreenshot(page, `${MEDIA}/briefing-night-1280.webp`);
  await page.getByTestId('lk-brief-back').click();
  await page.getByTestId('lk-menu-record').click();
  await page.waitForTimeout(500);
  await saveScreenshot(page, `${MEDIA}/record-night-1280.webp`);
});

test('in the Hall, night', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await runInHall(page, 'lightkeeper', { appearance: 'dark', style: 'console' });
  await page.goto('/#/game/lightkeeper');
  await page.waitForTimeout(3000);
  await saveScreenshot(page, `${MEDIA}/in-the-hall-night-1920.webp`);
});
