import { h } from './dom';

export interface ConfirmOptions {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

/**
 * A small modal question inside the game's own screen, for anything that would lose progress.
 * Escape or Cancel answers no; focus stays inside until it is answered.
 */
export function confirmDialog(host: HTMLElement, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const cancel = h('button', { class: 'chl-button', type: 'button' }, options.cancel);
    const confirm = h(
      'button',
      { class: 'chl-button chl-button--primary', type: 'button', 'data-testid': 'chl-confirm' },
      options.confirm,
    );
    const titleId = `chl-confirm-${Math.random().toString(36).slice(2)}`;
    const dialog = h(
      'div',
      {
        class: 'chl-dialog',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
      },
      h(
        'div',
        { class: 'chl-dialog__card chl-card' },
        h('h2', { id: titleId }, options.title),
        h('p', {}, options.body),
        h('div', { class: 'chl-dialog__actions' }, cancel, confirm),
      ),
    );
    const finish = (answer: boolean) => {
      dialog.removeEventListener('keydown', onKey, true);
      dialog.remove();
      resolve(answer);
    };
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === confirm ? cancel : confirm).focus();
      }
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('keydown', onKey, true);
    host.append(dialog);
    cancel.focus();
  });
}
