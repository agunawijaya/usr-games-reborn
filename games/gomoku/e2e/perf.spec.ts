import { expect, test } from '@playwright/test';

/**
 * The frame rate at 1920 × 1080 on the heaviest board (the `perf` scene): 300 pieces on 19 × 19
 * with Read the board on, lanterns bobbing with their halos and reflections, the moon's path and
 * the lanterns drifting beside the board; by day and by night. Frames are timed in the page with
 * requestAnimationFrame; the GPU flags of the shared config apply.
 */

for (const look of ['sand', 'lake'] as const) {
  test(`the fullest board holds 60 fps at 1920 × 1080 in ${look} @perf`, async ({ page }) => {
    await page.goto(`/?scene=perf&look=${look}&live=1`);
    await page.waitForFunction(() => window.__sceneReady === true);
    await page.waitForTimeout(800);
    const frames = await page.evaluate(
      () =>
        new Promise<number[]>((resolve) => {
          const times: number[] = [];
          let last = performance.now();
          const tick = (now: number) => {
            times.push(now - last);
            last = now;
            if (times.length < 330) requestAnimationFrame(tick);
            else resolve(times.slice(10));
          };
          requestAnimationFrame(tick);
        }),
    );
    const sorted = [...frames].sort((a, b) => a - b);
    const mean = frames.reduce((s, f) => s + f, 0) / frames.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    console.log(
      `${look}: mean ${mean.toFixed(1)} ms (${(1000 / mean).toFixed(0)} fps), p95 ${p95.toFixed(1)} ms`,
    );
    expect(mean).toBeLessThan(18);
    expect(p95).toBeLessThan(25);
  });
}
