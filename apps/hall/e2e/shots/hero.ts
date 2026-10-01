/**
 * Renders hero frames from the live Hall running in screenshot scenes, at 1920×1080 by default.
 *
 *   pnpm --filter @usr-games/hall shots [--scenes home,man,…] [--themes phosphor,…]
 *                                      [--appearances dark,light] [--out dir]
 *                                      [--width 1920 --height 1080]
 *
 * Machine Room scenes (home, man, profile) render once per palette; the other styles have one
 * signature palette. Needs the dev server on http://localhost:5173 (`pnpm dev`).
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const MACHINE_ROOM_SCENES = ['home', 'man', 'profile'];
const NEW_STYLE_SCENES = ['console-home', 'console-detail', 'holo-home', 'holo-album', 'picker'];
const THEMES = ['phosphor', 'manual', 'sunset'];
const APPEARANCES = ['dark', 'light'];

/** Moments a still frame cannot show on its own, such as a card tilting under the pointer. */
const ACTIONS: Record<string, (page: Page) => Promise<void>> = {
  'holo-home': async (page) => {
    const card = page.locator('[data-hero-hover]').first();
    if ((await card.count()) === 0) return;
    const box = await card.boundingBox();
    if (!box) return;
    // Up and to the right of centre, so the card leans toward the light.
    await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.26, { steps: 8 });
    await page.waitForTimeout(450);
  },
};

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const outDir = resolve(
  argument('out') ?? resolve(import.meta.dirname, '../../../../docs/media/hall/hero'),
);
const scenes =
  argument('scenes')?.split(',') ?? argument('only')?.split(',') ?? MACHINE_ROOM_SCENES;
const themes = argument('themes')?.split(',') ?? THEMES;
const appearances = argument('appearances')?.split(',') ?? APPEARANCES;
const base = process.env.HALL_URL ?? 'http://localhost:5173/';
const width = Number(argument('width') ?? 1920);
const height = Number(argument('height') ?? 1080);

/** Day and Night for the new styles, light and dark for the Machine Room, as the briefs name them. */
function fileName(scene: string, theme: string | null, appearance: string): string {
  if (theme) return `${scene}-${theme}-${appearance}.png`;
  return `${scene}-${appearance === 'light' ? 'day' : 'night'}.png`;
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => console.error('page error:', error.message));

for (const scene of scenes) {
  if (!MACHINE_ROOM_SCENES.includes(scene) && !NEW_STYLE_SCENES.includes(scene)) {
    console.error(`unknown scene: ${scene}`);
    continue;
  }
  const palettes = MACHINE_ROOM_SCENES.includes(scene) ? themes : [null];
  for (const theme of palettes) {
    for (const appearance of appearances) {
      const themeParam = theme ? `&theme=${theme}` : '';
      await page.goto(`${base}?scene=${scene}${themeParam}&appearance=${appearance}&freeze=1`);
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);
      await ACTIONS[scene]?.(page);
      const file = resolve(outDir, fileName(scene, theme, appearance));
      await page.screenshot({ path: file });
      console.log(file);
    }
  }
}
await browser.close();
