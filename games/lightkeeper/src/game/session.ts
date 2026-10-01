import type { ResultReceipt } from '@usr-games/kit';
import type { Beat } from '../engine/beats';
import { applyOrder, type Order } from '../engine/orders';
import { earnsPromotion, lightsKept, scoreSheet } from '../engine/score';
import { newWatch } from '../engine/setup';
import type { RankId, WatchState } from '../engine/types';
import { type LogLine, logLines, zoneLabel } from '../ui/copy';
import { packagesFromBeats, packagesFromEnd } from './packages';
import { NIGHT_RANK, type Saves, seedFor, type WatchKind } from './saves';

/**
 * One watch from first order to last: applying orders, keeping the log, saving after every
 * order so a watch can be resumed, installing packages as they are earned, and settling the
 * career and the Hall's records at the end.
 */

export interface SessionHooks {
  install(id: string): void;
  report(result: {
    outcome: 'win' | 'loss' | 'quit';
    score: number;
    stats: Record<string, number>;
    xpEvents: { id: string; xp: number }[];
    daily: boolean;
    durationSeconds: number;
  }): ResultReceipt;
  dateKey(): string;
  daySeed(): string;
}

export interface OrderOutcome {
  prev: WatchState;
  state: WatchState;
  beats: Beat[];
  lines: LogLine[];
  accepted: boolean;
}

const LOG_LIMIT = 60;

function openingLine(s: WatchState): LogLine {
  const harbour = s.harbourCell ? ', beside a harbour' : '';
  return {
    text: `The watch begins in zone ${zoneLabel(s.ship.zone)}${harbour}. ${s.now.gleaners} gleaners are out in the Reach, and the reserve lasts ${s.now.time.toFixed(0)} days at that.`,
    tone: 'info',
  };
}

export function rankOf(watch: WatchKind): RankId {
  if (watch.kind === 'daily') return NIGHT_RANK;
  return watch.rank;
}

export class WatchSession {
  state: WatchState;
  log: LogLine[] = [];
  readonly startedAt: number;
  promoted = false;
  receipt: ResultReceipt | null = null;
  private settled = false;

  private constructor(
    readonly watch: WatchKind,
    state: WatchState,
    private readonly saves: Saves,
    private readonly hooks: SessionHooks,
    startedAt: number,
  ) {
    this.state = state;
    this.startedAt = startedAt;
  }

  static begin(
    watch: WatchKind,
    saves: Saves,
    hooks: SessionHooks,
  ): { session: WatchSession; beats: Beat[] } {
    const seed = seedFor(watch, hooks.daySeed(), Date.now());
    const created = newWatch({
      seed,
      code: watch.kind === 'open' ? watch.code : null,
      rank: rankOf(watch),
      length: watch.kind === 'open' ? watch.length : 1,
      ruleSet: watch.kind === 'open' ? watch.ruleSet : 'commission',
    });
    const session = new WatchSession(watch, created.state, saves, hooks, Date.now());
    session.log = [openingLine(created.state), ...logLines(created.beats)];
    if (watch.kind === 'commission') {
      saves.career.update((career) => ({ ...career, watches: career.watches + 1 }));
    }
    session.persist();
    return { session, beats: created.beats };
  }

  static resume(saves: Saves, hooks: SessionHooks): WatchSession | null {
    const active = saves.active.load();
    if (!active || active.state.outcome) return null;
    const session = new WatchSession(active.watch, active.state, saves, hooks, Date.now());
    session.log = active.log.map((line) => ({
      text: line.text,
      tone: line.tone as LogLine['tone'],
    }));
    return session;
  }

  get over(): boolean {
    return this.state.outcome !== null;
  }

  issue(order: Order): OrderOutcome {
    const prev = this.state;
    const result = applyOrder(prev, order);
    const lines = logLines(result.beats);
    if (result.accepted) {
      this.state = result.state;
      this.log = [...this.log, ...lines].slice(-LOG_LIMIT);
      for (const id of packagesFromBeats(result.beats)) this.hooks.install(id);
      this.noteWorlds(result.beats);
      if (this.over) this.settle();
      else this.persist();
    }
    return { prev, state: this.state, beats: result.beats, lines, accepted: result.accepted };
  }

  private persist() {
    this.saves.active.save({
      watch: this.watch,
      state: this.state,
      startedAt: this.startedAt,
      log: this.log.slice(-30),
    });
  }

  private noteWorlds(beats: readonly Beat[]) {
    const touched = beats.filter(
      (b) => (b.type === 'world-relit' && b.byUs) || b.type === 'world-destroyed',
    );
    if (touched.length === 0) return;
    this.saves.gazetteer.update((gazetteer) => {
      const worlds = { ...gazetteer.worlds };
      for (const beat of touched) {
        if (beat.type !== 'world-relit' && beat.type !== 'world-destroyed') continue;
        const record = { answered: 0, relit: 0, lost: 0, ...worlds[beat.world] };
        if (beat.type === 'world-destroyed') record.lost += 1;
        else if (beat.wasDark) record.relit += 1;
        else record.answered += 1;
        worlds[beat.world] = record;
      }
      return { worlds };
    });
  }

  /** The watch is over: the career, the records and the Hall hear about it once. */
  private settle() {
    if (this.settled) return;
    this.settled = true;
    this.saves.active.save(null);
    const s = this.state;
    const outcome = s.outcome!;
    const sheet = scoreSheet(s);
    const won = outcome.kind === 'won';
    this.promoted = false;
    if (this.watch.kind === 'commission') {
      const career = this.saves.career.load();
      const atOwnRank = this.watch.rank === career.rank && !career.emeritus;
      this.promoted = atOwnRank && earnsPromotion(s);
      const best = Math.max(career.bestByRank[this.watch.rank] ?? -Infinity, sheet.total);
      this.saves.career.save({
        ...career,
        wins: career.wins + (won ? 1 : 0),
        bestByRank: { ...career.bestByRank, [this.watch.rank]: best },
        rank: this.promoted && career.rank < 6 ? ((career.rank + 1) as RankId) : career.rank,
        emeritus: career.emeritus || (this.promoted && career.rank === 6),
        promotions: this.promoted
          ? [...career.promotions, { rank: career.rank, dateKey: this.hooks.dateKey() }]
          : career.promotions,
      });
    }
    if (this.watch.kind === 'daily') {
      const day = this.watch.dateKey;
      // The first watch of the night is the one friends compare; later tries are practice.
      this.saves.nights.update((nights) => ({
        days: {
          ...nights.days,
          [day]: nights.days[day] ?? {
            outcome: outcome.kind,
            score: sheet.total,
            lights: lightsKept(s),
            stopped: s.tally.stopped,
            days: s.now.date - s.params.date,
          },
        },
      }));
    }
    for (const id of packagesFromEnd(s, this.promoted)) this.hooks.install(id);
    const xpEvents = [{ id: 'gleaners-stopped', xp: Math.min(25, s.tally.stopped) }];
    if (this.promoted) xpEvents.push({ id: 'promotion', xp: 25 });
    this.receipt = this.hooks.report({
      outcome: won ? 'win' : outcome.kind === 'lost' ? 'loss' : 'quit',
      score: Math.max(0, sheet.total),
      stats: {
        gleanersStopped: s.tally.stopped,
        callsAnswered: s.tally.callsAnswered + s.tally.relit,
        lightsKept: lightsKept(s),
        watchesKept: won ? 1 : 0,
      },
      xpEvents,
      daily: this.watch.kind === 'daily',
      durationSeconds: Math.round((Date.now() - this.startedAt) / 1000),
    });
  }
}
