import type { Hint } from '../engine/hints';
import { h, svg } from './dom';

/**
 * The picture hint as the player sees it: dots in rows, two ten-frames, or a friendlier way to
 * write the sum. Pictures are SVG so they stay sharp; the caption says the same in words.
 */
export function hintCard(hint: Hint): HTMLElement {
  return h(
    'section',
    { class: 'ns-panel ns-hint', role: 'note', 'aria-label': 'Hint' },
    h('span', { class: 'ns-label' }, 'A way to see it'),
    picture(hint),
    h('p', { class: 'ns-hint__caption' }, hint.caption),
  );
}

function picture(hint: Hint): Element | null {
  switch (hint.kind) {
    case 'array':
      return dotArray(hint.rows, hint.columns, hint.leftover);
    case 'ten-frame':
      return tenFrames(hint.first, hint.second);
    case 'steps':
      return hint.steps.length === 0
        ? null
        : h('ol', { class: 'ns-hint__steps' }, ...hint.steps.map((step) => h('li', {}, step)));
  }
}

const DOT = 14;
const GAP = 6;

/** `rows` rows of `columns` dots, and any leftover dots on a row of their own, hollow. */
function dotArray(rows: number, columns: number, leftover: number): SVGSVGElement {
  const lines = rows + (leftover > 0 ? 1 : 0);
  const width = columns * (DOT + GAP);
  const height = lines * (DOT + GAP);
  const dots: SVGElement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      dots.push(circle(column, row, 'ns-hint__dot'));
    }
  }
  for (let i = 0; i < leftover; i++) dots.push(circle(i, rows, 'ns-hint__dot ns-hint__dot--left'));
  return svg(
    'svg',
    { class: 'ns-hint__picture', viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' },
    ...dots,
  );
}

function circle(column: number, row: number, className: string): SVGElement {
  return svg('circle', {
    class: className,
    cx: column * (DOT + GAP) + DOT / 2 + GAP / 2,
    cy: row * (DOT + GAP) + DOT / 2 + GAP / 2,
    r: DOT / 2,
  });
}

/** Two frames of ten: the first filled with `first`, the second with `second`. */
function tenFrames(first: number, second: number): SVGSVGElement {
  const cell = DOT + GAP;
  const frameWidth = 5 * cell;
  const parts: SVGElement[] = [];
  const counts = [Math.min(10, first), Math.max(0, first - 10)];
  // Fill the first frame with `first`, then pour `second` into what is left of it and on.
  let poured = second;
  for (let frame = 0; frame < 2; frame++) {
    const x0 = frame * (frameWidth + cell);
    parts.push(
      svg('rect', {
        class: 'ns-hint__frame',
        x: x0,
        y: 0,
        width: frameWidth,
        height: 2 * cell,
        rx: 4,
      }),
    );
    for (let i = 0; i < 10; i++) {
      const own = i < counts[frame]!;
      const added = !own && poured > 0;
      if (added) poured--;
      parts.push(
        svg('circle', {
          class: own
            ? 'ns-hint__dot'
            : added
              ? 'ns-hint__dot ns-hint__dot--second'
              : 'ns-hint__dot ns-hint__dot--empty',
          cx: x0 + (i % 5) * cell + cell / 2,
          cy: Math.floor(i / 5) * cell + cell / 2,
          r: DOT / 2,
        }),
      );
    }
  }
  return svg(
    'svg',
    {
      class: 'ns-hint__picture',
      viewBox: `0 0 ${2 * frameWidth + cell} ${2 * cell}`,
      'aria-hidden': 'true',
    },
    ...parts,
  );
}
