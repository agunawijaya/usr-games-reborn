import type { BoardId } from '../boards/themes';
import type { PersonalityId } from '../engine/rivals';
import { HOUSE_RULE_NAMES } from '../engine/rules';
import type { Difficulty, HouseRules } from '../engine/types';
import type { SeatChoice, TableChoices } from '../app/saves';
import { page } from './pages';
import { emblemBadge } from './parts';

/**
 * New game: the board, who sits at the table (you, rivals with a personality and a level, or
 * friends taking turns at the same screen), Quick or Classic, Standard or Berkeley 1980 rules,
 * the house rules and the coach. Native controls throughout, so every choice works by keyboard.
 */

export interface SetupView {
  readonly table: TableChoices;
  readonly boards: readonly { readonly id: BoardId; readonly name: string }[];
  readonly personalities: readonly {
    readonly id: PersonalityId;
    readonly name: string;
    readonly title: string;
  }[];
  readonly colours: readonly string[];
  /** Your token choices on the chosen board; locked ones say which title opens them. */
  readonly tokens: readonly {
    readonly id: string;
    readonly name: string;
    readonly open: boolean;
    readonly chosen: boolean;
    readonly unlock?: string;
  }[];
  /** Rounds in a Quick game at this table size. */
  readonly quickRounds: number;
}

const LEVELS: readonly { id: Difficulty; name: string }[] = [
  { id: 'easy', name: 'Easy' },
  { id: 'medium', name: 'Medium' },
  { id: 'hard', name: 'Hard' },
];

function seatRow(view: SetupView, choice: SeatChoice, index: number): string {
  const colour = view.colours[index]!;
  const swatch = `<span class="dd-setup-swatch" style="--seat:${colour}" aria-hidden="true"></span>`;
  if (choice.kind === 'you') {
    const tokens = view.tokens
      .map(
        (t) =>
          `<button type="button" class="dd-token-pick" data-act="token" data-token="${t.id}" aria-pressed="${t.chosen}" ${t.open ? '' : 'disabled'} title="${t.open ? t.name : `${t.name}: ${t.unlock}`}">${emblemBadge(t.id, t.open ? colour : '#8a8f99', 34)}<span class="dd-visually-hidden">${t.name}</span></button>`,
      )
      .join('');
    return `<li class="dd-setup-seat">${swatch}<span class="dd-setup-seat-name">You</span><span class="dd-token-picks" role="group" aria-label="Your token">${tokens}</span></li>`;
  }
  const options = [
    ...view.personalities.map(
      (p) =>
        `<option value="rival:${p.id}" ${choice.kind === 'rival' && choice.personality === p.id ? 'selected' : ''}>${p.name}, ${p.title}</option>`,
    ),
    `<option value="guest" ${choice.kind === 'guest' ? 'selected' : ''}>A friend at this screen</option>`,
  ].join('');
  const level =
    choice.kind === 'rival'
      ? `<select data-field="difficulty" data-seat="${index}" aria-label="Seat ${index + 1} level">${LEVELS.map((l) => `<option value="${l.id}" ${choice.difficulty === l.id ? 'selected' : ''}>${l.name}</option>`).join('')}</select>`
      : `<span class="dd-setup-guest">Player ${index + 1}</span>`;
  const remove =
    view.table.seats.length > 2
      ? `<button type="button" class="dd-close" data-act="remove" data-seat="${index}" aria-label="Remove seat ${index + 1}">✕</button>`
      : '';
  return `<li class="dd-setup-seat">${swatch}<select data-field="seat" data-seat="${index}" aria-label="Seat ${index + 1}">${options}</select>${level}${remove}</li>`;
}

function radio(
  name: string,
  value: string,
  checked: boolean,
  title: string,
  detail: string,
): string {
  return `<label class="dd-choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}/><span><strong>${title}</strong><small>${detail}</small></span></label>`;
}

export function renderSetup(root: HTMLElement, view: SetupView): HTMLElement {
  const { table } = view;
  const boards = view.boards
    .map(
      (b, i) =>
        `<button type="button" class="dd-board-pick" role="radio" aria-checked="${b.id === table.board}" data-act="board" data-board="${b.id}"><kbd>${i + 1}</kbd><span>${b.name}</span></button>`,
    )
    .join('');
  const seats = table.seats.map((choice, i) => seatRow(view, choice, i)).join('');
  const house = (Object.keys(HOUSE_RULE_NAMES) as (keyof HouseRules)[])
    .map(
      (key) =>
        `<label class="dd-choice"><input type="checkbox" data-field="house" value="${key}" ${table.house[key] ? 'checked' : ''}/><span><strong>${HOUSE_RULE_NAMES[key].label}</strong><small>${HOUSE_RULE_NAMES[key].detail}</small></span></label>`,
    )
    .join('');
  const body = `<header class="dd-sheet-head"><p class="dd-moment-kicker">New game</p><h2>Set the table</h2></header>
    <div class="dd-board-picks" role="radiogroup" aria-label="Board">${boards}</div>
    <div class="dd-setup-columns">
      <section aria-labelledby="dd-setup-seats">
        <h3 id="dd-setup-seats">Seats</h3>
        <ol class="dd-setup-seats">${seats}</ol>
        ${table.seats.length < 6 ? '<button type="button" class="dd-action" data-act="add"><span>Add a seat</span><kbd>+</kbd></button>' : ''}
        <p class="dd-setup-note">Friends at this screen take their turns in their own seats; the game counts for your career only.</p>
      </section>
      <section aria-labelledby="dd-setup-rules">
        <h3 id="dd-setup-rules">Game</h3>
        <fieldset><legend class="dd-visually-hidden">Length</legend>
          ${radio('mode', 'quick', table.mode === 'quick', 'Quick', `${view.quickRounds} rounds, about thirty minutes; the richest wins.`)}
          ${radio('mode', 'classic', table.mode === 'classic', 'Classic', 'Play on until one player is left standing.')}
        </fieldset>
        <fieldset><legend class="dd-visually-hidden">Rules</legend>
          ${radio('preset', 'standard', table.preset === 'standard', 'Standard rules', 'Auctions for declined lots, a limited stock of buildings.')}
          ${radio('preset', 'berkeley', table.preset === 'berkeley', 'Berkeley 1980', 'The original program: the bank lends to anyone, and no auction once two remain.')}
        </fieldset>
        <fieldset><legend>House rules</legend>${house}</fieldset>
        <label class="dd-choice"><input type="checkbox" data-field="coach" ${table.coach ? 'checked' : ''}/><span><strong>Coach</strong><small>Landing heat, payback times and a trade meter. Your best worth counts only from games without it.</small></span></label>
      </section>
    </div>
    <nav class="dd-menu-actions">
      <button type="button" class="dd-action dd-action--primary" data-act="start"><span>Start</span><kbd>Enter</kbd></button>
    </nav>`;
  return page(root, 'dd-setup', 'New game', body);
}
