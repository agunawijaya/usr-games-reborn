import { h } from './dom';

/**
 * A question over the play screen before progress is lost, in the game's own look rather than the
 * browser's. Escape or the safe answer says no; focus stays inside until it is answered and goes
 * back where it was.
 */

export interface ConfirmText {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

export function askToConfirm(parent: HTMLElement, text: ConfirmText): Promise<boolean> {
  const returnFocus = document.activeElement as HTMLElement | null;
  const cancel = h('button', { type: 'button', class: 'hw-button is-primary' }, text.cancel);
  const confirm = h('button', { type: 'button', class: 'hw-button' }, text.confirm);
  const card = h(
    'section',
    {
      class: 'hw-confirm__card',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'hw-confirm-title',
      'aria-describedby': 'hw-confirm-body',
    },
    h('h2', { class: 'hw-confirm__title', id: 'hw-confirm-title' }, text.title),
    h('p', { id: 'hw-confirm-body' }, text.body),
    h('div', { class: 'hw-row' }, cancel, confirm),
  );
  const scrim = h('div', { class: 'hw-confirm' }, card);
  parent.append(scrim);
  cancel.focus();
  return new Promise((resolve) => {
    const answer = (yes: boolean) => {
      window.removeEventListener('keydown', onKey, true);
      scrim.remove();
      returnFocus?.focus();
      resolve(yes);
    };
    // Captured before the Hall sees it: Escape here closes the question, not the game.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        answer(false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === cancel ? confirm : cancel).focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', () => answer(false));
    confirm.addEventListener('click', () => answer(true));
  });
}
