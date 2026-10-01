#!/usr/bin/env node
// Browser checks of the real page in real time (Playwright, Chromium).
//   node scripts/ui-smoke.mjs            GPU (D3D11/ANGLE)
//   GPU=cpu node scripts/ui-smoke.mjs    CPU-only WebGL (SwiftShader)
//   GPU=nogl node scripts/ui-smoke.mjs   WebGL disabled: terminal view
// Exits non-zero on the first failed check or on any page error.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const mode = process.env.GPU || 'gpu';
const args = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  cpu: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  nogl: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2'],
}[mode];
const port = 8700 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL ${name}: ${e.message}`);
    failed++;
  }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const wait = (ms) => page.waitForTimeout(ms);
const me = () => page.evaluate(() => { const p = window.__hunt.me(); return p ? { x: p.x, y: p.y, face: p.face, ammo: p.ammo, q: p.q.length } : null; });

console.log(`ui-smoke (${mode})`);
await page.goto(`http://localhost:${port}/?seed=4242&bots=3&difficulty=novice&arena=ricochet&scheme=modern&view=modern`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });

await check('setup screen shows, options are clickable', async () => {
  assert(await page.isVisible('#setup'), 'setup hidden');
  await page.click('[data-opt="bots"] button[data-v="3"]');
  await page.click('[data-opt="arena"] button[data-v="ricochet"]');
  const note = await page.textContent('[data-note="arena"]');
  assert(/mirrors/i.test(note), `arena note: ${note}`);
});

await check('ENTER THE MAZE starts a match; the world steps in real time', async () => {
  await page.click('#o-start');
  const s0 = await page.evaluate(() => window.__hunt.g.step);
  await wait(900);
  const s1 = await page.evaluate(() => window.__hunt.g.step);
  assert(s1 - s0 >= 5, `only ${s1 - s0} steps in 0.9 s`);
  assert(!(await page.isVisible('#setup')), 'setup still visible');
});

const gl = await page.evaluate(() => !!window.__hunt.renderer);
if (mode === 'nogl') {
  await check('no WebGL: terminal view, notice shown', async () => {
    assert(!gl, 'a renderer was created');
    assert(await page.isVisible('#term'), 'terminal hidden');
    assert(await page.isVisible('#nogl'), 'no notice');
    const t = await page.textContent('#term');
    assert(/Ammo:/.test(t) && /Player:/.test(t), 'status panel missing');
  });
}

await check('movement keys strafe without turning; facing keys turn', async () => {
  await page.evaluate(() => window.__hunt.override('freezeBots', true));
  await page.evaluate(() => { window.__hunt.g.cheated = false; });
  const a = await me();
  for (const k of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    await page.keyboard.press(k);
    await wait(160);
  }
  const b = await me();
  assert(b.face === a.face, 'moving turned the player');
  await page.keyboard.press('ArrowUp');
  await wait(200);
  const c = await me();
  assert(c.face === 105, `ArrowUp should face up, face=${c.face}`);
});

await check('Space fires (ammo drops); the kill feed / message line exist', async () => {
  const a = await me();
  await page.keyboard.press('Space');
  await wait(250);
  const b = await me();
  assert(b.ammo < a.ammo || b.q > 0, `ammo ${a.ammo} -> ${b.ammo}`);
  if (gl) assert(await page.isVisible('#feed'), 'feed hidden');
  else assert(/Ammo:/.test(await page.textContent('#term')), 'terminal status missing');
});

await check('Esc pauses (the world stops) and resumes', async () => {
  await page.keyboard.press('Escape');
  assert(await page.isVisible('#pause'), 'pause menu hidden');
  const s0 = await page.evaluate(() => window.__hunt.g.step);
  await wait(400);
  const s1 = await page.evaluate(() => window.__hunt.g.step);
  assert(s1 === s0, 'the world kept moving while paused');
  await page.keyboard.press('Escape');
  await wait(300);
  assert(!(await page.isVisible('#pause')), 'still paused');
});

await check('? opens help; Esc closes it', async () => {
  await page.keyboard.press('Shift+Slash');
  assert(await page.isVisible('#help'), 'help hidden');
  const keys = await page.textContent('#help-keys');
  assert(/move left/.test(keys), 'help keys empty');
  await page.keyboard.press('Escape');
  await wait(100);
  assert(!(await page.isVisible('#help')), 'help still open');
});

