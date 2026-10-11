import { CHAPTERS, SECOND_STAR_NAME, starCount } from '../../engine/chapters';
import { eventName, MODE_NAMES } from '../../engine/events';
import { powerText, factorize } from '../../engine/factor';
import { PACKAGES } from '../../game/packages';
import type { App, Screen, ScreenFactory } from '../app';
import { clockText, secondsText } from '../clock';
import { h } from '../dom';
import type { EventOutcome } from '../flow';
import { fitBoardText, place } from '../hud';
import { icon } from '../icons';
import type { RunSummary } from './run';

/**
 * The end of a run: what was done, the timing card the original printed after every twenty
 * problems, stars for a chapter, the share line for the Daily, and the standard ways on:
 * Play again (R) · Game menu · Back to the Hall (H).
 */

function eventLine(outcome: EventOutcome): string {
  const r = outcome.result;
  const time = r.tempo === 'rush' ? ` · ${clockText(r.ms)}` : '';
  switch (r.spec.mode) {
    case 'sums':
      return `${r.clean} of ${r.items} first time${time}`;
    case 'split':
      return `${r.items} numbers · ${r.wrongs} bounce${r.wrongs === 1 ? '' : 's'}${time}`;
    case 'sieve':
      return `${r.clicks ?? 0} picks, par ${r.parClicks ?? 0} · ${r.wrongs} not prime${time}`;
    case 'spell':
      return `${r.clean} of ${r.items} right first time${time}`;
  }
}

/** The original's block card, as a runner's timing card. */
function timingCard(outcome: EventOutcome): HTMLElement | null {
  const card = outcome.card;
  if (!card) return null;
  const rows: [string, string][] = [
    ['Right', String(card.rights)],
    ['Wrong answers', String(card.wrongs)],
    ['Score', `${card.percent} %`],
    ['Time', clockText(card.totalMs)],
    ['A problem', secondsText(card.perProblemMs)],
    ['Fastest', secondsText(card.bestMs)],
  ];
  return h(
    'dl',
    { class: 'ns-timing', 'aria-label': 'Timing card' },
    ...rows.flatMap(([term, value]) => [h('dt', {}, term), h('dd', {}, value)]),
  );
}

