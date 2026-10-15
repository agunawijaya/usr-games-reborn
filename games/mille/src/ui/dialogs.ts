import { h } from './dom';

/**
 * A question over the table with two answers. Escape (or the cancel key) says no; Enter (or the
 * confirm key) says yes. Keys are caught on the way down, before the Hall's own Escape (which
 * would open the pause menu), and focus stays inside until it is answered.
 */

export interface ConfirmOptions {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
  confirmKey?: string;
  cancelKey?: string;
}

export function confirmDialog(host: HTMLElement, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const titleId = `dt-dialog-${Math.random().toString(36).slice(2)}`;
    const yes = h(
      'button',
      { class: 'dt-button dt-button--primary', type: 'button' },
      options.confirm,
      options.confirmKey ? h('kbd', {}, options.confirmKey) : null,
    );
    const no = h(
      'button',
      { class: 'dt-button', type: 'button' },
      options.cancel,
      options.cancelKey ? h('kbd', {}, options.cancelKey) : null,
    );
    const dialog = h(
      'div',
      { class: 'dt-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('h2', { class: 'dt-dialog__title', id: titleId }, options.title),
      h('p', { class: 'dt-dialog__body' }, options.body),
      h('div', { class: 'dt-dialog__buttons' }, yes, no),
    );
    const backdrop = h('div', { class: 'dt-backdrop' }, dialog);
    const finish = (answer: boolean) => {
      window.removeEventListener('keydown', keys, true);
      backdrop.remove();
      resolve(answer);
    };
    const keys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const stop = () => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      if (key === 'escape' || key === options.cancelKey?.toLowerCase()) {
        stop();
        finish(false);
      } else if (
        key === options.confirmKey?.toLowerCase() ||
        (key === 'enter' && document.activeElement !== no)
      ) {
        stop();
        finish(true);
      } else if (key === 'tab') {
        stop();
        (document.activeElement === yes ? no : yes).focus();
      } else if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        key !== 'enter' &&
        key !== ' '
      ) {
        // The table underneath must not take keys while the question is open.
        event.stopImmediatePropagation();
      }
    };
    yes.addEventListener('click', () => finish(true));
    no.addEventListener('click', () => finish(false));
    window.addEventListener('keydown', keys, true);
    host.append(backdrop);
    yes.focus();
  });
}
