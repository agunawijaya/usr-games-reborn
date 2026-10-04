import { portraitSvg } from '../../render/portrait';
import { chooseRefit, currentName, skipRefit } from '../../voyage/life';
import type { RefitId } from '../../voyage/types';
import type { App, Screen } from '../app';
import { REFITS } from '../copy';
import { button, h, svg } from '../dom';

/** A dockyard visit between chapters: two refits on offer, one to choose. Scars stay. */
export function dockyardScreen(app: App): Screen {
  const life = app.saves.life.load();
  if (!life?.dockyard) {
    queueMicrotask(() => app.go.voyage());
    return { element: h('section', { class: 'fh-screen' }) };
  }
  const offer = life.dockyard;
  const choose = (refit: RefitId) => {
    app.saves.life.save(chooseRefit(life, refit));
    app.sounds.play('bell');
    app.go.voyage();
  };
  const preview = (refits: readonly RefitId[], label: string) =>
    svg(
      portraitSvg({
        look: app.look,
        design: 'frigate',
        nation: 0,
        figurehead: life.figurehead,
        sails: 'battle',
        rig: [1, 1, 1, 1],
        hull: 1,
        scars: life.scars,
        refits,
        struck: false,
        burning: false,
        seed: 3,
        water: 'scene',
        on: 'card',
        label,
      }),
      'fh-dockyard__portrait',
    );
  const element = h(
    'section',
    { class: 'fh-screen fh-dockyard', dataset: { testid: 'fh-dockyard' } },
    h(
      'div',
      { class: 'fh-sheet fh-sheet--wide' },
      h('p', { class: 'fh-kicker' }, 'Alder Haven dockyard'),
      h('h1', {}, `The ${currentName(life)} in dock`),
      h(
        'p',
        { class: 'fh-lede' },
        'The shipwrights have her for a month. They can do one thing well in the time; her scars they leave as they are, mended and sound.',
      ),
      h(
        'div',
        { class: 'fh-refits' },
        ...offer.map((refit, i) =>
          h(
            'div',
            { class: 'fh-refit' },
            preview(
              [...life.refits, refit],
              `The ${life.shipName} with ${REFITS[refit].name.toLowerCase()}`,
            ),
            h('h2', {}, REFITS[refit].name),
            h('p', {}, REFITS[refit].line),
            button(`Choose ${REFITS[refit].name.toLowerCase()}`, {
              onClick: () => choose(refit),
              key: String(i + 1),
              variant: i === 0 ? 'primary' : undefined,
              testId: `fh-refit-${i}`,
            }),
          ),
        ),
      ),
      h(
        'div',
        { class: 'fh-actions' },
        button('Leave her as she is', {
          onClick: () => {
            app.saves.life.save(skipRefit(life));
            app.go.voyage();
          },
          variant: 'quiet',
          testId: 'fh-refit-skip',
        }),
      ),
    ),
  );
  return {
    element,
    onKey(event) {
      const n = Number(event.key);
      if (n >= 1 && n <= offer.length) {
        choose(offer[n - 1]!);
        return true;
      }
      return false;
    },
    onLook: () => app.go.dockyard(),
    focus: () =>
      element
        .querySelector<HTMLElement>('[data-testid="fh-refit-0"]')
        ?.focus({ preventScroll: true }),
  };
}
