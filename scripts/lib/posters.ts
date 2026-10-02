import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { Browser, Frame, Page } from '@playwright/test';
import { CONTENT_TYPES } from './hosted-dev-plugin.ts';
import { POSTER_LIST } from './hosted.ts';

/**
 * Build-time key art for the hosted games. A hosted game sends the Hall a snapshot of itself
 * only once it has been played, so on a first visit Console Home and Holo Collection would have
 * nothing of it to show. After `pnpm build`, this opens every hosted game in the built Hall in a
 * headless browser and keeps what the game offers:
 *
 * - its own snapshot, when it sends one within `SNAPSHOT_WAIT_MS` (the Hall keeps it on its
 *   poster shelf, where this reads it back), written as sent. Games that offer one only during
 *   play are first walked past their menu the way a player would (`START_PLAY`);
 * - otherwise a still of its frame once the page has settled, as JPEG.
 *
 * Each lands in `dist/play/<id>/poster.<ext>`, listed in `dist/play/posters.js`, which the Hall
 * imports at start-up. The files exist only in `dist/`: the repository holds no raster files
 * (ADR 0002, ADR 0012).
 */

const VIEWPORT = { width: 1280, height: 720 };
/** Long enough for a game to reach its snapshot: some wait for a plane to be airborne. */
const SNAPSHOT_WAIT_MS = 20_000;
const SETTLE_MS = 6_000;
const PAGES_AT_ONCE = 2;
/** The same flags the hosted games' screenshot suites use, so WebGL games keep their full look. */
const GPU_ARGS = [
  ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []),
  '--enable-gpu',
  '--ignore-gpu-blocklist',
];

/**
 * How to get a game past its menu into play, for the games that send their snapshot only then.
 * Each follows the game's own end-to-end suite (`games/<id>/e2e/`); when a step no longer fits
 * the game, the capture simply falls back to a still of its frame.
 */
const START_PLAY: Readonly<Record<string, (page: Page, game: Frame) => Promise<void>>> = {
  hunt: (_, game) => game.locator('#o-start').click(),
  battlestar: (_, game) => game.locator('#b-start').click(),
  sail: async (_, game) => {
    await game.getByRole('button', { name: /Historical Actions/ }).click();
    await game.locator('#menu [data-sc]').first().click();
    await game.locator('[data-ship]').first().click();
    await game.locator('#sail').click();
  },
  // A free mission; its first visit opens the tutorial, which Escape closes.
  trek: async (page) => {
    await page.keyboard.press('f');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
  },
  // An open shift: choose it, read the briefing, take position, close the help.
  'atc-classic': async (page, game) => {
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    await game.locator('#briefing-overlay.shown').waitFor({ timeout: 5_000 });
    await page.keyboard.press('Enter');
    await game.locator('#help-overlay.shown').waitFor({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  },
};
const MENU_SETTLE_MS = 3_000;

export interface PosterCapture {
  id: string;
  /** Site-relative path of the poster, or null when none could be made. */
  path: string | null;
  how: 'snapshot' | 'frame' | 'failed';
}

/** Serves the built site under its base path, like GitHub Pages would. */
function serveDist(dist: string, base: string): Promise<{ server: Server; origin: string }> {
  const root = resolve(dist);
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let file: string | null = null;
    if (url.pathname.startsWith(base)) {
      const inside = resolve(
        root,
        normalize(`.${sep}${decodeURIComponent(url.pathname.slice(base.length))}`),
      );
      if (inside === root || inside.startsWith(root + sep)) file = inside;
    }
    if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!file || !existsSync(file)) {
      response.statusCode = 404;
      response.end();
      return;
    }
    response.setHeader(
      'Content-Type',
      CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    );
    createReadStream(file).pipe(response);
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolveServer({ server, origin: `http://127.0.0.1:${port}` });
    });
  });
}

