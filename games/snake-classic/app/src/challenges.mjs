// Talon's Shadow — the challenges: single games apart from the expedition, each with its own
// field, its own way to score and three stars to earn. Fill the Field (grow until the field is
// full, and never run into yourself), King Drift (chain zigzags), Coil (close a loop round fruit
// and rivals), Survival (last as long as you can as the threats gather) and Courier (carry fruit
// to the burrow). Each mode works through a small handle the page gives it (`api`, see
// index.html) and draws its own marks; the scoring helpers below are pure.

import { carryEffects } from './carry.mjs';
import { flightRules } from './rules.mjs';
import { regionById } from './regions.mjs';

// ------------------------------------------------------------------ pure helpers

/** The field cut into cells for Fill the Field: 30 × 20 of them. */
export const CELL = 30;

/** The share of cells (0 to 1) holding some part of the snake. */
export function coverage(segments, width, height, cell = CELL) {
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const covered = new Uint8Array(cols * rows);
  let count = 0;
  for (const s of segments) {
    const col = Math.floor(s.x / cell);
    const row = Math.floor(s.y / cell);
    if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
    const i = row * cols + col;
    if (!covered[i]) {
      covered[i] = 1;
      count++;
    }
  }
  return { share: count / (cols * rows), covered, cols, rows };
}

