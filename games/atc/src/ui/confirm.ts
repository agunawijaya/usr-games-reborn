import { h } from './dom';

/**
 * A question over the play screen before progress is lost, in the game's own look rather than
 * the browser's. Escape or "Keep flying" answers no; focus stays inside until it is answered and
 * goes back where it was.
 */

export interface ConfirmText {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

export function askToConfirm(parent: HTMLElement, text: ConfirmText): Promise<boolean> {
  const returnFocus = document.activeElement as HTMLElement | null;
  const cancel = h(
    'button',
    { type: 'button', class: 'sk-button sk-button--primary' },
    text.cancel,
  );
  const confirm = h('button', { type: 'button', class: 'sk-button' }, text.confirm);
  const card = h(
    'section',
    {
      class: 'sk-card sk-card--simple',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'sk-confirm-title',
      'aria-describedby': 'sk-confirm-body',
    },
    h('h2', { class: 'sk-card__title', id: 'sk-confirm-title' }, text.title),
    h('p', { class: 'sk-card__lede', id: 'sk-confirm-body' }, text.body),
    h('div', { class: 'sk-actions' }, cancel, confirm),
  );
  const scrim = h('div', { class: 'sk-scrim sk-scrim--focus sk-confirm' }, card);
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
        event.stopPropagation();
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
