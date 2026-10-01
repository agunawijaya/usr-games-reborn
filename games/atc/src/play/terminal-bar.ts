import type { LineState, Order } from '../engine/commands';
import { h } from '../ui/dom';
import type { PlayScreen } from '../ui/play-screen';

/**
 * Terminal mode's command line along the bottom of the play screen. Each key is read at once:
 * the words echo back, the choices for the next key show beside them, a key that does not fit is
 * refused with the reason underlined, Enter gives the order (or moves on a tick when the line is
 * empty), `?` lists the choices and `!` opens the little shell.
 */

export interface TerminalActions {
  read(typed: string): LineState;
  order(order: Order): void;
  tick(): void;
  shell(): void;
}

export class TerminalBar {
  private readonly input: HTMLInputElement;
  private readonly echo: HTMLElement;
  private readonly choices: HTMLElement;
  private readonly message: HTMLElement;
  private readonly root: HTMLElement;
  private typed = '';

  constructor(
    private readonly screen: PlayScreen,
    private readonly actions: TerminalActions,
  ) {
    this.input = h('input', {
      class: 'sk-terminal__input',
      type: 'text',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-label': 'Terminal order',
      'aria-describedby': 'sk-terminal-echo',
    });
    this.echo = h('span', {
      class: 'sk-terminal__echo',
      id: 'sk-terminal-echo',
      'aria-live': 'polite',
    });
    this.choices = h('span', { class: 'sk-terminal__choices' });
    this.message = h('span', { class: 'sk-terminal__message', role: 'status' });
    this.root = h(
      'div',
      { class: 'sk-terminal' },
      h('span', { class: 'sk-terminal__prompt', 'aria-hidden': 'true' }, '›'),
      this.input,
      this.echo,
      this.choices,
      this.message,
    );
    screen.renderFoot({ kind: 'terminal', bar: this.root });
    this.input.addEventListener('keydown', (event) => this.key(event));
    this.input.addEventListener('input', () => this.typedChanged());
    this.render(this.actions.read(''));
  }

  focus(): void {
    this.input.focus();
  }

  private key(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Escape clears a line in progress; on an empty line it leaves the command line.
      if (this.typed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.clear();
      } else this.input.blur();
      return;
    }
    if (event.key === '`') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submit();
    }
  }

  private typedChanged(): void {
    const raw = this.input.value;
    if (raw.endsWith('!')) {
      this.clear();
      this.actions.shell();
      return;
    }
    if (raw.endsWith('?')) {
      this.input.value = this.typed;
      const state = this.actions.read(`${this.typed}?`);
      if (state.kind === 'reading') this.render(state, true);
      return;
    }
    const state = this.actions.read(raw);
    if (state.kind === 'error' && state.reason === 'key') {
      // Like the original, a key that does not fit is not taken; here it also says why.
      this.input.value = this.typed;
      this.render(state);
      return;
    }
    this.typed = raw;
    this.render(state);
  }

  private submit(): void {
    const state = this.actions.read(`${this.typed}\n`);
    if (state.kind === 'tick') {
      this.clear();
      this.actions.tick();
      return;
    }
    if (state.kind === 'order') {
      this.actions.order(state.order);
      this.clear(state.echo.words);
      return;
    }
    this.render(state);
  }

  private clear(lastOrder?: string): void {
    this.typed = '';
    this.input.value = '';
    this.render(this.actions.read(''));
    if (lastOrder) this.message.textContent = `Sent: ${lastOrder}`;
  }

  private render(state: LineState, asked = false): void {
    this.message.textContent = '';
    this.root.classList.toggle('is-error', state.kind === 'error');
    if (state.kind === 'shell') return;
    const echo = state.echo;
    this.echo.replaceChildren();
    if (state.kind === 'error') {
      const span = echo.spans[state.at];
      const before = span ? echo.words.slice(0, span.from) : echo.words;
      const bad = span ? echo.words.slice(span.from, span.to) : '';
      this.echo.append(before, h('u', {}, bad || ' '));
      this.message.textContent = state.message;
    } else {
      this.echo.append(echo.words);
    }
    const choices = state.kind === 'reading' || state.kind === 'error' ? state.choices : [];
    this.choices.replaceChildren(...choices.slice(0, asked ? 12 : 6).map((c) => h('span', {}, c)));
    this.choices.hidden = choices.length === 0;
  }

  destroy(): void {
    this.root.remove();
  }
}
