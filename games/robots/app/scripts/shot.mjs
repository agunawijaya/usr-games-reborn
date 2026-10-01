// Screenshot helper for the remaster: node scripts/shot.mjs <outdir> <name> [ms] [url-query] [js-after-load]
import { chromium } from 'playwright';
const [out, name, ms = '4000', query = '', js = ''] = process.argv.slice(2);
const url = (process.env.APP_URL ?? 'http://localhost:5173/') + (query ? `?${query}` : '');
const args = process.env.GPU === 'cpu' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: +(process.env.W || 1600), height: +(process.env.H || 900) } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => !!window.__rr, null, { timeout: 60000 });
if (js) await page.evaluate(js);
await page.waitForTimeout(+ms);
await page.screenshot({ path: `${out}/${name}.png` });
console.log(name, errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'ok');
await browser.close();
