import { FORMS } from '../engine/forms';
import type { Game, GameEvent } from '../engine/game';
import {
  BURST_SECONDS,
  type BurstMoment,
  burstHoldSeconds,
  TRAIL_SECONDS,
  type Trail,
} from '../render/effects';
import { settledCells } from '../render/from-game';
import type { PebbleCell } from '../render/sinkers';
import { depthShare } from '../render/view';

/**
 * Turns what the engine reports into what the tank shows: a burst's rows and the pebbles that were
 * in them, a plunge's trail of bubbles. A move that may settle a sinker is wrapped in `act`, which
 * notes the tank just before it, because by the time the engine says "burst" those rows are gone.
 */

export interface Acted {
  events: GameEvent[];
  bursts: BurstMoment[];
}

export class Moments {
  readonly bursts: BurstMoment[] = [];
  readonly trails: Trail[] = [];

  /** Plays `move` on the game at `time` (seconds on the run's clock) and keeps its moments. */
  act(game: Game, time: number, move: () => GameEvent[]): Acted {
    const before = settledCells(game);
    const kind = FORMS[game.form]!.kind;
    const from = { x: game.x, y: game.y };
    // A burst is paid at the level it happened at, before any climb it brings.
    const level = game.level;
    const events = move();
    const fresh: BurstMoment[] = [];
    let landed: PebbleCell[] = [];
    let plunged = 0;
    for (const event of events) {
      if (event.kind === 'plunged') plunged = event.rows;
      if (event.kind === 'landed') {
        const centre = event.cells[0]!;
        const depth = depthShare(Math.max(0, centre.y), game.height);
        landed = event.cells.map((c) => ({ x: c.x, y: c.y, group: event.group, kind, depth }));
      }
      if (event.kind === 'burst') {
        const rows = event.burst.rows;
        const moment: BurstMoment = {
          rows,
          cells: [...before, ...landed].filter((c) => rows.includes(c.y)),
          points: event.burst.points,
          combo: event.burst.combo,
          level,
          born: time,
        };
        fresh.push(moment);
        this.bursts.push(moment);
      }
    }
    if (plunged > 1) {
      // Standard has already brought on the next sinker: the trail is where this one landed.
      const x = landed[0]?.x ?? game.x;
      this.trails.push({ x, from: from.y, to: from.y + plunged, born: time });
    }
    return { events, bursts: fresh };
  }

  /** True while a burst is still cracking or dropping what was above it: hold the next sinker. */
  holding(time: number): boolean {
    return this.bursts.some((b) => time - b.born < burstHoldSeconds(b.rows.length));
  }

  /** Forgets moments that have played out. */
  trim(time: number): void {
    while (this.bursts.length > 0 && time - this.bursts[0]!.born > BURST_SECONDS)
      this.bursts.shift();
    while (this.trails.length > 0 && time - this.trails[0]!.born > TRAIL_SECONDS)
      this.trails.shift();
  }

  clear(): void {
    this.bursts.length = 0;
    this.trails.length = 0;
  }
}
