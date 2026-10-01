/**
 * Drives the workbench for screenshots: `tsx scripts/drive.ts <path?query> <width> <height> <steps…>`
 * where a step is `click:<testid>`, `key:<key>`, `keys:<key>x<count>`, `wait:<ms>` or `shot:<file>`.
 */
import { chromium } from '@playwright/test';

const [path = '/', width = '1280', height = '720', ...steps] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto(`http://localhost:5290${path}`);
await page.waitForTimeout(800);
for (const step of steps) {
  const [kind, value = ''] = step.split(/:(.*)/s);
  if (kind === 'click') await page.click(`[data-testid="${value}"]`);
  else if (kind === 'key') await page.keyboard.press(value);
  else if (kind === 'keys') {
    const [key, count] = value.split('x');
    for (let i = 0; i < Number(count); i++) await page.keyboard.press(key!);
  } else if (kind === 'wait') await page.waitForTimeout(Number(value));
  else if (kind === 'shot') await page.screenshot({ path: value });
  else if (kind === 'log') {
    const log = await page.evaluate(
      () => (window as unknown as { __zoomiesLog?: string[] }).__zoomiesLog ?? [],
    );
    process.stdout.write(`${log.join('\n')}\n`);
  }
}
await browser.close();
if (errors.length) process.stdout.write(`errors:\n${errors.join('\n')}\n`);
process.stdout.write('done\n');
