import type { Opponent } from '../engine/opponents';
import { playLayout } from '../render/geometry';
import type { Look } from '../render/look';
import type { SideIndex } from '../render/view';
import { movesCard, opponentCard, readCard, seatCard, type Tally } from './cards';
import { h, icon } from './dom';

export type { Tally } from './cards';

/**
 * The play screen around the board's canvas: the bar (Game menu, title, Pause), a column beside
 * the board on each side, and a layer for the cards laid over the board. Sessions fill the
 * columns; this module only lays them out.
 */

export interface SeatModel {
  /** "You", an opponent's name, or "Player 2" at one device. */
  name: string;
  kicker: string;
  side: SideIndex;
}

/** The usual columns of a game against an opponent (also used by the hero scenes). */
export interface PlayModel {
  /** Under the wordmark: the mode, rules and board. */
  context: string;
  you: SeatModel;
  them: SeatModel;
  opponent: Opponent | null;
  /** What the player should know now, with an optional point in bold ("block at M9"). */
  status: { text: string; point?: string; urgent?: boolean } | null;
  read: { on: boolean; allowed: boolean; mine: Tally; theirs: Tally; offReason?: string };
  /** Progress against a ladder opponent. */
  record: { wins: number; needed: number; star: boolean } | null;
  speech: string | null;
  thinking?: boolean;
  moveNumber: number;
  lastMove: string | null;
  /** The headline in your seat when the game is won ("Five in a row"). */
  moment: string | null;
}

export interface PlayScreen {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  setContext(text: string): void;
  setSides(left: readonly Node[], right: readonly Node[]): void;
  /** The usual columns for a game against an opponent. */
  update(model: PlayModel): void;
  /** Lays a card over the board (results, pause, a question), or clears it with null. */
  setOverlay(card: HTMLElement | null): void;
  setLook(look: Look): void;
  /** Places the columns beside the board for a viewport, and returns the board's slot. */
  layout(width: number, height: number): ReturnType<typeof playLayout>;
  onToggleRead(handler: (on: boolean) => void): void;
  onGameMenu(handler: () => void): void;
  onPause(handler: () => void): void;
}

const MENU_ICON = 'M4 7h16M4 12h16M4 17h16';
const PAUSE_ICON = 'M9 6v12M15 6v12';

export function createPlayScreen(
  host: HTMLElement,
  look: Look,
  options: { ownPause: boolean; inHall: boolean },
): PlayScreen {
  let currentLook = look;
  let model: PlayModel | null = null;
  let toggleRead: (on: boolean) => void = () => {};
  let gameMenu: () => void = () => {};
  let pause: () => void = () => {};

  const canvas = h('canvas', { class: 'ff-canvas', 'aria-hidden': 'true' });
  const context = h('span', { class: 'ff-context' });
  const bar = h(
    'header',
    { class: 'ff-bar' },
    h(
      'div',
      {},
      h(
        'button',
        { class: 'ff-button', type: 'button', onclick: () => gameMenu() },
        icon(MENU_ICON, { stroke: true }),
        'Game menu',
      ),
    ),
    h('div', { class: 'ff-title' }, h('span', { class: 'ff-wordmark' }, 'Fivefold'), context),
    h(
      'div',
      { class: 'ff-bar__end' },
      options.ownPause
        ? h(
            'button',
            {
              class: 'ff-button',
              type: 'button',
              'aria-keyshortcuts': 'Escape',
              onclick: () => pause(),
            },
            icon(PAUSE_ICON, { stroke: true }),
            'Pause',
            h('kbd', {}, 'Esc'),
          )
        : null,
    ),
  );
  const left = h('aside', { class: 'ff-side ff-side--you', 'aria-label': 'Your side' });
  const right = h('aside', { class: 'ff-side ff-side--them', 'aria-label': 'The other side' });
  const overlay = h('div', { class: 'ff-overlays' });
  const root = h(
    'div',
    { class: `ff-root ff-play${options.inHall ? ' is-in-hall' : ''}`, 'data-look': look.id },
    canvas,
    bar,
    left,
    right,
    overlay,
  );
  host.append(root);

  function render() {
    if (!model) return;
    const m = model;
    context.textContent = m.context;
    left.replaceChildren(
      seatCard({
        look: currentLook,
        side: m.you.side,
        kicker: m.you.kicker,
        name: m.you.name,
        moment: m.moment,
        status: m.status,
      }),
      readCard({
        on: m.read.on,
        allowed: m.read.allowed,
        offReason: m.read.offReason ?? 'Off for this game: you read it yourself.',
        mine: { name: m.you.name, tally: m.read.mine },
        theirs: { name: m.them.name, tally: m.read.theirs },
        toggle: (on) => toggleRead(on),
      }),
      movesCard(m.moveNumber, m.lastMove),
    );
    right.replaceChildren(
      m.opponent
        ? opponentCard({
            look: currentLook,
            opponent: m.opponent,
            side: m.them.side,
            speech: m.speech,
            record: m.record,
            thinking: m.thinking,
          })
        : seatCard({
            look: currentLook,
            side: m.them.side,
            kicker: m.them.kicker,
            name: m.them.name,
          }),
    );
  }

  return {
    root,
    canvas,
    setContext(text) {
      context.textContent = text;
    },
    setSides(leftCards, rightCards) {
      model = null;
      left.replaceChildren(...leftCards);
      right.replaceChildren(...rightCards);
    },
    update(next) {
      model = next;
      render();
    },
    setOverlay(card) {
      overlay.replaceChildren(...(card ? [card] : []));
      card?.querySelector<HTMLElement>('h2, button')?.focus();
    },
    setLook(next) {
      currentLook = next;
      root.dataset.look = next.id;
      render();
    },
    layout(width, height) {
      const placed = playLayout(width, height);
      const gutter = Math.round(Math.max(16, Math.min(40, width * 0.019)));
      root.style.setProperty('--ff-gutter', `${gutter}px`);
      root.style.setProperty('--ff-slot-top', `${placed.slot.y}px`);
      root.style.setProperty('--ff-slot-left', `${placed.slot.x}px`);
      root.style.setProperty('--ff-slot-size', `${placed.slot.width}px`);
      root.style.setProperty('--ff-side', `${placed.slot.x - gutter * 2}px`);
      root.style.setProperty('--ff-bar', `${Math.max(56, Math.min(76, placed.slot.y - 12))}px`);
      return placed;
    },
    onToggleRead(handler) {
      toggleRead = handler;
    },
    onGameMenu(handler) {
      gameMenu = handler;
    },
    onPause(handler) {
      pause = handler;
    },
  };
}
