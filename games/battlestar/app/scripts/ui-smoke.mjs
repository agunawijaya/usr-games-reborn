// UI smoke test in a real browser (Playwright): the command line, Tab
// completion, the hint panel, the Override panel (flags, badge, map
// teleport, day/night), save/load through the dialogs, text mode without
// WebGL, and — unless QUICK=1 — the hint panel's Autoplay driven all the
// way to the victory dialog.
//
//   node scripts/ui-smoke.mjs            full run (a few minutes)
//   QUICK=1 node scripts/ui-smoke.mjs    skip the autoplay-to-victory run
//   GPU=swiftshader node scripts/ui-smoke.mjs   software WebGL
//
// Not part of `npm test` (needs Chromium); `npm run smoke` runs it.

import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const port = 8700 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const base = `http://localhost:${port}/index.html`;
const gpuArgs = {
  gpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu'],
  none: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'],
};
let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
};

async function open(args, query) {
  const browser = await chromium.launch({ args });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  return { browser, page, errors };
}
const type = async (page, line) => {
  await page.click('#cmd');
  await page.fill('#cmd', line);
  await page.press('#cmd', 'Enter');
  await page.waitForTimeout(250);
};
const logText = (page) => page.$eval('#log', (e) => e.innerText);
const g = (page, expr) => page.evaluate(`(() => { const g = window.__bs.game; return ${expr}; })()`);

// ---------------------------------------------------------------- 1. the main UI
{
  const { browser, page, errors } = await open(gpuArgs[process.env.GPU || 'gpu'], 'fresh=1&seed=1');
  await type(page, 'look');
  check(/stateroom/i.test(await logText(page)), 'command line: "look" prints the stateroom');

  await page.click('#cmd');
  await page.fill('#cmd', 'inv');
  await page.press('#cmd', 'Tab');
  check((await page.inputValue('#cmd')).startsWith('inven'), 'Tab completes "inv" to an inventory verb');
  await page.fill('#cmd', '');

  await page.keyboard.press('`');
  check(!(await page.$eval('#hint-panel', (e) => e.hidden)), 'backtick opens the hint panel');
  check((await page.$eval('#hint-panel .hint-goal', (e) => e.textContent)).length > 0, 'hint panel names a goal');
  const before = await g(page, 'g.ourtime');
  await page.click('#hint-do');
  await page.waitForTimeout(400);
  check((await g(page, 'g.ourtime')) > before, '"Do it" plays the hinted command');
  await page.keyboard.press('Escape');

  check(await page.$eval('#badge-override', (e) => e.hidden), 'no OVERRIDE badge in a clean game');
  await page.keyboard.press('Shift+Backquote');
  check(await page.$eval('#dlg-override', (e) => e.open), '~ opens the Override panel');
  await page.check('#dlg-override [data-flag="infiniteFuel"]');
  await page.waitForTimeout(200);
  check(await g(page, 'g.ovr.infiniteFuel && g.cheated'), 'Infinite fuel sets the engine flag and marks the game cheated');
  check(!(await page.$eval('#badge-override', (e) => e.hidden)), 'OVERRIDE ACTIVE badge is shown');
  const pt = await page.evaluate(() => window.__bs.mapPoint(8));
  const box = await page.$eval('#worldmap', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, sx: r.width / c.width, sy: r.height / c.height }; });
  await page.mouse.click(box.x + pt[0] * box.sx, box.y + pt[1] * box.sy);
  await page.waitForTimeout(400);
  check((await g(page, 'g.position')) === 8, 'clicking room 8 on the world map teleports there');
  const night = await g(page, 'g.isNight');
  await page.click('#ovr-daynight');
  await page.waitForTimeout(300);
  check((await g(page, 'g.isNight')) !== night, 'Toggle day / night flips the world');
  await page.click('#dlg-override button[value=close]');

  await type(page, 'save');
  await type(page, 'smoke');
  const saved = await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('save:smoke')));
  check(saved, '"save" writes a named save to localStorage');
  const posSaved = await g(page, 'g.position');
  await page.evaluate(() => window.__bs.teleport ? window.__bs.teleport(22) : window.__bs.place({ room: 22 }));
  await page.waitForTimeout(300);
  await page.click('#btn-load');
  const li = page.locator('#save-list li', { hasText: 'smoke' });
  await li.locator('button.primary').click();
  await page.waitForTimeout(800);
  check((await g(page, 'g.position')) === posSaved && (await g(page, 'g.cheated')), 'Load restores the position and the cheated mark');

  check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
}

