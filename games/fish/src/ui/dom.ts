import type { Look } from '../render/look';

/**
 * A small element builder: `h('button', { class: 'gf-rank', onclick: ask }, '7')`. An attribute
 * whose name starts with `on` and whose value is a function becomes an event listener; `true`
 * sets an empty attribute and `false` or `undefined` leaves it out.
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

/** An inline SVG from markup we wrote ourselves (icons only; never anything a player typed). */
export function svg(markup: string): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGSVGElement;
}

/** The look's panel colours as the CSS properties gf-* panels are painted with. */
export function applyLook(element: HTMLElement, look: Look): void {
  const ui = look.ui;
  element.dataset.look = look.id;
  const properties: Record<string, string> = {
    panel: ui.panel,
    'panel-solid': ui.panelSolid,
    'panel-edge': ui.panelEdge,
    ink: ui.ink,
    'ink-soft': ui.inkSoft,
    accent: ui.accent,
    'accent-ink': ui.accentInk,
    'accent-strong': ui.accentStrong,
    paper: ui.paper,
    'paper-line': ui.paperLine,
    'paper-ink': ui.paperInk,
    margin: ui.margin,
    hole: ui.hole,
    mine: ui.mine,
    has: ui.has,
    'has-ink': ui.hasInk,
    none: ui.none,
    good: ui.good,
    focus: ui.focus,
    bubble: ui.bubble,
    'bubble-ink': ui.bubbleInk,
    key: ui.key,
    'key-ink': ui.keyInk,
    card: ui.card,
    'card-ink': ui.cardInk,
    'card-edge': ui.cardEdge,
  };
  for (const [name, value] of Object.entries(properties)) {
    element.style.setProperty(`--gf-${name}`, value);
  }
}
