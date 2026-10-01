import { type Child, h } from '../../ui/h';
import { formatRoute, HOME } from '../../router';
import { LABELS } from './wording';

/** Small pieces every player screen shares: labels with their arrow, key caps, the Hall link. */

/** "← Back to the Hall" reads as "Back to the Hall"; the arrow is decoration. */
export function labelNodes(label: string): Child[] {
  return label.startsWith('← ')
    ? [h('span', { class: 'pl-arrow', 'aria-hidden': 'true' }, '←'), ` ${label.slice(2)}`]
    : [label];
}

export function keyCap(key: string): HTMLElement {
  return h('kbd', { class: 'pl-kbd' }, key);
}

/** The link home, as a real link so it also works with a middle click. */
export function hallLink(className: string, onFollow: () => void, hint?: string): HTMLElement {
  return h(
    'a',
    {
      class: ['pl-button', 'pl-link', className],
      href: formatRoute(HOME),
      onclick: (event: MouseEvent) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onFollow();
      },
    },
    labelNodes(LABELS.back),
    hint ? keyCap(hint) : null,
  );
}

/** Keys typed into a form field are text, never shortcuts. */
export function isTyping(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  return Boolean(
    target?.closest(
      'input:not([type="radio"]):not([type="checkbox"]):not([type="range"]), textarea, select, [contenteditable]',
    ),
  );
}

export function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}
