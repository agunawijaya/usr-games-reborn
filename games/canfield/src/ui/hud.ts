import { h, icon, ICONS } from './dom';

/**
 * The words and buttons over the table during a deal: the title and rules at the top left, the
 * score at the top right (clear of the Hall's Pause pill), and a bottom bar with the deal, undo,
 * hint, Insight and the typed-command bar for players who know the original's commands.
 */

export type HudAction = 'deal' | 'undo' | 'hint' | 'insight' | 'ledger';

export interface HudStat {
  id: string;
  label: string;
  value: string;
}

export interface HudModel {
  title: string;
  /** "Standard · Points · Base 7". */
  modeLine: string;
  stats: readonly HudStat[];
  dealLabel: string;
  canDeal: boolean;
  canUndo: boolean;
  insightOn: boolean;
  /** Prices shown on the buttons, e.g. "−2" for undo; empty when free. */
  prices: Partial<Record<HudAction, string>>;
  showLedger: boolean;
  /** The deal is over: nothing more to press. */
  ended: boolean;
}

interface ButtonParts {
  button: HTMLButtonElement;
  label: HTMLSpanElement;
  price: HTMLSpanElement;
}

function hudButton(
  action: HudAction,
  label: string,
  key: string,
  onPress: (action: HudAction) => void,
): ButtonParts {
  const text = h('span', { class: 'td-hud__label' }, label);
  const price = h('span', { class: 'td-hud__price' });
  const button = h(
    'button',
    {
      type: 'button',
      class: `td-hud__button td-hud__button--${action}`,
      'data-testid': `td-button-${action}`,
      'aria-keyshortcuts': key,
      onclick: () => onPress(action),
    },
    icon(ICONS[action]),
    text,
    price,
    h('kbd', { class: 'td-hud__key' }, key),
  );
  return { button, label: text, price };
}

export class Hud {
  readonly element: HTMLDivElement;
  private readonly title = h('h1', { class: 'td-hud__title' });
  private readonly mode = h('p', { class: 'td-hud__mode' });
  private readonly stats = h('dl', { class: 'td-hud__stats', 'data-testid': 'td-stats' });
  private readonly buttons: Record<HudAction, ButtonParts>;
  readonly command: HTMLInputElement;

  constructor(onPress: (action: HudAction) => void, onCommand: (text: string) => void) {
    this.buttons = {
      deal: hudButton('deal', 'Deal', 'D', onPress),
      undo: hudButton('undo', 'Undo', 'Z', onPress),
      hint: hudButton('hint', 'Hint', 'H', onPress),
      insight: hudButton('insight', 'Insight', 'C', onPress),
      ledger: hudButton('ledger', 'Ledger', 'L', onPress),
    };
    this.command = h('input', {
      class: 'td-command__input',
      type: 'text',
      'data-testid': 'td-command',
      autocomplete: 'off',
      spellcheck: 'false',
      maxlength: 4,
      'aria-label': 'Type a move as in the original: s1, sf, t2, tf, 34, 1f, ht, c',
      placeholder: 's1 · tf · 34 · ht',
    });
    const form = h(
      'form',
      {
        class: 'td-command',
        onsubmit: (event: Event) => {
          event.preventDefault();
          onCommand(this.command.value);
          this.command.value = '';
        },
      },
      h('label', { class: 'td-command__label' }, icon(ICONS.command, 16), 'Move'),
      this.command,
    );
    this.element = h(
      'div',
      { class: 'td-hud' },
      h('header', { class: 'td-hud__plaque td-hud__plaque--title' }, this.title, this.mode),
      h('div', { class: 'td-hud__plaque td-hud__plaque--stats' }, this.stats),
      h(
        'nav',
        { class: 'td-hud__bar', 'aria-label': 'Table controls' },
        this.buttons.deal.button,
        this.buttons.undo.button,
        this.buttons.hint.button,
        this.buttons.insight.button,
        this.buttons.ledger.button,
        form,
      ),
    );
  }

  /**
   * Puts the score card in the left column under the reserve (in CSS pixels), leaving the top
   * right to the Hall's Pause pill and the top middle to the blooms. A compact card is one row,
   * as wide as its figures and at most `w`.
   */
  place(column: { x: number; y: number; w: number; compact: boolean }): void {
    const plaque = this.stats.parentElement!;
    plaque.classList.toggle('is-compact', column.compact);
    plaque.style.left = `${Math.round(column.x)}px`;
    plaque.style.top = `${Math.round(column.y)}px`;
    plaque.style.width = column.compact ? '' : `${Math.round(column.w)}px`;
    plaque.style.maxWidth = column.compact ? `${Math.round(column.w)}px` : '';
  }

  update(model: HudModel): void {
    this.title.textContent = model.title;
    this.mode.textContent = model.modeLine;
    this.stats.replaceChildren(
      ...model.stats.map((stat) =>
        h(
          'div',
          { class: 'td-hud__stat', 'data-stat': stat.id },
          h('dt', {}, stat.label),
          h('dd', {}, stat.value),
        ),
      ),
    );
    const { deal, undo, insight, ledger } = this.buttons;
    deal.label.textContent = model.dealLabel;
    deal.button.disabled = !model.canDeal;
    undo.button.disabled = !model.canUndo;
    insight.button.setAttribute('aria-pressed', String(model.insightOn));
    ledger.button.hidden = !model.showLedger;
    for (const action of Object.keys(this.buttons) as HudAction[]) {
      this.buttons[action].price.textContent = model.prices[action] ?? '';
      if (model.ended) this.buttons[action].button.disabled = true;
    }
    this.command.disabled = model.ended;
  }
}
