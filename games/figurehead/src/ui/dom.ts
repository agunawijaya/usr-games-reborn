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
    if (name === 'dataset' && typeof value === 'object') Object.assign(node.dataset, value);
    else if (name.startsWith('on') && typeof value === 'function') {
      node.addEventListener(name.slice(2), value as EventListener);
    } else if (value === true) node.setAttribute(name, '');
    else node.setAttribute(name, String(value));
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

/** Markup made by our own renderers (SVG portraits and carvings), never from player input. */
export function svg(markup: string, className = ''): HTMLElement {
  const holder = h('div', { class: className });
  holder.innerHTML = markup;
  return holder;
}

export function kbd(label: string): HTMLElement {
  return h('kbd', { class: 'fh-kbd' }, label);
}

export function button(
  label: string | Node,
  options: {
    onClick: () => void;
    key?: string;
    variant?: 'primary' | 'quiet' | 'ghost' | 'chip';
    testId?: string;
    disabled?: boolean;
    title?: string;
    pressed?: boolean;
    autofocus?: boolean;
  },
): HTMLButtonElement {
  return h(
    'button',
    {
      type: 'button',
      class: `fh-button${options.variant ? ` fh-button--${options.variant}` : ''}`,
      onclick: () => options.onClick(),
      disabled: options.disabled,
      title: options.title,
      'aria-keyshortcuts': options.key,
      'aria-pressed': options.pressed === undefined ? undefined : String(options.pressed),
      dataset: {
        ...(options.testId ? { testid: options.testId } : {}),
        ...(options.autofocus ? { autofocus: '' } : {}),
      },
    },
    h('span', { class: 'fh-button__label' }, label),
    options.key ? kbd(options.key) : null,
  );
}

/** Appends what is there, skipping the sections a screen leaves out. */
export function put(
  parent: Element,
  ...children: (Node | string | null | undefined | false)[]
): void {
  for (const child of children)
    if (child !== null && child !== undefined && child !== false) parent.append(child);
}
