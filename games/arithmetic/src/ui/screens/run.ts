import type { ResultReceipt, XpEvent } from '@usr-games/kit';
import { CHAPTERS, chapterStars, type StarCheck, starCount } from '../../engine/chapters';
import { shareLine } from '../../engine/daily';
import type { EventSpec } from '../../engine/events';
import type { PackageId } from '../../game/packages';
import { noteChapter, noteDaily, noteEvent } from '../../game/records';
import type { App, ScreenFactory } from '../app';
import type { EventOutcome, EventScreenOptions, RunPlan } from '../flow';
import { introScreen } from './intro';
import { resultsScreen } from './results';
import { sieveScreen } from './sieve';
import { spellScreen } from './spell';
import { splitScreen } from './split';
import { customLevel, sumsScreen } from './sums';

/**
 * A run: its events in order, each behind a short card, then the results. The run keeps score,
 * notes bests and stars, installs what was earned and reports once to the Hall at the end.
 */

export interface RunSummary {
  readonly plan: RunPlan;
  readonly outcomes: readonly EventOutcome[];
  readonly bests: readonly string[];
  readonly installed: readonly PackageId[];
  readonly stars: StarCheck | null;
  readonly share: string | null;
  readonly receipt: ResultReceipt;
  readonly score: number;
}

function screenFor(spec: EventSpec): (options: EventScreenOptions) => ScreenFactory {
  switch (spec.mode) {
    case 'sums':
      return sumsScreen;
    case 'split':
      return splitScreen;
    case 'sieve':
      return sieveScreen;
    case 'spell':
      return spellScreen;
  }
}

const BEST_NAMES: Record<EventSpec['mode'], string> = {
  sums: 'Quick Sums',
  split: 'Split',
  sieve: 'Sieve',
  spell: 'Spell It',
};

export function startRun(app: App, plan: RunPlan) {
  const outcomes: EventOutcome[] = [];
  const bests: string[] = [];
  const installed = new Set<PackageId>();
  const startedAt = performance.now();

  const install = (earned: readonly PackageId[]) => {
    for (const id of earned) if (app.context.installPackage(id)) installed.add(id);
  };

  function playEvent(index: number) {
    const spec = plan.events[index]!;
    const custom =
      spec.mode === 'sums' && spec.level === 'custom' ? app.saves.prefs.load().custom : null;
    const levelName = custom ? customLevel(custom.ops, custom.range).name : null;
    const options: EventScreenOptions = {
      plan,
      index,
      spec,
      seed: `${plan.seed}:event-${index}`,
      onDone: (outcome) => done(index, outcome),
    };
    app.show(introScreen(plan, index, levelName, () => app.show(screenFor(spec)(options))));
  }

  function done(index: number, outcome: EventOutcome) {
    const noted = noteEvent(
      app.saves.records.load(),
      outcome.result,
      outcome.detail,
      outcome.rungKey,
    );
    app.saves.records.save(noted.records);
    install(noted.earned);
    if (noted.personalBest) bests.push(BEST_NAMES[outcome.result.spec.mode]);
    outcomes.push(outcome);
    if (index + 1 < plan.events.length) playEvent(index + 1);
    else finish();
  }

  function finish() {
    const results = outcomes.map((outcome) => outcome.result);
    const score = results.reduce((sum, r) => sum + r.score, 0);
    let stars: StarCheck | null = null;
    let share: string | null = null;
    const xpEvents: XpEvent[] = [];
    if (plan.kind === 'chapter' && plan.chapterId) {
      const chapter = CHAPTERS.find((c) => c.id === plan.chapterId)!;
      stars = chapterStars(chapter, results, plan.tempo);
      const noted = noteChapter(
        app.saves.records.load(),
        chapter.id,
        starCount(stars),
        plan.tempo,
        score,
      );
      app.saves.records.save(noted.records);
      install(noted.earned);
      if (starCount(stars) === 3) xpEvents.push({ id: 'three-stars', xp: 10 });
    }
    if (plan.kind === 'daily' && plan.dailyKey && plan.dailyNumber !== undefined) {
      share = shareLine(plan.dailyNumber, results);
      if (!plan.practice) {
        const noted = noteDaily(app.saves.records.load(), plan.dailyKey, { score, line: share });
        app.saves.records.save(noted.records);
        install(noted.earned);
        if (noted.personalBest) bests.push('Daily');
      }
    }
    if (bests.length > 0) xpEvents.push({ id: 'personal-best', xp: 10 });
    if (
      outcomes.some(
        (o) => o.detail.mode === 'sums' && o.detail.firstTries === o.detail.splits.length,
      )
    ) {
      xpEvents.push({ id: 'perfect-block', xp: 8 });
    }
    const count = (mode: EventSpec['mode']) =>
      outcomes
        .filter((o) => o.result.spec.mode === mode)
        .reduce((sum, o) => sum + o.result.items, 0);
    const receipt = app.report({
      outcome: 'win',
      score,
      stats: {
        sumsSolved: count('sums'),
        numbersSplit: count('split'),
        boardsCleared: count('sieve'),
        wordsDone: count('spell'),
      },
      xpEvents,
      daily: plan.kind === 'daily' && !plan.practice,
      durationSeconds: Math.round((performance.now() - startedAt) / 1000),
    });
    app.show(
      resultsScreen({
        plan,
        outcomes,
        bests,
        installed: [...installed],
        stars,
        share,
        receipt,
        score,
      }),
    );
  }

  playEvent(0);
}
