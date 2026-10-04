// Frames per second at 1920×1080: `npx tsx games/dab/scripts/perf.ts [chalk|neon]`, with the
// workbench running (`pnpm --filter @usr-games/game-dab dev`).
import { chromium } from '@playwright/test';

const look = process.argv[2] ?? 'neon';
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`http://localhost:5287/?fresh=1&look=${look}`);
await page.waitForFunction('window.__ready === true');
// Passed as a string: the bundler's name helpers do not exist inside the page.
const COUNT_FRAMES = `new Promise((resolve) => {
  let frames = 0;
  let worst = 0;
  let last = performance.now();
  const start = last;
  const tick = (now) => {
    frames++;
    worst = Math.max(worst, now - last);
    last = now;
    if (now - start < 3000) requestAnimationFrame(tick);
    else resolve({ fps: (frames * 1000) / (now - start), worst });
  };
  requestAnimationFrame(tick);
})`;
const measure = async (label: string) => {
  const { fps, worst } = (await page.evaluate(COUNT_FRAMES)) as { fps: number; worst: number };
  process.stdout.write(`${label}: ${fps.toFixed(1)} fps, slowest frame ${worst.toFixed(0)} ms\n`);
};
await page.waitForTimeout(1500);
await measure('game menu (the board playing itself)');

// A 7 × 7 board against Master with the lens on, lines going down all the while.
await page.getByTestId('dx-go-custom').click();
for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More columns' }).click();
for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'More rows' }).click();
await page.getByRole('radio', { name: /Master/ }).check();
await page.getByTestId('dx-custom-start').click();
await page.getByTestId('dx-start').click();
await page.keyboard.press('KeyC');
const playing = page.evaluate(`(async () => {
  for (let i = 0; i < 40; i++) {
    const p = window.__dx.play();
    if (!p || p.match.over) break;
    if (p.humanToMove) {
      const free = [...p.match.board.drawn.keys()].filter((e) => !p.match.board.drawn[e]);
      p.play(free[Math.floor(Math.random() * free.length)]);
    } else p.skipWait();
    await new Promise((r) => setTimeout(r, 120));
  }
})()`);
await measure('play, 7 × 7 against Master, lens on');
await playing;
await browser.close();
