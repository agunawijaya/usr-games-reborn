#!/usr/bin/env node
// Browser flow tests (Playwright) for the parts of the UI that ui-smoke does
// not reach: close action (grapple, board, capture), repair, unfoul, the
// Defeat screen, quitting, and the end-screen buttons.
//   node scripts/ui-flows.mjs
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const port = 8930 + Math.floor(Math.random() * 9);
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

// Chesapeake (0, American) vs. Shannon (1, British); we command the Shannon.
async function open(stage) {
  await page.goto(`http://localhost:${port}/index.html`);
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`http://localhost:${port}/index.html?scenario=13&ship=1&seed=11&intro=0&stage=${stage}`);
  await page.waitForFunction(() => window.__ready === true && window.__game.st);
}
const st = () => page.evaluate(() => window.__game.st);
async function commit() {
  await page.click('#go');
  await page.waitForFunction(() => !window.__game.fleet.playing || true);
  await page.keyboard.press('Space'); // skip the cinematic
  await page.waitForFunction(() => !window.__game.fleet.playing, null, { timeout: 20000 });
  await page.waitForTimeout(120);
}
const endOpen = () => page.evaluate(() => document.getElementById('end').classList.contains('open'));
async function waitEnd() {
  await page.waitForFunction(() => document.getElementById('end').classList.contains('open'), null, { timeout: 15000 });
  return page.locator('#endTitle').textContent();
}

// --- 1. grapple -> board -> capture -> victory -> "Fight it again" ----------------
await open('w:speed=0;0:row=10,col=11,dir=1,crew1=1,crew2=0,crew3=0;1:row=10,col=10,dir=1');
check('close action panel offers a grapple', await page.locator('[data-grap="0:g"]').count() === 1);
let grappled = false;
let captured = false;
for (let t = 0; t < 14 && !captured; t++) {
  if (await page.locator('[data-board="0:3"]').count()) {
    grappled = true;
    await page.click('[data-board="0:3"]');
  } else if (await page.locator('[data-grap="0:g"]').count()) {
    await page.click('[data-grap="0:g"]');
  }
  await commit();
  const s = await st();
  captured = s.ships[0].captured === 1;
  if (s.over) break;
}
check('grapnels caught and boarders offered', grappled);
check('boarding captured the Chesapeake', captured);
const title1 = await waitEnd();
check('capture ends the battle in victory', title1 === 'Victory', title1);
const shannonPts = (await st()).ships[1].points;
check('capture scored points', shannonPts > 0, `${shannonPts}`);
await page.click('#endReplay');
await page.waitForTimeout(600);
let s = await st();
check('"Fight it again" restarts the same battle', !(await endOpen()) && s.turn === 0 && !s.over && s.name === 'Chesapeake vs. Shannon');

// --- 2. repair from the orders panel ---------------------------------------------------
await open('w:speed=0;1:row=10,col=10,dir=1,hull=2;0:row=40,col=40,dir=1');
for (let t = 0; t < 3; t++) {
  await page.click('[data-repair="hull"]');
  await commit();
}
s = await st();
check('three turns of hull repair restore 2 points', s.ships[1].specs.hull === 4, `hull ${s.ships[1].specs.hull}`);
await page.click('[data-repair="hull"]');
await page.click('[data-sails="full"]');
await commit();
check('repair refused when the hands are busy', (await page.locator('#log').textContent()).includes('No hands free to repair'));

// --- 3. unfoul (button appears when fouled; command line works) ----------------------------
await open('w:speed=0;0:row=10,col=11,dir=1,crew1=1,crew2=0,crew3=0;1:row=10,col=10,dir=1');
await page.evaluate(() => {
  const g = window.__game.st;
  for (const [a, b] of [[0, 1], [1, 0]]) {
    g.ships[a].foul[b].count = 1;
    g.ships[a].nfoul = 1;
  }
});
await page.keyboard.press('/');
await page.keyboard.type('d');
await page.keyboard.press('Enter');
check('the Unfoul button appears alongside a fouled ship', await page.locator('[data-unfoul="0"]').count() === 1);
let freed = false;
for (let t = 0; t < 16 && !freed; t++) {
  await page.keyboard.press('/');
  await page.keyboard.type('u a0');
  await page.keyboard.press('Enter');
  await commit();
  freed = (await st()).ships[1].nfoul === 0;
}
check('"u a0" cuts the ships apart', freed);

// --- 4. defeat -> "New battle" -----------------------------------------------------------
await open('w:speed=0;1:row=10,col=10,dir=1,hull=1;0:row=10,col=11,dir=1');
for (let t = 0; t < 12 && !(await st()).over; t++) await commit();
const title2 = await waitEnd();
check('losing the ship shows Defeat', title2 === 'Defeat', `${title2}: ${(await st()).result?.text}`);
await page.click('#endNew');
await page.waitForTimeout(400);
check('"New battle" returns to the scenario menu', await page.evaluate(() => document.getElementById('menu').classList.contains('open')));

// --- 5. quit ------------------------------------------------------------------------------
await open('w:speed=0;0:row=40,col=40,dir=1');
await page.keyboard.press('/');
await page.keyboard.type('Q');
await page.keyboard.press('Enter');
const title3 = await waitEnd();
check('Q gives up the command', (await st()).result?.reason === 'quit' && title3 === 'Command relinquished', title3);

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(failed ? `${failed} check(s) failed` : 'all flow checks passed');
process.exit(failed ? 1 : 0);
