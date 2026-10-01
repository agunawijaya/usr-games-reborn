import { h } from '../../ui/h';

/**
 * Modal helpers for the player: a focus trap for overlays and a small confirmation dialog. The
 * safe choice (keep playing) is always the default, and Escape always means "no".
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.closest('[hidden]') && element.getClientRects().length > 0,
  );
}

/** Keeps Tab and Shift+Tab cycling inside `root` while it is open. */
export function trapFocus(root: HTMLElement): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const items = focusablesIn(root);
    if (items.length === 0) return;
    const first = items[0] as HTMLElement;
    const last = items[items.length - 1] as HTMLElement;
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  };
  root.addEventListener('keydown', onKey);
  return () => root.removeEventListener('keydown', onKey);
}

let dialogCount = 0;

export interface ConfirmOptions {
  title: string;
  body: string;
  confirm: string;
  cancel: string;
}

export interface OpenDialog {
  result: Promise<boolean>;
  close(): void;
}

/** An alert dialog over the page; resolves true only when the player confirms. */
export function confirmDialog(host: HTMLElement, options: ConfirmOptions): OpenDialog {
  const id = `pl-dialog-${++dialogCount}`;
  const previous = document.activeElement as HTMLElement | null;
  let resolve: (value: boolean) => void = () => {};
  const result = new Promise<boolean>((done) => (resolve = done));

  const cancel = h(
    'button',
    { type: 'button', class: 'pl-button pl-button--primary' },
    options.cancel,
  );
  const confirm = h('button', { type: 'button', class: 'pl-button' }, options.confirm);
  const dialog = h(
    'div',
    {
      class: 'pl-dialog',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': `${id}-title`,
      'aria-describedby': `${id}-body`,
    },
    h('h2', { id: `${id}-title`, class: 'pl-dialog__title' }, options.title),
    h('p', { id: `${id}-body`, class: 'pl-dialog__body' }, options.body),
    h('div', { class: 'pl-dialog__actions' }, cancel, confirm),
  );
  const scrim = h('div', { class: 'pl-dialog-scrim', dataset: { testid: 'pl-confirm' } }, dialog);
  const release = trapFocus(dialog);

  function finish(answer: boolean) {
    release();
    scrim.remove();
    previous?.focus({ preventScroll: true });
    resolve(answer);
  }

  cancel.addEventListener('click', () => finish(false));
  confirm.addEventListener('click', () => finish(true));
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // Escape answers this dialog only; the player's own Escape handling must not see it.
    event.preventDefault();
    event.stopPropagation();
    finish(false);
  });
  host.append(scrim);
  cancel.focus();
  return { result, close: () => finish(false) };
}
