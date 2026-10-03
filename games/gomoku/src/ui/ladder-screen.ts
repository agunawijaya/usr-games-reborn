import { OPPONENTS, type Opponent, type OpponentId } from '../engine/opponents';
import type { Look } from '../render/look';
import { h, icon } from './dom';
import { portraitSvg } from './portraits';

/**
 * The ladder: five opponents in a rising line, the Referee waiting past the last, and the choices
 * for the next game underneath. Beat an opponent twice to reach the next; a win moving second
 * earns that opponent's star.
 */

export interface RungRecord {
  wins: number;
  star: boolean;
}

export interface LadderModel {
  records: Record<OpponentId, RungRecord>;
  /** The opponent chosen for the next game. */
  chosen: OpponentId;
  size: 15 | 19;
  rules: 'freestyle' | 'exact';
  /** Which side you take: first (slate or amber) or second, for the star. */
  moveFirst: boolean;
  /** Ranked games count (Read the board off); practice games do not. */
  ranked: boolean;
}

export const WINS_TO_CLIMB = 2;

/** Open when every opponent below it has been beaten twice. */
export function isOpen(records: Record<OpponentId, RungRecord>, opponent: Opponent): boolean {
  return OPPONENTS.filter((o) => o.rung < opponent.rung).every(
    (o) => records[o.id].wins >= WINS_TO_CLIMB,
  );
}

const BACK_ICON = 'M15 6l-6 6 6 6';

export interface LadderScreen {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  update(model: LadderModel): void;
  setLook(look: Look): void;
  onBack(handler: () => void): void;
  onPlay(handler: (model: LadderModel) => void): void;
  /** Any choice made on the screen (opponent, board, rules, side, ranked). */
  onChange(handler: (model: LadderModel) => void): void;
}

