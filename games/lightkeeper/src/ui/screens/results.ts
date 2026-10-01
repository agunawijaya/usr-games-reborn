import type { ShareCell } from '@usr-games/kit';
import { EMERITUS_TITLE, rankById } from '../../engine/params';
import {
  cleanRecord,
  lights,
  lightsKept,
  PROMOTION_SCORE,
  type ScoreLineId,
  scoreSheet,
} from '../../engine/score';
import { ChartView } from '../../render/chart-view';
import type { App, Ending, Screen } from '../app';
import { days, LOSS_LINES, power } from '../copy';
import { button, h } from '../dom';
import { insignia } from './insignia';

/**
 * The end of a watch: the lights as they really stand, the original's score sheet line by
 * line, the clean-record check for a promotion, and the way on (play again, the game menu,
 * the Hall). Keys follow the Hall's results order: R, then H.
 */

const LINE_LABELS: Record<ScoreLineId, (amount: number) => string> = {
  stopped: (n) => `${n} ${n === 1 ? 'gleaner' : 'gleaners'} stopped`,
  pace: (n) => `Pace: ${n.toFixed(2)} a day`,
  'still-out': (n) => `${n} still out there`,
  won: (n) => `Watch kept at rank ${n}`,
  'lost-ship': () => 'The ship was lost',
  'harbours-lost': (n) => `${n} ${n === 1 ? 'harbour' : 'harbours'} lost to your own fire`,
  'beacon-calls': (n) => `${n} ${n === 1 ? 'call' : 'calls'} for a harbour’s beacon`,
  'stars-lost': (n) => `${n} ${n === 1 ? 'star' : 'stars'} spent`,
  'worlds-lost': (n) => `${n} ${n === 1 ? 'world' : 'worlds'} lost to your own fire`,
  ember: () => 'Finished aboard the Ember',
  salvage: (n) => `${n} ore delivered`,
  injured: (n) => `${n} crew hurt`,
};

const CHECKS: Record<keyof ReturnType<typeof cleanRecord>, string> = {
  noBeacon: 'No beacon calls',
  noHarbourLost: 'No harbour lost to your fire',
  noWorldLost: 'No world lost to your fire',
  carefulWithStarsAndCrew: 'Few stars spent, few crew hurt',
  sameShip: 'Home in the Lantern',
};