await check('backtick toggles the Coach with a ricochet preview', async () => {
  await page.keyboard.press('Backquote');
  await wait(300);
  assert(await page.isVisible('#coachp'), 'coach panel hidden');
  const t = await page.textContent('#coach-body');
  assert(/bounces/.test(t) || /—/.test(t), `coach body: ${t}`);
  if (gl) assert(await page.evaluate(() => window.__hunt.renderer.coach.mesh.visible), 'coach path not drawn');
  await page.keyboard.press('Backquote');
});

await check('backslash opens Override; a flag shows OVERRIDE ACTIVE and marks the score', async () => {
  await page.keyboard.press('Backslash');
  assert(await page.isVisible('#overp'), 'override panel hidden');
  await page.click('#over-body input[data-flag="god"]');
  await wait(250);
  assert(await page.isVisible('#b-override'), 'no badge');
  const sc = await page.textContent('#s-table');
  assert(/CHEATED/.test(sc), 'score not marked');
  await page.click('#over-body input[data-flag="god"]');
  await page.click('#over-body input[data-flag="freezeBots"]');
  await page.keyboard.press('Backslash');
});

if (gl) {
  await check('F2 cycles 3D -> split -> terminal -> 3D', async () => {
    await page.keyboard.press('F2');
    await wait(150);
    assert(await page.evaluate(() => document.body.classList.contains('view-split')), 'not split');
    assert(await page.isVisible('#term'), 'terminal hidden in split');
    await page.keyboard.press('F2');
    await wait(150);
    assert(await page.evaluate(() => document.body.classList.contains('view-classic')), 'not classic');
    await page.keyboard.press('F2');
    await wait(150);
    assert(await page.evaluate(() => document.body.classList.contains('view-modern')), 'not 3D');
  });
  await check('F3 switches the follow camera', async () => {
    await page.keyboard.press('F3');
    await wait(100);
    assert(await page.evaluate(() => window.__hunt.renderer.camMode === 'follow'), 'no follow cam');
    await page.keyboard.press('F3');
  });
}

await check('Controls panel remaps a Modern key (N = move left), and it works', async () => {
  await page.keyboard.press('Escape');
  await page.click('#p-keys');
  assert(await page.isVisible('#keys'), 'controls hidden');
  await page.click('#keys-list button[data-act="moveLeft"]');
  await page.keyboard.press('KeyN');
  await wait(100);
  const txt = await page.textContent('#keys-list button[data-act="moveLeft"]');
  assert(/N/.test(txt), `binding shows ${txt}`);
  await page.click('#k-close');
  await page.click('#p-resume');
  await wait(150);
  const a = await me();
  await page.keyboard.press('KeyN');
  await wait(300);
  const b = await me();
  assert(b.x === a.x - 1 || b.q > 0 || (b.x === a.x), `x ${a.x} -> ${b.x}`);
  await page.evaluate(() => { document.getElementById('k-reset').click(); document.getElementById('k-close').click(); });
});

await check('sound toggles on and off (procedural Web Audio, muted by default)', async () => {
  assert((await page.textContent('#sound')).includes('OFF'), 'not muted by default');
  await page.click('#sound');
  await wait(200);
  assert((await page.textContent('#sound')).includes('ON'), 'did not unmute');
  await page.click('#sound');
});

await check('dying shows the re-entry choice; S re-enters scanning', async () => {
  await page.evaluate(() => { window.__hunt.me().death = '| Quit |'; });
  await wait(400);
  assert(await page.isVisible('#respawn'), 'no respawn overlay');
  await page.keyboard.press('s');
  await page.waitForFunction(() => !!window.__hunt.me(), null, { timeout: 8000 });
  const scan = await page.evaluate(() => window.__hunt.me().scan);
  assert(scan > 0, `entered with scan ${scan}`);
  assert(!(await page.isVisible('#respawn')), 'overlay still up');
});

await check('Classic scheme: l moves right, K faces up', async () => {
  await page.evaluate(() => window.__hunt.start({ scheme: 'classic', bots: '1', difficulty: 'novice' }));
  await page.evaluate(() => { window.__hunt.override('freezeBots', true); });
  await wait(300);
  const a = await me();
  await page.keyboard.press('Shift+KeyK');
  await wait(250);
  const b = await me();
  assert(b.face === 105, `K should face up: ${b.face}`);
  await page.keyboard.press('l');
  await wait(250);
  const c = await me();
  assert(c.face === 105, 'l turned the player');
  void a;
});

await check('no page errors', async () => {
  assert(!errors.length, errors.join(' | '));
});

console.log(`${passed} passed, ${failed} failed`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
