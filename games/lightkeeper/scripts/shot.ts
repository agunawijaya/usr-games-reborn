/**
 * Workbench screenshots: `tsx scripts/shot.ts <out.png> <path?query> [width] [height] [steps]`.
 * Opens the workbench on port 5300 in Chromium, plays the steps and saves one frame. Steps are
 * separated by `;`: `click:<testid>`, `key:<key>`, `wait:<ms>`, `cell:<row>,<col>` (a click on
 * the zone), `zone:<row>,<col>` (a click on the chart), `hover:<row>,<col>`, `fill:<testid>=<text>`, `auto:<orders>` (the dev autopilot).
 */
import { chromium } from '@playwright/test';

const [out, path = '/', width = '1280', height = '720', steps = 'wait:900'] = process.argv.slice(2);
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await page.goto(`http://localhost:5300${path}`);
await page.waitForTimeout(600);

async function canvasPoint(testId: string, row: number, col: number, size: number) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const pad = testId === 'lk-zone' ? Math.max(16, Math.min(box.width, box.height) * 0.04) : 0;
  if (testId === 'lk-zone') {
    const board = Math.min(box.width, box.height) - pad * 2;
    const x0 = box.x + (box.width - board) / 2;
    const y0 = box.y + (box.height - board) / 2;
    return { x: x0 + (col + 0.5) * (board / size), y: y0 + (row + 0.5) * (board / size) };
  }
  const label = Math.max(16, Math.min(box.width, box.height) * 0.055);
  const board = Math.min(box.width - label * 1.4, box.height - label * 1.4);
  const x0 = box.x + (box.width - board) / 2 + label * 0.45;
  const y0 = box.y + (box.height - board) / 2 + label * 0.45;
  return { x: x0 + (col + 0.5) * (board / 8), y: y0 + (row + 0.5) * (board / 8) };
}

for (const step of steps.split(';').filter(Boolean)) {
  const [kind, arg = ''] = step.split(':');
  if (kind === 'click') await page.getByTestId(arg).click();
  else if (kind === 'key') await page.keyboard.press(arg);
  else if (kind === 'fill') {
    const [testId, value = ''] = arg.split('=');
    await page.getByTestId(testId!).fill(value);
  } else if (kind === 'wait') await page.waitForTimeout(Number(arg));
  else if (kind === 'auto') {
    const result = await page.evaluate(
      (n) =>
        (
          window as unknown as { __lightkeeperAutopilot(n: number): unknown }
        ).__lightkeeperAutopilot(n),
      Number(arg),
    );
    process.stdout.write(`autopilot: ${JSON.stringify(result)}
`);
  } else if (kind === 'cell' || kind === 'hover' || kind === 'zone' || kind === 'zonehover') {
    const [row, col] = arg.split(',').map(Number) as [number, number];
    const isZone = kind === 'zone' || kind === 'zonehover';
    const point = await canvasPoint(isZone ? 'lk-chart' : 'lk-zone', row, col, isZone ? 8 : 10);
    if (kind === 'hover' || kind === 'zonehover') await page.mouse.move(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
  }
}
await page.screenshot({ path: out! });
await browser.close();
if (errors.length) process.stdout.write(`errors:\n${errors.join('\n')}\n`);
process.stdout.write(`saved ${out}\n`);
