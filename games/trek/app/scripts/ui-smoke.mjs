#!/usr/bin/env node
// Browser smoke test of the UI paths node --test cannot reach.
//   node scripts/ui-smoke.mjs [--shots media]
// Drives a real Chromium through: title → mission → Captain's Override
// panel (key + clicks) → badge → typed overrides → chart instant warp by
// click → one-shot kills → end screen marked CHEATED; plus sound on,
// quality toggle and the V-key gate. Exits non-zero on any failure or
// page error.
import { chromium } from 'playwright';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const gpu = process.env.GPU || 'gpu';
const gpuArgs = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  nogl: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2'],
}[gpu];

const server = await startServer(8950 + Math.floor(Math.random() * 40));
const port = server.address().port;
const browser = await chromium.launch({ args: gpuArgs });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const shot = async (name) => { if (shots) await page.screenshot({ path: join(shots, name) }); };
const type = async (text) => { await page.keyboard.type(text); await page.keyboard.press('Enter'); await page.waitForTimeout(250); };
const G = () => page.evaluate(() => {
  const g = window.__trek.game;
  return g && { qx: g.ship.qx, qy: g.ship.qy, energy: g.ship.energy, torps: g.ship.torpedoes, stardate: g.stardate, cheated: g.cheated, ov: { ...g.overrides }, kills: g.kills, won: g.won, lost: g.lost, left: g.klingonsRemaining };
});

await page.goto(`http://localhost:${port}/index.html?seed=428&difficulty=novice&help=0`);
await page.waitForFunction(() => window.__trek?.ready, null, { timeout: 120000 });
check('title screen shown', await page.isVisible('#title-screen.shown'));
const profile = await page.evaluate(() => window.__trek.profile());
check('renderer profile chosen', ['high', 'low', '2d'].includes(profile), profile);
// Sound + quality toggles work from the title screen and must not throw.
await page.click('#sound-btn');
await page.waitForTimeout(300);
check('sound button turns sound on', (await page.textContent('#sound-btn')).includes('on'));
if (profile !== '2d') {
  await page.click('#quality-btn');
  await page.waitForTimeout(800);
  const p2 = await page.evaluate(() => window.__trek.profile());
  check('quality toggle switches profile', p2 !== profile, `${profile} → ${p2}`);
}
if (profile !== '2d') { await page.click('#quality-btn'); await page.waitForTimeout(500); }

await page.keyboard.press('Enter');
await page.waitForTimeout(600);
let g = await G();
check('mission started', !!g && !g.won && !g.lost);

// V gate: typing "move" must not switch views.
await page.keyboard.type('mov');
const chartDuring = await page.isVisible('#strategic.shown');
await page.keyboard.press('Escape');
check('V inside a command does not toggle the chart', !chartDuring);
await page.keyboard.press('v');
await page.waitForTimeout(300);
check('V on an empty line opens the chart', await page.isVisible('#strategic.shown'));
await page.keyboard.press('v');

// Override panel via the key.
await page.keyboard.press('!');
await page.waitForTimeout(300);
check('! opens the Captain\'s Override panel', await page.isVisible('#override-panel.shown'));
check('no badge before any override', !(await page.isVisible('#override-badge.shown')));
await page.click('.ovr-row[data-flag="infiniteEnergy"]');
await page.waitForTimeout(200);
g = await G();
check('clicking a toggle engages the flag', g.ov.infiniteEnergy === true);
check('OVERRIDE ACTIVE badge visible', await page.isVisible('#override-badge.shown'));
check('bridge log marked CHEATED', await page.isVisible('#cheated-tag.shown'));
await shot('override-panel.png');

// Typed overrides.
const e0 = (await G()).energy;
await type('move 0 1');
await page.waitForTimeout(2200);
check('infinite energy: warp costs nothing', (await G()).energy === e0);
await type('override clock on');
const sd = (await G()).stardate;
await type('lrscan');
check('typed "override clock on" freezes the stardate', (await G()).stardate === sd);
await type('override torps');
const t0 = (await G()).torps;
await type('torpedo 3');
await page.waitForTimeout(900);
check('typed toggle "override torps" keeps the torpedo count', (await G()).torps === t0);

// Chart instant warp by click.
await type('override warp on');
await page.keyboard.press('Escape');
await page.keyboard.press('v');
await page.waitForTimeout(600);
check('chart armed for instant warp', await page.isVisible('#strategic.armed'));
await shot('chart-warp-armed.png');
const before = await G();
const target = before.qx < 4 ? { qx: 6, qy: 6 } : { qx: 1, qy: 1 };
const pt = await page.evaluate(({ qx, qy }) => window.__trek.chartPoint(qx, qy), target);
await page.mouse.move(pt.x, pt.y);
await page.mouse.click(pt.x, pt.y);
await page.waitForTimeout(2200);
const after = await G();
check('clicking the chart warps to that quadrant', after.qx === target.qx && after.qy === target.qy, `${before.qx},${before.qy} → ${after.qx},${after.qy}`);
check('chart closes after the jump', !(await page.isVisible('#strategic.shown')));

// Reveal map + one-shot kills to finish the mission quickly.
await type('override map on');
await type('override oneshot on');
await type('override shields on');
await shot('override-active.png');
for (let i = 0; i < 40; i++) {
  g = await G();
  if (g.won || g.lost) break;
  const next = await page.evaluate(() => {
    const game = window.__trek.game;
    const here = game.galaxy.quadrants[game.ship.qy][game.ship.qx];
    if (here.klingons > 0) return 'phaser 10';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (game.galaxy.quadrants[y][x].klingons > 0) return `override warp ${x + 1}-${y + 1}`;
    return 'lrscan';
  });
  await type(next);
  await page.waitForTimeout(next.startsWith('phaser') ? 1300 : 2100);
}
g = await G();
check('one-shot + instant warp clears the galaxy', g.won === true, `kills ${g.kills}, left ${g.left}`);
await page.waitForTimeout(3500);
check('end screen shown', await page.isVisible('#game-over.shown'));
check('end screen stamped CHEATED', await page.isVisible('#game-over-cheated.shown'));
const lastLog = await page.evaluate(() => window.__trek.game.events.at(-1).msg);
check('final log line marked [CHEATED]', /CHEATED/.test(lastLog), lastLog);
await shot('end-cheated.png');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed (${gpu})`);
process.exit(failed ? 1 : 0);
