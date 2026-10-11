import type { App } from '../app';
import { h } from '../dom';
import type { RunPlan } from '../flow';

/** Pieces every play screen shares: its root, the feedback line, labels and a confirm. */

export function playRoot(className: string, ...children: (HTMLElement | null)[]): HTMLElement {
  return h('div', { class: `ns-play ${className}` }, ...children);
}

/** One line under the board for what just happened, read out to screen readers. */
export function feedbackLine(): HTMLElement {
  return h('p', {
    class: 'ns-feedback',
    role: 'status',
    'aria-live': 'polite',
    'data-testid': 'ns-feedback',
  });
}

/** The board's small top line: where in the run this is. */
export function eventLabel(plan: RunPlan, index: number, fallback: string): string {
  const of = `${index + 1} of ${plan.events.length}`;
  if (plan.kind === 'daily') return `Daily #${plan.dailyNumber ?? ''} · event ${of}`;
  if (plan.kind === 'chapter') return `${plan.title} · event ${of}`;
  return fallback;
}

export function shake(element: HTMLElement) {
  element.classList.remove('ns-shake');
  void element.offsetWidth;
  element.classList.add('ns-shake');
}

/** Asks before something that throws away progress; the safe choice has the focus. */
export function confirmLeave(app: App, question: string, onConfirm: () => void) {
  const keep = h('button', { class: 'ns-button', type: 'button' }, 'Keep playing');
  const go = h(
    'button',
    { class: 'ns-button ns-button--primary', type: 'button' },
    'Yes, start again',
  );
  const dialog = h(
    'div',
    { class: 'ns-dialog', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': question },
    h(
      'div',
      { class: 'ns-card ns-dialog__card' },
      h('h2', { class: 'ns-card__title' }, question),
      h('p', { class: 'ns-muted' }, 'This one starts over from the beginning.'),
      h('div', { class: 'ns-dialog__actions' }, keep, go),
    ),
  );
  const close = () => dialog.remove();
  keep.addEventListener('click', close);
  go.addEventListener('click', () => {
    close();
    onConfirm();
  });
  app.root.append(dialog);
  keep.focus();
}
