import {
  CAREER_TUNING,
  commissionDays,
  EMERITUS_TITLE,
  RANKS,
  rankById,
  skillFor,
} from '../../engine/params';
import { PROMOTION_SCORE } from '../../engine/score';
import type { RankId } from '../../engine/types';
import { NIGHT_RANK, type WatchKind } from '../../game/saves';
import type { App, Screen } from '../app';
import { STANDING_ORDERS } from '../copy';
import { button, h } from '../dom';
import { insignia } from './insignia';

/**
 * Before a watch: who you are, what this rank adds, and what earns the next one. Tonight's
 * watch and open watches get a shorter card with their own rules.
 */
export function briefingScreen(app: App, watch: WatchKind): Screen {
  const rank: RankId = watch.kind === 'daily' ? NIGHT_RANK : watch.rank;
  const title = rankById(rank).title;
  const begin = () => {
    if (watch.kind === 'commission') {
      app.saves.career.update((career) =>
        career.briefed.includes(rank) ? career : { ...career, briefed: [...career.briefed, rank] },
      );
    }
    app.go.play(watch);
  };

  const body: (HTMLElement | null)[] = [];
  if (watch.kind === 'commission') {
    const orders = STANDING_ORDERS[rank];
    const career = app.saves.career.load();
    const next = rank < 6 ? rankById(rank + 1).title : EMERITUS_TITLE;
    const atOwnRank = career.rank === rank && !career.emeritus;
    const skill = skillFor('commission', rank);
    const gleaners = Math.trunc(skill * 5) + CAREER_TUNING.extraGleaners;
    body.push(
      h('p', { class: 'lk-brief__intro' }, orders.intro),
      h('h3', {}, rank === 1 ? 'Standing orders' : 'New at this rank'),
      h('ul', { class: 'lk-brief__orders' }, ...orders.added.map((line) => h('li', {}, line))),
      h(
        'dl',
        { class: 'lk-brief__facts' },
        h(
          'div',
          {},
          h('dt', {}, 'Clock'),
          h(
            'dd',
            {},
            `${commissionDays(rank, 1)} days of reserve, more with every gleaner stopped`,
          ),
        ),
        h('div', {}, h('dt', {}, 'Swarm'), h('dd', {}, `about ${gleaners} gleaners or more`)),
        h('div', {}, h('dt', {}, 'Harbours'), h('dd', {}, rank === 6 ? 'one' : `${2}–${7 - rank}`)),
      ),
      h(
        'p',
        { class: 'lk-brief__goal' },
        atOwnRank
          ? `A win worth ${PROMOTION_SCORE.toLocaleString('en')} points with a clean record makes you ${next}. Clean means no call for a harbour’s beacon, no harbour or world lost to your own fire, few stars spent, few crew hurt, and the Lantern brought home.`
          : 'Promotions come at your own rank; this watch is for practice and the record.',
      ),
    );
  } else if (watch.kind === 'daily') {
    body.push(
      h(
        'p',
        { class: 'lk-brief__intro' },
        `The same Reach for every keeper tonight, at ${title}’s rules. The original called this a tournament: the same code gives the same galaxy.`,
      ),
      h(
        'ul',
        { class: 'lk-brief__orders' },
        ...STANDING_ORDERS[1].added
          .concat(STANDING_ORDERS[2].added, STANDING_ORDERS[3].added)
          .map((line) => h('li', {}, line)),
      ),
    );
  } else {
    const rules =
      watch.ruleSet === 'classic'
        ? 'the 1976 rules: every event from the first watch, at the original numbers'
        : `the career’s rules for a ${title}`;
    body.push(
      h(
        'p',
        { class: 'lk-brief__intro' },
        `Code “${watch.code || 'none'}”, ${title} (${rankById(rank).originalLevel} in the original), a ${watch.length === 1 ? 'short' : watch.length === 2 ? 'medium' : 'long'} watch, with ${rules}.`,
      ),
      h('p', {}, 'Anyone who types the same code and settings gets the same Reach.'),
    );
  }

  const element = h(
    'section',
    {
      class: 'lk-screen lk-brief',
      'aria-labelledby': 'lk-brief-title',
      dataset: { testid: 'lk-brief' },
    },
    h(
      'div',
      { class: 'lk-brief__card' },
      h(
        'header',
        { class: 'lk-brief__head' },
        insignia(rank),
        h(
          'div',
          {},
          h(
            'p',
            { class: 'lk-kicker' },
            watch.kind === 'commission'
              ? `Rank ${rank} of ${RANKS.length}`
              : watch.kind === 'daily'
                ? `Tonight’s watch #${watch.number}`
                : 'Open watch',
          ),
          h(
            'h2',
            { id: 'lk-brief-title' },
            watch.kind === 'commission'
              ? title
              : watch.kind === 'daily'
                ? 'Tonight’s watch'
                : 'Open watch',
          ),
        ),
      ),
      ...body,
      h(
        'div',
        { class: 'lk-brief__actions' },
        button('Begin the watch', {
          onClick: begin,
          key: 'Enter',
          variant: 'primary',
          testId: 'lk-begin',
          autofocus: true,
        }),
        button('Game menu', {
          onClick: () => app.go.title(),
          variant: 'quiet',
          testId: 'lk-brief-back',
        }),
      ),
    ),
  );

  return {
    element,
    onKey(event) {
      if (event.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') {
        begin();
        return true;
      }
      return false;
    },
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