export function resultsScreen(app: App, ending: Ending): Screen {
  const s = ending.state;
  const outcome = s.outcome!;
  const won = outcome.kind === 'won';
  const sheet = scoreSheet(s);
  const kept = lightsKept(s);
  const record = cleanRecord(s);
  const elapsed = s.now.date - s.params.date;
  const career = app.saves.career.load();

  const headline = won
    ? 'The Reach is safe'
    : outcome.kind === 'ended'
      ? 'Watch ended'
      : LOSS_LINES[outcome.reason].title;
  const lede = won
    ? `Every gleaner stopped in ${days(elapsed)}, with ${kept} of 32 lights still burning.`
    : outcome.kind === 'ended'
      ? `You stood the watch down ${elapsed < 0.1 ? 'before the first day was out' : `after ${days(elapsed)}`}. ${s.now.gleaners} gleaners are still out there.`
      : LOSS_LINES[outcome.reason].line;

  const chart = h('canvas', {
    class: 'lk-results__chart',
    'aria-label': `Chart of the Reach: ${kept} of 32 lights kept.`,
    role: 'img',
  });
  const chartBox = h('div', { class: 'lk-results__chart-box' }, chart);
  const view = new ChartView(chart, app.look, true);
  view.truth = true;
  view.show(s);

  const sheetList = h(
    'ol',
    { class: 'lk-sheetlines', dataset: { testid: 'lk-score-lines' } },
    ...sheet.lines.map((line, i) =>
      h(
        'li',
        { style: `--i:${i}` },
        h('span', {}, LINE_LABELS[line.id](line.amount)),
        h(
          'b',
          { dataset: { sign: line.points >= 0 ? 'plus' : 'minus' } },
          `${line.points >= 0 ? '+' : '−'}${power(Math.abs(line.points))}`,
        ),
      ),
    ),
    h(
      'li',
      { class: 'lk-sheetlines__total' },
      h('span', {}, 'Total'),
      h('b', { dataset: { testid: 'lk-score-total' } }, power(sheet.total)),
    ),
  );

  let promotion: HTMLElement | null = null;
  if (ending.watch.kind === 'commission' && outcome.kind !== 'ended') {
    const rank = ending.watch.rank;
    const nextTitle = rank < 6 ? rankById(rank + 1).title : EMERITUS_TITLE;
    const checks = h(
      'ul',
      { class: 'lk-checks' },
      h('li', { dataset: { ok: String(won) } }, 'The watch kept'),
      h(
        'li',
        { dataset: { ok: String(sheet.total >= PROMOTION_SCORE) } },
        `${PROMOTION_SCORE.toLocaleString('en')} points or more`,
      ),
      ...Object.entries(record).map(([key, ok]) =>
        h('li', { dataset: { ok: String(ok) } }, CHECKS[key as keyof typeof CHECKS]),
      ),
    );
    promotion = h(
      'section',
      {
        class: `lk-promotion${ending.promoted ? ' is-promoted' : ''}`,
        dataset: { testid: 'lk-promotion' },
      },
      ending.promoted ? insignia(rank === 6 ? 6 : ((rank + 1) as typeof rank), rank === 6) : null,
      h(
        'div',
        {},
        h(
          'h3',
          {},
          ending.promoted
            ? `Promoted: ${nextTitle}!`
            : career.rank !== rank
              ? 'A practice watch'
              : `Towards ${nextTitle}`,
        ),
        h(
          'p',
          {},
          ending.promoted
            ? rank === 6
              ? 'The original saved its rarest line for this: you are a Warden Emeritus.'
              : `Your next watch is at ${nextTitle}’s rules.`
            : career.rank !== rank
              ? 'Promotions come at your own rank.'
              : 'A promotion needs every mark below.',
        ),
        checks,
      ),
    );
  }

  const receipt = ending.receipt;
  const xp =
    receipt && receipt.xpGained > 0
      ? h(
          'span',
          { class: 'lk-results__xp' },
          `+${receipt.xpGained} XP${receipt.rankChange ? ` · Hall rank: ${receipt.rankChange.to}` : ''}`,
        )
      : null;

  const shareButton =
    ending.watch.kind === 'daily'
      ? button('Share tonight’s watch', {
          onClick: () => {
            const all = lights(s, true);
            const cells: ShareCell[] = all.map((l) =>
              l.state === 'lost' ? 'special' : l.state === 'dark' ? 'miss' : 'near',
            );
            const grid = [0, 1, 2, 3].map((row) => cells.slice(row * 8, row * 8 + 8));
            void app.context.share({
              title: 'Lightkeeper',
              daily: app.context.daily.dateKey(),
              headline: won ? `${kept}/32 lights kept` : `${kept}/32 lights, swarm unbroken`,
              grid,
              lines: [
                `${s.tally.stopped} gleaners stopped in ${days(elapsed)} · ${sheet.total} points`,
              ],
            });
          },
          variant: 'quiet',
          testId: 'lk-share',
        })
      : null;

  const playAgain = () => {
    if (ending.watch.kind === 'commission') {
      app.go.briefing({ kind: 'commission', rank: app.saves.career.load().rank });
    } else app.go.briefing(ending.watch);
  };

  const element = h(
    'section',
    { class: `lk-screen lk-results${won ? ' is-won' : ''}`, dataset: { testid: 'lk-results' } },
    h(
      'div',
      { class: 'lk-results__main' },
      h('p', { class: 'lk-kicker' }, won ? 'Watch kept' : 'Watch over'),
      h('h2', { class: 'lk-results__title' }, headline),
      h('p', { class: 'lk-results__lede' }, lede),
      h(
        'p',
        { class: 'lk-results__lights', dataset: { testid: 'lk-lights-kept' } },
        h('b', {}, `${kept}`),
        ' of 32 lights kept',
        xp,
      ),
      h(
        'div',
        { class: 'lk-results__actions' },
        button(ending.watch.kind === 'commission' ? 'Next watch' : 'Play again', {
          onClick: playAgain,
          key: 'R',
          variant: 'primary',
          testId: 'lk-again',
          autofocus: true,
        }),
        button('Game menu', { onClick: () => app.go.title(), testId: 'lk-results-menu' }),
        button('Back to the Hall', {
          onClick: () => app.context.navigate('hall'),
          key: 'H',
          testId: 'lk-results-hall',
        }),
        shareButton,
      ),
      sheetList,
    ),
    h('div', { class: 'lk-results__side' }, chartBox, promotion),
  );

  const observer = new ResizeObserver(() => {
    view.resize(chartBox.clientWidth, chartBox.clientHeight);
    view.draw();
  });
  observer.observe(chartBox);

  return {
    element,
    onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (event.key.toLowerCase() === 'r') {
        playAgain();
        return true;
      }
      if (event.key.toLowerCase() === 'h') {
        app.context.navigate('hall');
        return true;
      }
      return false;
    },
    onLook(look) {
      view.setLook(look, true);
      view.draw();
    },
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
    destroy: () => observer.disconnect(),
  };
}
