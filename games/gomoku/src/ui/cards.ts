import type { Opponent } from '../engine/opponents';
import type { Look } from '../render/look';
import type { SideIndex } from '../render/view';
import { h } from './dom';
import { portraitSvg } from './portraits';

/**
 * The cards of the play screen: the seats and "Read the board" beside the board, and the cards
 * laid over it (results, pause, a question before progress is lost, the tutorial's coach).
 * Results follow the collection's order: Play again (R) · Game menu · Back to the Hall (H), then
 * the game's own extras.
 */

export interface Tally {
  threes: number;
  fours: number;
}

/** A small picture of a side's piece: a pebble by day, a lantern by night. */
export function swatch(look: Look, side: SideIndex, size = 30): HTMLElement {
  const piece = look.pieces[side]!;
  const span = h('span', { class: 'ff-swatch', 'aria-hidden': 'true' });
  const id = `sw${side}${look.id}`;
  let art: string;
  if (!look.dark)
    art = `<defs><radialGradient id="${id}" cx="0.36" cy="0.32" r="0.75"><stop offset="0" stop-color="${piece.light}"/><stop offset="0.5" stop-color="${piece.body}"/><stop offset="1" stop-color="${piece.shade}"/></radialGradient></defs>
      <ellipse cx="17" cy="18" rx="12" ry="10" fill="rgba(84,62,30,0.25)"/>
      <ellipse cx="15" cy="15" rx="12.5" ry="11" fill="url(#${id})"/>`;
  else if (side === 0)
    art = `<rect x="4" y="22" width="22" height="4" rx="1.5" fill="#5b3313"/>
      <rect x="8" y="7" width="14" height="16" fill="${piece.body}" stroke="${piece.detail}" stroke-width="1.6"/>
      <path d="M15 7v16M8 13h14" stroke="${piece.detail}" stroke-width="0.9" opacity="0.6"/>
      <rect x="11" y="10" width="8" height="10" fill="${piece.light}" opacity="0.6"/>`;
  else
    art = `<ellipse cx="15" cy="25" rx="8" ry="2.4" fill="#3a4767"/>
      <ellipse cx="15" cy="14" rx="8" ry="9.5" fill="${piece.body}"/>
      <ellipse cx="13" cy="12" rx="4" ry="5" fill="${piece.light}" opacity="0.8"/>
      <rect x="11" y="3.2" width="8" height="2.4" rx="1" fill="${piece.detail}"/>
      <rect x="10.5" y="22.4" width="9" height="2.4" rx="1" fill="${piece.detail}"/>`;
  span.innerHTML = `<svg viewBox="0 0 30 30" width="${size}" height="${size}">${art}</svg>`;
  return span;
}

/** "Slate · moves first", by the look's names for the sides. */
export function sideLabel(look: Look, side: SideIndex): string {
  return `${look.pieces[side]!.name}${side === 0 ? ' · moves first' : ' · moves second'}`;
}

export interface SeatCard {
  look: Look;
  side: SideIndex;
  kicker: string;
  name: string;
  /** A headline when the game is won ("Five in a row"). */
  moment?: string | null;
  status?: { text: string; point?: string; urgent?: boolean } | null;
  /** Shows that this seat is to move. */
  toMove?: boolean;
}

export function seatCard(seat: SeatCard): HTMLElement {
  return h(
    'section',
    { class: `ff-card ff-seat${seat.toMove ? ' is-to-move' : ''}` },
    swatch(seat.look, seat.side, 44),
    h(
      'div',
      {},
      h('p', { class: 'ff-kicker' }, seat.kicker),
      h('h2', { class: 'ff-seat__name' }, seat.name),
      h('p', { class: 'ff-seat__side' }, sideLabel(seat.look, seat.side)),
    ),
    seat.moment ? h('p', { class: 'ff-seat__moment' }, seat.moment) : null,
    seat.status
      ? h(
          'p',
          {
            class: `ff-seat__turn${seat.status.urgent ? ' is-urgent' : ''}`,
            'aria-live': 'polite',
          },
          seat.status.text,
          seat.status.point ? h('b', {}, ` ${seat.status.point}`) : null,
        )
      : null,
  );
}

function legendLine(dashed: boolean): string {
  return `<svg viewBox="0 0 46 14" width="46" height="14"><path d="M3 7h40" stroke="currentColor" stroke-width="3.4" stroke-linecap="${dashed ? 'butt' : 'round'}" ${dashed ? 'stroke-dasharray="7 5"' : ''}/></svg>`;
}

function legendRing(): string {
  return `<svg viewBox="0 0 46 22" width="46" height="22"><circle cx="23" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><circle cx="23" cy="11" r="3" fill="currentColor"/></svg>`;
}

