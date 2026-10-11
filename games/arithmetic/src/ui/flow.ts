import type { EventResult, EventSpec } from '../engine/events';
import type { ModeId } from '../engine/levels';
import type { BlockCard, Tempo } from '../engine/sums';
import type { EventDetail } from '../game/records';

/**
 * How the screens hand over to each other. A run is a list of events played in order (one for
 * free play, two to four for a chapter, four for the Daily); every event screen ends by handing
 * back an outcome, and the run screen keeps score.
 */

export type RunKind = 'free' | 'chapter' | 'daily';

export interface RunPlan {
  readonly kind: RunKind;
  readonly title: string;
  readonly events: readonly EventSpec[];
  readonly tempo: Tempo;
  readonly seed: string;
  readonly chapterId?: string;
  readonly dailyKey?: string;
  readonly dailyNumber?: number;
  /** A Daily played again the same day: for fun, not for the record. */
  readonly practice?: boolean;
}

export interface EventOutcome {
  readonly result: EventResult;
  readonly detail: EventDetail;
  /** The key bests are kept under, e.g. `sums:times-10` or `sums:custom:+-x:12`. */
  readonly rungKey: string;
  readonly card?: BlockCard;
  /** Primes uncovered, for the album. */
  readonly primes: readonly number[];
}

export interface EventScreenOptions {
  readonly plan: RunPlan;
  readonly index: number;
  readonly spec: EventSpec;
  readonly seed: string;
  readonly onDone: (outcome: EventOutcome) => void;
}

export interface Nav {
  menu(): void;
  pickTheme(): void;
  freePlay(mode?: ModeId): void;
  campaign(): void;
  run(plan: RunPlan): void;
  daily(): void;
  album(): void;
  training(): void;
  help(): void;
  settings(): void;
}

export function rungKey(spec: EventSpec, custom?: { ops: string; range: number }): string {
  if (spec.mode === 'sums' && spec.level === 'custom' && custom) {
    return `sums:custom:${custom.ops}:${custom.range}`;
  }
  return `${spec.mode}:${spec.level}`;
}
