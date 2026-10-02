// The big moments of the real game, staged through `window.__fp`, for critique rounds:
// `npx tsx games/snake/scripts/moments.ts <out-dir> [sun|moon]`.
import { chromium, type Page } from '@playwright/test';

const [out, look = 'sun'] = process.argv.slice(2);
if (!out) throw new Error('Usage: moments.ts <out-dir> [sun|moon]');
const width = Number(process.env.W ?? 1920);
const height = Number(process.env.H ?? 1080);
const browser = await chromium.launch({
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width, height } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const shot = async (name: string, wait = 400) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/${name}-${look}-${width}.png` });
  process.stdout.write(`${name}\n`);
};

/** Puts something on the square east of you: the door, or a piece of the snake. */
async function stageEast(p: Page, what: 'door' | 'snake', pockets: number) {
  await p.evaluate(
    ({ what, pockets }) => {
      const play = (
        window as unknown as {
          __fp: {
            play: () => {
              session: { round: Record<string, unknown> };
              stage: (patch: object) => void;
            };
          };
        }
      ).__fp.play();
      const round = play.session.round as {
        you: { x: number; y: number };
        garden: { door: unknown };
        snake: Array<{ x: number; y: number }>;
        loot: number;
      };
      const east = { x: round.you.x + 1, y: round.you.y };
      const ledger = { gross: pockets, spent: 0 };
      if (what === 'door')
        play.stage({ garden: { ...round.garden, door: east }, ledger, loot: 300 });
      else
        play.stage({
          snake: [{ x: east.x + 1, y: east.y }, east, ...round.snake.slice(2)],
          ledger,
          loot: 350,
        });
    },
    { what, pockets },
  );
}

await page.goto(`http://localhost:5276/?fresh=1&look=${look}`);
await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
await page.evaluate(() => document.fonts.ready);
await page.getByRole('button', { name: /Start a run/ }).click();
await page.getByTestId('fp-map').waitFor();
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(300);
await stageEast(page, 'door', 412);
await page.keyboard.press('ArrowRight');
await shot('10-door', 600);
await page.keyboard.press('KeyD');
await page.getByTestId('fp-map').waitFor();
await shot('11-deeper-map', 600);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await stageEast(page, 'snake', 1386);
await page.keyboard.press('ArrowRight');
await shot('12-coil', 700);
await shot('13-wink', 900);
await shot('14-dial', 2200);
await shot('15-after-dial', 2600);
// A fresh run to bank.
await page.evaluate(() =>
  (document.querySelector('[data-choice="again"]') as HTMLButtonElement | null)?.click(),
);
await page.getByTestId('fp-map').waitFor();
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await stageEast(page, 'door', 1240);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
await page.keyboard.press('KeyB');
await shot('16-bank', 1300);
await shot('17-results', 2600);
process.stdout.write(errors.length ? `ERRORS: ${errors.slice(0, 5).join(' | ')}\n` : 'no errors\n');
await browser.close();
