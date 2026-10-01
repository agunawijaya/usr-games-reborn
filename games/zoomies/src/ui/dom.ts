/** A tiny element builder, so screens read as the markup they make. */

type Child = Node | string | number | null | undefined | false;
type AttributeValue = string | number | boolean | undefined | null | ((event: Event) => void);
type Attributes = { [name: string]: AttributeValue | Record<string, string> } & {
  dataset?: Record<string, string>;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'dataset' && typeof value === 'object') {
      Object.assign(node.dataset, value);
    } else if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2), value as EventListener);
    } else if (value === true) {
      node.setAttribute(name, '');
    } else {
      node.setAttribute(name, String(value));
    }
  }
  append(node, children);
  return node;
}

function append(node: Node, children: (Child | Child[])[]) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(
      typeof child === 'string' || typeof child === 'number'
        ? document.createTextNode(String(child))
        : child,
    );
  }
}

export function kbd(label: string): HTMLElement {
  return h('kbd', { class: 'zm-kbd' }, label);
}

export function button(
  label: string | Node,
  options: {
    onClick: () => void;
    key?: string;
    variant?: 'primary' | 'quiet' | 'ghost';
    testId?: string;
    disabled?: boolean;
    title?: string;
  },
): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: `zm-button${options.variant ? ` zm-button--${options.variant}` : ''}`,
      onclick: () => options.onClick(),
      disabled: options.disabled,
      title: options.title,
      'aria-keyshortcuts': options.key,
      dataset: options.testId ? { testid: options.testId } : undefined,
    },
    h('span', { class: 'zm-button__label' }, label),
    options.key ? kbd(options.key) : null,
  );
}

export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Stars as text a screen reader can say, with the shapes for everyone else. */
export function starRow(earned: readonly boolean[], label: string): HTMLElement {
  return h(
    'span',
    {
      class: 'zm-stars',
      role: 'img',
      'aria-label': `${earned.filter(Boolean).length} of ${earned.length} stars${label ? `: ${label}` : ''}`,
    },
    ...earned.map((on) =>
      h(
        'span',
        { class: on ? 'zm-star zm-star--on' : 'zm-star', 'aria-hidden': 'true' },
        on ? '★' : '☆',
      ),
    ),
  );
}
