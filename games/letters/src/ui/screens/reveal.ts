import type { GameResult, ResultReceipt } from '@usr-games/kit';
import type { Deal } from '../../engine/deal';
import { HUNTERS } from '../../engine/hunter';
import { coverage, multiplierFor, percent } from '../../engine/score';
import type { BoardWord } from '../../engine/solver';
import type { RoundPlan } from '../../game/modes';
import {
  addToBook,
  duelWon,
  readingLevel,
  recordRound,
  type RoundOutcome,
} from '../../game/records';
import { dailyShareText } from '../../game/share';
import type { App, Screen, ScreenFactory } from '../app';
import { h, text } from '../dom';
import { type RevealList, type RevealSummary, RevealView } from '../reveal-view';

/**
 * After the bell: the round is filed in the records and the word book, reported to the Hall,
 * and shown as the reveal. Play again deals a fresh board for the same plan (the Daily Grid
 * replays its own board, as practice).
 */
export function revealScreen(
  plan: RoundPlan,
  deal: Deal,
  outcome: RoundOutcome,
  first?: RoundOutcome,
): ScreenFactory {
  return (app) => {
    const receipt = file(app, plan, outcome, first);
    const summary = summarise(deal, outcome, first);
    const again = () =>
      app.go.play({ ...plan, seed: plan.mode === 'daily' ? plan.seed : freshSeed(plan.seed) });
    const view = new RevealView(app.board, app.palette, app.reducedMotion, summary, {
      playAgain: again,
      gameMenu: () => app.go.title(),
      hall: () => app.context.navigate('hall'),
    });
    const foundSet = new Set(
      [...outcome.found, ...(first?.found ?? [])].map((entry) => entry.word),
    );
    const hunted = new Set(outcome.hunter?.finds.map((find) => find.word) ?? []);
    app.board.setTrace([]);
    app.board.setHints([]);
    app.board.setGuide(null);
    app.board.setDimmed(0);
    app.board.showWeb(
      deal.words.map((word) => ({
        path: word.path,
        found: foundSet.has(word.word),
        ghost: hunted.has(word.word),
      })),
    );
    app.sounds.reveal();
    addNotes(app, view.notes, plan, outcome, receipt);
    const screen: Screen = {
      element: view.element,
      onKey: (event) => {
        const key = event.key.toLowerCase();
        if (key === 'r') again();
        else if (key === 'h') app.context.navigate('hall');
        else return false;
        return true;
      },
      onLook: (palette, reducedMotion) => view.setLook(palette, reducedMotion),
      focus: () => view.focus(),
      destroy: () => view.destroy(),
    };
    return screen;
  };
}

function freshSeed(seed: string): string {
  return `${seed.replace(/#\d+$/, '')}#${Math.floor(Math.random() * 1e9)}`;
}

/** Records, word book, packages and the Hall's result, once per round. */
function file(
  app: App,
  plan: RoundPlan,
  outcome: RoundOutcome,
  first?: RoundOutcome,
): ResultReceipt {
  const dateKey = plan.dateKey ?? app.context.daily.dateKey();
  const before = app.records();
  const { records, earned } = recordRound(before, outcome, dateKey);
  app.keep(records, earned);
  const allFound = [...outcome.found, ...(first?.found ?? [])];
  const { book, added } = addToBook(app.book(), allFound);
  if (added.length > 0) app.saves.book.save(book);
  return app.report(
    resultFor(plan, outcome, first, added.filter((word) => word.tier === 3).length),
  );
}

function resultFor(
  plan: RoundPlan,
  outcome: RoundOutcome,
  first: RoundOutcome | undefined,
  newVeryRare: number,
): Omit<GameResult, 'presentation'> {
  const share = coverage(outcome.found.length, outcome.total);
  const xpEvents: { id: string; xp: number }[] = [];
  const long = outcome.found.filter((entry) => entry.word.length >= 7).length;
  if (long > 0) xpEvents.push({ id: 'long-words', xp: Math.min(12, long * 4) });
  if (share >= 0.25) xpEvents.push({ id: 'coverage', xp: share >= 0.5 ? 12 : 6 });
  if (newVeryRare > 0) xpEvents.push({ id: 'very-rare', xp: Math.min(10, newVeryRare * 5) });
  let result: GameResult['outcome'] = 'complete';
  if (plan.mode === 'duel' && outcome.hunter) {
    result = duelWon(outcome) ? 'win' : outcome.score === outcome.hunter.score ? 'draw' : 'loss';
  }
  const words = outcome.found.length + (first?.found.length ?? 0);
  return {
    outcome: result,
    score: Math.max(outcome.score, first?.score ?? 0),
    stats: {
      wordsFound: words,
      longWords: [...outcome.found, ...(first?.found ?? [])].filter(
        (entry) => entry.word.length >= 6,
      ).length,
      coverage: percent(share),
    },
    xpEvents,
    daily: plan.mode === 'daily',
    durationSeconds: Math.round(outcome.elapsed + (first?.elapsed ?? 0)),
  };
}

function asWords(found: RoundOutcome['found']): BoardWord[] {
  return found.map((entry) => ({ word: entry.word, path: [...entry.path], tier: entry.tier }));
}

