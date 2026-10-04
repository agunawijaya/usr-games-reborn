import type { ResultReceipt } from '@usr-games/kit';
import { type Battle, createBattle } from '../engine';
import { dailyEncounter, dailyRating, practiceEncounter } from '../voyage/daily';
import type { Encounter } from '../voyage/encounters';
import {
  chapterRenown,
  closeChapter,
  lifeEncounter,
  type ChapterOutcome,
  type PrizeVerdict,
  prizeVerdict,
  readBattle,
} from '../voyage/life';
import { emptyTally, type Tally } from '../voyage/tally';
import type { ChapterRecord, Life } from '../voyage/types';
import type { App } from '../ui/app';
import type { ActiveBattle, Counts, Memory, Mode } from './saves';

/**
 * The thread from a choice on the menu to a battle and back: building the encounter for each
 * mode, keeping a battle in progress saved, and settling it at the end with the Hall (result,
 * packages) and with her life (the chapter written into the log).
 */

export function encounterFor(app: App, mode: Mode): Encounter {
  switch (mode.kind) {
    case 'voyage': {
      const life = app.saves.life.load();
      if (!life) throw new Error('no ship at sea');
      return lifeEncounter(life, mode.option);
    }
    case 'daily':
      return dailyEncounter(app.context.daily.seed());
    case 'open':
      return practiceEncounter(mode.practice);
  }
}

export function startBattle(app: App, mode: Mode): ActiveBattle {
  const encounter = encounterFor(app, mode);
  const active: ActiveBattle = {
    mode,
    battle: createBattle(encounter.setup),
    tally: emptyTally(),
    startedAt: Date.now(),
    log: [],
  };
  app.saves.active.save(active);
  return active;
}

/** Packages that can be earned in the middle of a battle, the moment they happen. */
export function checkBattlePackages(app: App, tally: Tally): void {
  if (tally.rakes > 0) app.install('raking-fire');
  if (tally.dismasted.length > 0) app.install('bare-poles');
  if (tally.signals > 0) app.install('signal-flying');
}

function bumpCounts(app: App, outcome: ChapterOutcome, verdicts: readonly PrizeVerdict[]): Counts {
  const home = outcome.prizes.filter((_, i) => verdicts[i] === 'home' || verdicts[i] === 'serve');
  return app.saves.counts.update((c) => ({
    ...c,
    battles: c.battles + 1,
    wins: c.wins + (outcome.win === true ? 1 : 0),
    prizes: c.prizes + home.length,
    wholePrizes: c.wholePrizes + home.filter((p) => p.condition === 'whole').length,
    broadsides: c.broadsides + outcome.tally.broadsides,
    rakes: c.rakes + outcome.tally.rakes,
    mentions: c.mentions + outcome.mentions.filter((m) => m.earned).length,
  }));
}

function reportBattle(
  app: App,
  outcome: ChapterOutcome,
  verdicts: readonly PrizeVerdict[],
  score: number,
  daily: boolean,
  durationSeconds: number,
): ResultReceipt {
  const home = outcome.prizes.filter((_, i) => verdicts[i] === 'home' || verdicts[i] === 'serve');
  const mentions = outcome.mentions.filter((m) => m.earned).length;
  const xpEvents = [
    ...home.slice(0, 3).map((_, i) => ({ id: `prize-${i + 1}`, xp: 8 })),
    ...(mentions ? [{ id: 'mentions', xp: mentions * 2 }] : []),
  ];
  return app.report({
    outcome: outcome.win === true ? 'win' : outcome.win === false ? 'loss' : 'draw',
    score,
    stats: {
      prizes: home.length,
      broadsides: outcome.tally.broadsides,
      mentions,
      rakes: outcome.tally.rakes,
    },
    xpEvents,
    daily,
    durationSeconds,
  });
}

export function outcomeOf(app: App, active: ActiveBattle): ChapterOutcome {
  const encounter = encounterFor(app, active.mode);
  const life = active.mode.kind === 'voyage' ? app.saves.life.load() : null;
  return readBattle(life, encounter, active.battle, active.tally);
}

