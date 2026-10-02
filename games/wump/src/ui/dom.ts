/** A tiny element builder, enough for the game's screens without a framework. */

type Child = Node | string | null | undefined | false;

export interface Attributes {
  class?: string;
  dataset?: Record<string, string>;
  style?: string;
  [name: string]: unknown;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (name === 'class') element.className = String(value);
    else if (name === 'dataset') Object.assign(element.dataset, value);
    else if (name.startsWith('on') && typeof value === 'function') {
      element.addEventListener(name.slice(2), value as EventListener);
    } else if (value === true) element.setAttribute(name, '');
    else element.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

const SVG = 'http://www.w3.org/2000/svg';

export function svg(
  viewBox: string,
  className: string,
  paths: { d: string; class?: string }[],
): SVGSVGElement {
  const element = document.createElementNS(SVG, 'svg');
  element.setAttribute('viewBox', viewBox);
  element.setAttribute('class', className);
  element.setAttribute('aria-hidden', 'true');
  for (const p of paths) {
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', p.d);
    if (p.class) path.setAttribute('class', p.class);
    element.append(path);
  }
  return element;
}

export function keycap(label: string): HTMLElement {
  return h('kbd', { class: 'hw-key' }, label);
}

/** A canvas sized for the device pixel ratio; returns its 2D context scaled to CSS pixels. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(width * ratio));
  const hgt = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== w || canvas.height !== hgt) {
    canvas.width = w;
    canvas.height = hgt;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}
