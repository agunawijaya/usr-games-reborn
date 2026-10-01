import type { GameResult, PackageDefinition } from '@usr-games/kit';
import { levelForXp, type ProgressionUpdate } from '@usr-games/kit/progression';
import type { CatalogEntry } from '../../catalog/catalog';
import { h } from '../../ui/h';
import { keyCap, labelNodes } from './chrome';
import { type PlayerIconName, playerIcon } from './icons';
import { RESULTS_ACTIONS, type ResultsAction } from './menu';
import { trapFocus } from './overlays';
import { type Announcement, type AnnouncementKind, announcements, ledger } from './receipt';
import { exitStatus, outcomeHeadline, type Wording } from './wording';

/**
 * The Hall's results screen, for games that report with `presentation: 'hall'`: how the round
 * went, what it earned and where it leaves the player, then Play again · Game menu · Back to
 * the Hall.
 */

export interface ResultsSheetOptions {
  entry: CatalogEntry;
  wording: Wording;
  result: GameResult;
  update: ProgressionUpdate;
  lookup: (key: string) => PackageDefinition | undefined;
  onAction(action: ResultsAction): void;
}

export interface ResultsSheet {
  element: HTMLElement;
  focus(): void;
  destroy(): void;
}

const HIGHLIGHT_ICONS: Record<AnnouncementKind, PlayerIconName> = {
  xp: 'bolt',
  achievement: 'star',
  quest: 'flag',
  level: 'rank',
  rank: 'rank',
};

const number = new Intl.NumberFormat('en');

function highlights(list: readonly Announcement[]): HTMLElement | null {
  const shown = list.filter((item) => item.kind !== 'xp');
  if (shown.length === 0) return null;
  return h(
    'ul',
    { class: 'pl-results__highlights', role: 'list' },
    shown.map((item) =>
      h(
        'li',
        { class: `pl-highlight pl-highlight--${item.kind}` },
        playerIcon(HIGHLIGHT_ICONS[item.kind]),
        item.text,
      ),
    ),
  );
}

function levelMeter(update: ProgressionUpdate, wording: Wording): HTMLElement {
  const level = levelForXp(update.state.xp);
  const toNext = level.nextLevelAt === null ? null : level.nextLevelAt - update.state.xp;
  const caption =
    wording === 'unix'
      ? `level ${level.level} · ${level.rank}`
      : `Level ${level.level} · rank ${level.rank}`;
  const rest =
    toNext === null
      ? 'Top level reached'
      : `${number.format(toNext)} XP to level ${level.level + 1}`;
  return h(
    'div',
    { class: 'pl-level' },
    h('p', { class: 'pl-level__caption' }, h('b', null, caption), h('span', null, rest)),
    h(
      'div',
      {
        class: 'pl-level__track',
        role: 'progressbar',
        'aria-label': `Progress to level ${level.level + 1}`,
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(Math.round(level.fraction * 100)),
      },
      h('span', { class: 'pl-level__fill', style: { '--pl-fill': String(level.fraction) } }),
    ),
  );
}

export function resultsSheet(options: ResultsSheetOptions): ResultsSheet {
  const { entry, wording, result, update } = options;
  const { id, title } = entry.manifest;
  const rows = ledger(update, wording, options.lookup);
  const heading = outcomeHeadline(result.outcome);

  const actions = RESULTS_ACTIONS.map((action, index) =>
    h(
      'button',
      {
        type: 'button',
        class: ['pl-button', index === 0 && 'pl-button--primary'],
        dataset: { action: action.action },
        'aria-keyshortcuts': action.key,
        onclick: () => options.onAction(action.action),
      },
      action.action === 'play-again' ? playerIcon('again') : null,
      h('span', null, labelNodes(action.label)),
      action.key ? keyCap(action.key) : null,
    ),
  );

  const sheet = h(
    'section',
    {
      class: ['pl-sheet', 'pl-sheet--results', `pl-sheet--${result.outcome}`],
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'pl-results-title',
      'aria-describedby': 'pl-results-summary',
    },
    h(
      'header',
      { class: 'pl-sheet__head' },
      h('p', { class: 'pl-sheet__kicker' }, wording === 'unix' ? `$ ${id}` : title),
      h('h2', { id: 'pl-results-title', class: 'pl-sheet__title pl-results__title' }, heading),
      wording === 'unix'
        ? h('p', { class: 'pl-results__status' }, exitStatus(result.outcome))
        : null,
    ),
    h(
      'div',
      { id: 'pl-results-summary', class: 'pl-results__summary' },
      result.score !== undefined
        ? h(
            'p',
            { class: 'pl-results__score' },
            h('span', null, 'Score'),
            h('b', { dataset: { testid: 'pl-score' } }, number.format(result.score)),
          )
        : null,
      h(
        'p',
        { class: 'pl-results__xp' },
        h('span', null, 'Earned'),
        h('b', { dataset: { testid: 'pl-xp' } }, `+${number.format(update.xpGained)} XP`),
      ),
    ),
    rows.length > 0
      ? h(
          'ul',
          { class: 'pl-ledger', role: 'list', 'aria-label': 'Where the XP came from' },
          rows.map((row) =>
            h(
              'li',
              { class: 'pl-ledger__row' },
              h('span', { class: 'pl-ledger__label' }, row.label),
              h('span', { class: 'pl-ledger__xp' }, `+${number.format(row.xp)}`),
            ),
          ),
        )
      : null,
    highlights(announcements(update, wording, options.lookup)),
    levelMeter(update, wording),
    h('div', { class: 'pl-results__actions' }, actions),
  );
  const element = h(
    'div',
    { class: 'pl-scrim pl-scrim--results', dataset: { testid: 'pl-results' } },
    sheet,
  );
  const release = trapFocus(sheet);

  return {
    element,
    focus: () => actions[0]?.focus({ preventScroll: true }),
    destroy() {
      release();
      element.remove();
    },
  };
}
