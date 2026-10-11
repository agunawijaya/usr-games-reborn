import { CHAPTERS } from '../engine/chapters';
import type { MachineId } from '../engine/message';
import type { PackageId } from './packages';

/**
 * What the desk remembers between visits, and the rules that turn moments into packages. Pure:
 * every update returns new records and the packages it earned.
 */
export interface Records {
  /** Best stars per campaign message id. */
  stars: Record<string, number>;
  /** Best seconds per campaign message id. */
  best: Record<string, number>;
  /** Local date keys of Daily Signals played, oldest first. */
  dailies: string[];
  /** Fastest clean keying, in words a minute. */
  bestWpm: number;
  /** Steps read or sent at each machine, for the logbook. */
  worked: Record<MachineId, number>;
  /** Packages already earned, so a moment never earns twice. */
  earned: PackageId[];
}

export function emptyRecords(): Records {
  return {
    stars: {},
    best: {},
    dailies: [],
    bestWpm: 0,
    worked: { telegraph: 0, cipher: 0, punch: 0, tape: 0, printer: 0, semaphore: 0 },
    earned: [],
  };
}

export function isRecords(value: unknown): value is Records {
  const v = value as Records;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.stars === 'object' &&
    typeof v.best === 'object' &&
    Array.isArray(v.dailies) &&
    Array.isArray(v.earned) &&
    typeof v.worked === 'object'
  );
}

export interface Update {
  records: Records;
  earned: PackageId[];
}

function earn(records: Records, wanted: readonly PackageId[]): Update {
  const fresh = wanted.filter((id, i) => !records.earned.includes(id) && wanted.indexOf(id) === i);
  return {
    records: fresh.length > 0 ? { ...records, earned: [...records.earned, ...fresh] } : records,
    earned: fresh,
  };
}

/** One moment at a machine, as the station reports it. */
export type StepReport =
  | { kind: 'keyed'; mark: '.' | '-' }
  | { kind: 'sent-morse'; wpm: number; wrong: number }
  | { kind: 'cracked'; scope: boolean; hints: number; fooled: boolean }
  | { kind: 'read-card'; letters: number; chart: boolean; hints: number }
  | { kind: 'punched-tape'; rows: number; slips: number }
  | { kind: 'read-banner'; printedShare: number; width: number; wrong: number }
  | { kind: 'read-flags'; letters: number }
  | { kind: 'sent-flags'; late: number; wrong: number }
  | { kind: 'worked'; machine: MachineId };

export function recordStep(records: Records, report: StepReport): Update {
  switch (report.kind) {
    case 'keyed':
      return earn(records, [report.mark === '.' ? 'first-dit' : 'first-daw']);
    case 'sent-morse': {
      const clean = report.wrong === 0;
      const next =
        clean && report.wpm > records.bestWpm
          ? { ...records, bestWpm: Math.round(report.wpm * 10) / 10 }
          : records;
      return earn(next, clean && report.wpm >= 20 ? ['morse-20wpm'] : []);
    }
    case 'cracked':
      return earn(records, [
        ...(report.scope && report.hints === 0 ? (['frequency-sleuth'] as const) : []),
        ...(report.fooled ? (['beat-the-machine'] as const) : []),
      ]);
    case 'read-card':
      return earn(
        records,
        report.letters >= 10 && !report.chart && report.hints === 0 ? ['card-reader'] : [],
      );
    case 'punched-tape':
      return earn(records, report.rows >= 8 && report.slips === 0 ? ['tape-weaver'] : []);
    case 'read-banner':
      return earn(records, [
        ...(report.printedShare < 0.5 && report.wrong === 0 ? (['banner-day'] as const) : []),
        ...(report.width <= 33 ? (['squint'] as const) : []),
      ]);
    case 'read-flags':
      return earn(records, report.letters >= 20 ? ['flag-reader'] : []);
    case 'sent-flags':
      return earn(records, report.late === 0 && report.wrong === 0 ? ['flag-sender'] : []);
    case 'worked':
      return {
        records: {
          ...records,
          worked: {
            ...records.worked,
            [report.machine]: (records.worked[report.machine] ?? 0) + 1,
          },
        },
        earned: [],
      };
  }
}

/** A finished campaign message: keeps the best stars and time. */
export function recordMessage(
  records: Records,
  id: string,
  stars: number,
  seconds: number,
  steps: number,
): Update {
  const next: Records = {
    ...records,
    stars: { ...records.stars, [id]: Math.max(stars, records.stars[id] ?? 0) },
    best: { ...records.best, [id]: Math.min(seconds, records.best[id] ?? Infinity) },
  };
  const all = CHAPTERS.every((chapter) =>
    chapter.messages.every((message) => message.id in next.stars),
  );
  return earn(next, [
    ...(steps > 1 ? (['chain-reaction'] as const) : []),
    ...(all ? (['signal-room'] as const) : []),
  ]);
}

/** A free or sandbox message with more than one machine still counts as a chain. */
export function recordChain(records: Records, steps: number): Update {
  return earn(records, steps > 1 ? ['chain-reaction'] : []);
}

/** A Daily Signal; returns whether it was the first today, which is the one that counts. */
export function recordDaily(records: Records, dateKey: string): Update & { first: boolean } {
  const first = !records.dailies.includes(dateKey);
  const dailies = first ? [...records.dailies, dateKey].slice(-60) : records.dailies;
  const update = earn({ ...records, dailies }, dailies.length >= 7 ? ['daily-regular'] : []);
  return { ...update, first };
}

/** The message to open next: the first in the campaign without stars recorded. */
export function nextMessageId(records: Records): string | null {
  for (const chapter of CHAPTERS) {
    for (const message of chapter.messages) if (!(message.id in records.stars)) return message.id;
  }
  return null;
}

/** Messages are opened in order: a message is open once the one before it has been read. */
export function isOpen(records: Records, id: string): boolean {
  const all = CHAPTERS.flatMap((chapter) => chapter.messages.map((message) => message.id));
  const index = all.indexOf(id);
  return index === 0 || (index > 0 && all[index - 1]! in records.stars);
}

export function totalStars(records: Records): number {
  return Object.values(records.stars).reduce((sum, n) => sum + n, 0);
}