export function resultsScreen(summary: RunSummary): ScreenFactory {
  return (app: App): Screen => {
    const { plan } = summary;
    const best = summary.bests.length > 0;
    const again = h(
      'button',
      {
        class: 'ns-button ns-button--primary',
        type: 'button',
        onclick: playAgain,
        'data-testid': 'ns-again',
      },
      'Play again (R)',
    );
    const menu = h(
      'button',
      {
        class: 'ns-button',
        type: 'button',
        onclick: () => app.go.menu(),
        'data-testid': 'ns-results-menu',
      },
      'Game menu',
    );
    const hall = h(
      'button',
      { class: 'ns-button', type: 'button', onclick: () => app.context.navigate('hall') },
      'Back to the Hall (H)',
    );

    const chapterIndex = plan.chapterId ? CHAPTERS.findIndex((c) => c.id === plan.chapterId) : -1;
    const nextChapter = chapterIndex >= 0 ? CHAPTERS[chapterIndex + 1] : undefined;
    const next = nextChapter
      ? h(
          'button',
          {
            class: 'ns-button',
            type: 'button',
            onclick: () => app.go.campaign(),
            'data-testid': 'ns-next-chapter',
          },
          `Next: ${nextChapter.title} (N)`,
        )
      : null;

    const stars = summary.stars
      ? h(
          'ul',
          { class: 'ns-starline', 'aria-label': `${starCount(summary.stars)} of 3 stars` },
          ...(
            [
              [summary.stars.accurate, 'Accurate: 90 % or better'],
              [summary.stars.second, SECOND_STAR_NAME[plan.tempo]],
              [summary.stars.noHints, 'No hints'],
            ] as const
          ).map(([won, name]) =>
            h(
              'li',
              { class: won ? 'ns-starline__star ns-starline__star--won' : 'ns-starline__star' },
              h('span', { 'aria-hidden': 'true' }, '★'),
              ` ${name}`,
            ),
          ),
        )
      : null;

    const events = h(
      'ul',
      { class: 'ns-results__events' },
      ...summary.outcomes.map((outcome) =>
        h(
          'li',
          { class: 'ns-results__event' },
          icon(outcome.result.spec.mode, 'ns-mode__icon'),
          h(
            'div',
            {},
            h(
              'strong',
              {},
              `${MODE_NAMES[outcome.result.spec.mode]} · ${eventName(outcome.result.spec)}`,
            ),
            h('div', { class: 'ns-muted' }, eventLine(outcome)),
          ),
          h('span', { class: 'ns-count' }, outcome.result.score.toLocaleString('en-US')),
        ),
      ),
    );

    const packages = summary.installed
      .map((id) => PACKAGES.find((p) => p.id === id)?.title)
      .filter((title): title is string => Boolean(title));

    const shareButton = summary.share
      ? h(
          'button',
          { class: 'ns-button', type: 'button', onclick: share, 'data-testid': 'ns-share' },
          'Share (S)',
        )
      : null;
    const shareNote = h('span', { class: 'ns-muted', role: 'status' });

    const card = h(
      'section',
      { class: 'ns-card ns-results', 'aria-label': 'Results', 'data-testid': 'ns-results' },
      h(
        'span',
        { class: 'ns-label' },
        plan.kind === 'daily'
          ? plan.practice
            ? 'Daily, practice'
            : 'Daily'
          : plan.kind === 'chapter'
            ? 'Campaign'
            : 'Free play',
      ),
      h('h1', { class: 'ns-card__title' }, plan.title),
      stars,
      events,
      ...summary.outcomes.map(timingCard),
      h(
        'p',
        { class: 'ns-results__total' },
        h('span', {}, 'Score '),
        h('strong', { class: 'ns-count' }, summary.score.toLocaleString('en-US')),
        summary.receipt.xpGained > 0
          ? h('span', { class: 'ns-muted' }, ` · +${summary.receipt.xpGained} XP`)
          : null,
      ),
      best
        ? h('p', { class: 'ns-ribbon' }, `New personal best: ${summary.bests.join(', ')}`)
        : null,
      packages.length > 0
        ? h('p', { class: 'ns-muted' }, `Packages: ${packages.join(', ')}`)
        : null,
      summary.share
        ? h('p', { class: 'ns-shareline', 'data-testid': 'ns-shareline' }, summary.share)
        : null,
      shareButton || next
        ? h('div', { class: 'ns-results__extra' }, shareButton, next, shareNote)
        : null,
      h('div', { class: 'ns-results__actions' }, again, menu, hall),
    );

    const headline = h(
      'div',
      { class: 'ns-board', 'aria-hidden': 'true' },
      h(
        'div',
        { class: 'ns-board__top' },
        best ? 'New best' : plan.kind === 'daily' ? `Daily #${plan.dailyNumber}` : 'Finish',
      ),
      h('div', { class: 'ns-board__problem' }, summary.score.toLocaleString('en-US')),
      h(
        'div',
        { class: 'ns-board__rule' },
        app.look.theme === 'atom' && summary.score > 1
          ? `${summary.score} = ${powerText(factorize(summary.score))}`
          : 'points',
      ),
    );
    const root = h('div', { class: 'ns-menu' }, card, headline);

    app.setScene({ kind: 'finish', featured: summary.score });
    app.cue({ kind: 'finish', personalBest: best });
    app.sounds.finish(best);

    function playAgain() {
      app.go.run({
        ...summary.plan,
        seed: `${summary.plan.seed}+`,
        practice: plan.kind === 'daily' ? true : plan.practice,
      });
    }

    async function share() {
      if (!summary.share) return;
      const outcome = await app.context.share(summary.share);
      shareNote.textContent =
        outcome === 'copied'
          ? 'Copied.'
          : outcome === 'shared'
            ? 'Shared.'
            : 'Sharing is not available here.';
    }

    function layout() {
      const l = app.layout;
      const width = Math.min(l.width * 0.5, 860 * l.s);
      place(card, { x: l.width - width - 40 * l.s, y: Math.max(76, 80 * l.s), w: width, h: 0 });
      card.style.height = 'auto';
      card.style.maxHeight = `${l.height - Math.max(76, 80 * l.s) - 24}px`;
      if (app.look.theme === 'sprint') {
        place(headline, l.board);
        headline.hidden = false;
      } else {
        const { chamber } = l;
        place(headline, {
          x: chamber.x - chamber.r * 1.2,
          y: chamber.y + chamber.r * 1.02,
          w: chamber.r * 2.4,
          h: 120 * l.s,
        });
      }
      fitBoardText(headline);
    }

    return {
      element: root,
      layout: 'results',
      onLayout: layout,
      onKey(event) {
        const key = event.key.toLowerCase();
        if (key === 'r') playAgain();
        else if (key === 'h') app.context.navigate('hall');
        else if (key === 's' && summary.share) void share();
        else if (key === 'n' && nextChapter) app.go.campaign();
        else return false;
        return true;
      },
      focus: () => again.focus({ preventScroll: true }),
    };
  };
}
