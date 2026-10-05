import { ALPHABET } from '../engine/letters';
import type { BeachLayout } from '../render/layout';
import { h, svg } from './dom';

/**
 * The play screen's interface, in HTML so it stays crisp, focusable and readable aloud: the
 * tide average, the word written in the wet sand, the shells-and-pebbles keyboard, the gauge's
 * label and the Lighthouse. Positions come from the shared beach layout.
 */
export interface ScoreView {
  label: string;
  /** A short reminder beside the label, such as "lower is better". */
  hint?: string;
  value: string;
  details: readonly (readonly [string, string])[];
  context: string;
}

export function scorePanel(score: ScoreView): HTMLElement {
  return h(
    'section',
    { class: 'bt-score', 'aria-label': 'Score', 'data-testid': 'bt-score' },
    h(
      'p',
      { class: 'bt-score__label' },
      score.label,
      score.hint ? h('span', { class: 'bt-score__hint' }, score.hint) : null,
    ),
    h('p', { class: 'bt-score__value' }, score.value),
    score.details.length > 0
      ? h(
          'p',
          { class: 'bt-score__sub' },
          ...score.details.map(([label, value]) =>
            h('span', {}, `${label} `, h('strong', {}, value)),
          ),
        )
      : null,
    h('p', { class: 'bt-score__context' }, score.context),
  );
}

export type SlotState = 'hidden' | 'found' | 'fresh' | 'sea';

/** One slot drawn in the wet sand; its letter is traced with a finger (an SVG stroke). */
function slot(letter: string | null, state: SlotState, layout: BeachLayout): HTMLElement {
  const { width, height } = layout.slot;
  const element = h('span', {
    class: `bt-slot bt-slot--${state}`,
    style: `width:${width}px;height:${height}px`,
  });
  const drawing = svg('svg', { viewBox: '0 0 100 112', 'aria-hidden': 'true' });
  drawing.append(svg('path', { class: 'bt-slot__groove', d: 'M10 100 Q50 106 90 100' }));
  if (letter) {
    drawing.append(
      svg(
        'text',
        { class: 'bt-slot__letter', x: 50, y: 84, 'text-anchor': 'middle' },
        letter.toUpperCase(),
      ),
    );
  }
  element.append(drawing);
  return element;
}

export function wordRow(
  letters: readonly (string | null)[],
  states: readonly SlotState[],
  layout: BeachLayout,
): HTMLElement {
  const spoken = letters.map((letter) => (letter ? letter.toUpperCase() : 'blank')).join(', ');
  const row = h('div', {
    class: 'bt-word',
    role: 'img',
    'aria-label': `The word: ${spoken}`,
    style: `left:${layout.word.x}px;top:${layout.word.y}px;gap:${layout.slot.gap}px`,
  });
  letters.forEach((letter, i) => row.append(slot(letter, states[i] ?? 'hidden', layout)));
  return row;
}

export type KeyState = 'fresh' | 'right' | 'wrong';

const SHELL_SHAPES = ['scallop', 'pebble', 'cockle', 'pebble-round'] as const;

/** The outline behind each letter: scallops, cockles and two kinds of pebble, in turn. */
function keyShape(index: number): SVGSVGElement {
  const shape = SHELL_SHAPES[(index * 7 + Math.floor(index / 3)) % SHELL_SHAPES.length]!;
  const drawing = svg('svg', {
    class: 'bt-key__shape',
    viewBox: '0 0 100 100',
    'aria-hidden': 'true',
  });
  const tilt = ((index * 37) % 11) - 5;
  if (shape === 'scallop' || shape === 'cockle') {
    const ribs = shape === 'scallop' ? 7 : 5;
    const body = svg('path', {
      class: `bt-key__body bt-key__body--${shape}`,
      d: 'M50 93 C8 80 2 30 22 14 C34 4 66 4 78 14 C98 30 92 80 50 93 Z',
      transform: `rotate(${tilt} 50 50)`,
    });
    drawing.append(body);
    // Ribs only round the rim, so they never cross the letter.
    for (let i = 0; i < ribs; i++) {
      const edgeX = 16 + (68 * i) / (ribs - 1);
      const edgeY = 16 + Math.abs(i - (ribs - 1) / 2) * 6;
      const along = (t: number) =>
        `${(50 + (edgeX - 50) * t).toFixed(1)} ${(88 + (edgeY - 88) * t).toFixed(1)}`;
      drawing.append(
        svg('path', {
          class: 'bt-key__rib',
          d: `M${along(0.72)} L${along(0.97)}`,
          transform: `rotate(${tilt} 50 50)`,
        }),
      );
    }
    drawing.append(
      svg('rect', {
        class: 'bt-key__hinge',
        x: 40,
        y: 86,
        width: 20,
        height: 8,
        rx: 3,
        transform: `rotate(${tilt} 50 50)`,
      }),
    );
  } else {
    const round = shape === 'pebble-round';
    drawing.append(
      svg('ellipse', {
        class: `bt-key__body bt-key__body--${shape}`,
        cx: 50,
        cy: 52,
        rx: round ? 44 : 46,
        ry: round ? 42 : 36,
        transform: `rotate(${tilt * 2} 50 50)`,
      }),
      svg('ellipse', {
        class: 'bt-key__gleam',
        cx: 36,
        cy: 34,
        rx: 14,
        ry: 6,
        transform: `rotate(-20 36 34)`,
      }),
    );
  }
  return drawing;
}

