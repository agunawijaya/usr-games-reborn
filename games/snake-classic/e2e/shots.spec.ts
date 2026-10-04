import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { gameFrame, inGame, runInHall, waitForGame } from '../../../packages/bridge/testing/hall';
import { saveScreenshot } from '../../../packages/bridge/testing/shots';
import { beginFlight, calmDown, clearAndLeave, gather, openUpTo, READY } from './flight';

/**
 * Documentation screenshots of Talon's Shadow inside the Hall, at 1280×720 and 1920×1080: the
 * expedition desk (five regions cleared), a briefing, a flight with the bird locking on, the
 * report, the field book, the Aztec yard with its rivals and the wild turkey, the challenges and
 * King Drift on a combo. Run with `SHOTS=1`, see
 * playwright.config.ts.
 */
const MEDIA = fileURLToPath(new URL('../docs/media/', import.meta.url));

async function save(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  const kb = await saveScreenshot(page, `${MEDIA}${name}-${width}.webp`);
  process.stdout.write(`${name}-${width}.webp ${kb} KB\n`);
}

for (const size of [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
]) {
  test(`Talon's Shadow in the Hall, ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await openUpTo(page, 'aztec');
    await runInHall(page, 'snake-classic', { appearance: 'light' });
    await waitForGame(page, READY);
    const frame = gameFrame(page);
    await page.waitForTimeout(1500);
    await save(page, 'desk');

    await frame.getByTestId('desk-region-savanna').click();
    await save(page, 'briefing');
    await frame.getByTestId('desk-fly').click();
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    // The secretary bird stays off this picture: the snake is held still for the bird's lock.
    await calmDown(page, { keepBird: true, keepRivals: true });
    await gather(page, 3);
    // Keeps the snake mid-field until the bird locks on to it, then holds that moment still.
    await inGame(
      page,
      `window.__hold = setInterval(() => {
        const game = window.TalonGame;
        const eagle = game.peek().eagle;
        if (eagle.state === 'lock' && eagle.quarry === 'you') {
          clearInterval(window.__hold);
          return game.setPaused(true);
        }
        game.placeHead(420, 330);
      }, 30)`,
    );
    await expect
      .poll(
        () =>
          inGame<boolean>(
            page,
            "window.TalonGame.peek().eagle.state === 'lock' && window.TalonGame.peek().eagle.quarry === 'you'",
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    await page.waitForTimeout(300);
    await save(page, 'flight');
    await inGame(page, 'window.TalonGame.setPaused(false)');
    await calmDown(page);
    await clearAndLeave(page, 'north');
    await expect(frame.getByTestId('desk-report')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await save(page, 'report');
    // The Hall's toasts for that first escape pass before the next pictures.
    await page.waitForTimeout(6000);

    await frame.getByTestId('desk-report').getByRole('button', { name: 'Expedition' }).click();
    await frame.getByTestId('desk-book').click();
    await save(page, 'field-book');
    await frame.getByTestId('desk-back').click();
    await beginFlight(page, 'aztec');
    // Up towards the yard's south wall, then west along it.
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(700);
    await page.keyboard.press('KeyA');
    await page.waitForTimeout(1300);
    await page.keyboard.press('KeyW');
    // Long enough for the wild turkey to come in from its corner.
    await page.waitForTimeout(1600);
    await save(page, 'aztec');

    // The challenges, and King Drift a few seconds in, held still on a combo.
    await page.reload();
    await waitForGame(page, READY);
    await frame.getByTestId('desk-challenges').click();
    await page.waitForTimeout(400);
    await save(page, 'challenges');
    await frame.getByTestId('desk-challenge-drift').click();
    await frame.getByTestId('desk-play').click();
    await expect.poll(() => inGame<string>(page, 'window.TalonGame.state')).toBe('playing');
    await inGame(
      page,
      `(() => {
        let tick = 0;
        for (let i = 0; i < 400; i++) {
          window.TalonGame.fastForward(16, (p) => {
            tick++;
            const across = p.head.x < 220 ? 1 : p.head.x > 680 ? -1 : (window.__across || 1);
            window.__across = across;
            const vertical = p.head.y < 150 ? 1 : p.head.y > 450 ? -1 : Math.floor(tick / 34) % 2 ? 1 : -1;
            return tick % 34 < 17 ? { dx: 0, dy: vertical } : { dx: across, dy: 0 };
          });
          const state = window.TalonGame.modeApi.state;
          if (state.meter.combo >= 3 && state.popups.length) break;
        }
        window.TalonGame.setPaused(true);
      })()`,
    );
    // The line under the field catches up within half a second.
    await page.waitForTimeout(700);
    await save(page, 'drift');
  });
}
