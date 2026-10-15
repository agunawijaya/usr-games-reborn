import { chromium } from '@playwright/test';
import { GPU_LAUNCH_ARGS } from '../../../packages/bridge/testing/shots';

/**
 * A quick look at workbench scenes while drawing: `npx tsx scripts/peek.ts <out-dir> <query>…`
 * saves one PNG per query (e.g. `scene=deck&look=night&w=1280&h=720`) from the running
 * workbench on port 5296.
 */

const [out, ...queries] = process.argv.slice(2);
const browser = await chromium.launch({ args: GPU_LAUNCH_ARGS });
for (const query of queries) {
  const params = new URLSearchParams(query);
  const page = await browser.newPage({
    viewport: { width: Number(params.get('w') ?? 1920), height: Number(params.get('h') ?? 1080) },
    deviceScaleFactor: Number(params.get('dpr') ?? 1),
  });
  page.on('console', (m) => {
    if (m.type() === 'error') process.stdout.write(`console: ${m.text()}\n`);
  });
  page.on('pageerror', (e) => process.stdout.write(`pageerror: ${e.message}\n`));
  await page.goto(`http://localhost:5296/?${query}`);
  await page.waitForFunction(() => window.__sceneReady === true, undefined, { timeout: 60_000 });
  await page.waitForTimeout(Number(params.get('wait') ?? 250));
  const name = query.replace(/[^a-z0-9]+/gi, '-');
  await page.screenshot({
    path: `${out}/${name}.png`,
    clip: params.has('clip') ? JSON.parse(params.get('clip')!) : undefined,
  });
  process.stdout.write(`${out}/${name}.png\n`);
  await page.close();
}
await browser.close();