function legendItem(art: string, name: string, meaning: string): HTMLElement {
  const sample = h('span', { 'aria-hidden': 'true' });
  sample.innerHTML = art;
  return h('li', {}, sample, h('span', {}, h('strong', {}, name), ` — ${meaning}`));
}

function tallyText(t: Tally): string {
  return `${t.fours} four${t.fours === 1 ? '' : 's'} · ${t.threes} open three${t.threes === 1 ? '' : 's'}`;
}

export interface ReadCard {
  on: boolean;
  allowed: boolean;
  /** Why it is off, when it is not allowed. */
  offReason?: string;
  mine: { name: string; tally: Tally };
  theirs: { name: string; tally: Tally };
  toggle(on: boolean): void;
}

export function readCard(read: ReadCard): HTMLElement {
  const input = h('input', {
    type: 'checkbox',
    role: 'switch',
    checked: read.on,
    disabled: !read.allowed,
    'data-testid': 'read-the-board',
    onchange: (event: Event) => read.toggle((event.target as HTMLInputElement).checked),
  });
  return h(
    'section',
    { class: 'ff-card ff-read' },
    h(
      'label',
      { class: 'ff-switch' },
      h('span', {}, 'Read the board ', read.allowed ? h('kbd', {}, 'T') : null),
      input,
      h('span', { class: 'ff-switch__track', 'aria-hidden': 'true' }),
    ),
    read.allowed
      ? h(
          'ul',
          { class: 'ff-legend' },
          legendItem(legendLine(false), 'Four', 'one stone from five'),
          legendItem(legendLine(true), 'Open three', 'one stone from an open four'),
          legendItem(legendRing(), 'Ring', 'where it completes'),
        )
      : h('p', { class: 'ff-seat__side' }, read.offReason ?? 'Off for this game.'),
    read.on
      ? h(
          'div',
          { class: 'ff-tally' },
          h(
            'div',
            { class: 'is-mine' },
            h('strong', {}, read.mine.name),
            tallyText(read.mine.tally),
          ),
          h(
            'div',
            { class: 'is-theirs' },
            h('strong', {}, read.theirs.name),
            tallyText(read.theirs.tally),
          ),
        )
      : null,
  );
}

export interface OpponentCard {
  look: Look;
  opponent: Opponent;
  side: SideIndex;
  speech: string | null;
  /** Progress on the ladder, for a ranked game. */
  record: { wins: number; needed: number; star: boolean } | null;
  thinking?: boolean;
  /** Overrides the kicker ("Rung 3 · Patient"), e.g. for the Bot League. */
  kicker?: string;
}

