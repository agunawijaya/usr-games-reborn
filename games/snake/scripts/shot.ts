// Screenshots of the workbench for critique rounds:
// `npx tsx games/snake/scripts/shot.ts <out-dir> <query> [<query> …]`, each query like
// `scene=chamber&look=moon&freeze=2.4`, at 1920×1080 unless `W`/`H` say otherwise.
import { chromium } from '@playwright/test';

const [out, ...queries] = process.argv.slice(2);
if (!out || queries.length === 0) throw new Error('Usage: shot.ts <out-dir> <query>…');
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
for (const query of queries) {
  await page.goto(`http://localhost:5276/?${query}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  const name = query.replace(/[&=]/g, '-').replace(/[^a-z0-9.-]/gi, '');
  await page.screenshot({ path: `${out}/${name}-${width}.png` });
  process.stdout.write(`${name}\n`);
}
process.stdout.write(errors.length ? `ERRORS: ${errors.slice(0, 5).join(' | ')}\n` : 'no errors\n');
await browser.close();
