import type { ShowCombo } from '../engine/score';
import { pairName } from '../engine/score';
import type { Frame } from '../render/layout';

/**
 * The HTML over the table, on a design sheet that scales with the canvas: the status card, the
 * prompt bar, the counting ledger and the key strip, plus a polite live region that reads every
 * count and score aloud for screen readers.
 */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The little peg-board badge on the status card. */
const BOARD_ICON =
  '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="8" y="2.5" width="12" height="23" rx="5"/><circle cx="12" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="11" r="1.2" fill="currentColor"/><circle cx="12" cy="14" r="1.2" fill="currentColor"/><circle cx="16" cy="17" r="1.2" fill="currentColor"/><circle cx="12" cy="20" r="1.2" fill="currentColor"/></svg>';

export function comboLabel(combo: ShowCombo): string {
  switch (combo.kind) {
    case 'fifteen':
      return 'Fifteen';
    case 'run':
      return `Run of ${['', '', '', 'three', 'four', 'five'][combo.cards.length] ?? combo.cards.length}`;
    case 'pair':
      return pairName(combo.cards.length);
    case 'flush':
      return `Flush of ${combo.cards.length === 5 ? 'five' : 'four'}`;
    case 'nobs':
      return 'His nobs';
  }
}

export interface LedgerState {
  title: string;
  combos: ShowCombo[];
  /** How many combos are showing; the last of them is the one being counted. */
  shown: number;
  total: number;
  note?: string;
  perfect?: boolean;
}

export class Hud {
  readonly sheet = el('div', 'ft-sheet');
  readonly status = el('div', 'ft-status ft-panel');
  private readonly statusName = el('div', 'ft-status__name');
  private readonly statusLine = el('div', 'ft-status__line');
  readonly prompt = el('div', 'ft-prompt ft-panel');
  readonly promptText = el('span', 'ft-prompt__text');
  readonly promptActions = el('span', 'ft-prompt__actions');
  readonly ledger = el('section', 'ft-ledger ft-panel');
  private readonly ledgerTitle = el('div', 'ft-ledger__title');
  private readonly ledgerItems = el('ol', 'ft-ledger__items');
  private readonly ledgerTotal = el('div', 'ft-ledger__total');
  private readonly ledgerNote = el('div', 'ft-ledger__note');
  readonly keys = el('div', 'ft-keys');
  readonly live = el('div', 'ft-sr');

  constructor() {
    const badge = el('div', 'ft-status__badge');
    badge.innerHTML = BOARD_ICON;
    const words = el('div');
    words.append(this.statusName, this.statusLine);
    this.status.append(badge, words);
    this.prompt.append(this.promptText, this.promptActions);
    this.prompt.hidden = true;
    this.ledger.setAttribute('aria-label', 'The count');
    this.ledger.append(this.ledgerTitle, this.ledgerItems, this.ledgerTotal, this.ledgerNote);
    this.ledger.hidden = true;
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('role', 'status');
    this.sheet.append(this.status, this.prompt, this.ledger, this.keys, this.live);
  }

  /** Places the sheet over the canvas for the current window. */
  place(frame: Frame): void {
    this.sheet.style.transform = `translate(${frame.originX}px, ${frame.originY}px) scale(${frame.scale})`;
  }

  setStatus(name: string, line: string): void {
    this.statusName.textContent = name;
    this.statusLine.textContent = line;
  }

  setPrompt(html: string | null, actions: HTMLElement[] = []): void {
    if (html === null) {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.hidden = false;
    this.promptText.innerHTML = html;
    this.promptActions.replaceChildren(...actions);
  }

  setLedger(state: LedgerState | null): void {
    if (!state) {
      this.ledger.hidden = true;
      return;
    }
    this.ledger.hidden = false;
    this.ledger.dataset.perfect = String(Boolean(state.perfect));
    this.ledgerTitle.textContent = state.title;
    let running = 0;
    const items = state.combos.slice(0, state.shown).map((combo, index) => {
      running += combo.points;
      const item = el('li', 'ft-ledger__item');
      item.dataset.kind = combo.kind;
      item.dataset.active = String(index === state.shown - 1);
      item.append(comboLabel(combo), ' ');
      item.append(el('b', undefined, String(running)));
      return item;
    });
    this.ledgerItems.replaceChildren(...items);
    this.ledgerTotal.replaceChildren(
      el('b', undefined, String(state.total)),
      el('span', undefined, 'points'),
    );
    this.ledgerNote.textContent = state.note ?? '';
    this.ledgerNote.hidden = !state.note;
  }

  setKeys(entries: [key: string, label: string][]): void {
    this.keys.replaceChildren(
      ...entries.map(([key, label]) => {
        const item = el('span');
        item.append(el('kbd', undefined, key), label);
        return item;
      }),
    );
    this.keys.hidden = entries.length === 0;
  }

  announce(text: string): void {
    this.live.textContent = text;
  }
}

export function button(label: string, onClick: () => void, key?: string, quiet = false) {
  const node = el('button', quiet ? 'ft-button ft-button--quiet' : 'ft-button', label);
  node.type = 'button';
  if (key) node.append(el('span', 'ft-key', key));
  node.addEventListener('click', onClick);
  return node;
}
