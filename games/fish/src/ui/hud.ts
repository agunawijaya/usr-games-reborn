import type { Rank } from '@usr-games/kit/cards';
import type { Knowledge } from '../engine/knowledge';
import type { Rect } from '../render/layout';
import { applyLook, h, svg } from './dom';
import { CARD_ICON, FISH_ICON, GOLD_FISH_ICON } from './icons';
import { lineText, type LogLine, rankShort, rankWord } from './words';
import type { Look } from '../render/look';

/**
 * The panels over the pond, kept as live elements and updated in place so keyboard focus never
 * jumps: a name plate per rival (press 1–3 to choose who to ask), a speech bubble, the ask bar
 * of ranks you hold, the notebook with its grid and log, the bucket's card, the pond's count
 * and the mode in the corner. The game decides what they say; this file only shows it.
 */

export interface RivalPlate {
  name: string;
  cards: number;
  books: number;
  goldens: number;
  selected: boolean;
  turn: boolean;
  /** Centre of the rival and the top of its head, in screen pixels. */
  anchor: { x: number; top: number };
  /** Their number key is live: you are choosing whom to ask. */
  choosing?: boolean;
}

export type AskMode = 'choose-rival' | 'choose-rank' | 'message';

export interface HudModel {
  look: Look;
  s: number;
  status: { title: string; mode: string };
  rivals: readonly RivalPlate[];
  speech: { rival: number; text: string; loud?: boolean } | null;
  ask: {
    rect: Rect;
    /** Choosing a rival, choosing a rank, or a message while answers play out. */
    mode: AskMode;
    target: string | null;
    /** The rival asked last, whom Enter picks again. */
    again?: string | null;
    ranks: readonly { rank: Rank; count: number }[];
    selectedRank: Rank | null;
    /** The message, in message mode. */
    message?: string;
    /** A short word of news at the front of the bar ("Lucky catch!"). */
    note?: string | null;
  };
  notebook: {
    rect: Rect;
    open: boolean;
    rivals: readonly string[];
    knowledge: Knowledge | null;
    myRanks: ReadonlySet<Rank>;
    lines: readonly LogLine[];
    /** The rival chosen in the ask bar, whose row is marked. */
    selected: number | null;
  };
  bucket: { anchor: { x: number; y: number }; fish: number; goldens: number };
  pond: { anchor: { x: number; y: number }; cards: number };
}

export interface HudActions {
  chooseRival(index: number): void;
  ask(rank: Rank): void;
  toggleNotebook(): void;
}

