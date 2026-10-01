#!/usr/bin/env node
// Browser smoke test (Playwright): the canonical UI scenarios that a
// headless engine test cannot cover, played keyboard-only.
//   T-01 scenario menu lists 32 scenarios
//   T-02/T-03 choose scenario 21, ship 0 (Lydia)
//   T-04 screen layout: sea view, wind vane, ship status, move prompt
//   T-05 a helm order typed at the command line resolves a turn
//   plus: tactical view toggle, cinematic skip, no console errors.
//   node scripts/ui-smoke.mjs [--shots <dir>]
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const shotsIdx = process.argv.indexOf('--shots');
const shots = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
const port = 8990 + Math.floor(Math.random() * 9);
const server = await startServer(port);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

await page.goto(`http://localhost:${port}/index.html`);
await page.evaluate(() => sessionStorage.clear());
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__ready === true);

// T-01
const n = await page.locator('#menu .scen button').count();
check('T-01 menu lists all 32 scenarios', n === 32, `${n}`);
const playable = await page.locator('#menu .scen button:not([disabled])').count();
check('the 22 staged historical scenarios are playable', playable === 22, `${playable}`);
check('the "More historical actions" cards are present', await page.locator('#menu .card.small').count() === 17);

// T-02 / T-03 (keyboard: focus the card and press Enter)
await page.locator('#menu .card[data-sc="21"]').focus();
await page.keyboard.press('Enter');
check('T-02 scenario 21 is Hornblower and the Natividad', (await page.locator('#menuTitle').textContent()).includes('Hornblower and the Natividad'));
const row0 = await page.locator('table.ships tbody tr').first().textContent();
check('T-03 ship 0 is the British Lydia', row0.includes('Lydia') && row0.includes('British'));
await page.locator('[data-ship="0"]').focus();
await page.keyboard.press('Enter');
await page.locator('#captain').fill('Hornblower');
await page.keyboard.press('Enter');
await page.waitForTimeout(4200); // opening establishing shot

// T-04 layout
const vis = async (sel) => page.locator(sel).isVisible();
check('T-04 3D sea view', await vis('#scene'));
check('T-04 wind vane', await vis('#vane svg'));
check('T-04 ship status pane', (await page.locator('#slate').textContent()).includes('Lydia'));
const prompt = await page.locator('#prompt').textContent();
check('T-04 move prompt', /move \(\d+,.\d+\):/.test(prompt), prompt.trim());
if (shots) await page.screenshot({ path: `${shots}/ui-start.png` });

// T-05: keyboard-only helm order + make it so
const before = await page.evaluate(() => window.__game.st.turn);
await page.keyboard.press('/');
await page.keyboard.type('1');
await page.keyboard.press('Enter');
const queued = await page.locator('#queued').textContent();
check('helm order queued from the command line', queued.includes('helm 1'), queued.trim());
await page.keyboard.press('Enter'); // empty line: make it so
await page.waitForTimeout(1200);
const playing = await page.evaluate(() => window.__game.fleet.playing);
check('turn plays as a cinematic', playing === true);
await page.keyboard.press('Space'); // skip
await page.waitForTimeout(500);
const after = await page.evaluate(() => window.__game.st.turn);
check('T-05 the turn resolved', after === before + 1, `${before} -> ${after}`);
check('log shows the helm', (await page.locator('#log').textContent()).includes('Helm: 1'));

// tactical view
await page.locator('body').click({ position: { x: 700, y: 120 } });
await page.keyboard.press('t');
await page.waitForTimeout(600);
check('tactical view toggles', await page.evaluate(() => window.__game.director.mode === 'tactical'));
if (shots) await page.screenshot({ path: `${shots}/ui-chart.png` });
await page.keyboard.press('t');

// help overlay by keyboard
await page.keyboard.press('?');
check('help opens', await vis('#help .panel'));
await page.keyboard.press('Escape');

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(failed ? `${failed} check(s) failed` : 'all UI checks passed');
process.exit(failed ? 1 : 0);