export function createLadderScreen(
  host: HTMLElement,
  look: Look,
  options: { inHall: boolean },
): LadderScreen {
  let currentLook = look;
  let model: LadderModel | null = null;
  let back: () => void = () => {};
  let play: (model: LadderModel) => void = () => {};
  let change: (model: LadderModel) => void = () => {};

  const canvas = h('canvas', { class: 'ff-canvas', 'aria-hidden': 'true' });
  const page = h('div', { class: 'ff-page ff-ladder' });
  const root = h(
    'div',
    { class: `ff-root${options.inHall ? ' is-in-hall' : ''}`, 'data-look': look.id },
    canvas,
    page,
  );
  host.append(root);

  function choose(next: Partial<LadderModel>) {
    if (!model) return;
    model = { ...model, ...next };
    change(model);
    render();
  }

  function rungCard(opponent: Opponent): HTMLElement {
    const m = model!;
    const record = m.records[opponent.id];
    const open = isOpen(m.records, opponent);
    const beaten = record.wins >= WINS_TO_CLIMB;
    const chosen = open && m.chosen === opponent.id;
    const below = OPPONENTS.find((o) => o.rung === opponent.rung - 1);
    const state = beaten
      ? 'Beaten'
      : chosen
        ? 'Up next'
        : open
          ? 'Open'
          : `Beat ${below?.name ?? ''} twice to meet`;
    const portrait = h('span', {});
    portrait.innerHTML = portraitSvg(opponent.id, currentLook.dark, 136);
    const card = h(
      'li',
      {
        class: [
          'ff-rung',
          opponent.id === 'referee' ? 'ff-rung--referee' : '',
          beaten ? 'is-beaten' : '',
          chosen ? 'is-next' : '',
          open ? '' : 'is-locked',
        ]
          .filter(Boolean)
          .join(' '),
      },
      h(
        'span',
        { class: 'ff-rung__rung' },
        opponent.id === 'referee' ? 'beyond' : `0${opponent.rung}`,
      ),
      portrait,
      h('h2', { class: 'ff-rung__name' }, opponent.name),
      h('p', { class: 'ff-rung__temper' }, opponent.temperament),
      h('p', { class: 'ff-rung__line' }, `“${opponent.hello}”`),
      h(
        'div',
        { class: 'ff-rung__record', 'aria-label': `${record.wins} of ${WINS_TO_CLIMB} wins` },
        h(
          'span',
          { class: 'ff-pips' },
          ...Array.from({ length: WINS_TO_CLIMB }, (_, i) =>
            h('span', { class: `ff-pip${i < record.wins ? ' is-on' : ''}` }),
          ),
        ),
        h(
          'span',
          {
            class: `ff-star${record.star ? ' is-on' : ''}`,
            title: 'A star for a win moving second',
          },
          '★',
        ),
      ),
      h('p', { class: 'ff-rung__state' }, state),
    );
    if (open && !chosen) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Choose ${opponent.name}`);
      card.addEventListener('click', () => choose({ chosen: opponent.id }));
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        choose({ chosen: opponent.id });
      });
    }
    card.dataset.opponent = opponent.id;
    return card;
  }

  function segmented<T extends string | number | boolean>(
    label: string,
    value: T,
    choices: [T, string][],
    pick: (value: T) => void,
  ): HTMLElement {
    return h(
      'div',
      { class: 'ff-choice' },
      h('span', {}, label),
      h(
        'div',
        { class: 'ff-segmented', role: 'group', 'aria-label': label },
        ...choices.map(([v, text]) =>
          h(
            'button',
            { type: 'button', 'aria-pressed': String(v === value), onclick: () => pick(v) },
            text,
          ),
        ),
      ),
    );
  }

  function render() {
    if (!model) return;
    const m = model;
    const chosen = OPPONENTS.find((o) => o.id === m.chosen)!;
    const first = currentLook.pieces[0]!.name;
    const second = currentLook.pieces[1]!.name;
    page.replaceChildren(
      h(
        'header',
        { class: 'ff-page__head' },
        h(
          'div',
          {},
          h(
            'button',
            { class: 'ff-button', type: 'button', onclick: () => back() },
            icon(BACK_ICON, { stroke: true }),
            'Game menu',
          ),
        ),
        h(
          'div',
          { class: 'ff-page__titles' },
          h('p', { class: 'ff-kicker' }, 'Fivefold · Ladder'),
          h('h1', { class: 'ff-page__title' }, 'Climb the ladder'),
          h(
            'p',
            { class: 'ff-page__lead' },
            m.ranked
              ? 'Beat each opponent twice to meet the next. Win moving second for a star.'
              : 'Practice: Read the board is allowed and moves can be taken back. Nothing counts.',
          ),
        ),
        h('div', {}),
      ),
      h('ol', { class: 'ff-rungs' }, ...OPPONENTS.map(rungCard)),
      h(
        'div',
        { class: 'ff-ladder__foot' },
        segmented(
          'Board',
          m.size,
          [
            [15, '15 × 15'],
            [19, '19 × 19'],
          ],
          (size) => choose({ size }),
        ),
        segmented(
          'Rules',
          m.rules,
          [
            ['freestyle', 'Freestyle'],
            ['exact', 'Exactly five'],
          ],
          (rules) => choose({ rules }),
        ),
        segmented(
          'You play',
          m.moveFirst,
          [
            [true, `${first} · first`],
            [false, `${second} · second ★`],
          ],
          (moveFirst) => choose({ moveFirst }),
        ),
        segmented(
          'Game',
          m.ranked,
          [
            [true, 'Ranked'],
            [false, 'Practice'],
          ],
          (ranked) => choose({ ranked }),
        ),
        h(
          'button',
          {
            class: 'ff-button ff-button--primary ff-button--big',
            type: 'button',
            onclick: () => play(m),
          },
          `Play ${chosen.name}`,
          h('kbd', {}, 'Enter'),
        ),
      ),
    );
  }

  return {
    root,
    canvas,
    update(next) {
      model = next;
      render();
    },
    setLook(next) {
      currentLook = next;
      root.dataset.look = next.id;
      render();
    },
    onBack(handler) {
      back = handler;
    },
    onPlay(handler) {
      play = handler;
    },
    onChange(handler) {
      change = handler;
    },
  };
}
