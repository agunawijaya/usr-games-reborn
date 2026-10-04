// Orchard Crawl — the balance check. Serves the game's folder on a free port, opens it in headless
// Chromium and lets the bot (bot.js) crawl every orchard many times through
// OrchardGame.fastForward: the real page's rules, without drawing, each crawl from its own seed.
// Two players: one heads home as soon as the burrow opens, one stays out for the orchard's points.
//
//   node games/worm-classic/scripts/balance.mjs [crawls per orchard, default 30] [orchard id]

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const BOT = fileURLToPath(new URL('./bot.js', import.meta.url));
const CRAWLS = Number(process.argv[2] ?? 30);
const ONLY = process.argv[3] ?? null;
const TYPES = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname)).replace(
    /^[/\\]+/,
    '',
  );
  const file = join(APP, path || 'index.html');
  try {
    if (!file.startsWith(APP) || !statSync(file).isFile()) throw new Error('not here');
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
await page.waitForFunction(() => !!window.__orchard);
await page.addScriptTag({ path: BOT });

/** One crawl in the page: returns what the desk would have learnt. */
const CRAWL = `async ({ orchardId, seed, player }) => {
  const { ORCHARDS, crawlRules } = await import('./src/orchards.mjs');
  const { seededRandom, seedOf } = await import('./src/daily.mjs');
  const { emptySummary, starsOf } = await import('./src/stars.mjs');
  const orchard = ORCHARDS.find((o) => o.id === orchardId);
  const s = emptySummary();
  const game = window.OrchardGame;
  if (!window.__balanceListening) {
    window.__balanceListening = true;
    game.on((e) => window.__balanceEvent?.(e));
  }
  window.__balanceEvent = (e) => {
    if (e.type === 'bite') { s.harvested = e.harvested; s.bestBite = Math.max(s.bestBite, e.points); if (e.points > e.value) s.chains++; if (e.rotten) s.rottenEaten++; }
    else if (e.type === 'frog-caught') s.frogs++;
    else if (e.type === 'bird-arrived') s.birdVisits++;
    else if (e.type === 'bird-stole') s.stolen++;
    else if (e.type === 'wasp-hatched') s.waspsHatched++;
    else if (e.type === 'rival-gone' && ['wall', 'self', 'your-body', 'fence'].includes(e.cause)) s.rivalCrashes++;
    else if (e.type === 'gardener-arrived') s.gardenerVisits++;
    else if (e.type === 'gardener-left' && game.state === 'playing') s.gardenerSeenOff++;
    else if (e.type === 'burrowing') s.length = game.peek().length;
    else if (e.type === 'crash') s.reason = e.reason;
  };
  const stream = (name) => seededRandom(seedOf('balance:' + orchardId + ':' + seed + ':' + name));
  game.begin({ theme: orchard.theme, rules: crawlRules(orchard), streams: { value: stream('value'), place: stream('place'), creature: stream('creature') } });
  const steer = window.__crawlBot({ ...player, stayFor: player.stayFor === 'points' ? orchard.points : 0 });
  const end = game.fastForward(15 * 60 * 1000, steer, 16);
  const peek = game.peek();
  s.home = end.state === 'home';
  s.score = peek.score;
  s.seconds = end.ms / 1000;
  if (!s.home) s.length = peek.length;
  const stars = starsOf(orchard).filter((star) => star.met(s)).map((star) => star.id);
  return { home: s.home, reason: s.reason, score: s.score, seconds: s.seconds, length: s.length, stars, harvested: s.harvested, bestBite: s.bestBite };
}`;

const { ORCHARDS } = await import(new URL('../app/src/orchards.mjs', import.meta.url).href);
const median = (xs) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};
const pct = (n, total) => `${Math.round((100 * n) / Math.max(1, total))}%`;

for (const orchard of ORCHARDS) {
  if (ONLY && orchard.id !== ONLY) continue;
  for (const [name, player] of [
    ['careful', { small: true }],
    ['chaining', { chain: true }],
    ['for points', { chain: true, stayFor: 'points' }],
  ]) {
    const results = [];
    for (let seed = 1; seed <= CRAWLS; seed++)
      results.push(
        await page.evaluate(
          `(${CRAWL})(${JSON.stringify({ orchardId: orchard.id, seed, player })})`,
        ),
      );
    const homes = results.filter((r) => r.home);
    const reasons = {};
    for (const r of results) if (!r.home) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    const star = (id) => results.filter((r) => r.stars.includes(id)).length;
    process.stdout.write(
      `${orchard.name.padEnd(10)} ${name.padEnd(16)} home ${pct(homes.length, results.length).padStart(4)}` +
        ` · points★ ${pct(star('points'), results.length).padStart(4)} · feat★ ${pct(star('feat'), results.length).padStart(4)}` +
        ` · score ${String(median(results.map((r) => r.score))).padStart(4)} (home ${String(median(homes.map((r) => r.score))).padStart(4)})` +
        ` · length ${String(median(results.map((r) => r.length))).padStart(3)} · ${Math.round(median(results.map((r) => r.seconds)))} s` +
        ` · bite ${median(results.map((r) => r.bestBite))} (≥15 ${pct(results.filter((r) => r.bestBite >= 15).length, results.length)})` +
        ` · crashes ${JSON.stringify(reasons)}\n`,
    );
  }
}

await browser.close();
server.close();
