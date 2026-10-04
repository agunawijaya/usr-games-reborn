import { FIGUREHEADS, figureheadSvg } from '../../render/figureheads';
import { PALETTES } from '../../render/palette';
import { captainsMade, currentName, prizesHome, QUALITY_NAMES } from '../../voyage/life';
import { hullName } from '../../voyage/names';
import type { App, Screen } from '../app';
import { ENDINGS, KIND_TITLES } from '../copy';
import { button, h, svg } from '../dom';
import { heroPortrait } from './title';

/** The last page of her story: how she ended, and every chapter of her life in one place. */
export function epilogueScreen(app: App): Screen {
  const life = app.saves.life.load();
  if (!life?.ending) {
    queueMicrotask(() => app.go.voyage());
    return { element: h('section', { class: 'fh-screen' }) };
  }
  const ending = ENDINGS[life.ending];
  const years = life.plan[life.plan.length - 1]!.year;
  const carving = FIGUREHEADS.find((f) => f.id === life.figurehead)!;
  const p = PALETTES[app.look];
  const element = h(
    'section',
    { class: 'fh-screen fh-epilogue', dataset: { testid: 'fh-epilogue', ending: life.ending } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      h(
        'div',
        { class: 'fh-epilogue__art' },
        life.ending === 'gate'
          ? svg(
              figureheadSvg(life.figurehead, p, app.look === 'night', carving.name),
              'fh-epilogue__carving',
            )
          : svg(heroPortrait(app, life, 'card'), 'fh-epilogue__portrait'),
      ),
      h('p', { class: 'fh-kicker' }, `The ${currentName(life)}, ${years} years`),
      h('h1', { dataset: { testid: 'fh-ending-title' } }, ending.title),
      h(
        'p',
        { class: 'fh-lede' },
        ending.text(life.hull > 1 ? hullName(life.shipName, life.hull) : life.shipName, years),
      ),
      h(
        'p',
        {},
        `Renown ${life.renown} · ${prizesHome(life)} prizes brought home · ${captainsMade(life)} captains made from her officers · her crew ${QUALITY_NAMES[life.crew.qual]} at the last${life.hull > 1 ? ` · ${life.hull} hulls under one carving` : ''}.`,
      ),
      h(
        'ol',
        { class: 'fh-biography' },
        life.records.map((r) =>
          h(
            'li',
            { dataset: { result: r.win === true ? 'won' : r.win === false ? 'lost' : 'even' } },
            h('b', {}, `Year ${r.year}`),
            ` ${KIND_TITLES[r.kind]}${r.foe ? `, the ${r.foe}` : ''} · ${r.win === true ? 'won' : r.win === false ? 'lost' : 'undecided'}${r.prizes.length ? ` · ${r.prizes.length} ${r.prizes.length === 1 ? 'prize' : 'prizes'}` : ''}`,
          ),
        ),
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Launch a new ship', {
          onClick: () => app.go.launch(),
          key: 'Enter',
          variant: 'primary',
          testId: 'fh-new-life',
          autofocus: true,
        }),
        button('Game menu', { onClick: () => app.go.title(), testId: 'fh-epilogue-menu' }),
        button('Back to the Hall', { onClick: () => app.context.navigate('hall'), key: 'H' }),
      ),
    ),
  );
  return {
    element,
    onKey(event) {
      if (event.key === 'Enter') {
        app.go.launch();
        return true;
      }
      if (event.key.toLowerCase() === 'h') {
        app.context.navigate('hall');
        return true;
      }
      return false;
    },
    onLook: () => app.go.epilogue(),
    focus: () =>
      element.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true }),
  };
}
