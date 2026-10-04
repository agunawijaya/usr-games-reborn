// Talon's Shadow — the balance check. Serves the game's folder on a free port, opens it in
// headless Chromium and lets a simple bot fly every region many times through
// TalonGame.fastForward (the real page's rules, without drawing): it goes for the nearest fruit
// round the fences, keeps straight on while the bird takes aim, and leaves over the nearest edge
// once the field is bare (the edges open only then). A second, stubborn bot never leaves, to
// show that every flight ends.
//
//   node games/snake-classic/scripts/balance.mjs [flights per region, default 40]

import process from 'node:process';
import { chromium } from '@playwright/test';
import { BOT } from './bots.mjs';
import { serveGame } from './serve.mjs';

const FLIGHTS = Number(process.argv[2] ?? 40);
const { url, close } = await serveGame();

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => console.error('page error:', error.message));
await page.goto(url);
await page.waitForFunction('!!window.__talon && !!window.TalonGame');
await page.evaluate(`(async () => {
  window.__fences = await import('./src/fences.mjs');
  window.__paths = await import('./src/paths.mjs');
  window.__rules = await import('./src/rules.mjs');
  window.__regions = await import('./src/regions.mjs');
  window.__daily = await import('./src/daily.mjs');
  window.TalonGame.on((event) => {
    if (event.type === 'lock' && event.quarry === 'you') window.__locksOnYou++;
    if (event.type === 'caught') window.__cause = event.cause;
  });
  ${BOT};
})()`);

/** One flight of a region with the bot, seeded so the table repeats. */
const fly = (regionId, seed, mode) =>
  page.evaluate(`(() => {
    const region = window.__regions.regionById('${regionId}');
    window.__botMode = '${mode}';
    window.__botGoal = region.goal;
    window.__botDir = null;
    window.__locksOnYou = 0;
    window.__cause = null;
    window.TalonGame.begin({ theme: region.theme, tuning: region.tuning, rules: window.__rules.flightRules(region),
      random: window.__daily.seededRandom(${seed}) });
    const end = window.TalonGame.fastForward(600000, window.__bot);
    const p = window.TalonGame.peek();
    return { ...end, carried: p.carried, rivalsAte: p.rivalsAte, bare: p.bare, goal: region.goal, locks: window.__locksOnYou, pecks: p.pecks, cause: window.__cause };
  })()`);

const regions = await page.evaluate('window.__regions.REGIONS.map((r) => r.id)');
const rows = [];
for (const id of regions) {
  const flights = [];
  for (let i = 0; i < FLIGHTS; i++) flights.push(await fly(id, 1000 + i, 'goal'));
  const stubborn = [];
  for (let i = 0; i < Math.max(5, FLIGHTS / 8); i++) stubborn.push(await fly(id, 5000 + i, 'stay'));
  const escaped = flights.filter((f) => f.state === 'won');
  const cleared = escaped.filter((f) => f.carried >= f.goal);
  const mean = (list, key) => list.reduce((sum, f) => sum + f[key], 0) / Math.max(1, list.length);
  rows.push({
    region: id,
    cleared: `${Math.round((100 * cleared.length) / flights.length)}%`,
    caught: `${Math.round((100 * flights.filter((f) => f.state === 'dead').length) / flights.length)}%`,
    'by bird/rival/peck': ['bird', 'rival', 'peck']
      .map((c) => flights.filter((f) => f.cause === c).length)
      .join('/'),
    'fruit home': mean(escaped, 'carried').toFixed(1),
    'rivals ate': mean(flights, 'rivalsAte').toFixed(1),
    'locks on you': mean(escaped, 'locks').toFixed(1),
    pecks: mean(flights, 'pecks').toFixed(1),
    'flight s': (mean(flights, 'ms') / 1000).toFixed(0),
    'stubborn ends, s': `${(Math.max(...stubborn.map((f) => f.ms)) / 1000).toFixed(0)} max`,
    'never ended': flights.concat(stubborn).filter((f) => f.state === 'playing').length,
  });
}

/** The rows as an aligned table on standard output. */
function printTable(list) {
  const keys = Object.keys(list[0]);
  const width = keys.map((key) =>
    Math.max(key.length, ...list.map((row) => String(row[key]).length)),
  );
  const line = (cells) => cells.map((cell, i) => String(cell).padEnd(width[i])).join('  ');
  const lines = [line(keys), ...list.map((row) => line(keys.map((key) => row[key])))];
  process.stdout.write(lines.map((text) => `${text}\n`).join(''));
}

printTable(rows);
await browser.close();
close();
