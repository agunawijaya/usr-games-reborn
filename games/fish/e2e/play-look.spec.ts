import { expect, test } from '@playwright/test';

/**
 * A review aid, not a test of behaviour: plays a Quick game at the real pace and saves a
 * picture every few hundred milliseconds into `LOOK_DIR`, so every animation of play can be
 * judged frame by frame (`--grep @look`). `LOOK_QUERY=&appearance=dark` for the night pond.
 */
const [width, height] = (process.env.LOOK_SIZE ?? '1920x1080').split('x').map(Number);
test.use({ viewport: { width: width!, height: height! } });

test('play frames for review @look', async ({ page }) => {
  const dir = process.env.LOOK_DIR;
  expect(dir, 'LOOK_DIR names where the pictures go').toBeTruthy();
  await page.goto(`/?game&fresh=1&chrome=0${process.env.LOOK_QUERY ?? ''}`);
  await page.waitForFunction(() => window.__gf !== undefined);
  await page.getByTestId('gf-menu-quick').click();
  await page.getByTestId('gf-quick-start').click();
  let shot = 0;
  for (let round = 0; round < Number(process.env.LOOK_ROUNDS ?? 3); round++) {
    await expect
      .poll(() => page.evaluate(() => window.__gf!.phase()), { timeout: 60_000 })
      .toBe('your-turn');
    await page.screenshot({ path: `${dir}/turn-${round}.png` });
    await page.evaluate(() => window.__gf!.askAny());
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(260);
      await page.screenshot({ path: `${dir}/r${round}-${String(shot++).padStart(3, '0')}.png` });
    }
  }
});
