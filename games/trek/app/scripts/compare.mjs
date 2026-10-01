#!/usr/bin/env node
// Side-by-side comparison capture: the painted fancy-web port and this
// procedural port, same seed, same keystrokes, same moments.
//   node scripts/compare.mjs [--only painted|procedural] [--out dir]
//
// fancy-web is served read-only from ../fancy-web (nothing there is
// modified). It has no seed parameter, so its first Math.random() call —
// the one createGame() turns into a seed — is stubbed to return the same
// seed. Both pages run under Playwright's fake clock, so every screenshot
// is taken the same number of milliseconds into each port's animation.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const out = args.includes('--out') ? resolve(args[args.indexOf('--out') + 1]) : join(here, '..', 'media', 'compare');
mkdirSync(out, { recursive: true });

const SEED = 428;               // start quadrant has a starbase + star; 2 Klingons next door
const W = 1600, H = 900;

const PORTS = {
  painted: {
    root: join(here, '..', '..', 'fancy-web'),
    url: 'index.html',
    init: (seed) => {
      let first = true;
      const orig = Math.random;
      Math.random = () => { if (first) { first = false; return (seed + 0.5) / 1e9; } return orig(); };
      try { localStorage.setItem('trek-fancyweb-help-seen', '1'); localStorage.setItem('trek-fancyweb-cheat-visible', '0'); localStorage.setItem('trek-fancyweb-ref-visible', '1'); } catch { /* */ }
    },
  },
  procedural: {
    root: join(here, '..'),
    url: `index.html?seed=${SEED}&difficulty=standard&help=0&capture=1&quality=high`,
    init: () => {
      try { localStorage.setItem('trek-procweb-help-seen', '1'); localStorage.setItem('trek-procweb-cheat-visible', '0'); localStorage.setItem('trek-procweb-ref-visible', '1'); } catch { /* */ }
    },
  },
};

// The script: [action, arg]. 'shot' names the pair file.
// Timings (ms of fake clock) are chosen per state so both ports show the
// same moment: beams mid-flight, the torpedo at impact, the blast in bloom.
const STEPS = [
  ['run', 1600],
  ['shot', '01-title'],
  ['key', 'Enter'],
  ['run', 1500],
  ['type', 'shields up'],
  ['run', 1600],
  ['shot', '02-quadrant-star-starbase'],
  ['type', 'move 1.5 1'],
  ['run', 3200],
  ['type', 'phaser 400'],
  ['run', { painted: 330, procedural: 420 }],
  ['shot', '03-phaser-combat'],
  ['run', 3000],
  ['type', 'torpedo 4.5'],
  // procedural: the ship comes about onto the torpedo bearing first
  ['run', { painted: 560, procedural: 1050 }],
  ['shot', '04-torpedo-hit'],
  ['run', { painted: 260, procedural: 400 }],
  ['shot', '05-explosion'],
  ['run', 3000],
  ['type', 'shields down'],
  ['run', 600],
  ['type', 'phaser 60'],
  ['run', 2200],
  ['type', 'phaser 60'],
  ['run', 2600],
  ['key', 'v'],
  ['run', 1800],
  ['shot', '06-galaxy-chart'],
  ['key', 'v'],
  ['run', 600],
  ['type', 'damages'],
  ['run', 900],
  ['shot', '07-damage-report'],
];

async function capture(name, port) {
  const server = await startServer(8700 + (name === 'painted' ? 11 : 22), port.root);
  const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name}] console`, m.text()); });
  await page.addInitScript(port.init, SEED);
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);   // installed clocks tick in real time until paused
  await page.goto(`http://localhost:${server.address().port}/${port.url}`);
  // Let fonts, modules and shaders load in real time before driving the clock.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  for (const [act, arg] of STEPS) {
    if (act === 'run') await page.clock.runFor(typeof arg === 'object' ? arg[name] : arg);
    else if (act === 'key') await page.keyboard.press(arg);
    else if (act === 'type') { await page.keyboard.type(arg); await page.keyboard.press('Enter'); }
    else if (act === 'shot') {
      const file = join(out, `${arg}-${name}.png`);
      await page.screenshot({ path: file });
      console.log(file.replace(/\\/g, '/').split('/media/')[1] ?? file);
    }
  }
  await browser.close();
  server.close();
}

for (const [name, port] of Object.entries(PORTS)) {
  if (only && only !== name) continue;
  await capture(name, port);
}
