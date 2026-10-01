import { h, icon } from './dom';

/**
 * The end-of-shift cards. Both keep the collection's results order: Play again (R) · Game menu ·
 * Back to the Hall (H), with the shift's own next step first when there is one.
 */

export interface Stat {
  label: string;
  value: string;
}

export interface ReplayTick {
  tick: number;
  state: 'past' | 'shown' | 'loss';
}

export interface LossCardModel {
  /** Where the card sits, so the moment on the radar behind it stays in view. */
  side?: 'left' | 'centre';
  kicker: string;
  /** What happened, in the card's words: "Loss of separation", "Unsafe landing", … */
  headline: string;
  /** The plane names involved, as the radar shows them (k6, B7). */
  planes: readonly string[];
  lede: string;
  replay: readonly ReplayTick[];
  stats: readonly Stat[];
}

export interface LossCard {
  root: HTMLElement;
  above: HTMLCanvasElement;
  tilted: HTMLCanvasElement;
}

export type CardAction = 'next' | 'play-again' | 'game-menu' | 'hall' | 'share';

/** The collection's results order: Play again (R) · Game menu · Back to the Hall (H). */
export function actions(extra: Node[] = []): HTMLElement {
  return h(
    'div',
    { class: 'sk-actions' },
    ...extra,
    h(
      'button',
      {
        class: `sk-button${extra.length ? '' : ' sk-button--primary'}`,
        type: 'button',
        'data-action': 'play-again',
      },
      'Play again',
      h('span', { class: 'sk-key' }, 'R'),
    ),
    h('button', { class: 'sk-button', type: 'button', 'data-action': 'game-menu' }, 'Game menu'),
    h(
      'button',
      { class: 'sk-button', type: 'button', 'data-action': 'hall' },
      '← Back to the Hall',
      h('span', { class: 'sk-key' }, 'H'),
    ),
  );
}

export function stats(list: readonly Stat[]): HTMLElement {
  return h(
    'dl',
    { class: 'sk-results' },
    ...list.map((stat) =>
      h(
        'div',
        { class: 'sk-stat' },
        h('dt', { class: 'sk-stat__label' }, stat.label),
        h('dd', { class: 'sk-stat__value' }, stat.value),
      ),
    ),
  );
}

export function lossCard(model: LossCardModel): LossCard {
  const above = h('canvas', { 'aria-label': 'Replay from above' });
  const tilted = h('canvas', { 'aria-label': 'Replay, tilted' });
  const title = h('h2', { class: 'sk-card__title' }, `${model.headline} — `);
  model.planes.forEach((name, i) => {
    if (i > 0) title.append(' and ');
    title.append(h('b', {}, name));
  });
  const root = h(
    'div',
    { class: `sk-scrim${model.side === 'left' ? ' sk-scrim--left' : ''}` },
    h(
      'section',
      { class: 'sk-card sk-card--loss', 'aria-labelledby': 'sk-loss-title' },
      h('p', { class: 'sk-card__kicker' }, model.kicker),
      title,
      h('p', { class: 'sk-card__lede' }, model.lede),
      h(
        'div',
        { class: 'sk-replay' },
        h('figure', {}, above, h('figcaption', {}, h('span', { class: 'sk-chip' }, 'From above'))),
        h('figure', {}, tilted, h('figcaption', {}, h('span', { class: 'sk-chip' }, 'Tilted'))),
      ),
      h(
        'div',
        { class: 'sk-scrub' },
        h('span', {}, 'Replay'),
        h(
          'ol',
          {},
          ...model.replay.map((step) =>
            h(
              'li',
              {
                class:
                  step.state === 'shown'
                    ? 'is-current'
                    : step.state === 'loss'
                      ? 'is-loss'
                      : undefined,
              },
              h(
                'button',
                {
                  type: 'button',
                  'data-tick': String(step.tick),
                  'aria-label': `Replay tick ${step.tick}`,
                },
                `${step.tick}`,
              ),
            ),
          ),
        ),
      ),
      stats(model.stats),
      actions(),
    ),
  );
  title.id = 'sk-loss-title';
  return { root, above, tilted };
}

export interface StarModel {
  label: string;
  earned: boolean;
}

export interface ShiftCardModel {
  kicker: string;
  title: string;
  lede: string;
  stars: readonly StarModel[];
  stats: readonly Stat[];
  /** Where the tapestry was kept. */
  logbook: string;
}

export interface ShiftCard {
  root: HTMLElement;
  tapestry: HTMLCanvasElement;
}

const STAR = 'M12 2.6l2.8 6.1 6.6.7-4.9 4.5 1.4 6.5L12 17.1l-5.9 3.3 1.4-6.5-4.9-4.5 6.6-.7z';
const BOOK = 'M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9';

function star(earned: boolean): SVGSVGElement {
  const svg = icon(STAR, { stroke: !earned });
  svg.classList.add(earned ? 'is-earned' : 'is-missed');
  return svg;
}

/** Shift complete: the tapestry of the shift, its stars and the way on. */
export function shiftCard(model: ShiftCardModel): ShiftCard {
  const tapestry = h('canvas', {
    class: 'sk-tapestry',
    role: 'img',
    'aria-label': 'The shift woven as a tapestry: one thread for every flight',
  });
  const root = h(
    'div',
    { class: 'sk-scrim sk-scrim--focus' },
    h(
      'section',
      { class: 'sk-card sk-card--shift', 'aria-labelledby': 'sk-shift-title' },
      h('div', { class: 'sk-card__art' }, tapestry),
      h(
        'div',
        { class: 'sk-card__side' },
        h('p', { class: 'sk-card__kicker' }, model.kicker),
        h('h2', { class: 'sk-card__title', id: 'sk-shift-title' }, model.title),
        h('p', { class: 'sk-card__lede' }, model.lede),
        h(
          'ul',
          { class: 'sk-starlist' },
          ...model.stars.map((s) =>
            h('li', { class: s.earned ? 'is-earned' : 'is-missed' }, star(s.earned), s.label),
          ),
        ),
        stats(model.stats),
        h('p', { class: 'sk-logbook' }, icon(BOOK, { stroke: true }), model.logbook),
        actions([
          h(
            'button',
            { class: 'sk-button sk-button--primary', type: 'button', 'data-action': 'next' },
            'Next shift',
            h('span', { class: 'sk-key' }, 'Enter'),
          ),
        ]),
      ),
    ),
  );
  return { root, tapestry };
}
