import { button, h } from './dom';

/**
 * The game's own confirmation sheet, for anything that loses progress or gives a ship up. It
 * takes focus, keeps Tab inside, and answers Escape with "no".
 */
export function confirmDialog(
  host: HTMLElement,
  o: { title: string; text: string; yes: string; no?: string; testId?: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const close = (answer: boolean) => {
      sheet.remove();
      window.removeEventListener('keydown', onKey, true);
      previous?.focus({ preventScroll: true });
      resolve(answer);
    };
    const yes = button(o.yes, {
      onClick: () => close(true),
      variant: 'primary',
      testId: o.testId ?? 'fh-confirm-yes',
    });
    const no = button(o.no ?? 'Not now', {
      onClick: () => close(false),
      variant: 'quiet',
      testId: 'fh-confirm-no',
    });
    const sheet = h(
      'div',
      {
        class: 'fh-dialog',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'fh-dialog-title',
      },
      h(
        'div',
        { class: 'fh-dialog__card' },
        h('h2', { id: 'fh-dialog-title' }, o.title),
        h('p', {}, o.text),
        h('div', { class: 'fh-dialog__actions' }, no, yes),
      ),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(false);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        (document.activeElement === yes ? no : yes).focus();
      } else if (
        event.key === 'Enter' &&
        document.activeElement !== no &&
        document.activeElement !== yes
      ) {
        event.preventDefault();
      }
      event.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    host.append(sheet);
    requestAnimationFrame(() => no.focus());
  });
}
