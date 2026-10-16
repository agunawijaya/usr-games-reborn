import { element } from './parts';

/**
 * The frame every page off the menu shares: the world dimmed behind, a "← Game menu" button
 * where the Hall's back button sits, and one panel. Escape goes back too.
 */
export function page(
  root: HTMLElement,
  className: string,
  title: string,
  body: string,
): HTMLElement {
  const node = element('section', `dd-page ${className}`);
  node.setAttribute('aria-label', title);
  node.innerHTML = `<button type="button" class="dd-back" data-act="menu"><span aria-hidden="true">←</span> Game menu <kbd>Esc</kbd></button>
    <div class="dd-panel dd-sheet">${body}</div>`;
  root.append(node);
  return node;
}

/** Escapes text that came from a player (a guest's name) before it goes into markup. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
