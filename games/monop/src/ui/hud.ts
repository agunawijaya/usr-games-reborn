import type { BoardTheme } from '../boards/themes';
import type { PersonalityId } from '../engine/rivals';
import { portrait } from './avatars';
import { coins, dieFace, element, emblemBadge } from './parts';

/**
 * The play screen's panels over the world: the board and round at the top left, the players
 * down the left, the current lot's card on the right, what just happened along the top, and
 * the actions along the bottom. Every number the player needs is here in plain type; the
 * world behind is for delight, not for reading prices. The top right stays clear for the
 * Hall's pause pill and the bottom left for its toasts.
 */

export interface SeatView {
  readonly name: string;
  readonly title?: string;
  readonly colour: string;
  readonly token: string;
  readonly coins: number;
  readonly worth: number;
  readonly portrait?: PersonalityId;
  readonly you?: boolean;
  readonly active?: boolean;
  /** One short line: "Rolling", "In the lock-up", "Thinking…" */
  readonly status?: string;
  /** The groups this seat owns streets in, and how much of each. */
  readonly groups: readonly { colour: string; owned: number; of: number }[];
}

export interface PropertyView {
  readonly name: string;
  readonly groupName: string;
  readonly groupColour: string;
  readonly price: number;
  readonly rents: readonly number[];
  readonly level: number;
  readonly buildCost: number;
  readonly mortgage: number;
  readonly owner?: { readonly name: string; readonly colour: string; readonly token: string };
  /** What the player owes on landing, if anything. */
  readonly due?: number;
  /** Rows in place of the building ladder, for transit stops and utilities. */
  readonly rows?: readonly {
    readonly label: string;
    readonly html: string;
    readonly now?: boolean;
  }[];
  readonly mortgaged?: boolean;
  /** The coach's line about this lot, when the coach is on. */
  readonly advice?: string;
}

export interface ActionView {
  readonly id: string;
  readonly label: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly primary?: boolean;
}

export interface HudView {
  readonly board: BoardTheme;
  readonly mode: string;
  readonly round: number;
  /** The last round, or null when the game runs until one player is left. */
  readonly rounds: number | null;
  /** "Round", or "Turn" in a scenario, where the rounds are your turns. */
  readonly roundWord?: string;
  readonly seats: readonly SeatView[];
  readonly banner?: { readonly dice?: readonly [number, number]; readonly text: string };
  readonly property?: PropertyView;
  readonly actions: readonly ActionView[];
  readonly log: readonly string[];
  /** The flat map is showing; the badge offers the way back to the town. */
  readonly mapView?: boolean;
  /** A scenario's goals and how far along each is. */
  readonly goals?: readonly {
    readonly text: string;
    readonly progress: string;
    readonly done: boolean;
  }[];
}

const LEVEL_NAMES = [
  'Bare lot',
  'One storey',
  'Two storeys',
  'Three storeys',
  'Four storeys',
  'Landmark',
];

function boardBadge(view: HudView): HTMLElement {
  const badge = element('section', 'dd-panel dd-badge-panel');
  const word = view.roundWord ?? 'Round';
  const progress =
    view.rounds === null
      ? ''
      : `<div class="dd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${view.rounds}" aria-valuenow="${view.round}"><span style="width:${(Math.min(1, view.round / view.rounds) * 100).toFixed(1)}%"></span></div>`;
  badge.innerHTML = `<h1 class="dd-board-name">${view.board.name}</h1>
    <p class="dd-round">${view.mode} · ${word} ${view.round}${view.rounds === null ? '' : ` of ${view.rounds}`}</p>
    ${progress}${goalList(view.goals)}
    <button type="button" class="dd-link dd-view-toggle" data-action="map">${view.mapView ? 'Town view' : 'Map view'} <kbd>V</kbd></button>`;
  return badge;
}

function goalList(goals: HudView['goals']): string {
  if (!goals?.length) return '';
  const rows = goals
    .map(
      (g) =>
        `<li class="${g.done ? 'dd-goal--done' : ''}"><span>${g.text}</span><strong>${g.done ? '✓' : g.progress}</strong></li>`,
    )
    .join('');
  return `<ul class="dd-goals" aria-label="Goals">${rows}</ul>`;
}

