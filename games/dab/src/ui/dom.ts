import { type MarkId, markStrokes } from '../render/marks';

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

/** Parses trusted, hand-written SVG markup from this game's own icons. */
export function svg(markup: string): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGSVGElement;
}

/** A player's mark as an SVG icon, drawn from the same strokes the board uses. */
export function markIcon(id: MarkId, label?: string): SVGSVGElement {
  const paths = markStrokes(id)
    .map(
      (stroke) =>
        `<polyline points="${stroke.map((p) => `${(p.x * 40 + 24).toFixed(1)},${(p.y * 40 + 24).toFixed(1)}`).join(' ')}"/>`,
    )
    .join('');
  return svg(
    `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" ${
      label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'
    }>${paths}</svg>`,
  );
}

/**
 * A small drawing of a position: its dots, its lines, and its taken boxes shaded by owner. Used
 * on the puzzle tiles, where it says more than a number.
 */
export function boardThumb(board: {
  columns: number;
  rows: number;
  drawn: Uint8Array;
  owner: Int8Array;
}): SVGSVGElement {
  const step = 10;
  const pad = 4;
  const width = board.columns * step + pad * 2;
  const height = board.rows * step + pad * 2;
  const parts: string[] = [];
  board.owner.forEach((owner, box) => {
    if (owner < 0) return;
    const x = pad + (box % board.columns) * step;
    const y = pad + Math.floor(box / board.columns) * step;
    parts.push(
      `<rect x="${x + 1.5}" y="${y + 1.5}" width="${step - 3}" height="${step - 3}" rx="1.5" class="dx-thumb-${owner}"/>`,
    );
  });
  const horizontal = (board.rows + 1) * board.columns;
  board.drawn.forEach((drawn, edge) => {
    if (!drawn) return;
    if (edge < horizontal) {
      const row = Math.floor(edge / board.columns);
      const column = edge % board.columns;
      const y = pad + row * step;
      parts.push(`<path d="M${pad + column * step} ${y}h${step}"/>`);
    } else {
      const index = edge - horizontal;
      const row = Math.floor(index / (board.columns + 1));
      const column = index % (board.columns + 1);
      parts.push(`<path d="M${pad + column * step} ${pad + row * step}v${step}"/>`);
    }
  });
  for (let row = 0; row <= board.rows; row++) {
    for (let column = 0; column <= board.columns; column++) {
      parts.push(
        `<circle cx="${pad + column * step}" cy="${pad + row * step}" r="1.3" class="dx-thumb-dot"/>`,
      );
    }
  }
  return svg(
    `<svg class="dx-thumb" viewBox="0 0 ${width} ${height}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">${parts.join('')}</svg>`,
  );
}