const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export class Hud {
  readonly element: HTMLDivElement;
  private readonly plates: HTMLButtonElement[] = [];
  private readonly bubble = h('div', { class: 'gf-bubble', role: 'status' });
  private readonly status = h('div', { class: 'gf-status gf-panel' });
  private readonly askBar = h('div', {
    class: 'gf-askbar gf-panel',
    role: 'group',
    'aria-label': 'Ask for a rank',
  });
  private readonly notebook = h('aside', {
    class: 'gf-notebook gf-panel',
    'aria-label': 'Notebook',
  });
  private readonly bucketLabel = h('div', { class: 'gf-label gf-panel' });
  private readonly pondLabel = h('div', { class: 'gf-label gf-panel' });

  constructor(private readonly actions: HudActions) {
    this.element = h('div', { class: 'gf-hud' });
    this.element.append(
      this.status,
      this.pondLabel,
      this.bubble,
      this.askBar,
      this.notebook,
      this.bucketLabel,
    );
  }

  render(model: HudModel, root: HTMLElement): void {
    // Panels are rebuilt in place; whatever had keyboard focus gets it back afterwards.
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.focusKey
        : undefined;
    applyLook(root, model.look);
    this.renderStatus(model);
    this.renderPlates(model);
    this.renderBubble(model);
    this.renderAskBar(model);
    this.renderNotebook(model);
    this.renderLabels(model);
    if (focused && !this.element.contains(document.activeElement)) {
      this.element.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focused)}"]`)?.focus();
    }
  }

  private renderStatus(model: HudModel): void {
    this.status.replaceChildren(
      h('span', { class: 'gf-status-title' }, model.status.title),
      h('span', { class: 'gf-status-mode' }, model.status.mode),
    );
  }

  private renderPlates(model: HudModel): void {
    while (this.plates.length < model.rivals.length) {
      const index = this.plates.length;
      const plate = h('button', {
        class: 'gf-plate gf-panel',
        type: 'button',
        'data-focus-key': `plate-${index}`,
        'data-testid': `gf-plate-${index + 1}`,
      });
      plate.addEventListener('click', () => this.actions.chooseRival(index));
      this.plates.push(plate);
      this.element.append(plate);
    }
    this.plates.forEach((plate, index) => {
      const rival = model.rivals[index];
      plate.hidden = !rival;
      if (!rival) return;
      plate.setAttribute('aria-pressed', String(rival.selected));
      plate.dataset.turn = String(rival.turn);
      plate.dataset.choosing = String(Boolean(rival.choosing));
      plate.setAttribute(
        'aria-label',
        `${rival.name}: ${rival.cards} cards, ${rival.books} books. Press ${index + 1} to ask ${rival.name}.`,
      );
      plate.style.left = `${rival.anchor.x}px`;
      plate.style.top = `${rival.anchor.top - 18 * model.s}px`;
      plate.replaceChildren(
        h('span', { class: 'gf-plate-key', 'aria-hidden': 'true' }, String(index + 1)),
        h('span', { class: 'gf-plate-name' }, rival.name),
        h(
          'span',
          { class: 'gf-plate-stats', 'aria-hidden': 'true' },
          h('span', { class: 'gf-plate-stat' }, svg(CARD_ICON), String(rival.cards)),
          h(
            'span',
            { class: 'gf-plate-stat' },
            svg(rival.goldens > 0 ? GOLD_FISH_ICON : FISH_ICON),
            String(rival.books),
          ),
        ),
      );
    });
  }

  private renderBubble(model: HudModel): void {
    const speech = model.speech;
    const plate = speech ? model.rivals[speech.rival] : undefined;
    this.bubble.hidden = !speech || !plate;
    if (!speech || !plate) return;
    this.bubble.textContent = speech.text;
    this.bubble.dataset.loud = String(Boolean(speech.loud));
    // Beside the head on the pond's side, its tail pointing back at the speaker.
    const side = plate.anchor.x > model.ask.rect.x + model.ask.rect.w / 2 + 40 ? -1 : 1;
    this.bubble.dataset.side = side > 0 ? 'right' : 'left';
    this.bubble.style.left = `${plate.anchor.x + side * 96 * model.s}px`;
    this.bubble.style.top = `${plate.anchor.top + 58 * model.s}px`;
  }

  private renderAskBar(model: HudModel): void {
    const { rect, mode, target, again, ranks, selectedRank, message, note } = model.ask;
    Object.assign(this.askBar.style, {
      left: `${rect.x + rect.w / 2}px`,
      top: `${rect.y}px`,
      maxWidth: `${rect.w}px`,
      height: `${rect.h}px`,
    });
    this.askBar.dataset.mode = mode;
    if (mode === 'message') {
      this.askBar.replaceChildren(
        h('span', { class: 'gf-ask-message', 'data-testid': 'gf-ask-message' }, message ?? ''),
      );
      return;
    }
    const lead =
      mode === 'choose-rival'
        ? h(
            'span',
            { class: 'gf-ask-lead' },
            'Who will you ask?',
            h('span', { class: 'gf-ask-keys' }, again ? `1–3 · Enter: ${again}` : '1–3 or a name'),
          )
        : h('span', { class: 'gf-ask-lead' }, 'Ask ', h('strong', {}, target ?? ''), ' for');
    const buttons = ranks.map(({ rank, count }) =>
      h(
        'button',
        {
          class: 'gf-rank',
          type: 'button',
          'data-focus-key': `rank-${rank}`,
          'data-testid': `gf-rank-${rankShort(rank)}`,
          'aria-pressed': String(selectedRank === rank),
          'aria-label': `${rankWord(rank)}, ${count} in your hand`,
          'aria-keyshortcuts': rank === 10 ? '0' : rankShort(rank),
          'aria-disabled': mode === 'choose-rival' ? 'true' : undefined,
          onclick: () => this.actions.ask(rank),
        },
        rankShort(rank),
        h('span', { class: 'gf-rank-count', 'aria-hidden': 'true' }, `×${count}`),
      ),
    );
    this.askBar.replaceChildren(
      ...(note ? [h('span', { class: 'gf-ask-note' }, note)] : []),
      lead,
      h('div', { class: 'gf-ranks' }, ...buttons),
    );
  }

  private renderNotebook(model: HudModel): void {
    const book = model.notebook;
    Object.assign(this.notebook.style, {
      left: `${book.rect.x}px`,
      top: `${book.rect.y}px`,
      width: `${book.rect.w}px`,
      height: book.open ? `${book.rect.h}px` : 'auto',
    });
    const toggle = h(
      'button',
      {
        class: 'gf-switch',
        type: 'button',
        role: 'switch',
        'aria-checked': String(book.open),
        'aria-label': 'Notebook',
        'aria-keyshortcuts': 'N',
        'data-focus-key': 'notebook',
        'data-testid': 'gf-notebook-switch',
        onclick: () => this.actions.toggleNotebook(),
      },
      book.open ? 'On' : 'Off',
      h('span', { class: 'gf-switch-track', 'aria-hidden': 'true' }),
    );
    const head = h(
      'div',
      { class: 'gf-notebook-head' },
      h('h2', { class: 'gf-notebook-title' }, 'Notebook'),
      toggle,
    );
    if (!book.open) {
      this.notebook.replaceChildren(head);
      return;
    }
    this.notebook.replaceChildren(
      head,
      h(
        'div',
        { class: 'gf-notebook-body' },
        h('h3', { class: 'gf-section-title' }, 'Who has shown what'),
        this.grid(book),
        h('h3', { class: 'gf-section-title' }, 'At the pond'),
        h(
          'ol',
          { class: 'gf-log', reversed: '' },
          ...book.lines.map((line, i) =>
            h(
              'li',
              { 'data-fresh': String(i === 0) },
              ...line.parts.map((part) =>
                part.kind ? h('span', { class: `gf-${part.kind}` }, part.text) : part.text,
              ),
            ),
          ),
        ),
      ),
    );
  }

  private grid(book: HudModel['notebook']): HTMLElement {
    const grid = h('div', {
      class: 'gf-grid',
      role: 'table',
      'aria-label': 'Ranks each rival has shown',
    });
    const knowledge = book.knowledge;
    grid.append(h('span', { role: 'columnheader' }));
    for (const rank of RANKS) {
      grid.append(
        h(
          'span',
          {
            class: 'gf-grid-head',
            role: 'columnheader',
            'data-mine': String(book.myRanks.has(rank)),
            'data-booked': String(knowledge?.isBooked(rank) ?? false),
          },
          rankShort(rank),
        ),
      );
    }
    book.rivals.forEach((name, i) => {
      const seat = i + 1;
      grid.append(
        h(
          'span',
          {
            class: 'gf-grid-name',
            role: 'rowheader',
            'data-selected': String(book.selected === i),
          },
          name,
        ),
      );
      for (const rank of RANKS) {
        const { state, text, label } = cellFor(knowledge, seat, rank);
        grid.append(
          h(
            'span',
            { class: 'gf-cell', role: 'cell', 'data-state': state, 'aria-label': label },
            text,
          ),
        );
      }
    });
    return grid;
  }

  private renderLabels(model: HudModel): void {
    const bucket = model.bucket;
    this.bucketLabel.style.left = `${bucket.anchor.x}px`;
    this.bucketLabel.style.top = `${bucket.anchor.y}px`;
    this.bucketLabel.replaceChildren(
      'Your bucket · ',
      h('strong', {}, String(bucket.fish)),
      bucket.fish === 1 ? ' fish' : ' fish',
      bucket.goldens > 0 ? ` (${bucket.goldens} golden)` : '',
    );
    const pond = model.pond;
    this.pondLabel.style.left = `${pond.anchor.x}px`;
    this.pondLabel.style.top = `${pond.anchor.y}px`;
    this.pondLabel.replaceChildren('Pond · ', h('strong', {}, String(pond.cards)), ' cards');
  }
}

function cellFor(
  knowledge: Knowledge | null,
  seat: number,
  rank: Rank,
): { state: string; text: string; label: string } {
  if (!knowledge || knowledge.isBooked(rank)) return { state: 'empty', text: '', label: '' };
  const known = knowledge.knownCount(seat, rank);
  if (known > 0) {
    return {
      state: 'has',
      text: String(known),
      label: `has at least ${known} ${rankWord(rank, known)}`,
    };
  }
  const since = knowledge.drawsSinceNone(seat, rank);
  if (since === 0) return { state: 'none', text: '✕', label: `has no ${rankWord(rank)}` };
  // A "no" fades as they draw: after a couple of cards it is no longer worth remembering.
  if (since !== null && since <= 2) {
    return {
      state: 'maybe',
      text: '✕',
      label: `had no ${rankWord(rank)}, has drawn ${since} since`,
    };
  }
  return { state: 'empty', text: '', label: '' };
}

/** The log as plain sentences, newest first, for the screen reader's history. */
export function logText(lines: readonly LogLine[]): string[] {
  return lines.map(lineText);
}
