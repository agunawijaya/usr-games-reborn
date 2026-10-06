import { fileURLToPath } from 'node:url';
import { test } from '@playwright/test';
import { inGame, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { reachTheCanyonCut, READY } from './shift';

/**
 * Review frames of the underground look for the owner (`REVIEW=1`): the Canyon Cut mid-shift,
 * its stack of stones a few rows deep with gaps, a piece falling over its ghost, by day and by
 * night, at 1280×720 and 1920×1080. Saved to docs/media/review/.
 */
const REVIEW = fileURLToPath(new URL('../docs/media/review/', import.meta.url));

test.skip(!process.env.REVIEW, 'review frames only on request');

/** A stack four rows deep, a hole or two in each, mixed stones, and a T falling above it. */
const STACK = `(() => {
  const g = window.game;
  const colors = Object.values(window.BrokenWellEngine.PIECE_COLORS);
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const y = g.height - 1 - r;
    const open = [];
    for (let x = 0; x < g.width; x++) if (g.board[y][x].type !== 'rock') open.push(x);
    open.forEach((x, i) => {
      const hole = (i + r * 2) % 5 === 1 || (r === 3 && i % 2 === 0);
      g.board[y][x] = hole ? { type: 'empty' } : { type: 'filled', color: colors[(x * 3 + r) % colors.length] };
    });
  }
  g.current.y = Math.floor(g.height * 0.35);
  g.paused = true;
  g.updateGhost();
})()`;

for (const appearance of ['dark', 'light'] as const) {
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    test(`underground ${appearance} ${size.width}`, async ({ page }) => {
      await page.setViewportSize(size);
      await runInHall(page, 'blocks-classic', { appearance });
      await waitForGame(page, READY);
      await reachTheCanyonCut(page);
      await inGame(page, STACK);
      await page.waitForTimeout(1200);
      await saveScreenshot(page, `${REVIEW}play-${appearance}-${size.width}.webp`);
    });
  }
}

/** The key art the game hands the Hall, and the Hall's home showing it. */
for (const appearance of ['dark', 'light'] as const) {
  test(`poster ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await runInHall(page, 'blocks-classic', { appearance });
    await waitForGame(page, READY);
    await page.waitForFunction(() =>
      (window.localStorage.getItem('usr-games:hall:posters') ?? '').includes('blocks-classic'),
    );
    const image = await page.evaluate(() => {
      const shelf = JSON.parse(window.localStorage.getItem('usr-games:hall:posters')!);
      const posters = (shelf.data?.posters ?? shelf.data ?? {}) as Record<
        string,
        { image: string }
      >;
      return posters['blocks-classic']?.image ?? '';
    });
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync(REVIEW, { recursive: true });
    writeFileSync(
      `${REVIEW}poster-${appearance}.webp`,
      Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'),
    );
    await page.goto('/#/game/blocks-classic');
    await page.waitForTimeout(2500);
    await saveScreenshot(page, `${REVIEW}hall-page-${appearance}-1280.webp`);
    await page.goto('/#/games/arcade');
    await page.locator('a, button', { hasText: 'Broken Well' }).first().focus();
    await page.waitForTimeout(1500);
    await saveScreenshot(page, `${REVIEW}hall-arcade-${appearance}-1280.webp`);
  });
}