/** True when (x, y) lies inside the closed loop `points` (an even-odd test). */
export function insideLoop(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Where a loop closes: the head has come back to its own body, beyond the neck. Returns the
 * index of the body segment it touched, or -1.
 */
export function loopClosedAt(segments, neck = 14, reach = 16) {
  const head = segments[0];
  for (let i = neck; i < segments.length; i++) {
    if (Math.hypot(segments[i].x - head.x, segments[i].y - head.y) < reach) return i;
  }
  return -1;
}

/**
 * King Drift's meter. A drift is a turn of at least 50° made while turning quickly; drifts
 * chain into a combo while each turns the other way from the last and follows it within 0.9 s.
 * A drift is worth 10 points a link of the combo, doubled when the head passed close to
 * something (a fence, an edge, a rival or a hunter) without touching it. Touching a fence or an
 * edge, or running straight on for long, ends the combo.
 */
export class DriftMeter {
  constructor() {
    this.turning = 0;
    this.turnedBy = 0;
    this.calmFor = 0;
    this.lastSign = 0;
    this.sinceLast = Infinity;
    this.combo = 0;
    this.best = 0;
    this.points = 0;
    this.close = false;
  }

  /**
   * One step: the heading's change (radians), the step's length (ms), whether the head is close
   * to something, whether it touched a fence or an edge. Returns a drift scored now, if any.
   * @returns {{ points: number, combo: number, close: boolean } | null}
   */
  step(turn, dt, close, touched) {
    this.sinceLast += dt;
    if (touched) this.breakCombo();
    if (close) this.close = true;
    const quick = Math.abs(turn) / Math.max(1, dt) > 0.0016;
    if (quick && (this.turning === 0 || Math.sign(turn) === this.turning)) {
      this.turning = Math.sign(turn);
      this.turnedBy += Math.abs(turn);
      this.calmFor = 0;
      return null;
    }
    this.calmFor += dt;
    if (this.turning !== 0 && this.calmFor > 90) return this.endTurn();
    if (this.sinceLast > 1600 && this.combo > 0) this.breakCombo();
    return null;
  }

  endTurn() {
    const sign = this.turning;
    const angle = this.turnedBy;
    const close = this.close;
    this.turning = 0;
    this.turnedBy = 0;
    this.close = false;
    if (angle < (50 * Math.PI) / 180) return null;
    this.combo = sign !== this.lastSign && this.sinceLast < 900 ? this.combo + 1 : 1;
    this.lastSign = sign;
    this.sinceLast = 0;
    this.best = Math.max(this.best, this.combo);
    const points = 10 * this.combo * (close ? 2 : 1);
    this.points += points;
    return { points, combo: this.combo, close };
  }

  breakCombo() {
    this.combo = 0;
    this.lastSign = 0;
  }
}

/** How many stars a score earns against three thresholds. */
export function starsFor(score, thresholds) {
  return thresholds.filter((t) => score >= t).length;
}

// ------------------------------------------------------------------ the modes

/** A neutral carry: fruit changes nothing (Fill the Field grows by its own rule). */
const lightCarry = (growPerFruit) => (carried) => ({ speed: 1, turn: 1, grow: carried * growPerFruit, patience: 1, lock: 1, dive: 1 });

const seconds = (ms) => Math.max(0, Math.ceil(ms / 1000));

/**
 * @typedef {{ id: string, name: string, region: string, fence: string, blurb: string,
 *   rules: string[], unit: string, stars: number[], timeLimitMs?: number,
 *   setup: (base: object) => object, start?: (api: object) => void,
 *   step?: (api: object, dt: number) => void, under?: (ctx: CanvasRenderingContext2D, api: object, time: number) => void,
 *   over?: (ctx: CanvasRenderingContext2D, api: object, time: number) => void,
 *   status: (api: object) => string, result: (api: object) => { score: number, headline: string } }} Challenge
 */

/** @type {Challenge} */
const fill = {
  id: 'fill',
  name: 'Fill the Field',
  region: 'origami',
  fence: 'none',
  blurb: 'Eat and grow until the snake fills the field. Never run into yourself.',
  rules: [
    'Every fruit makes the snake longer by a good stretch; it never slows down.',
    'Running into your own body ends the game; so does the bird, which starts hunting at a quarter full (or after a minute), its dives quicker every half minute after that, and the paper hen, from half full.',
    'Fruit only grows where the snake is not. The score is how much of the field you filled.',
  ],
  unit: '%',
  stars: [25, 50, 75],
  setup: (base) => ({
    ...base,
    harvest: Infinity,
    fruitLifeMs: Infinity,
    rivals: 0,
    hunters: 0,
    canShed: false,
    selfCollision: true,
    flatBody: true,
    carry: lightCarry(22),
  }),
  start(api) {
    api.state.share = 0;
    api.state.birdAwake = false;
    api.state.wokeAt = 0;
    api.state.henCome = false;
    api.setBirdAwake(false);
    api.setFruitSpot((x, y) => !api.snake.some((s) => Math.hypot(s.x - x, s.y - y) < 24));
  },
  step(api) {
    const { share } = coverage(api.snake, api.size.width, api.size.height);
    api.state.share = share;
    if ((share >= 0.25 || api.clock >= 60000) && !api.state.birdAwake) {
      api.state.birdAwake = true;
      api.state.wokeAt = api.clock;
      api.setBirdAwake(true);
      api.say(share >= 0.25 ? 'A quarter full: the bird is hunting.' : 'A minute gone: the bird is hunting.');
    }
    // Once awake, the bird's dives come quicker every half minute, so every game ends.
    if (api.state.birdAwake) api.quickenDives(0.85 ** Math.floor((api.clock - api.state.wokeAt) / 30000));
    if (share >= 0.5 && !api.state.henCome) {
      api.state.henCome = true;
      api.addHunter();
      api.say('Half full: the paper hen is on its way.');
    }
    if (share >= 0.999) api.finish('full');
  },
  under(ctx, api) {
    // The cells already filled, faintly, so the shape of what is left shows.
    const { covered, cols } = coverage(api.snake, api.size.width, api.size.height);
    ctx.save();
    ctx.fillStyle = 'rgba(232, 81, 94, 0.07)';
    for (let i = 0; i < covered.length; i++) {
      if (covered[i]) ctx.fillRect((i % cols) * CELL, Math.floor(i / cols) * CELL, CELL, CELL);
    }
    ctx.restore();
  },
  status: (api) => `Filled ${Math.floor(api.state.share * 100)}% · ★ at 25 · 50 · 75%`,
  result: (api) => {
    const score = Math.floor(api.state.share * 100);
    return { score, headline: score >= 100 ? 'The field is full!' : `${score}% of the field filled` };
  },
};

/** @type {Challenge} */
const drift = {
  id: 'drift',
  name: 'King Drift',
  region: 'neon-grid',
  fence: 'plus',
  blurb: 'Zigzag left, right, left: every turn the other way within a moment adds to the combo.',
  rules: [
    'A drift is a sharp turn of at least 50°. Turn the other way within a moment and the combo grows: each drift is worth 10 points a link.',
    'Pass close to a fence, an edge, a rival or the hen without touching it, and that drift counts double.',
    'Touching a fence or an edge, or running straight on, ends the combo. Sixty seconds; the bird and the circuit hen still hunt.',
  ],
  unit: 'points',
  stars: [900, 2200, 3800],
  timeLimitMs: 60000,
  setup: (base) => ({
    ...base,
    harvest: Infinity,
    appleCount: 0,
    rivals: 1,
    hunters: 1,
    canShed: false,
    carry: lightCarry(0),
  }),
  start(api) {
    api.state.meter = new DriftMeter();
    api.state.heading = Math.atan2(api.heading.dy, api.heading.dx);
    api.state.popups = [];
  },
  step(api, dt) {
    const now = Math.atan2(api.heading.dy, api.heading.dx);
    let turn = now - api.state.heading;
    if (turn > Math.PI) turn -= Math.PI * 2;
    if (turn < -Math.PI) turn += Math.PI * 2;
    api.state.heading = now;
    const scored = api.state.meter.step(turn, dt, api.closeCall(26), api.touchedWall);
    if (scored) {
      const head = api.snake[0];
      api.state.popups.push({ x: head.x, y: head.y, text: `${scored.close ? 'Close! ' : ''}×${scored.combo}  +${scored.points}`, born: api.clock });
    }
    api.state.popups = api.state.popups.filter((p) => api.clock - p.born < 900);
    if (api.clock >= drift.timeLimitMs) api.finish('time');
  },
  over(ctx, api) {
    ctx.save();
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of api.state.popups) {
      const age = (api.clock - p.born) / 900;
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = '#ffe14d';
      ctx.fillText(p.text, p.x, p.y - 24 - (api.reducedMotion ? 0 : age * 26));
    }
    ctx.restore();
  },
  status: (api) => `${api.state.meter.points} points · combo ×${api.state.meter.combo} · best ×${api.state.meter.best} · ${seconds(drift.timeLimitMs - api.clock)} s left`,
  result: (api) => ({ score: api.state.meter.points, headline: `${api.state.meter.points} points, best combo ×${api.state.meter.best}` }),
};

