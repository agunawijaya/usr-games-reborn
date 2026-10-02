type Attributes = Record<string, string | number | boolean | null | undefined | EventListener>;

/** A small element builder: attributes, `on*` listeners and children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Array<Node | string | null | false | undefined>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2), value as EventListener);
    } else if (name === 'class') {
      element.className = String(value);
    } else {
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    element.append(child);
  }
  return element;
}

/** Parses trusted, hand-written SVG markup from this game's own icon set. */
export function svg(markup: string): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGSVGElement;
}

export function formatGlints(value: number): string {
  return value.toLocaleString('en-US');
}