// ---------------------------------------------------------------- 1b. procedural audio
{
  const { browser, page, errors } = await open([...gpuArgs[process.env.GPU || 'gpu'], '--autoplay-policy=no-user-gesture-required'], 'fresh=1&seed=1');
  check((await page.evaluate(() => window.__bs.sound())).muted, 'sound is muted by default');
  await page.click('#btn-sound');
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => window.__bs.sound());
  check(!st.muted && st.state === 'running', `the sound button unmutes (context ${st.state})`);
  const rooms = [[22, false, 'ship'], [37, false, 'space'], [73, false, 'air'], [80, false, 'beach'], [80, true, 'beach night'],
    [113, false, 'woods'], [126, true, 'pools night'], [231, false, 'cave'], [270, false, 'abyss'], [235, true, 'clubhouse']];
  const levels = [];
  for (const [room, night, label] of rooms) {
    await page.evaluate(([room, night]) => window.__bs.place({ room, night, time: night ? 140 : 40 }), [room, night]);
    await page.waitForTimeout(2200);
    const l = await page.evaluate(() => window.__bs.sound());
    levels.push(`${label} ${l.rms.toFixed(0)}/${l.peak.toFixed(0)} dB`);
    check(l.rms > -60 && l.peak < 0, `${label}: ambience audible and not clipping (rms ${l.rms.toFixed(1)} dBFS, peak ${l.peak.toFixed(1)})`);
  }
  const recipes = await page.evaluate(() => [...new Set(Object.values(window.__bsEventSounds || {}))]);
  for (const r of ['step', 'boom', 'bigBoom', 'clang', 'ring', 'zap', 'drip', 'gull', 'bird', 'frog', 'shimmer', 'bells', 'grind', 'roarUp', 'roarDown', 'alarm', 'snort', ...recipes]) {
    await page.evaluate((r) => window.__bs.play(r), r);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => window.__bs.sound());
  check(after.peak < 0.5, `one-shots do not clip the master (peak ${after.peak.toFixed(1)} dBFS)`);
  await page.click('#btn-sound');
  await page.waitForTimeout(1200);
  check((await page.evaluate(() => window.__bs.sound())).rms < -70, 'muting silences the output');
  check(errors.length === 0, `audio: no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
}

// ---------------------------------------------------------------- 2. text mode without WebGL
{
  const { browser, page, errors } = await open(gpuArgs.none, 'fresh=1&seed=1');
  check(await page.$eval('#scene-fallback', (e) => !e.hidden && getComputedStyle(e).display !== 'none'), 'no WebGL: the text-mode panel is shown');
  await type(page, 'look');
  check(/stateroom/i.test(await logText(page)), 'no WebGL: the game is fully playable');
  check(errors.length === 0, `no WebGL: no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
}

// ---------------------------------------------------------------- 3. autoplay to victory
if (!process.env.QUICK) {
  const seed = process.env.SEED || 7;
  const { browser, page, errors } = await open(gpuArgs[process.env.GPU || 'gpu'], `fresh=1&seed=${seed}&autodelay=40&motion=reduce&q=low`);
  await page.keyboard.press('`');
  await page.click('#hint-auto');
  const t0 = Date.now();
  let open_ = false;
  while (Date.now() - t0 < 15 * 60 * 1000) {
    await page.waitForTimeout(2000);
    open_ = await page.$eval('#dlg-end', (e) => e.open);
    if (open_) break;
  }
  const title = open_ ? await page.$eval('#end-title', (e) => e.textContent) : '(no end dialog)';
  const turns = await g(page, 'g.ourtime');
  check(open_ && /win/i.test(title), `autoplay (seed ${seed}) reaches the victory dialog: "${title}" after ${turns} turns, ${Math.round((Date.now() - t0) / 1000)} s`);
  check(!(await g(page, 'g.cheated')), 'hints and autoplay do not mark the score as cheated');
  check(errors.length === 0, `autoplay: no page errors (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
}

server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall UI checks passed');
process.exitCode = failures ? 1 : 0;
