// A walk through the real game on the workbench for critique rounds:
// `npx tsx games/snake/scripts/walk.ts <out-dir> [look]`. Starts from empty saves.
import { chromium } from '@playwright/test';

const [out, look = 'sun'] = process.argv.slice(2);
if (!out) throw new Error('Usage: walk.ts <out-dir> [sun|moon]');
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
const shot = async (name: string) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-${look}-${width}.png` });
  process.stdout.write(`${name}\n`);
};

await page.goto(`http://localhost:5276/?fresh=1&look=${look}`);
await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
await shot('01-menu');
await page.getByRole('button', { name: /Start a run/ }).click();
await shot('02-map');
await page.keyboard.press('Enter');
await shot('03-chamber');
for (const key of ['ArrowRight', 'ArrowRight', 'KeyE', 'ArrowDown', 'KeyD', 'KeyD']) {
  await page.keyboard.press(key);
  await page.waitForTimeout(220);
}
await shot('04-steps');
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
await shot('05-peek');
await page.keyboard.press('KeyT');
await shot('06-warp-confirm');
await page.keyboard.press('Enter');
await shot('07-after-warp');
process.stdout.write(errors.length ? `ERRORS: ${errors.slice(0, 5).join(' | ')}\n` : 'no errors\n');
await browser.close();
