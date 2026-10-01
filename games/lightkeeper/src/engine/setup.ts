import { createRng } from '@usr-games/kit';
import type { Beat } from './beats';
import { gleanersAttack } from './combat';
import { type Ctx, EndOfWatch, makeCtx, ranf } from './context';
import { baseParams, CAREER_TUNING } from './params';
import { scheduleRandom } from './schedule';
import {
  type RankId,
  REACH_SIZE,
  type RuleSet,
  type WatchLength,
  type WatchState,
  type Zone,
  ZONE_CAPACITY,
  ZONE_SIZE,
} from './types';
import { emptyCells, enterZone } from './zone';

/**
 * A new watch, set up the way the original set up a game: harbours and gleaners by skill and
 * length, worlds scattered one per zone, the clock as a reserve shared by the swarm. The same
 * seed always gives the same Reach; that was the original's tournament mode.
 */

export const WORLD_COUNT = 32;

export interface WatchOptions {
  seed: string;
  code?: string | null;
  rank: RankId;
  length: WatchLength;
  ruleSet: RuleSet;
}

export interface NewWatch {
  state: WatchState;
  beats: Beat[];
}

function emptyZone(): Zone {
  return {
    stars: 0,
    holes: 0,
    gleaners: 0,
    harbour: false,
    world: null,
    distress: null,
    layout: null,
    seen: null,
  };
}

export function newWatch(options: WatchOptions): NewWatch {
  const params = baseParams(options.rank, options.length, options.ruleSet);
  const s: WatchState = {
    version: 1,
    seed: options.seed,
    code: options.code ?? null,
    params,
    rng: createRng(options.seed).state(),
    zones: Array.from({ length: REACH_SIZE }, () => Array.from({ length: REACH_SIZE }, emptyZone)),
    cells: emptyCells(),
    gleaners: [],
    override: false,
    harbourCell: null,
    worldCell: null,
    ship: {
      vessel: 'lantern',
      energy: params.energy,
      shield: params.shield,
      shieldUp: true,
      shrouded: false,
      shroudSettled: false,
      reserves: params.reserves,
      crew: params.crew,
      holdFree: params.holdFree,
      flares: params.flares,
      zone: { row: 0, col: 0 },
      cell: { row: 0, col: 0 },
      condition: 'green',
      navigationUncalibrated: false,
      drive: 5,
      callsIssued: 0,
    },
    now: { harbours: [], gleaners: 0, date: 0, time: params.time, reserve: 0 },
    events: [],
    nextEventId: 1,
    snapshot: null,
    lostWorlds: [],
    tally: {
      stopped: 0,
      injured: 0,
      rimTouches: 0,
      harboursLostByUs: 0,
      starsLost: 0,
      worldsLostByUs: 0,
      beaconCalls: 0,
      salvage: 0,
      relit: 0,
      callsAnswered: 0,
      hailsAccepted: 0,
      novas: 0,
      portals: 0,
      charted: 0,
    },
    swept: [],
    outcome: null,
    actions: 0,
  };
  const ctx = makeCtx(s);
  drawCounts(ctx);
  scatterReach(ctx);
  scheduleFirstEvents(ctx);
  s.ship.cell = { row: ranf(ctx, ZONE_SIZE), col: ranf(ctx, ZONE_SIZE) };
  ctx.order.free = false;
  try {
    enterZone(ctx);
    gleanersAttack(ctx, false);
  } catch (error) {
    if (!(error instanceof EndOfWatch)) throw error;
    s.outcome = error.outcome;
  }
  s.rng = ctx.rng.state();
  return { state: s, beats: ctx.beats };
}

function drawCounts(ctx: Ctx) {
  const { s } = ctx;
  const { params } = s;
  const { rank, skill } = params;
  params.harbours = rank === 6 ? 1 : ranf(ctx, 6 - rank) + 2;
  let gleaners = Math.trunc(skill * params.length * 3.5 * (ctx.rng.next() + 0.75));
  const floor = Math.trunc(skill * params.length * 5);
  // The career adds a few gleaners so that even a Cadet's clean win can reach a promotion.
  gleaners = Math.max(
    gleaners,
    params.ruleSet === 'commission' ? floor + CAREER_TUNING.extraGleaners : floor,
  );
  params.gleaners = Math.min(127, gleaners);
  params.reserve = params.gleaners * params.time;
  params.date = (ranf(ctx, 20) + 20) * 100;
  s.now = {
    harbours: [],
    gleaners: params.gleaners,
    date: params.date,
    time: params.time,
    reserve: params.reserve,
  };
}

function scatterReach(ctx: Ctx) {
  const { s } = ctx;
  for (const row of s.zones) {
    for (const zone of row) {
      zone.stars = ranf(ctx, 9) + 1;
      zone.holes = Math.max(0, ranf(ctx, 3) - Math.trunc(zone.stars / 5));
    }
  }
  const randomZone = () => {
    const row = ranf(ctx, REACH_SIZE);
    const col = ranf(ctx, REACH_SIZE);
    return { at: { row, col }, zone: s.zones[row]![col]! };
  };
  for (let world = 0; world < WORLD_COUNT; world++) {
    for (;;) {
      const { zone } = randomZone();
      if (zone.world !== null) continue;
      zone.world = world;
      break;
    }
  }
  for (let i = 0; i < s.params.harbours; i++) {
    for (;;) {
      const { at, zone } = randomZone();
      if (zone.harbour) continue;
      zone.harbour = true;
      zone.seen = { gleaners: null, harbour: true, stars: null, collapsed: false };
      s.now.harbours.push(at);
      // The watch starts in the first harbour's zone, as the original's ship did.
      if (i === 0) s.ship.zone = { ...at };
      break;
    }
  }
  for (let left = s.params.gleaners; left > 0;) {
    const clump = Math.min(ranf(ctx, 4) + 1, left);
    for (;;) {
      const { zone } = randomZone();
      if (zone.gleaners + clump > ZONE_CAPACITY) continue;
      zone.gleaners += clump;
      left -= clump;
      break;
    }
  }
}

/** The original scheduled these five in this order; the career skips the ones not yet unlocked. */
function scheduleFirstEvents(ctx: Ctx) {
  const { rules } = ctx.s.params;
  if (rules.collapses) scheduleRandom(ctx, 'collapse', 1);
  if (rules.snare) scheduleRandom(ctx, 'snare', ctx.s.params.gleaners);
  if (rules.sieges) scheduleRandom(ctx, 'siege-begins', 1);
  if (rules.calls) scheduleRandom(ctx, 'call', 1);
  if (rules.redline) scheduleRandom(ctx, 'snapshot', 1);
}
