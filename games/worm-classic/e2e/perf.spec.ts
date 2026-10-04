import { expect, test } from '@playwright/test';
import { inGame, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { READY, beginCrawl, openUpTo, playUntil } from './crawl';

/**
 * How smoothly the busiest orchard draws: Midnight at 1920×1080 with every creature out and the
 * worm steered in real time by the bot, frames counted over five seconds inside the game's page.
 * Run with `PERF=1 pnpm exec playwright test -c games/worm-classic perf`; NOTES.md records the
 * result. Skipped otherwise, since a busy machine makes the number meaningless.
 */
test('Midnight draws at the display’s rate at 1920×1080', async ({ page }) => {
  test.skip(!process.env.PERF, 'set PERF=1 to measure');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openUpTo(page, 'midnight');
  await runInHall(page, 'worm-classic');
  await waitForGame(page, READY);
  await beginCrawl(page, 'midnight');
  await playUntil(page, 'p.gardener !== null && p.rival !== null && p.frog !== null');
  const frames = await inGame<number[]>(
    page,
    `new Promise((done) => {
      const steer = window.__crawlBot({ stayFor: Infinity });
      const gaps = [];
      let last = performance.now();
      const started = last;
      const tick = (now) => {
        gaps.push(now - last);
        last = now;
        const want = steer(window.OrchardGame.peek());
        if (want) window.OrchardGame.steer(want.dx, want.dy);
        if (now - started < 5000 && window.OrchardGame.state === 'playing') requestAnimationFrame(tick);
        else done(gaps);
      };
      requestAnimationFrame(tick);
    })`,
  );
  const sorted = frames.slice(1).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? Infinity;
  const slow = sorted[Math.floor(sorted.length * 0.95)] ?? Infinity;
  process.stdout.write(
    `frames ${sorted.length} · median ${median.toFixed(1)} ms (${(1000 / median).toFixed(0)} fps) · 95th ${slow.toFixed(1)} ms\n`,
  );
  expect(median).toBeLessThan(20);
});
