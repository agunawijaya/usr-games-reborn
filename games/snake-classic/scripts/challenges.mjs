// Talon's Shadow — the challenges check. Plays every challenge several times through
// TalonGame.fastForward with a bot made for it, and prints the scores and the stars they earn,
// to see that each one ends and that its stars sit where they should: a plain bot should earn
// one, rarely two.
//
//   node games/snake-classic/scripts/challenges.mjs [games per challenge, default 12]

import process from 'node:process';
import { chromium } from '@playwright/test';
import { BOT } from './bots.mjs';
import { serveGame } from './serve.mjs';

const GAMES = Number(process.argv[2] ?? 12);
const { url, close } = await serveGame();

/** The bots for the challenges: the expedition bot that never leaves, and three made for one mode each. */
const MODE_BOTS = `(() => {
  // King Drift: a turn one way, then the other, every 280 ms, kept between the fences and edges.
  window.__zigzag = (p) => {
    window.__tick = (window.__tick || 0) + 1;
    if (window.__tick % 17 === 0) window.__flip = !window.__flip;
    const h = p.head;
    window.__across = h.x < 200 ? 1 : h.x > 700 ? -1 : window.__across || 1;
    const vertical = h.y < 140 ? 1 : h.y > 460 ? -1 : window.__flip ? 1 : -1;
    return window.__flip ? { dx: 0, dy: vertical } : { dx: window.__across, dy: 0 };
  };
  // Coil: go to the south-west of a fruit, then round it in a square (north, east, south,
  // west) so that the loop closes with the fruit inside.
  window.__coiler = (p) => {
    const h = p.head;
    // A side of 26 steps: the square's way round is shorter than the snake, so the loop closes.
    const SIDE = 26;
    if (window.__square && window.__square.left > 0) {
      window.__square.left--;
      const side = Math.min(3, Math.floor((4 * SIDE + 8 - window.__square.left) / SIDE));
      return [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }][side];
    }
    const fruit = p.apples.filter((a) => a.x > 170 && a.x < 730 && a.y > 170 && a.y < 430)
      .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
    if (!fruit) return window.__bot(p);
    const corner = { x: fruit.x - 34, y: fruit.y + 34 };
    if (Math.hypot(corner.x - h.x, corner.y - h.y) < 14) {
      window.__square = { left: 4 * SIDE + 8 };
      return { dx: 0, dy: -1 };
    }
    const dx = corner.x - h.x, dy = corner.y - h.y;
    return Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) || 1 };
  };
  // Courier: gather three, then head for the burrow on the west side.
  window.__courier = (p) => {
    if (p.carried >= 3) {
      const h = p.head;
      const goal = { x: 70, y: 300 };
      const route = window.__paths.routeTo(h, goal, p.fences);
      const aim = route.length ? window.__paths.farthestInSight(h, route.slice(0, 10), p.fences) : goal;
      const dx = aim.x - h.x, dy = aim.y - h.y;
      return Math.abs(dx) > Math.abs(dy) ? { dx: Math.sign(dx), dy: 0 } : { dx: 0, dy: Math.sign(dy) || 1 };
    }
    return window.__bot(p);
  };
})()`;

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (error) => console.error('page error:', error.message));
await page.goto(url);
await page.waitForFunction('!!window.__talon && !!window.TalonGame');
await page.evaluate(`(async () => {
  window.__fences = await import('./src/fences.mjs');
  window.__paths = await import('./src/paths.mjs');
  window.__challenges = await import('./src/challenges.mjs');
  ${BOT};
  ${MODE_BOTS};
})()`);

const BOT_FOR = {
  fill: '__bot',
  drift: '__zigzag',
  coil: '__coiler',
  survival: '__bot',
  courier: '__courier',
};

const ids = await page.evaluate('window.__challenges.CHALLENGES.map((c) => c.id)');
const rows = [];
for (const id of ids) {
  const games = [];
  for (let i = 0; i < GAMES; i++) {
    games.push(
      await page.evaluate(`(() => {
        const challenge = window.__challenges.challengeById('${id}');
        const region = window.__challenges.challengeRegion(challenge);
        window.__botMode = 'stay';
        window.__botGoal = Infinity;
        window.__botDir = null;
        window.__square = null;
        window.TalonGame.begin({ theme: region.theme, tuning: region.tuning,
          rules: window.__challenges.challengeRules(challenge), random: window.__challengesSeed?.(${i}) });
        const end = window.TalonGame.fastForward(600000, window['${BOT_FOR[id]}']);
        const result = challenge.result(window.TalonGame.modeApi);
        return { ...end, score: result.score, stars: window.__challenges.starsFor(result.score, challenge.stars) };
      })()`),
    );
  }
  const scores = games.map((g) => g.score).sort((a, b) => a - b);
  rows.push({
    challenge: id,
    'scores (low · median · high)': `${scores[0]} · ${scores[Math.floor(scores.length / 2)]} · ${scores[scores.length - 1]}`,
    stars: [0, 1, 2, 3].map((n) => games.filter((g) => g.stars === n).length).join('/'),
    'seconds (median)': Math.round(
      games.map((g) => g.ms).sort((a, b) => a - b)[Math.floor(games.length / 2)] / 1000,
    ),
    'never ended': games.filter((g) => g.state === 'playing').length,
  });
}

const keys = Object.keys(rows[0]);
const width = keys.map((key) =>
  Math.max(key.length, ...rows.map((row) => String(row[key]).length)),
);
const line = (cells) => cells.map((cell, i) => String(cell).padEnd(width[i])).join('  ');
process.stdout.write(
  [line(keys), ...rows.map((row) => line(keys.map((key) => row[key])))]
    .map((text) => `${text}\n`)
    .join(''),
);
await browser.close();
close();