export function keyboard(
  states: Readonly<Record<string, KeyState>>,
  layout: BeachLayout,
  onKey?: (letter: string) => void,
): HTMLElement {
  const board = h('div', {
    class: 'bt-keys',
    role: 'group',
    'aria-label': 'Letters',
    style: `left:${layout.keyboard.x}px;top:${layout.keyboard.y}px;width:${layout.keyboard.width}px;gap:${layout.key.gap}px ${layout.key.gap}px`,
  });
  ALPHABET.forEach((letter, index) => {
    const state = states[letter] ?? 'fresh';
    const label =
      state === 'fresh'
        ? letter.toUpperCase()
        : `${letter.toUpperCase()}, ${state === 'right' ? 'in the word' : 'not in the word'}`;
    const key = h(
      'button',
      {
        class: `bt-key bt-key--${state}`,
        type: 'button',
        'data-letter': letter,
        'aria-label': label,
        'aria-disabled': state === 'fresh' ? undefined : 'true',
        style: `width:${layout.key.size}px;height:${layout.key.size}px`,
      },
      keyShape(index),
      h('span', { class: 'bt-key__letter', 'aria-hidden': 'true' }, letter.toUpperCase()),
    );
    if (onKey) key.addEventListener('click', () => onKey(letter));
    board.append(key);
  });
  return board;
}

export function gaugeLabel(waves: number, allowed: number, layout: BeachLayout): HTMLElement {
  const left = allowed - waves;
  return h(
    'p',
    {
      class: 'bt-gauge',
      style: `left:${layout.gauge.x}px;top:${layout.gauge.bottomY + 46 * layout.scale}px`,
      'aria-live': 'polite',
    },
    h('strong', {}, `${waves} of ${allowed}`),
    h('span', {}, left === 1 ? 'waves · one more and it falls' : 'waves'),
  );
}

export function lighthouseButton(
  available: boolean,
  layout: BeachLayout,
  onUse?: () => void,
): HTMLElement {
  const button = h(
    'button',
    {
      class: 'bt-lighthouse',
      type: 'button',
      'aria-disabled': available ? undefined : 'true',
      'aria-keyshortcuts': 'Shift+Slash',
      style: `right:${Math.max(16, 24 * layout.scale)}px;top:${layout.gauge.bottomY + 120 * layout.scale}px`,
    },
    lighthouseIcon(),
    h(
      'span',
      { class: 'bt-lighthouse__text' },
      h('strong', {}, 'Lighthouse'),
      h('span', {}, 'shows a letter · costs a wave'),
    ),
    h('kbd', { class: 'bt-kbd' }, '?'),
  );
  if (onUse) button.addEventListener('click', onUse);
  return button;
}

function lighthouseIcon(): SVGSVGElement {
  return svg(
    'svg',
    { class: 'bt-lighthouse__icon', viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    svg('path', { d: 'M9 22l1.5-13h3L15 22z', class: 'bt-icon-tower' }),
    svg('path', { d: 'M10 14h4M9.6 18h4.8', class: 'bt-icon-band' }),
    svg('rect', { x: 9.5, y: 5, width: 5, height: 4, rx: 1, class: 'bt-icon-lamp' }),
    svg('path', { d: 'M8.5 5L12 2l3.5 3z', class: 'bt-icon-roof' }),
    svg('path', { d: 'M15.5 7l6-2M15.5 7.5l6 1.5', class: 'bt-icon-beam' }),
  );
}

/** A stand-in for the Hall's own Pause pill, drawn on stills so they show the whole frame. */
export function hallPausePill(): HTMLElement {
  return h(
    'div',
    { class: 'bt-hall-pill', 'aria-hidden': 'true' },
    'Pause',
    h('span', { class: 'bt-kbd' }, 'Esc'),
  );
}

export function hallBackCorner(): HTMLElement {
  return h('div', { class: 'bt-hall-corner', 'aria-hidden': 'true' }, '← Back to the Hall');
}

export function winCaption(headline: string, detail: string): HTMLElement {
  return h(
    'div',
    { class: 'bt-caption', role: 'status' },
    h('p', { class: 'bt-caption__headline' }, headline),
    h('p', { class: 'bt-caption__detail' }, detail),
  );
}
