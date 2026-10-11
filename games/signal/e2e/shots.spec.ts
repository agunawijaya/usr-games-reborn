import { fileURLToPath } from 'node:url';
import { type Page, test } from '@playwright/test';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { begin, go, openDesk } from './hook';

/**
 * The documentation screenshots (`docs/media/`): every main screen at 1280×720 and 1920×1080,
 * by morning and by night, from the workbench. Run with `--grep @shots`.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

const SCREENS: Array<[string, (page: Page) => Promise<void>]> = [
  ['menu', async () => undefined],
  ['room', (page) => go(page, 'room')],
  [
    'telegraph',
    async (page) => {
      await go(page, 'message', 'c1-m5');
      await begin(page);
      await page.waitForTimeout(6000);
    },
  ],
  [
    'cipher',
    async (page) => {
      await go(page, 'message', 'c2-m1');
      await begin(page);
      for (let i = 0; i < 23; i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(900);
    },
  ],
  [
    'punch',
    async (page) => {
      await go(page, 'message', 'c3-m2');
      await begin(page);
      await page.locator('.dd-card-surface').focus();
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    },
  ],
  [
    'printer',
    async (page) => {
      await go(page, 'message', 'c5-m1');
      await begin(page);
      await page.waitForTimeout(2600);
    },
  ],
  [
    'flags',
    async (page) => {
      await go(page, 'message', 'c6-m3');
      await begin(page);
      await page.keyboard.press('KeyA');
      await page.keyboard.press('Numpad3');
      await page.waitForTimeout(500);
      await page.keyboard.press('KeyZ');
      await page.waitForTimeout(500);
    },
  ],
  [
    'results',
    async (page) => {
      await go(page, 'message', 'c1-m1');
      await begin(page);
      await page.getByTestId('dd-input').fill('tea at ten');
      await page.keyboard.press('Enter');
      await page.getByTestId('dd-results').waitFor();
    },
  ],
];

for (const [width, height] of [
  [1280, 720],
  [1920, 1080],
] as const) {
  for (const look of ['morning', 'night'] as const) {
    for (const [name, stage] of SCREENS) {
      test(`@shots ${name}, ${look}, ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await openDesk(page, `&look=${look}`);
        await stage(page);
        await page.waitForTimeout(400);
        const size = await saveScreenshot(page, `${MEDIA}${name}-${look}-${width}.webp`);
        console.log(`${name}-${look}-${width}.webp ${size} KB`);
      });
    }
  }
}
