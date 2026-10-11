import type { DesignFrame } from '../render/frame';

/** A tiny element builder: `h('div', { class: 'x', onclick: … }, child, 'text')`. */
export type Attribute = string | number | boolean | undefined | ((event: Event) => void);

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, Attribute> = {},
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') {
      // `onclick: …` and friends become listeners.
      element.addEventListener(name.slice(2), value);
      continue;
    }
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return element;
}

export interface DesignRect {
  x: number;
  y: number;
  width?: number;
  height?: number;
  /** On small screens text keeps its size, so cards keep at least this many CSS pixels. */
  minWidth?: number;
  /** Pins the element's bottom edge here (design y) instead of its top, so it grows upwards. */
  bottom?: number;
}

/**
 * Pins an element to a rectangle of the 1920 × 1080 design frame. Positions follow the frame;
 * sizes scale with it but text keeps its own minimum (see `--dd-text`).
 */
export function place(element: HTMLElement, frame: DesignFrame, rect: DesignRect) {
  element.style.left = `${frame.offsetX + rect.x * frame.scale}px`;
  if (rect.bottom !== undefined) {
    element.style.top = 'auto';
    element.style.bottom = `${frame.height - (frame.offsetY + rect.bottom * frame.scale)}px`;
  } else {
    element.style.bottom = 'auto';
    element.style.top = `${frame.offsetY + rect.y * frame.scale}px`;
  }
  if (rect.width !== undefined)
    element.style.width = `${Math.max(rect.width * frame.scale, rect.minWidth ?? 0)}px`;
  if (rect.height !== undefined) element.style.height = `${rect.height * frame.scale}px`;
}

/** Keyboard key caps from a list such as `['Q', 'W', 'E']`. */
export function keys(labels: readonly string[], className = ''): HTMLElement[] {
  return labels.map((label) => h('kbd', { class: className || undefined }, label));
}

/** A button with the desk's look; `primary` is the filled one. */
export function button(
  label: string,
  run: () => void,
  options: { primary?: boolean; key?: string; choice?: string; small?: boolean } = {},
): HTMLButtonElement {
  const element = h(
    'button',
    {
      type: 'button',
      class: [
        'dd-button',
        options.primary ? 'dd-button--primary' : '',
        options.small ? 'dd-button--small' : '',
      ]
        .filter(Boolean)
        .join(' '),
      'data-choice': options.choice,
      onclick: () => run(),
    },
    label,
  );
  if (options.key) element.append(h('kbd', {}, options.key));
  return element;
}