/** @type {Challenge} */
const coil = {
  id: 'coil',
  name: 'Coil',
  region: 'jungle',
  fence: 'none',
  blurb: 'Close a loop with your body: whatever is inside it is yours.',
  rules: [
    'Bring your head back to your own body to close a loop. Every fruit inside is taken at once: n fruit in one coil score n × n.',
    'A rival caught inside a coil is squeezed out of the game for 15 points.',
    'Touching yourself is safe here; running into a rival is not. Ninety seconds; the bird hunts.',
  ],
  unit: 'points',
  stars: [30, 90, 180],
  timeLimitMs: 90000,
  setup: (base) => ({
    ...base,
    harvest: Infinity,
    fruitLifeMs: Infinity,
    appleCount: 0,
    rivals: 2,
    hunters: 0,
    canShed: false,
    carry: lightCarry(1),
  }),
  start(api) {
    api.state.points = 0;
    api.state.coils = 0;
    api.state.flash = null;
    api.state.quietUntil = 0;
  },
  step(api) {
    // Fruit comes in clusters, so a coil is worth closing.
    if (api.apples.length < 5) {
      const cx = 140 + api.random() * (api.size.width - 280);
      const cy = 120 + api.random() * (api.size.height - 240);
      for (let k = 0; k < 4; k++) api.spawnFruitAt(cx + (api.random() - 0.5) * 90, cy + (api.random() - 0.5) * 90);
    }
    if (api.clock >= api.state.quietUntil) {
      const at = loopClosedAt(api.snake);
      if (at > 0) {
        const loop = api.snake.slice(0, at + 1);
        let fruit = 0;
        for (let i = api.apples.length - 1; i >= 0; i--) {
          if (insideLoop(loop, api.apples[i].x, api.apples[i].y)) {
            api.collectFruit(i);
            fruit++;
          }
        }
        let squeezed = 0;
        for (let i = api.rivals.length - 1; i >= 0; i--) {
          const head = api.rivals[i].segments[0];
          if (insideLoop(loop, head.x, head.y)) {
            api.removeRival(i);
            squeezed++;
          }
        }
        const points = fruit * fruit + squeezed * 15;
        if (points) {
          api.state.points += points;
          api.state.coils++;
          api.say(`Coiled ${fruit} fruit${squeezed ? ` and ${squeezed} rival${squeezed > 1 ? 's' : ''}` : ''}: +${points}`, 1600);
        }
        api.state.flash = { loop: loop.map((s) => ({ x: s.x, y: s.y })), born: api.clock };
        api.state.quietUntil = api.clock + 700;
      }
    }
    if (api.clock >= coil.timeLimitMs) api.finish('time');
  },
  under(ctx, api) {
    const flash = api.state.flash;
    if (!flash || api.clock - flash.born > 600) return;
    ctx.save();
    ctx.globalAlpha = 0.35 * (1 - (api.clock - flash.born) / 600);
    ctx.fillStyle = '#d8f070';
    ctx.beginPath();
    flash.loop.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },
  status: (api) => `${api.state.points} points · ${api.state.coils} coils · ${seconds(coil.timeLimitMs - api.clock)} s left`,
  result: (api) => ({ score: api.state.points, headline: `${api.state.points} points in ${api.state.coils} coils` }),
};

