/**
 * Renders the full screenshot set of the Hall into docs/media/hall/: every screen of every style,
 * in each of the style's palettes, light and dark, at 1280×720 and 1920×1080, plus an index.
 *
 *   pnpm --filter @usr-games/hall shots:all [--styles console,holo] [--screens home,settings]
 *                                           [--sizes 1920] [--appearances dark] [--out dir]
 *                                           [--resume]
 *
 * Frames are WebP (Chromium encodes them, so no image library is needed): the set is a few
 * hundred frames and PNG would make the repository heavy. The hero frames stay PNG (hero.ts).
 * Needs the dev server on http://localhost:5173 (`pnpm dev`).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';

type Style = 'machine-room' | 'console' | 'holo';
type Appearance = 'light' | 'dark';

interface Screen {
  id: string;
  title: string;
  /** The hash to open, or a scene of its own for screens that are not a route. */
  route?: (style: Style) => string;
  scene?: (style: Style) => string;
  player?: 'ada' | 'new' | 'root' | 'rankup';
  /** Something a still frame cannot show on its own, done before the shot. */
  action?: (page: Page) => Promise<void>;
}

const STYLES: Record<Style, { title: string; scene: string; palettes: (string | null)[] }> = {
  'machine-room': {
    title: 'Machine Room',
    scene: 'home',
    palettes: ['phosphor', 'manual', 'sunset'],
  },
  console: { title: 'Console Home', scene: 'console-home', palettes: [null] },
  holo: { title: 'Holo Collection', scene: 'holo-home', palettes: [null] },
};

/** The native fixture's round: Start, then whatever the shot needs from inside it. */
const startRound = async (page: Page) => {
  await page.getByTestId('fx-start').click();
  await page.waitForTimeout(250);
};
const openPause = async (page: Page) => {
  await startRound(page);
  await page.getByTestId('pl-pause-button').click();
  await page.waitForTimeout(400);
};
const winRound = async (page: Page) => {
  await startRound(page);
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(600);
};

const SCREENS: Screen[] = [
  { id: 'home', title: 'Home', route: () => '#/' },
  { id: 'category', title: 'One category', route: () => '#/games/arcade' },
  {
    id: 'game',
    title: 'Game page',
    route: (style) => (style === 'machine-room' ? '#/man/robots' : '#/game/robots'),
  },
  { id: 'play', title: 'A game’s title screen', scene: (style) => `player-${style}` },
  { id: 'round', title: 'Playing', scene: (style) => `player-${style}`, action: startRound },
  { id: 'pause', title: 'Pause menu', scene: (style) => `player-${style}`, action: openPause },
  { id: 'results', title: 'Results', scene: (style) => `player-${style}`, action: winRound },
  { id: 'hosted', title: 'A hosted game', scene: (style) => `player-hosted-${style}` },
  { id: 'profile', title: 'Profile', route: () => '#/home' },
  { id: 'profile-new', title: 'Profile on day one', route: () => '#/home', player: 'new' },
  { id: 'rank-up', title: 'Rank-up moment', route: () => '#/', player: 'rankup' },
  { id: 'settings', title: 'Settings', route: () => '#/settings' },
  { id: 'about', title: 'About', route: () => '#/about' },
  { id: 'closet-locked', title: 'Closet door (locked)', route: () => '#/closet' },
  { id: 'closet', title: 'Server closet (root)', route: () => '#/closet', player: 'root' },
];

/** Screens that come before any style: the first visit. */
const SHARED: { id: string; title: string; scene: string }[] = [
  { id: 'login', title: 'Login', scene: 'login' },
  { id: 'picker', title: 'Style picker', scene: 'picker' },
];

const SIZES = [
  [1280, 720],
  [1920, 1080],
] as const;
const QUALITY = 0.9;

function argument(name: string): string[] | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1]?.split(',');
}

const outDir = resolve(
  argument('out')?.[0] ?? resolve(import.meta.dirname, '../../../../docs/media/hall'),
);
const styles = (argument('styles') ?? Object.keys(STYLES)) as Style[];
const screenIds = argument('screens');
const sizes = SIZES.filter(
  ([width]) => !argument('sizes') || argument('sizes')!.includes(String(width)),
);
const appearances = (argument('appearances') ?? ['light', 'dark']) as Appearance[];
const base = process.env.HALL_URL ?? 'http://localhost:5173/';
const wanted = (id: string) => !screenIds || screenIds.includes(id);
/** `--resume` keeps frames already on disk, to finish an interrupted run. */
const resume = process.argv.includes('--resume');