export function opponentCard(card: OpponentCard): HTMLElement {
  const { opponent, look } = card;
  const portrait = h('span', {});
  portrait.innerHTML = portraitSvg(opponent.id, look.dark, 118);
  return h(
    'section',
    { class: `ff-card ff-foe${card.thinking ? ' is-thinking' : ''}` },
    h(
      'div',
      { class: 'ff-foe__head' },
      portrait,
      h(
        'div',
        {},
        h(
          'p',
          { class: 'ff-kicker' },
          card.kicker ??
            (opponent.id === 'referee'
              ? `Beyond the ladder · ${opponent.temperament}`
              : `Rung ${opponent.rung} · ${opponent.temperament}`),
        ),
        h('h2', { class: 'ff-foe__name' }, opponent.name),
        h('p', { class: 'ff-seat__side' }, swatch(look, card.side, 24), sideLabel(look, card.side)),
      ),
    ),
    card.thinking
      ? h(
          'p',
          { class: 'ff-thinking', 'aria-live': 'polite' },
          h('span', { class: 'ff-thinking__dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
          `${opponent.name} is thinking`,
        )
      : card.speech
        ? h('p', { class: 'ff-speech' }, `“${card.speech}”`)
        : null,
    card.record
      ? h(
          'div',
          { class: 'ff-record' },
          h(
            'span',
            { class: 'ff-pips' },
            `Beat ${opponent.name} twice`,
            ...Array.from({ length: card.record.needed }, (_, i) =>
              h('span', { class: `ff-pip${i < card.record!.wins ? ' is-on' : ''}` }),
            ),
          ),
          h(
            'span',
            { class: 'ff-pips', title: 'A star for a win moving second' },
            h('span', { class: `ff-star${card.record.star ? ' is-on' : ''}` }, '★'),
            'Win second',
          ),
        )
      : null,
  );
}

export function movesCard(
  moveNumber: number,
  last: string | null,
  extra?: Node | null,
): HTMLElement {
  return h(
    'section',
    { class: 'ff-card ff-moves' },
    h('span', {}, 'Move ', h('b', {}, String(moveNumber))),
    last ? h('span', {}, 'Last ', h('b', {}, last)) : null,
    extra ?? null,
  );
}

/** A plain card for the side columns: a kicker, a title, and lines. */
export function infoCard(
  kicker: string,
  title: string,
  ...body: (Node | string | null)[]
): HTMLElement {
  return h(
    'section',
    { class: 'ff-card ff-info' },
    h('p', { class: 'ff-kicker' }, kicker),
    h('h2', { class: 'ff-seat__name' }, title),
    ...body.map((b) => (typeof b === 'string' ? h('p', { class: 'ff-info__line' }, b) : b)),
  );
}

// —— cards over the board ——

export interface CardAction {
  label: string;
  key?: string;
  primary?: boolean;
  run(): void;
}

function actionButtons(actions: readonly CardAction[], className: string): HTMLElement {
  return h(
    'div',
    { class: className },
    ...actions.map((action) => {
      const button = h(
        'button',
        {
          type: 'button',
          class: `ff-button${action.primary ? ' ff-button--primary' : ''}`,
          'data-action': action.label,
        },
        action.label,
        action.key ? h('kbd', {}, action.key) : null,
      );
      button.addEventListener('click', () => action.run());
      return button;
    }),
  );
}

export interface ResultsModel {
  kicker: string;
  title: string;
  /** The opponent's line, or a sentence about the game. */
  story: string;
  stats: readonly { label: string; value: string }[];
  /** Ladder progress after this game. */
  record?: { name: string; wins: number; needed: number; star: boolean } | null;
  footnotes?: readonly string[];
  mood: 'won' | 'lost' | 'drawn';
  actions: readonly CardAction[];
}

export function resultsCard(model: ResultsModel): HTMLElement {
  const record = model.record
    ? h(
        'p',
        { class: 'ff-results__record' },
        h(
          'span',
          { class: 'ff-pips' },
          `${model.record.name}: `,
          ...Array.from({ length: model.record.needed }, (_, i) =>
            h('span', { class: `ff-pip${i < model.record!.wins ? ' is-on' : ''}` }),
          ),
        ),
        h(
          'span',
          { class: 'ff-pips' },
          h('span', { class: `ff-star${model.record.star ? ' is-on' : ''}` }, '★'),
          model.record.star ? 'Star earned' : 'Win second for the star',
        ),
      )
    : null;
  return h(
    'section',
    {
      class: `ff-overlay ff-results is-${model.mood}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ff-results-title',
    },
    h(
      'div',
      { class: 'ff-overlay__card' },
      h('p', { class: 'ff-kicker' }, model.kicker),
      h('h2', { class: 'ff-overlay__title', id: 'ff-results-title', tabindex: '-1' }, model.title),
      h('p', { class: 'ff-overlay__story' }, model.story),
      record,
      model.stats.length
        ? h(
            'dl',
            { class: 'ff-results__stats' },
            ...model.stats.map((stat) =>
              h('div', {}, h('dt', {}, stat.label), h('dd', {}, stat.value)),
            ),
          )
        : null,
      ...(model.footnotes ?? []).map((line) => h('p', { class: 'ff-overlay__foot' }, line)),
      actionButtons(model.actions, 'ff-overlay__actions'),
    ),
  );
}

export interface ConfirmText {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

export function confirmCard(text: ConfirmText, answer: (yes: boolean) => void): HTMLElement {
  return h(
    'section',
    {
      class: 'ff-overlay ff-confirm',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ff-confirm-title',
    },
    h(
      'div',
      { class: 'ff-overlay__card' },
      h('h2', { class: 'ff-overlay__title', id: 'ff-confirm-title' }, text.title),
      h('p', { class: 'ff-overlay__story' }, text.body),
      actionButtons(
        [
          { label: text.cancel, primary: true, run: () => answer(false) },
          { label: text.confirm, run: () => answer(true) },
        ],
        'ff-overlay__actions',
      ),
    ),
  );
}

/** The workbench's own pause card, in the collection's order (in the Hall, the Hall's is used). */
export function pauseCard(actions: readonly CardAction[]): HTMLElement {
  return h(
    'section',
    {
      class: 'ff-overlay ff-pause',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'ff-pause-title',
    },
    h(
      'div',
      { class: 'ff-overlay__card' },
      h('h2', { class: 'ff-overlay__title', id: 'ff-pause-title' }, 'Paused'),
      actionButtons(actions, 'ff-overlay__actions ff-overlay__actions--column'),
    ),
  );
}

/** The tutorial's coach: a short instruction beside the board, never over it. */
export function coachCard(
  step: string,
  title: string,
  text: string,
  extra?: Node | null,
): HTMLElement {
  return h(
    'section',
    { class: 'ff-card ff-coach', 'aria-live': 'polite' },
    h('p', { class: 'ff-kicker' }, step),
    h('h2', { class: 'ff-seat__name' }, title),
    h('p', { class: 'ff-coach__text' }, text),
    extra ?? null,
  );
}
