/**
 * A tiny element builder so screens read like the markup they produce, without a framework.
 * `h('p', { class: 'tagline' }, text)` → <p class="tagline">text</p>
 */

export type Child = Node | string | number | null | undefined | false | readonly Child[];

type Listener = (event: never) => void;

export interface Props {
  class?: string | false | null | (string | false | null | undefined)[];
  style?: string | Record<string, string | number>;
  dataset?: Record<string, string>;
  [key: string]: unknown;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function appendChildren(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) appendChildren(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

function className(value: Props['class']): string {
  if (!value) return '';
  return Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
}

function applyProps(element: Element, props: Props | null | undefined, isSvg: boolean): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') {
      const name = className(value as Props['class']);
      if (name) element.setAttribute('class', name);
    } else if (key === 'style') {
      if (typeof value === 'string') element.setAttribute('style', value);
      else {
        for (const [property, v] of Object.entries(value as Record<string, string | number>)) {
          (element as HTMLElement).style.setProperty(property, String(v));
        }
      }
    } else if (key === 'dataset') {
      for (const [name, v] of Object.entries(value as Record<string, string>)) {
        (element as HTMLElement).dataset[name] = v;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'ref' && typeof value === 'function') {
      (value as (el: Element) => void)(element);
    } else if (!isSvg && key in element && !key.includes('-')) {
      (element as unknown as Record<string, unknown>)[key] = value;
    } else {
      element.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  applyProps(element, props, false);
  appendChildren(element, children);
  return element;
}

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  applyProps(element, props, true);
  appendChildren(element, children);
  return element;
}

/** Replaces all children of `parent`. */
export function mount(parent: Element, ...children: Child[]): void {
  parent.replaceChildren();
  appendChildren(parent, children);
}

export type Listeners = Record<string, Listener>;
