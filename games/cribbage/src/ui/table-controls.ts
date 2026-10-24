import { type CardId, cardName } from '@usr-games/kit/cards';
import { el } from './hud';

/**
 * The controls that sit on the table itself, on the design sheet: a clear button over each of
 * your cards (so the hand can be reached with the keyboard and read by a screen reader, and so
 * focus shows as a ring round the card), the coach's note, and the pad for claiming your count.
 */

export interface HandButton {
  card: CardId;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  /** Pressed in the lay-away: chosen for the crib. */
  pressed?: boolean;
  /** Cannot be laid now (it would pass 31). */
  unavailable?: boolean;
  hint?: string;
}

export class HandButtons {
  readonly element = el('div', 'ft-hand');
  private readonly buttons = new Map<CardId, HTMLButtonElement>();

  constructor(private readonly onActivate: (card: CardId) => void) {
    this.element.setAttribute('role', 'group');
    this.element.setAttribute('aria-label', 'Your hand');
  }

  /** Places one clear button over each card; buttons for cards gone from the hand go too. */
  update(cards: readonly HandButton[]): void {
    const keep = new Set(cards.map((card) => card.card));
    for (const [card, button] of this.buttons) {
      if (!keep.has(card)) {
        button.remove();
        this.buttons.delete(card);
      }
    }
    for (const card of cards) {
      let button = this.buttons.get(card.card);
      if (!button) {
        button = el('button', 'ft-hand__card');
        button.type = 'button';
        button.dataset.card = String(card.card);
        button.dataset.testid = 'ft-hand-card';
        const id = card.card;
        // Only keyboard clicks (detail 0): pointer presses are taken by the table's drag handler.
        button.addEventListener('click', (event) => {
          if (event.detail === 0) this.onActivate(id);
        });
        this.buttons.set(card.card, button);
        this.element.append(button);
      }
      const style = button.style;
      style.left = `${card.x - card.width / 2}px`;
      style.top = `${card.y - card.height / 2}px`;
      style.width = `${card.width}px`;
      style.height = `${card.height}px`;
      style.transform = `rotate(${card.angle}rad)`;
      const state = [
        card.pressed ? 'chosen for the crib' : '',
        card.unavailable ? 'too big to lay now' : '',
        card.hint ?? '',
      ]
        .filter(Boolean)
        .join(', ');
      button.setAttribute(
        'aria-label',
        state ? `${cardName(card.card)}, ${state}` : cardName(card.card),
      );
      if (card.pressed !== undefined) button.setAttribute('aria-pressed', String(card.pressed));
      else button.removeAttribute('aria-pressed');
      button.setAttribute('aria-disabled', String(Boolean(card.unavailable)));
    }
    // Keep the buttons in hand order, so Tab and the arrows walk the cards left to right.
    const order = cards.map((card) => this.buttons.get(card.card)!);
    order.forEach((button, i) => {
      if (this.element.children[i] !== button)
        this.element.insertBefore(button, this.element.children[i] ?? null);
    });
  }

  focus(card: CardId): void {
    this.buttons.get(card)?.focus({ preventScroll: true });
  }

  focusedCard(): CardId | null {
    const active = document.activeElement;
    if (!(active instanceof HTMLButtonElement) || !this.element.contains(active)) return null;
    return Number(active.dataset.card);
  }

  cards(): CardId[] {
    return [...this.buttons.keys()];
  }
}

/** The coach's note beside your hand. */
export class CoachNote {
  readonly element = el('aside', 'ft-coach ft-panel');
  private readonly title = el('div', 'ft-coach__title', 'Coach');
  private readonly body = el('div', 'ft-coach__body');

  constructor() {
    this.element.setAttribute('aria-label', 'Coach');
    this.element.dataset.testid = 'ft-coach';
    this.element.append(this.title, this.body);
    this.element.hidden = true;
  }

  /** The first line is the advice; `figures` sets the rest as aligned numbers. */
  show(lines: string[] | null, figures = false): void {
    if (!lines || lines.length === 0) {
      this.element.hidden = true;
      return;
    }
    this.element.hidden = false;
    this.element.dataset.figures = String(figures);
    this.body.replaceChildren(
      ...lines.map((line, i) =>
        el(i === 0 ? 'p' : 'p', i === 0 ? 'ft-coach__main' : 'ft-coach__line', line),
      ),
    );
  }
}

/** The pad for claiming a count: type the number (0–29) or press the digits, then Count. */
export class ClaimPad {
  readonly element = el('form', 'ft-claim ft-panel');
  private readonly title = el('div', 'ft-claim__title');
  private readonly input = el('input', 'ft-claim__input');
  private readonly error = el('div', 'ft-claim__error');
  private submitHandler: ((value: number) => void) | null = null;

  constructor() {
    this.element.dataset.testid = 'ft-claim';
    this.element.setAttribute('aria-label', 'Your count');
    this.input.type = 'text';
    this.input.inputMode = 'numeric';
    this.input.maxLength = 2;
    this.input.autocomplete = 'off';
    this.input.dataset.testid = 'ft-claim-input';
    this.input.setAttribute('aria-label', 'Points in this hand');
    const digits = el('div', 'ft-claim__digits');
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
      const key = el('button', 'ft-claim__digit', digit);
      key.type = 'button';
      key.tabIndex = -1;
      key.addEventListener('click', () => {
        if (this.input.value.length < 2) this.input.value += digit;
        this.input.focus();
      });
      digits.append(key);
    }
    const clear = el('button', 'ft-claim__digit ft-claim__digit--wide', '⌫');
    clear.type = 'button';
    clear.tabIndex = -1;
    clear.setAttribute('aria-label', 'Delete a digit');
    clear.addEventListener('click', () => {
      this.input.value = this.input.value.slice(0, -1);
      this.input.focus();
    });
    digits.append(clear);
    const submit = el('button', 'ft-button', 'Count it');
    submit.type = 'submit';
    submit.dataset.testid = 'ft-claim-submit';
    submit.append(el('span', 'ft-key', 'Enter'));
    const row = el('div', 'ft-claim__row');
    row.append(this.input, submit);
    this.element.append(this.title, row, digits, this.error);
    this.element.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = this.input.value.trim();
      const value = /^\d{1,2}$/.test(text) ? Number(text) : NaN;
      if (!Number.isInteger(value) || value > 29) {
        this.error.textContent = 'A whole number from 0 to 29, please.';
        this.input.focus();
        return;
      }
      this.error.textContent = '';
      this.submitHandler?.(value);
    });
    this.element.hidden = true;
  }

  open(title: string, onSubmit: (value: number) => void): void {
    this.title.textContent = title;
    this.input.value = '';
    this.error.textContent = '';
    this.submitHandler = onSubmit;
    this.element.hidden = false;
    this.input.focus({ preventScroll: true });
  }

  close(): void {
    this.submitHandler = null;
    this.element.hidden = true;
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }
}
