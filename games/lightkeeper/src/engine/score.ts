import type { WatchState } from './types';

/**
 * The end-of-watch sheet, line for line from the original's `score`, and its promotion rule:
 * a win worth at least 1,000 with a clean record (no beacon calls, no harbour or world lost to
 * your own fire, few stars spent and few crew hurt, and the ship you started in).
 */

export type ScoreLineId =
  | 'stopped'
  | 'pace'
  | 'still-out'
  | 'won'
  | 'lost-ship'
  | 'harbours-lost'
  | 'beacon-calls'
  | 'stars-lost'
  | 'worlds-lost'
  | 'ember'
  | 'salvage'
  | 'injured';

export interface ScoreLine {
  id: ScoreLineId;
  /** The count or rate the line is about. */
  amount: number;
  points: number;
}

export interface ScoreSheet {
  lines: ScoreLine[];
  total: number;
}

export const PROMOTION_SCORE = 1000;

export function daysElapsed(s: WatchState): number {
  return s.now.date - s.params.date;
}

export function scoreSheet(s: WatchState): ScoreSheet {
  const { tally, params } = s;
  const lines: ScoreLine[] = [];
  const add = (id: ScoreLineId, amount: number, points: number) => {
    if (points !== 0) lines.push({ id, amount, points });
  };
  add('stopped', tally.stopped, Math.trunc(params.gleanerPower / 4) * tally.stopped);
  const pace = tally.stopped / Math.max(1, daysElapsed(s));
  add('pace', pace, Math.trunc(400 * pace));
  add('still-out', s.now.gleaners, Math.trunc((-400 * s.now.gleaners) / (tally.stopped + 1)));
  if (s.outcome?.kind === 'won') add('won', params.rank, 100 * params.rank);
  // Running out of time was the only defeat the original did not count as losing the ship.
  if (s.outcome?.kind === 'lost' && s.outcome.reason !== 'reserve-ran-dry')
    add('lost-ship', 1, -500);
  add('harbours-lost', tally.harboursLostByUs, -100 * tally.harboursLostByUs);
  add('beacon-calls', tally.beaconCalls, -100 * tally.beaconCalls);
  add('stars-lost', tally.starsLost, -5 * tally.starsLost);
  add('worlds-lost', tally.worldsLostByUs, -150 * tally.worldsLostByUs);
  if (s.ship.vessel === 'ember') add('ember', 1, -200);
  add('salvage', tally.salvage, 3 * tally.salvage);
  add('injured', tally.injured, -tally.injured);
  return { lines, total: lines.reduce((sum, line) => sum + line.points, 0) };
}

export interface CleanRecord {
  noBeacon: boolean;
  noHarbourLost: boolean;
  noWorldLost: boolean;
  carefulWithStarsAndCrew: boolean;
  sameShip: boolean;
}

export function cleanRecord(s: WatchState): CleanRecord {
  const { tally } = s;
  return {
    noBeacon: tally.beaconCalls === 0,
    noHarbourLost: tally.harboursLostByUs === 0,
    noWorldLost: tally.worldsLostByUs === 0,
    carefulWithStarsAndCrew: 5 * tally.starsLost + tally.injured < 100,
    sameShip: s.ship.vessel === 'lantern',
  };
}

export function earnsPromotion(s: WatchState): boolean {
  if (s.outcome?.kind !== 'won') return false;
  const record = cleanRecord(s);
  return Object.values(record).every(Boolean) && scoreSheet(s).total >= PROMOTION_SCORE;
}

export type LightState = 'lit' | 'threatened' | 'dark' | 'lost';

export interface Light {
  world: number;
  zone: { row: number; col: number };
  state: LightState;
}

/**
 * Every world's light. As the crew knows it, a call not yet heard leaves a light looking lit;
 * `truth` shows it as it is, for the end of the watch.
 */
export function lights(s: WatchState, truth = false): Light[] {
  const result: Light[] = [];
  s.zones.forEach((row, r) =>
    row.forEach((zone, c) => {
      if (zone.world === null) return;
      let state: LightState = 'lit';
      const event = zone.distress === null ? null : s.events.find((e) => e.id === zone.distress);
      if (event && !event.ghost && (truth || !event.hidden)) {
        state = event.kind === 'swarm-grows' ? 'dark' : 'threatened';
      }
      result.push({ world: zone.world, zone: { row: r, col: c }, state });
    }),
  );
  for (const lost of s.lostWorlds)
    result.push({ world: lost.world, zone: lost.zone, state: 'lost' });
  return result.sort((a, b) => a.world - b.world);
}

export function lightsKept(s: WatchState): number {
  return lights(s, true).filter((light) => light.state === 'lit' || light.state === 'threatened')
    .length;
}
