import { addDays, dailyNumber } from '@usr-games/kit';
import { ROOMS } from '../../data/house';
import { PAR_PROFILE, RIVALS } from '../../game/ladder';
import { RIVAL_COATS } from '../../render/palette';
import type { App, Screen } from '../app';
import { h, starRow } from '../dom';
import { ordinal } from './results';

/** Records on this device, and the cats next door: who they are and where they come from. */
export function recordsScreen(app: App): Screen {
  const house = app.saves.house.load();
  const daily = app.saves.daily.load();
  const night = app.saves.night.load();
  const lab = app.saves.lab.load();

  const rivals = h(
    'section',
    { class: 'zm-card zm-section', 'aria-labelledby': 'zm-rivals-title' },
    h('h2', { id: 'zm-rivals-title' }, 'The cats next door'),
    h(
      'p',
      {},
      'Every room you play, they play too. Three of them play strategies found in the original program’s source: two hidden experiments and the 1999 automatic player.',
    ),
    h(
      'ul',
      { class: 'zm-ladder' },
      ...[...RIVALS.map((r) => r.profile), PAR_PROFILE].map((profile) =>
        h(
          'li',
          { class: 'zm-ladder__row', style: 'grid-template-columns:1.6em 1fr' },
          h('span', { class: 'zm-dot', style: `background:${RIVAL_COATS[profile.id].fur}` }),
          h(
            'span',
            {},
            h('span', { class: 'zm-ladder__name' }, profile.name),
            h('span', { class: 'zm-ladder__note' }, `${profile.style} ${profile.origin}`),
          ),
        ),
      ),
    ),
  );

  const houseTable = h(
    'section',
    { class: 'zm-card zm-section', 'aria-labelledby': 'zm-house-records' },
    h('h2', { id: 'zm-house-records' }, 'The House'),
    h(
      'table',
      { class: 'zm-table' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', { scope: 'col' }, 'Room'),
          h('th', { scope: 'col' }, 'Stars'),
          h('th', { scope: 'col' }, 'Best'),
          h('th', { scope: 'col' }, 'Par'),
        ),
      ),
      h(
        'tbody',
        {},
        ...ROOMS.map((room) => {
          const record = house.rooms[room.id];
          return h(
            'tr',
            {},
            h('th', { scope: 'row', style: 'font-weight:600' }, room.name),
            h('td', {}, starRow(record?.stars ?? [false, false, false], '')),
            h('td', {}, record && record.bestTurns !== null ? String(record.bestTurns) : '—'),
            h('td', {}, String(room.par)),
          );
        }),
      ),
    ),
  );

  const todayKey = app.context.daily.dateKey();
  const recentDays = Array.from({ length: 14 }, (_, i) => addDays(todayKey, -i)).filter(
    (key) => daily.days[key],
  );
  const dailyTable = h(
    'section',
    { class: 'zm-card zm-section', 'aria-labelledby': 'zm-daily-records' },
    h('h2', { id: 'zm-daily-records' }, 'Today’s mess, lately'),
    recentDays.length === 0
      ? h('p', {}, 'No daily rooms played yet. Today’s is waiting on the game menu.')
      : h(
          'table',
          { class: 'zm-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', { scope: 'col' }, 'Day'),
              h('th', { scope: 'col' }, 'Result'),
              h('th', { scope: 'col' }, 'Ahead of'),
            ),
          ),
          h(
            'tbody',
            {},
            ...recentDays.map((key) => {
              const record = daily.days[key]!;
              return h(
                'tr',
                {},
                h('th', { scope: 'row', style: 'font-weight:600' }, `#${dailyNumber(key)}`),
                h(
                  'td',
                  {},
                  record.outcome === 'cleared'
                    ? `${record.turns} turns (par ${record.par})`
                    : `fluffed on turn ${record.turns}`,
                ),
                h('td', {}, `${record.ahead} of 5`),
              );
            }),
          ),
        ),
  );

  const nightTable = h(
    'section',
    { class: 'zm-card zm-section', 'aria-labelledby': 'zm-night-records' },
    h('h2', { id: 'zm-night-records' }, 'Long Night: best ten'),
    night.top.length === 0
      ? h('p', {}, 'No nights yet. The original kept five scores a player; you get ten.')
      : h(
          'table',
          { class: 'zm-table' },
          h(
            'thead',
            {},
            h(
              'tr',
              {},
              h('th', { scope: 'col' }, ''),
              h('th', { scope: 'col' }, 'Score'),
              h('th', { scope: 'col' }, 'Waves'),
              h('th', { scope: 'col' }, 'Date'),
            ),
          ),
          h(
            'tbody',
            {},
            ...night.top.map((record, i) =>
              h(
                'tr',
                {},
                h('th', { scope: 'row' }, ordinal(i + 1)),
                h('td', {}, String(record.score)),
                h(
                  'td',
                  {},
                  `${record.waves}${record.startWave > 1 ? ` (from wave ${record.startWave})` : ''}`,
                ),
                h('td', {}, record.dateKey),
              ),
            ),
          ),
        ),
    lab.best ? h('p', {}, `Pattern Lab best: ${lab.best.pattern} scored ${lab.best.score}.`) : null,
  );

  const back = h(
    'button',
    {
      type: 'button',
      class: 'zm-button zm-button--quiet',
      onclick: () => app.go.title(),
      dataset: { testid: 'zm-back' },
    },
    '← Game menu',
  );
  const element = h(
    'section',
    {
      class: 'zm-screen',
      'aria-labelledby': 'zm-records-title',
      dataset: { testid: 'zm-records' },
    },
    h(
      'div',
      { class: 'zm-page' },
      h(
        'div',
        { class: 'zm-page__head' },
        back,
        h('h1', { class: 'zm-page__title', id: 'zm-records-title' }, 'Records & rivals'),
      ),
      h('div', { class: 'zm-grid-2' }, rivals, houseTable, dailyTable, nightTable),
    ),
  );
  return {
    element,
    focus: () => back.focus({ preventScroll: true }),
    onKey(event) {
      if (event.key === 'Backspace') {
        app.go.title();
        return true;
      }
      return false;
    },
  };
}
