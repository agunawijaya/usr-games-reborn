/**
 * A small element builder: `h('p', { class: 'x' }, 'text', child)`. An attribute whose name
 * starts with `on` and whose value is a function becomes an event listener: `onclick: run`.
 */

type Attributes = Record<string, string | number | boolean | undefined | ((event: Event) => void)>;
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') {
      element.addEventListener(name.slice(2), value);
      continue;
    }
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : String(child));
  }
  return element;
}

export function formatPoints(n: number): string {
  return n.toLocaleString('en-GB');
}