/** A signed-in guest with a muted Hall, opening the game the way a player would. */
function seedScript(): string {
  return `
    if (window.top === window) {
      const put = (key, version, data) => window.localStorage.setItem(
        'usr-games:hall:' + key, JSON.stringify({ v: version, savedAt: '', data }));
      put('settings', 2, { style: 'console', appearance: 'dark', motion: 'full', muted: true });
      put('profile', 2, { username: null, guest: true, createdOn: null, hintsSeen: [], styleChosen: true });
    }`;
}

const SNAPSHOT_SCRIPT = (id: string) => `(() => {
  const raw = window.localStorage.getItem('usr-games:hall:posters');
  if (!raw) return null;
  const poster = JSON.parse(raw).data?.[${JSON.stringify(id)}];
  return poster ? poster.image : null;
})()`;

async function captureOne(
  browser: Browser,
  origin: string,
  base: string,
  dist: string,
  id: string,
): Promise<PosterCapture> {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    await page.addInitScript(seedScript());
    await page.goto(`${origin}${base}`);
    await page.waitForSelector('html[data-style="console"]', { timeout: 30_000 });
    await page.goto(`${origin}${base}#/run/${id}`);
    await page.waitForSelector('[data-testid="pl-frame"]', { timeout: 30_000 });
    const folder = join(dist, 'play', id);
    mkdirSync(folder, { recursive: true });
    const startPlay = START_PLAY[id];
    const game = page.frame({ url: /\/play\// });
    if (startPlay && game) {
      await page.waitForTimeout(MENU_SETTLE_MS);
      await startPlay(page, game).catch(() => undefined);
    }

    const snapshot = await page
      .waitForFunction(SNAPSHOT_SCRIPT(id), undefined, { timeout: SNAPSHOT_WAIT_MS, polling: 500 })
      .then((handle) => handle.jsonValue() as Promise<string>)
      .catch(() => null);
    const decoded = snapshot ? /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(snapshot) : null;
    if (decoded) {
      const extension = decoded[1] === 'jpeg' ? 'jpg' : (decoded[1] as string);
      writeFileSync(
        join(folder, `poster.${extension}`),
        Buffer.from(decoded[2] as string, 'base64'),
      );
      return { id, path: `play/${id}/poster.${extension}`, how: 'snapshot' };
    }

    await page.waitForTimeout(SETTLE_MS);
    await page
      .locator('[data-testid="pl-frame"]')
      .screenshot({ path: join(folder, 'poster.jpg'), type: 'jpeg', quality: 84 });
    return { id, path: `play/${id}/poster.jpg`, how: 'frame' };
  } catch {
    return { id, path: null, how: 'failed' };
  } finally {
    await context.close();
  }
}

export function writePosterList(dist: string, captures: readonly PosterCapture[]): void {
  const listed = Object.fromEntries(
    captures.filter((capture) => capture.path).map((capture) => [capture.id, capture.path]),
  );
  mkdirSync(join(dist, 'play'), { recursive: true });
  writeFileSync(
    join(dist, POSTER_LIST),
    `// Build-time posters of the hosted games (scripts/lib/posters.ts).\nexport default ${JSON.stringify(listed, null, 2)};\n`,
  );
}

/**
 * Captures a poster for each hosted game in `ids` from the built site in `dist`. Returns null
 * when no headless browser is available; the Hall then keeps its own key art for first visits.
 */
export async function capturePosters(options: {
  dist: string;
  base: string;
  ids: readonly string[];
}): Promise<PosterCapture[] | null> {
  // The list exists even if nothing is captured, so the Hall never asks for a missing file.
  writePosterList(options.dist, []);
  let browser: Browser;
  try {
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch({ args: GPU_ARGS });
  } catch {
    return null;
  }
  const { server, origin } = await serveDist(options.dist, options.base);
  const captures: PosterCapture[] = [];
  try {
    const queue = [...options.ids];
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        captures.push(await captureOne(browser, origin, options.base, options.dist, id));
      }
    };
    await Promise.all(Array.from({ length: PAGES_AT_ONCE }, worker));
  } finally {
    await browser.close();
    server.close();
  }
  captures.sort((a, b) => options.ids.indexOf(a.id) - options.ids.indexOf(b.id));
  writePosterList(options.dist, captures);
  return captures;
}
