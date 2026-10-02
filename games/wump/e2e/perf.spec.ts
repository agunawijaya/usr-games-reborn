import { expect, type Page, test } from '@playwright/test';
import { CAMPAIGN } from '../src/engine/campaign';

/**
 * Frame rate in the deep cave (120 rooms) at 1920 × 1080, while exploring and while the camera
 * rides a dart: `pnpm exec playwright test -c games/wump --grep @perf`. Prints the numbers for the
 * notes; asserts only a floor, since a shared test machine is no benchmark.
 */

async function frames(page: Page, seconds: number) {
  const gaps = await page.evaluate(
    (ms) =>
      new Promise<number[]>((resolve) => {
        const gaps: number[] = [];
        const start = performance.now();
        let last = start;
        const step = (now: number) => {
          gaps.push(now - last);
          last = now;
          if (now - start < ms) requestAnimationFrame(step);
          else resolve(gaps.slice(1));
        };
        requestAnimationFrame(step);
      }),
    seconds * 1000,
  );
  const sorted = [...gaps].sort((a, b) => a - b);
  const mean = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  return {
    fps: Math.round(1000 / mean),
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]! * 10) / 10,
  };
}

for (const appearance of ['light', 'dark'] as const) {
  test(`the deep cave holds its frame rate in ${appearance} @perf`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/?game=1&mute=1&appearance=${appearance}`);
    await page.waitForFunction(() => window.__sceneReady === true);
    const caves = Object.fromEntries(
      CAMPAIGN.map((cave) => [
        cave.id,
        { stars: 1, bestScore: 100, fewestMoves: 9, tries: 1, hushes: 1 },
      ]),
    );
    await page.evaluate((data) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        'usr-games:wump-workbench:progress',
        JSON.stringify({ v: 1, savedAt: '', data: { tutorialDone: true, caves: data } }),
      );
    }, caves);
    await page.reload();
    await page.waitForFunction(() => window.__sceneReady === true);
    await page.getByRole('button', { name: /Expeditions/ }).click();
    await page.getByRole('button', { name: /Expedition 12:/ }).click();
    await expect(page.locator('.hw-room__name')).toBeVisible();
    await page.waitForTimeout(800);
    const exploring = await frames(page, 3);
    await page.keyboard.press('a');
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await expect(page.locator('.hw-ride')).toBeVisible();
    const riding = await frames(page, 1.5);
    console.log(
      `deep cave 1920×1080, ${appearance}: exploring ${exploring.fps} fps (p95 ${exploring.p95} ms), dart ride ${riding.fps} fps (p95 ${riding.p95} ms)`,
    );
    expect(exploring.fps).toBeGreaterThan(30);
    expect(riding.fps).toBeGreaterThan(30);
  });
}
