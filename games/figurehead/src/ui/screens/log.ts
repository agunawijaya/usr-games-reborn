import { DESIGNS } from '../../engine';
import { FIGUREHEADS } from '../../render/figureheads';
import { currentName, QUALITY_NAMES } from '../../voyage/life';
import type { App, Screen } from '../app';
import { ENDINGS, KIND_TITLES, lifeEventLine, mentionLabel } from '../copy';
import { button, h } from '../dom';

/** The ship's log: every chapter of the life at sea, and the lives already told. */
export function logScreen(app: App): Screen {
  const life = app.saves.life.load();
  const memories = app.saves.memories.load();
  const counts = app.saves.counts.load();
  const chapters = life
    ? h(
        'ol',
        { class: 'fh-log', dataset: { testid: 'fh-log-chapters' } },
        life.records.map((r) =>
          h(
            'li',
            { dataset: { result: r.win === true ? 'won' : r.win === false ? 'lost' : 'even' } },
            h('h3', {}, `Year ${r.year} · ${KIND_TITLES[r.kind]}${r.foe ? `, the ${r.foe}` : ''}`),
            h(
              'p',
              {},
              `${r.win === true ? 'Won' : r.win === false ? 'Lost' : 'Undecided'} in ${r.turns} turns · renown ${r.renown}${r.aboard ? ` · aboard the ${r.aboard}` : ''}`,
            ),
            h(
              'p',
              { class: 'fh-orders__small' },
              r.mentions
                .map((m) => `${m.earned ? '◆' : '◇'} ${mentionLabel(m.id, m.turns, r.kind)}`)
                .join(' · '),
            ),
            r.prizes.length
              ? h(
                  'p',
                  {},
                  `Prizes: ${r.prizes.map((p) => `${p.name} (${DESIGNS[p.design].kind}, ${p.fate === 'squadron' ? 'joined the squadron' : p.fate === 'dockyard' ? 'brought home' : p.fate === 'retaken' ? 'retaken by her prisoners' : 'let go'})`).join('; ')}`,
                )
              : null,
            r.events.length
              ? h(
                  'ul',
                  {},
                  r.events.map((e) => h('li', {}, lifeEventLine(e, currentName(life)))),
                )
              : null,
          ),
        ),
      )
    : h('p', {}, 'No ship at sea yet.');
  const element = h(
    'section',
    { class: 'fh-screen fh-logbook', dataset: { testid: 'fh-logbook' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      h('p', { class: 'fh-kicker' }, 'The ship’s log'),
      h('h1', {}, life ? `The ${currentName(life)}` : 'The log'),
      life
        ? h(
            'p',
            { class: 'fh-lede' },
            `Launched ${life.startedOn} with ${FIGUREHEADS.find((f) => f.id === life.figurehead)!.name.toLowerCase()} at her bow. ${QUALITY_NAMES[life.crew.qual][0]!.toUpperCase()}${QUALITY_NAMES[life.crew.qual].slice(1)} crew, renown ${life.renown}.`,
          )
        : null,
      chapters,
      h('h2', {}, 'Lives already told'),
      memories.length
        ? h(
            'ul',
            { class: 'fh-memories', dataset: { testid: 'fh-memories' } },
            memories.map((m) =>
              h(
                'li',
                {},
                h('b', {}, m.shipName),
                ` · ${m.startedOn} to ${m.endedOn} · ${ENDINGS[m.ending].title} · ${m.chapters} chapters, ${m.prizes} prizes, ${m.captains} captains made, renown ${m.renown}`,
              ),
            ),
          )
        : h('p', {}, 'None yet. Every ship that reaches her last anchorage is remembered here.'),
      h(
        'p',
        { class: 'fh-orders__small' },
        `In all: ${counts.battles} actions, ${counts.wins} won, ${counts.prizes} prizes (${counts.wholePrizes} taken whole), ${counts.broadsides} broadsides, ${counts.rakes} rakes.`,
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Game menu', {
          onClick: () => app.go.title(),
          key: 'Esc',
          variant: 'primary',
          testId: 'fh-log-menu',
          autofocus: true,
        }),
      ),
    ),
  );
  return {
    element,
    onKey(event) {
      if (event.key === 'Escape') {
        app.go.title();
        return true;
      }
      return false;
    },
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
