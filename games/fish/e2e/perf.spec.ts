import { expect, test } from '@playwright/test';

/**
 * Frames per second while the pond plays at 1920 × 1080, by morning and by firefly light
 * (`--grep @look`, since timings depend on the machine and on other sessions sharing it).
 */
for (const appearance of ['light', 'dark'] as const) {
  test(`frame rate in play, ${appearance} @look`, async ({ page }) => {
    await page.goto(`/?game&fresh=1&chrome=0&appearance=${appearance}`);
    await page.waitForFunction(() => window.__gf !== undefined);
    await page.getByTestId('gf-menu-quick').click();
    await page.getByTestId('gf-quick-start').click();
    await page.waitForTimeout(1500);
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const started = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - started < 4000) {
              // Keep the game moving through its turns while we count.
              if (window.__gf!.phase() === 'your-turn') window.__gf!.askAny();
              requestAnimationFrame(tick);
            } else resolve((frames * 1000) / (performance.now() - started));
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`${appearance}: ${fps.toFixed(1)} fps`);
    expect(fps).toBeGreaterThan(50);
  });
}