/** Day and Night for the plain-word styles, light and dark for the Machine Room palettes. */
function appearanceName(palette: string | null, appearance: Appearance): string {
  if (palette) return `${palette}-${appearance}`;
  return appearance === 'light' ? 'day' : 'night';
}

function sceneUrl(options: {
  scene: string;
  route?: string;
  player?: string;
  palette: string | null;
  appearance: Appearance;
}): string {
  const params = new URLSearchParams({
    scene: options.scene,
    appearance: options.appearance,
    freeze: '1',
  });
  if (options.palette) params.set('theme', options.palette);
  if (options.route) params.set('route', options.route);
  if (options.player) params.set('player', options.player);
  return `${base}?${params}`;
}

/** Chromium re-encodes the PNG capture as WebP in a blank page of its own. */
async function toWebp(encoder: Page, png: Buffer): Promise<Buffer> {
  const dataUrl = await encoder.evaluate(
    async ({ source, quality }) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d')!.drawImage(image, 0, 0);
      return canvas.toDataURL('image/webp', quality);
    },
    { source: `data:image/png;base64,${png.toString('base64')}`, quality: QUALITY },
  );
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

async function shoot(
  page: Page,
  encoder: Page,
  url: string,
  file: string,
  action?: Screen['action'],
) {
  if (resume && existsSync(file)) return;
  // A busy machine can stall one load; a second try is cheaper than restarting the whole set.
  try {
    await page.goto(url, { timeout: 60_000 });
  } catch {
    await page.goto(url, { timeout: 60_000 });
  }
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await action?.(page);
  const webp = await toWebp(encoder, await page.screenshot());
  mkdirSync(resolve(file, '..'), { recursive: true });
  writeFileSync(file, webp);
  console.log(`${relative(outDir, file)}  ${Math.round(webp.length / 1024)} KB`);
}

const index: { section: string; rows: { title: string; files: string[] }[] }[] = [];

const browser = await chromium.launch();
const encoder = await browser.newPage();
for (const [width, height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => console.error('page error:', error.message));
  const record = (section: string, title: string, file: string) => {
    let group = index.find((entry) => entry.section === section);
    if (!group) index.push((group = { section, rows: [] }));
    let row = group.rows.find((entry) => entry.title === title);
    if (!row) group.rows.push((row = { title, files: [] }));
    row.files.push(relative(outDir, file).replaceAll('\\', '/'));
  };

  for (const shared of SHARED.filter((screen) => wanted(screen.id))) {
    for (const appearance of appearances) {
      const file = resolve(
        outDir,
        'first-visit',
        `${shared.id}-${appearanceName(null, appearance)}-${width}.webp`,
      );
      await shoot(
        page,
        encoder,
        sceneUrl({ scene: shared.scene, palette: null, appearance }),
        file,
      );
      record('First visit', shared.title, file);
    }
  }

  for (const style of styles) {
    const { title, scene, palettes } = STYLES[style];
    for (const screen of SCREENS.filter((entry) => wanted(entry.id))) {
      for (const palette of palettes) {
        for (const appearance of appearances) {
          const url = sceneUrl({
            scene: screen.scene?.(style) ?? scene,
            route: screen.route?.(style),
            player: screen.player,
            palette,
            appearance,
          });
          const name = `${screen.id}-${appearanceName(palette, appearance)}-${width}.webp`;
          const file = resolve(outDir, style, name);
          await shoot(page, encoder, url, file, screen.action);
          record(title, screen.title, file);
        }
      }
    }
  }
  await page.close();
}
await browser.close();

/** A browsable index, rewritten only when the whole set was shot. */
if (!argument('styles') && !screenIds && !argument('sizes') && !argument('appearances')) {
  const lines = [
    '# The Hall, screen by screen',
    '',
    'Every screen of every Hall style, in each palette, light and dark, at 1280×720 and',
    '1920×1080. Generated by `pnpm --filter @usr-games/hall shots:all` from the development',
    'screenshot scenes (a demo player, ada, with the clock pinned). The approved hero frames are in',
    '[`hero/`](hero/README.md).',
    '',
  ];
  for (const group of index) {
    lines.push(`## ${group.section}`, '');
    for (const row of group.rows) {
      const links = row.files.map(
        (file) => `[${file.split('/').pop()!.replace('.webp', '')}](${file})`,
      );
      lines.push(`- **${row.title}:** ${links.join(' · ')}`);
    }
    lines.push('');
  }
  writeFileSync(resolve(outDir, 'README.md'), lines.join('\n'));
}
