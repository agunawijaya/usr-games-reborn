#!/usr/bin/env node
// Browser smoke test (Playwright): what the headless engine tests cannot
// cover — the page, its controls and its fallbacks.
//   node scripts/ui-smoke.mjs
// See docs/test-scenarios.md (P-01 .. P-12).
import { chromium } from 'playwright';
import { createRain, step, screenText } from '../src/engine/rain.js';
import { startServer } from './serve.mjs';

const port = 8600 + Math.floor(Math.random() * 90);
const server = await startServer(port);
const base = `http://localhost:${port}/index.html`;
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

async function open(url, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true);
  await page.waitForTimeout(800);
  return { page, errors, context };
}

// ---------------------------------------------------------------- main page
{
  const { page, errors, context } = await open(base);
  const info = await page.evaluate(() => window.__info);
  check('P-01 the pond renders (WebGL2, modern view)', info.view === 'modern' && !!info.grid, `${info.profile} ${info.grid} ${info.scene}`);
  check('P-01 the default is the man page\'s -d 120', info.delay === 120);

  // sound: muted, and no audio context until asked
  const sound = page.locator('#sound');
  check('P-02 sound is off at start', (await sound.getAttribute('aria-pressed')) === 'false' && (await sound.textContent()).includes('Sound off'));
  check('P-02 no AudioContext before a gesture', (await page.evaluate(() => window.__rain.audio().state)) === 'none');
  await sound.click();
  await page.waitForTimeout(300);
  const a = await page.evaluate(() => window.__rain.audio());
  check('P-02 one click turns sound on', !a.muted && a.state === 'running' && (await sound.textContent()).includes('Sound on'), a.state);
  await page.evaluate(() => window.__rain.setDelay(10));
  let peak = 0;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    peak = Math.max(peak, await page.evaluate(() => window.__rain.audio().level));
  }
  check('P-02 and there is sound: hiss and plinks', peak > 0.005, `peak rms ${peak.toFixed(4)}`);
  await page.keyboard.press('m');
  check('P-02 M mutes again', (await page.evaluate(() => window.__rain.audio().muted)) === true);

  // intensity
  await page.locator('.presets button[data-d="10"]').click();
  check('P-03 the Downpour preset sets -d 10', (await page.evaluate(() => window.__rain.rain.delay)) === 10);
  check('P-03 the readout shows the command line', (await page.locator('#readout code').textContent()) === 'rain -d 10');
  await page.keyboard.press('ArrowLeft');
  const lighter = await page.evaluate(() => window.__rain.rain.delay);
  check('P-03 left arrow: lighter rain (longer delay)', lighter > 10, `-d ${lighter}`);
  await page.keyboard.press('0');
  check('P-03 key 0: -d 0, paced at 9600 baud', (await page.locator('#readout code').textContent()) === 'rain -d 0');
  await page.locator('.presets button[data-d="120"]').click();

  // views
  await page.keyboard.press('2');
  await page.waitForTimeout(600);
  check('P-04 split: both panes visible', await page.locator('#pond').isVisible() && await page.locator('#term').isVisible());
  const rows = (await page.locator('#term').textContent()).split('\n');
  check('P-04 the classic pane is 80x24', rows.length === 24 && rows.every((r) => r.length === 80), `${rows.length} rows`);
  // lock-step: what the classic pane shows is the engine frame on screen,
  // and that frame is the one a fresh engine reaches in as many steps
  const { text, frame } = await page.evaluate(() => {
    const s = window.__rain.timeline.shown;
    return { text: document.getElementById('term').textContent, frame: s.frame };
  });
  const ref = createRain({ COLS: 80, LINES: 24, seed: 1, delay: 120 });
  for (let f = 0; f < frame; f++) step(ref);
  const pageText = text.split('\n').map((r) => r.replace(/\s+$/, '')).join('\n');
  check('P-05 the classic pane equals the engine (and so the 1980 binary)', pageText === screenText(ref), `frame ${frame}`);
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  check('P-04 classic: the pond is hidden', !(await page.locator('#pond').isVisible()) && await page.locator('#term').isVisible());
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  check('P-04 back to modern', await page.locator('#pond').isVisible() && !(await page.locator('#term').isVisible()));

  // help
  await page.keyboard.press('?');
  check('P-06 ? opens the help', await page.locator('#help').isVisible());
  await page.keyboard.press('Escape');
  check('P-06 Esc closes it', !(await page.locator('#help').isVisible()));

  // quality
  await page.keyboard.press('q');
  await page.waitForTimeout(700);
  const low = await page.evaluate(() => window.__info);
  check('P-07 Q switches to Low', (await page.locator('#quality').textContent()) === 'Low' && low.profile !== 'high', low.profile);
  await page.keyboard.press('q');
  await page.waitForTimeout(700);
  check('P-07 and back to High', (await page.locator('#quality').textContent()) === 'High');

  // idle fade
  await page.mouse.move(100, 100);
  await page.waitForTimeout(3800);
  check('P-08 the controls fade out when idle', await page.evaluate(() => document.body.classList.contains('idle')));
  await page.mouse.move(300, 300);
  await page.waitForTimeout(100);
  check('P-08 and come back on a mouse move', !(await page.evaluate(() => document.body.classList.contains('idle'))));
  await page.keyboard.press('h');
  check('P-08 H hides the controls entirely', !(await page.locator('#bar').isVisible()));
  await page.keyboard.press('h');

  check('P-09 fullscreen button present', await page.locator('#fullscreen').isVisible());
  check('P-12 no console errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------- -d errors
{
  const { page, errors, context } = await open(`${base}?d=1000`);
  const note = await page.locator('#notice').textContent();
  check("P-13 ?d=1000 prints the original's error", note.includes("Invalid delay `1000' (1-999)"), note);
  check('P-13 and rains at the default instead', (await page.evaluate(() => window.__rain.rain.delay)) === 120);
  check('P-13 no errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------- reduced motion
{
  const { page, errors, context } = await open(base, { reducedMotion: 'reduce' });
  check('P-10 prefers-reduced-motion starts in a drizzle (-d 400)', (await page.evaluate(() => window.__rain.rain.delay)) === 400);
  check('P-10 no errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------- no WebGL
{
  const { page, errors, context } = await open(`${base}?nogl`);
  const info = await page.evaluate(() => window.__info);
  check('P-11 without WebGL2: the classic view', info.view === 'classic' && info.fallback === 'no-webgl2');
  check('P-11 modern and split are disabled', await page.locator('.seg button[data-view="split"]').isDisabled());
  check('P-11 a notice explains why', (await page.locator('#notice').textContent()).includes('WebGL2'));
  await page.waitForTimeout(1500);
  const rows = (await page.locator('#term').textContent()).trim().length;
  check('P-11 and it rains', rows > 0);
  check('P-11 no errors', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
server.close();
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('all UI checks passed');