function seatCard(seat: SeatView): HTMLElement {
  const card = element('li', `dd-panel dd-seat${seat.active ? ' dd-seat--active' : ''}`);
  card.style.setProperty('--seat', seat.colour);
  const face = seat.portrait
    ? portrait(seat.portrait, 44)
    : emblemBadge(seat.token, seat.colour, 44);
  const groups = seat.groups
    .map(
      (g) =>
        `<span class="dd-pip${g.owned === g.of ? ' dd-pip--full' : ''}" style="--pip:${g.colour}" title="${g.owned} of ${g.of}"></span>`,
    )
    .join('');
  card.innerHTML = `<div class="dd-seat-face">${face}${seat.portrait ? `<span class="dd-seat-token">${emblemBadge(seat.token, seat.colour, 22)}</span>` : ''}</div>
    <div class="dd-seat-body">
      <p class="dd-seat-name">${seat.name}${seat.title ? ` <span class="dd-seat-title">${seat.title}</span>` : ''}</p>
      <p class="dd-seat-coins">${coins(seat.coins)}<span class="dd-seat-worth">worth ${seat.worth.toLocaleString('en-GB')}</span></p>
      <p class="dd-seat-groups">${groups}${seat.status ? `<span class="dd-seat-status">${seat.status}</span>` : ''}</p>
    </div>`;
  return card;
}

function banner(view: NonNullable<HudView['banner']>): HTMLElement {
  const node = element('section', 'dd-panel dd-banner');
  node.setAttribute('aria-live', 'polite');
  const dice = view.dice
    ? `<span class="dd-banner-dice">${dieFace(view.dice[0], 30)}${dieFace(view.dice[1], 30)}</span>`
    : '';
  node.innerHTML = `${dice}<span class="dd-banner-text">${view.text}</span>`;
  return node;
}

function propertyCard(p: PropertyView): HTMLElement {
  const card = element('section', 'dd-panel dd-card');
  card.style.setProperty('--group', p.groupColour);
  const ladder =
    p.rows ??
    p.rents.map((rent, level) => ({
      label: LEVEL_NAMES[level]!,
      html: coins(rent),
      now: level === p.level,
    }));
  const rows = ladder
    .map(
      (row) =>
        `<tr class="${row.now ? 'dd-card-now' : ''}"><th scope="row">${row.label}</th><td>${row.html}</td></tr>`,
    )
    .join('');
  const owner = p.owner
    ? `<p class="dd-card-owner">${emblemBadge(p.owner.token, p.owner.colour, 26)}<span>Owned by <strong>${p.owner.name}</strong></span></p>`
    : `<p class="dd-card-owner dd-card-owner--free">For sale · ${coins(p.price)}</p>`;
  const due =
    p.due !== undefined ? `<p class="dd-card-due"><span>You pay</span>${coins(p.due)}</p>` : '';
  const mortgaged = p.mortgaged
    ? '<p class="dd-card-note">Mortgaged: no rent until it is paid off.</p>'
    : '';
  const advice = p.advice ? `<p class="dd-card-advice"><span>Coach</span>${p.advice}</p>` : '';
  card.innerHTML = `<header class="dd-card-band"><span>${p.groupName}</span></header>
    <h2 class="dd-card-name">${p.name}</h2>
    ${owner}
    <table class="dd-card-rents"><caption>Rent</caption><tbody>${rows}</tbody></table>
    <p class="dd-card-meta">${p.buildCost > 0 ? `<span>Build ${coins(p.buildCost)}</span>` : ''}<span>Mortgage ${coins(p.mortgage)}</span></p>
    ${mortgaged}${due}${advice}`;
  return card;
}

function actionBar(actions: readonly ActionView[]): HTMLElement {
  const bar = element('nav', 'dd-panel dd-actions');
  bar.setAttribute('aria-label', 'Your turn');
  for (const action of actions) {
    const button = element(
      'button',
      `dd-action${action.primary ? ' dd-action--primary' : ''}`,
      `<span>${action.label}</span><kbd>${action.key}</kbd>`,
    );
    button.type = 'button';
    button.disabled = !action.enabled;
    button.dataset.action = action.id;
    bar.append(button);
  }
  return bar;
}

function ticker(lines: readonly string[]): HTMLElement {
  const node = element('section', 'dd-panel dd-ticker');
  node.setAttribute('aria-label', 'What happened');
  node.innerHTML = `<ol>${lines.map((line) => `<li>${line}</li>`).join('')}</ol>`;
  return node;
}

/** Builds the play screen's panels into `root`, replacing what was there. */
export function renderHud(root: HTMLElement, view: HudView): void {
  root.replaceChildren();
  root.classList.add('dd-hud');
  const left = element('div', 'dd-left');
  left.append(boardBadge(view));
  const seats = element('ol', 'dd-seats');
  seats.setAttribute('aria-label', 'Players');
  for (const seat of view.seats) seats.append(seatCard(seat));
  left.append(seats);
  root.append(left);
  if (view.banner) root.append(banner(view.banner));
  if (view.property) root.append(propertyCard(view.property));
  root.append(actionBar(view.actions));
  if (view.log.length) root.append(ticker(view.log));
}