/** Today's Weather and open water end at the battle: prizes count as brought home. */
export function settleQuick(
  app: App,
  active: ActiveBattle,
  outcome: ChapterOutcome,
): { receipt: ResultReceipt; score: number } {
  const verdicts: PrizeVerdict[] = outcome.prizes.map(() => 'home');
  const daily = active.mode.kind === 'daily';
  const score = daily ? dailyRating(outcome) : chapterRenown(outcome, verdicts);
  const seconds = Math.round((Date.now() - active.startedAt) / 1000);
  bumpCounts(app, outcome, verdicts);
  if (outcome.prizes.length) app.install('first-prize');
  if (outcome.prizes.some((p) => p.condition === 'whole')) app.install('taken-whole');
  if (daily && active.mode.kind === 'daily') {
    const key = active.mode.dateKey;
    const days = app.saves.days.load();
    // The first engagement of the day is the one on record.
    if (!days[key]) {
      app.saves.days.save({
        ...days,
        [key]: {
          rating: score,
          won: outcome.win === true,
          mentions: outcome.mentions.map((m) => m.earned),
          kind: outcome.encounter.kind,
        },
      });
    }
    if (outcome.win) app.install('fair-weather');
  }
  const receipt = reportBattle(app, outcome, verdicts, score, daily, seconds);
  app.saves.active.save(null);
  return { receipt, score };
}

/** A voyage chapter, once the prize crews are chosen: written into her life for good. */
export function settleChapter(
  app: App,
  active: ActiveBattle,
  outcome: ChapterOutcome,
  battle: Battle,
  sent: readonly number[],
): { life: Life; record: ChapterRecord; receipt: ResultReceipt } {
  const before = app.saves.life.load()!;
  const { life, record } = closeChapter(before, outcome, battle, sent);
  const verdicts = outcome.prizes.map((p, i) => prizeVerdict(p, sent[i] ?? 0));
  bumpCounts(app, outcome, verdicts);
  app.saves.life.save(life);
  app.install('maiden-cruise');
  if (record.prizes.some((p) => p.fate === 'squadron' || p.fate === 'dockyard'))
    app.install('first-prize');
  if (
    record.prizes.some(
      (p) => p.condition === 'whole' && (p.fate === 'squadron' || p.fate === 'dockyard'),
    )
  ) {
    app.install('taken-whole');
  }
  if (record.events.some((e) => e.kind === 'captain-made')) app.install('captain-made');
  if (record.events.some((e) => e.kind === 'retaken')) app.install('brought-home');
  if (life.crew.qual >= 4) app.install('old-hands');
  if (life.crew.qual >= 5) app.install('best-crew-afloat');
  if (life.ending) {
    app.install('full-life');
    remember(app, life);
  }
  const seconds = Math.round((Date.now() - active.startedAt) / 1000);
  const receipt = reportBattle(app, outcome, verdicts, record.renown, false, seconds);
  app.saves.active.save(null);
  return { life, record, receipt };
}

function remember(app: App, life: Life): void {
  const memory: Memory = {
    id: life.id,
    shipName: life.shipName,
    hull: life.hull,
    figurehead: life.figurehead,
    captain: life.captain,
    startedOn: life.startedOn,
    endedOn: app.context.daily.dateKey(),
    ending: life.ending!,
    renown: life.renown,
    chapters: life.records.length,
    prizes: life.records.reduce(
      (n, r) => n + r.prizes.filter((p) => p.fate === 'squadron' || p.fate === 'dockyard').length,
      0,
    ),
    captains: life.records.reduce(
      (n, r) => n + r.events.filter((e) => e.kind === 'captain-made').length,
      0,
    ),
    quality: life.crew.qual,
  };
  app.saves.memories.update((list) =>
    [memory, ...list.filter((m) => m.id !== life.id)].slice(0, 24),
  );
  app.saves.counts.update((c) => ({ ...c, lives: c.lives + 1 }));
}

/** Leave a battle unfinished: it counts as quitting, and it is not kept. */
export function abandonBattle(app: App, active: ActiveBattle): void {
  app.report({
    outcome: 'quit',
    durationSeconds: Math.round((Date.now() - active.startedAt) / 1000),
  });
  app.saves.active.save(null);
}

export { emptyTally };
