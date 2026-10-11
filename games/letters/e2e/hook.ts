import type { Page } from '@playwright/test';

/**
 * Helpers that reach the workbench's app (set by dev/main.ts) to find words on the live board
 * and where its cubes sit on screen, so tests can drag and type real words.
 */
export interface LiveWord {
  word: string;
  path: number[];
}

export async function waitForPlay(page: Page) {
  await page.waitForFunction(
    () =>
      (window as unknown as { __chl?: { live?: { phase: string } } }).__chl?.live?.phase ===
      'playing',
    null,
    { timeout: 30_000 },
  );
}

export async function boardWords(page: Page): Promise<LiveWord[]> {
  return page.evaluate(() => {
    const app = (window as unknown as { __chl: { live: { deal: { words: LiveWord[] } } } }).__chl;
    return app.live.deal.words.map((w) => ({ word: w.word, path: [...w.path] }));
  });
}

export async function foundWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const app = (window as unknown as { __chl: { live: { state: { found: { word: string }[] } } } })
      .__chl;
    return app.live.state.found.map((f) => f.word);
  });
}

export async function cellCentre(page: Page, cell: number): Promise<{ x: number; y: number }> {
  return page.evaluate((c) => {
    const app = (
      window as unknown as {
        __chl: { board: { cellPoint(cell: number): { x: number; y: number } } };
      }
    ).__chl;
    return app.board.cellPoint(c);
  }, cell);
}

/** Drags the mouse through a word's cubes, centre to centre, and lets go. */
export async function trace(page: Page, path: readonly number[]) {
  const first = await cellCentre(page, path[0]!);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const cell of path.slice(1)) {
    const point = await cellCentre(page, cell);
    await page.mouse.move(point.x, point.y, { steps: 6 });
  }
  await page.mouse.up();
}
