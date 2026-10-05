import { type CardId, cardLabel, cardName, isRed } from '@usr-games/kit/cards';
import type { Charge, CostRow, Statement } from '../engine/ledger';
import { costsOf, netOf, returnPercent, STATEMENT_ROWS } from '../engine/ledger';
import { h } from './dom';

/**
 * The panels beside the table: Insight (the original's card counter), the account book of a
 * Bank deal, the prompt to pay for the next stage, a short notice line and a confirm dialog.
 */

function chip(card: CardId | null, seen: boolean, emphasis = false): HTMLElement {
  if (card === null || !seen)
    return h(
      'span',
      { class: 'td-chip td-chip--unseen', title: 'Not seen yet', 'aria-label': 'not seen yet' },
      '?',
    );
  return h(
    'span',
    {
      class: `td-chip${isRed(card) ? ' td-chip--red' : ''}${emphasis ? ' td-chip--shows' : ''}`,
      title: cardName(card),
      'aria-label': cardName(card),
    },
    cardLabel(card),
  );
}

export interface InsightModel {
  /** Talon bottom first, then the hand in dealing order. */
  talon: readonly CardId[];
  hand: readonly CardId[];
  seen: ReadonlySet<CardId>;
  reserve: number;
  /** "1 point" or "$1". */
  price: string;
  charged: number;
}

/** Insight: the cards already seen, where they lie in the talon and the hand, and how many are left. */
export function insightPanel(model: InsightModel): HTMLElement {
  const groups: HTMLElement[] = [];
  for (let i = 0; i < model.hand.length; i += 3) {
    const group = model.hand.slice(i, i + 3);
    groups.push(
      h(
        'li',
        { class: 'td-insight__deal' },
        ...group.map((card, k) => chip(card, model.seen.has(card), k === group.length - 1)),
      ),
    );
  }
  return h(
    'section',
    { class: 'td-panel td-insight', 'aria-label': 'Insight', 'data-testid': 'td-insight' },
    h('h2', { class: 'td-panel__title' }, 'Insight'),
    h(
      'p',
      { class: 'td-panel__note' },
      `Cards you have seen, where they lie now. Each costs ${model.price} the first time it is listed.`,
    ),
    h(
      'dl',
      { class: 'td-insight__counts' },
      h('div', {}, h('dt', {}, 'Hand'), h('dd', {}, String(model.hand.length))),
      h('div', {}, h('dt', {}, 'Talon'), h('dd', {}, String(model.talon.length))),
      h('div', {}, h('dt', {}, 'Reserve'), h('dd', {}, String(model.reserve))),
      h(
        'div',
        {},
        h('dt', {}, 'Listed'),
        h('dd', { 'data-testid': 'td-insight-charged' }, String(model.charged)),
      ),
    ),
    h('h3', { class: 'td-panel__heading' }, 'Under the talon’s top card'),
    model.talon.length > 1
      ? h(
          'p',
          { class: 'td-insight__row' },
          ...model.talon.slice(0, -1).map((card) => chip(card, model.seen.has(card))),
        )
      : h('p', { class: 'td-panel__note' }, 'Nothing under it.'),
    h('h3', { class: 'td-panel__heading' }, 'Next deals, three at a time'),
    groups.length > 0
      ? h('ol', { class: 'td-insight__deals' }, ...groups)
      : h('p', { class: 'td-panel__note' }, 'The hand is empty: the talon turns over next.'),
  );
}

const ROW_LABELS: Record<CostRow, string> = {
  deals: 'Deals',
  inspections: 'Inspections',
  games: 'Games',
  runs: 'Passes',
  information: 'Insight',
  thinkTime: 'Time',
  undo: 'Undo',
  hints: 'Hints',
};

const ENTRY_LABELS: Record<Charge['kind'], string> = {
  deal: 'The deal',
  inspection: 'Inspection',
  game: 'Playing it out',
  run: 'Another pass',
  insight: 'Insight',
  time: 'Thinking time',
  undo: 'Undo',
  hint: 'Hint',
};

export function money(amount: number): string {
  const whole = Math.round(amount);
  return whole < 0 ? `−$${Math.abs(whole).toLocaleString('en')}` : `$${whole.toLocaleString('en')}`;
}

export interface LedgerEntry {
  label: string;
  amount: number;
}

/** The running account: charges as they came, credits for cards home, and the balance. */
export function ledgerEntries(charges: readonly Charge[], winnings: number): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const charge of charges) {
    const last = entries.at(-1);
    const label = ENTRY_LABELS[charge.kind];
    // Insight and time come a dollar at a time: one line each run of them.
    if (last && last.label === label && (charge.kind === 'insight' || charge.kind === 'time'))
      last.amount -= charge.amount;
    else entries.push({ label, amount: -charge.amount });
  }
  if (winnings > 0) entries.push({ label: 'Cards home', amount: winnings });
  return entries;
}

export interface LedgerModel {
  entries: readonly LedgerEntry[];
  deal: Statement;
  sitting: Statement;
  lifetime: Statement;
  balance: number;
}