function byLength(a: BoardWord, b: BoardWord): number {
  return b.word.length - a.word.length || (a.word < b.word ? -1 : 1);
}

function summarise(deal: Deal, outcome: RoundOutcome, first?: RoundOutcome): RevealSummary {
  const plan = outcome.plan;
  const mine = asWords(outcome.found).sort(byLength);
  const theirs = first ? asWords(first.found).sort(byLength) : [];
  const seen = new Set([...mine, ...theirs].map((word) => word.word));
  const hidden = deal.words.filter((word) => !seen.has(word.word));
  const share = coverage(mine.length, outcome.total);
  const lists: RevealList[] = [];
  const stats = [
    { label: 'Words', value: `${mine.length} of ${outcome.total}` },
    { label: 'Score', value: String(outcome.score) },
    { label: 'Best chain', value: outcome.bestChain > 1 ? `×${outcome.bestChain}` : '—' },
  ];
  let banner: string | undefined;
  let foundLabel = 'Your words';
  let ghostLabel: string | undefined;
  if (plan.mode === 'pass' && first) {
    const players = plan.players ?? ['Player 1', 'Player 2'];
    lists.push(
      { id: 'second', label: players[1], words: mine },
      { id: 'first', label: players[0], words: theirs },
      { id: 'hidden', label: 'Still hidden', words: hidden },
    );
    const a = coverage(first.found.length, first.total);
    const b = share;
    banner =
      a === b && first.score === outcome.score
        ? `${players[0]} and ${players[1]} tie at ${percent(a)}% each`
        : `${players[0]} ${percent(a)}% · ${first.score} points  —  ${players[1]} ${percent(b)}% · ${outcome.score} points`;
    stats.push({ label: players[0], value: `${first.found.length} words` });
    foundLabel = 'Words either of you found';
  } else if (plan.mode === 'duel' && outcome.hunter) {
    const hunter = HUNTERS[outcome.hunter.strength];
    const hunterWords = deal.words.filter((word) =>
      outcome.hunter!.finds.some((find) => find.word === word.word),
    );
    lists.push(
      { id: 'hidden', label: 'Still hidden', words: hidden },
      { id: 'yours', label: 'Yours', words: mine },
      { id: 'hunter', label: hunter.name, words: hunterWords },
    );
    const verdict = duelWon(outcome)
      ? 'You out-read'
      : outcome.score === outcome.hunter.score
        ? 'A draw with'
        : 'Beaten this time by';
    banner = `${verdict} the ${hunter.name}: ${outcome.score} to ${outcome.hunter.score}`;
    stats.push({ label: hunter.name, value: `${outcome.hunter.finds.length} words` });
    ghostLabel = `The ${hunter.name}'s words`;
  } else {
    lists.push(
      { id: 'hidden', label: 'Still hidden', words: hidden },
      { id: 'yours', label: 'Yours', words: mine },
    );
  }
  return {
    heading:
      plan.mode === 'daily' ? `Daily Grid #${plan.dailyNumber ?? ''}` : 'Every word on the board',
    banner,
    share,
    stats: [...stats, { label: 'Best word', value: mine[0]?.word.toUpperCase() ?? '—' }].slice(
      0,
      4,
    ),
    longestHidden: hidden[0] ?? null,
    lists,
    foundLabel,
    ghostLabel,
  };
}

/** The XP line, the Daily share, the level change and, after the tutorial, a closing word. */
function addNotes(
  app: App,
  notes: HTMLElement,
  plan: RoundPlan,
  outcome: RoundOutcome,
  receipt: ResultReceipt,
) {
  const lines: HTMLElement[] = [];
  if (receipt.xpGained > 0)
    lines.push(h('p', { class: 'chl-note chl-note--xp' }, `+${receipt.xpGained} XP`));
  const level = readingLevel(app.records());
  if (level !== null)
    lines.push(h('p', { class: 'chl-note' }, `Board-reading level ${percent(level)}%`));
  if (plan.mode === 'daily' && plan.dateKey) {
    const record = app.records().dailies[plan.dateKey];
    const replay = record && record.found !== outcome.found.length;
    if (record) {
      const status = h('span', { class: 'chl-note__status', role: 'status' });
      const share = h(
        'button',
        {
          class: 'chl-button chl-share',
          type: 'button',
          'data-testid': 'chl-share',
          onclick: () =>
            void app.context
              .share(
                dailyShareText(
                  plan.dailyNumber ?? 0,
                  record,
                  app.context.settings().colorBlindPalette,
                ),
              )
              .then((how) =>
                text(
                  status,
                  how === 'copied'
                    ? 'Copied'
                    : how === 'shared'
                      ? 'Shared'
                      : 'Sharing is not available here',
                ),
              ),
        },
        replay ? 'Share your first try' : 'Share',
      );
      lines.push(h('p', { class: 'chl-note' }, share, status));
    }
  }
  if (plan.mode === 'tutorial') {
    lines.push(
      h(
        'p',
        { class: 'chl-note chl-note--coach' },
        'This is every word the board held. Your share of them is the number to beat, round after round.',
      ),
    );
  }
  if (outcome.bestChain >= 3)
    lines.push(h('p', { class: 'chl-note' }, `Chain of ×${multiplierFor(3)}`));
  notes.replaceChildren(...lines);
}
