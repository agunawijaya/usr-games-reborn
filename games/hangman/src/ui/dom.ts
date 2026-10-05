type Listener = (event: Event) => void;
type Attributes = Record<string, string | number | boolean | undefined | Listener>;
type Child = Node | string | null | undefined | false;

/**
 * A small element builder: `h('button', { class: 'bt-button', onclick: go }, 'Go')`.
 * Attributes named `on…` with a function become event listeners.
 */
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
  for (const child of children) if (child) element.append(child);
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number | undefined> = {},
  ...children: (SVGElement | string)[]
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) continue;
    element.setAttribute(name, String(value));
  }
  for (const child of children) element.append(child);
  return element;
}