/** The account book of a Bank deal: the running entries, then the original's three columns. */
export function ledgerPanel(model: LedgerModel): HTMLElement {
  const columns = [model.deal, model.sitting, model.lifetime];
  const row = (label: string, values: string[], strong = false) =>
    h(
      'tr',
      { class: strong ? 'td-ledger__total' : 'td-ledger__cost' },
      h('th', { scope: 'row' }, label),
      ...values.map((v) => h('td', {}, v)),
    );
  const percent = (s: Statement) => {
    const value = returnPercent(s);
    return value === null ? '—' : `${value.toFixed(0)}%`;
  };
  return h(
    'section',
    { class: 'td-panel td-ledger', 'aria-label': 'Account book', 'data-testid': 'td-account-book' },
    h('h2', { class: 'td-panel__title' }, 'Account book'),
    h('p', { class: 'td-panel__note' }, 'Play money only: it cannot be bought, sold or spent.'),
    h(
      'ol',
      { class: 'td-ledger__entries' },
      ...model.entries
        .slice(-7)
        .map((e) =>
          h(
            'li',
            { class: e.amount < 0 ? 'is-debit' : 'is-credit' },
            h('span', {}, e.label),
            h('span', {}, `${e.amount > 0 ? '+' : ''}${money(e.amount)}`),
          ),
        ),
    ),
    h(
      'table',
      { class: 'td-ledger__statement' },
      h(
        'thead',
        {},
        h(
          'tr',
          {},
          h('th', {}, ''),
          h('th', { scope: 'col' }, 'Deal'),
          h('th', { scope: 'col' }, 'Sitting'),
          h('th', { scope: 'col' }, 'Lifetime'),
        ),
      ),
      h(
        'tbody',
        {},
        ...STATEMENT_ROWS.map((key) =>
          row(
            ROW_LABELS[key],
            columns.map((s) => money(s[key])),
          ),
        ),
        row(
          'Costs',
          columns.map((s) => money(costsOf(s))),
          true,
        ),
        row(
          'Winnings',
          columns.map((s) => money(s.winnings)),
          true,
        ),
        row(
          'Net',
          columns.map((s) => money(netOf(s))),
          true,
        ),
        row('Return', columns.map(percent)),
      ),
    ),
    h(
      'p',
      { class: 'td-ledger__balance', 'data-testid': 'td-balance' },
      `Balance ${money(model.balance)}`,
    ),
  );
}

export interface StagePromptModel {
  stage: 'dealt' | 'inspection';
  cardsHome: number;
}

/** A Bank deal's next stage: inspect it, play it out, or walk away. */
export function stagePrompt(
  model: StagePromptModel,
  act: (choice: 'inspect' | 'play-out' | 'walk-away') => void,
): HTMLElement {
  const inspect = model.stage === 'dealt';
  const lead = inspect ? 'Inspect this deal for $13?' : 'Play it out for $26?';
  const body = inspect
    ? 'Make every move you can without dealing from the hand; three more cards come free whenever the talon empties. Then decide.'
    : `Deal from the hand from now on. Every card home pays $5, the ${model.cardsHome} home already included.`;
  return h(
    'section',
    { class: 'td-stage', 'aria-label': 'The next stage', 'data-testid': 'td-stage' },
    h('p', { class: 'td-stage__lead' }, lead),
    h('p', { class: 'td-stage__body' }, body),
    h(
      'div',
      { class: 'td-stage__actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'td-button td-button--primary',
          'data-testid': inspect ? 'td-inspect' : 'td-play-out',
          onclick: () => act(inspect ? 'inspect' : 'play-out'),
        },
        inspect ? 'Inspect · $13' : 'Play it out · $26',
        h('kbd', {}, inspect ? 'I' : 'P'),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'td-button',
          'data-testid': 'td-walk-away',
          onclick: () => act('walk-away'),
        },
        'Walk away',
        h('kbd', {}, 'W'),
      ),
    ),
  );
}

export interface DialogOptions {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

/** A small modal question; resolves true when confirmed. Escape and the cancel button decline. */
export function confirmDialog(host: HTMLElement, options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = (answer: boolean) => {
      backdrop.remove();
      previous?.focus();
      resolve(answer);
    };
    const yes = h(
      'button',
      {
        type: 'button',
        class: 'td-button td-button--primary',
        'data-testid': 'td-confirm-yes',
        onclick: () => close(true),
      },
      options.confirm,
    );
    const no = h(
      'button',
      {
        type: 'button',
        class: 'td-button',
        'data-testid': 'td-confirm-no',
        onclick: () => close(false),
      },
      options.cancel,
    );
    const dialog = h(
      'div',
      {
        class: 'td-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'td-dialog-title',
      },
      h('h2', { id: 'td-dialog-title', class: 'td-dialog__title' }, options.title),
      h('p', { class: 'td-dialog__body' }, options.body),
      h('div', { class: 'td-dialog__actions' }, no, yes),
    );
    const backdrop = h('div', {
      class: 'td-backdrop',
      onkeydown: (event: Event) => {
        const key = (event as KeyboardEvent).key;
        if (key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close(false);
        } else if (key === 'Tab') {
          // Keep focus inside the dialog.
          event.preventDefault();
          (document.activeElement === yes ? no : yes).focus();
        }
      },
    });
    backdrop.append(dialog);
    host.append(backdrop);
    no.focus();
  });
}
