import { gameAccent, type ThemeState } from '../../../../core/palette';
import { formatMinutes, formatNumber } from '../../../../ui/format';
import { h } from '../../../../ui/h';
import { emblem, icon } from '../../../../ui/icons';
import type { PreviewManager } from '../../ui/previews';
import type { ProcessRow } from '../../../../core/home-model';

const STATE_WORDS = { R: 'running', D: 'arriving soon', S: 'sleeping' } as const;

function metaLine(row: ProcessRow): string {
  if (row.state === 'S') return 'coming soon';
  if (row.state === 'D') return 'being adopted';
  if (row.bestScore !== null) return `best ${formatNumber(row.bestScore)}`;
  return row.lastPlayed ? 'played' : 'not run yet';
}

function flags(row: ProcessRow): HTMLElement | null {
  const items = [row.dailyOpen && 'daily', row.wantedByCron && 'cron'].filter(Boolean) as string[];
  if (items.length === 0) return null;
  return h(
    'span',
    { class: 'proc__flags' },
    items.map((item) => h('span', { class: `flag flag--${item}` }, item)),
  );
}

/**
 * One game as a running (or sleeping) process: status light and ps state, a small screen
 * with its emblem that wakes into a live preview on hover or focus, then title and tagline.
 */
export function processTile(
  row: ProcessRow,
  theme: ThemeState,
  previews: PreviewManager,
  options: { showDirectory: boolean },
): HTMLElement {
  const { manifest } = row.entry;
  const screen = h(
    'div',
    { class: 'proc__screen' },
    emblem(manifest.emblem, 'emblem proc__emblem'),
    flags(row),
    row.state === 'S' ? h('span', { class: 'proc__zz' }, icon('sleep')) : null,
  );
  const tile = h(
    'a',
    {
      class: ['proc', `proc--${STATE_WORDS[row.state].split(' ')[0]}`],
      href: `#/man/${manifest.id}`,
      dataset: { game: manifest.id, focusKey: `proc:${manifest.id}` },
      style: {
        '--game-accent': gameAccent(manifest.accent, theme),
        '--game-accent-raw': manifest.accent,
      },
      'aria-label': `${manifest.title}. ${manifest.tagline} ${STATE_WORDS[row.state]}, ${manifest.directory}, ${formatMinutes(manifest.sessionMinutes)}.`,
    },
    h(
      'div',
      { class: 'proc__head' },
      h('span', { class: 'led', title: STATE_WORDS[row.state] }),
      h('span', { class: 'proc__stat' }, row.state),
      h('span', { class: 'proc__pid' }, `PID ${row.pid}`),
      h('span', { class: 'proc__time' }, formatMinutes(manifest.sessionMinutes)),
    ),
    screen,
    h(
      'div',
      { class: 'proc__body' },
      h('h3', { class: 'proc__title' }, manifest.title),
      h('p', { class: 'proc__tagline' }, manifest.tagline),
    ),
    h(
      'div',
      { class: 'proc__meta' },
      options.showDirectory ? h('span', { class: 'proc__path' }, manifest.directory) : null,
      h('span', { class: 'proc__best' }, metaLine(row)),
    ),
  );
  if (row.state !== 'S') previews.attach(tile, screen, row.entry);
  return tile;
}