/** @type {Challenge} */
const survival = {
  id: 'survival',
  name: 'Survival',
  region: 'midnight',
  fence: 'H',
  blurb: 'Last as long as you can. Every half minute something else joins the hunt.',
  rules: [
    'The edges never open. Every 30 seconds the hunt grows: a night heron, two rivals, a second heron, a hungrier owl, another rival; after three minutes every dive comes quicker than the last.',
    'Every second you last is a point, and every fruit another, though it slows you like any load.',
    'Space sheds the tail as a decoy, as in the expedition.',
  ],
  unit: 'points',
  stars: [180, 380, 480],
  setup: (base) => ({
    ...base,
    harvest: Infinity,
    fruitLifeMs: 24000,
    rivals: 0,
    hunters: 0,
    canShed: true,
  }),
  start(api) {
    api.state.wave = 0;
    api.state.fruit = 0;
  },
  step(api) {
    const waves = [
      () => api.addHunter(),
      () => {
        api.addRival();
        api.addRival();
      },
      () => api.addHunter(),
      () => api.setBirdHunger(0.7),
      () => api.addRival(),
      () => api.setBirdHunger(0.5),
    ];
    // After the six waves, every half minute each dive comes a fifth quicker: the hunt ends.
    const due = Math.floor(api.clock / 30000);
    while (api.state.wave < due) {
      const wave = api.state.wave;
      if (wave < waves.length) waves[wave]();
      else api.quickenDives(0.8 ** (wave - waves.length + 1));
      api.state.wave++;
      api.say(`${api.state.wave * 30} seconds: the hunt grows.`, 2000);
    }
  },
  status: (api) => `${survival.score(api)} points · ${seconds(api.clock)} s · 🍎 ${api.carried}`,
  score: (api) => Math.floor(api.clock / 1000) + api.carried,
  result: (api) => ({ score: survival.score(api), headline: `${seconds(api.clock)} s with 🍎 ${api.carried}` }),
};

/** @type {Challenge} */
const courier = {
  id: 'courier',
  name: 'Courier',
  region: 'desert',
  fence: 'I',
  blurb: 'Carry fruit to the burrow. The more you bring at once, the more each one is worth.',
  rules: [
    'Slither into the burrow to deliver what you carry: n fruit at once score n × n.',
    'Carrying slows you and makes the hunters hungrier, as in the expedition.',
    'Two minutes; the hawk, the courser and a rival are about.',
  ],
  unit: 'points',
  stars: [60, 140, 240],
  timeLimitMs: 120000,
  setup: (base) => ({
    ...base,
    harvest: Infinity,
    fruitLifeMs: 30000,
    rivals: 1,
    hunters: 1,
    canShed: false,
  }),
  start(api) {
    api.state.points = 0;
    api.state.trips = 0;
    api.state.burrow = { x: 70, y: api.size.height / 2 };
    api.setFruitSpot((x, y) => Math.hypot(x - api.state.burrow.x, y - api.state.burrow.y) > 140);
  },
  step(api) {
    const head = api.snake[0];
    const burrow = api.state.burrow;
    if (api.carried > 0 && Math.hypot(head.x - burrow.x, head.y - burrow.y) < 26) {
      const n = api.carried;
      api.state.points += n * n;
      api.state.trips++;
      api.carried = 0;
      api.say(`${n} delivered: +${n * n}`, 1500);
    }
    if (api.clock >= courier.timeLimitMs) api.finish('time');
  },
  under(ctx, api, time) {
    const burrow = api.state.burrow;
    ctx.save();
    const pulse = api.reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * 0.004);
    ctx.fillStyle = 'rgba(60, 34, 14, 0.85)';
    ctx.beginPath();
    ctx.ellipse(burrow.x, burrow.y, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 214, 102, ${0.4 + 0.4 * pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  },
  status: (api) => `${api.state.points} points · ${api.state.trips} trips · 🍎 ${api.carried} carried · ${seconds(courier.timeLimitMs - api.clock)} s left`,
  result: (api) => ({ score: api.state.points, headline: `${api.state.points} points in ${api.state.trips} trips` }),
};

export const CHALLENGES = Object.freeze([fill, drift, coil, survival, courier]);

/** @param {string} id */
export function challengeById(id) {
  return CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0];
}

/** The region a challenge borrows its look, bird and hunter from, with the challenge's own field. */
export function challengeRegion(challenge) {
  const region = regionById(challenge.region);
  return { ...region, fence: challenge.fence };
}

/** The rules of a challenge for TalonGame.begin: a region's rules, changed by the challenge. */
export function challengeRules(challenge) {
  const region = challengeRegion(challenge);
  const base = flightRules(region);
  return { ...challenge.setup({ ...base, carry: base.carry ?? carryEffects }), mode: challenge };
}
