import type { Verdict } from '../codecs/semaphore';
import { h, keys } from './dom';

/**
 * The interface pieces shared by the desk and the stations: the telegram card with its header
 * band, star goals, key hints, the semaphore word and its timer, rubber stamps and the tag that
 * points at a machine with a message.
 */

/** A card with a red header band (left and right texts) and a body. */
export function card(
  band: [string, string?],
  ...body: Array<Node | string | null | false>
): HTMLElement {
  return h(
    'section',
    { class: 'dd-card' },
    h('div', { class: 'dd-band' }, h('span', {}, band[0]), band[1] ? h('span', {}, band[1]) : null),
    h('div', { class: 'dd-card__body' }, ...body),
  );
}

export function title(text: string, subtitle?: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(h('h2', { class: 'dd-title' }, text));
  if (subtitle) fragment.append(h('p', { class: 'dd-subtitle' }, subtitle));
  return fragment;
}

export interface Slot {
  label: string;
  stars: number;
  state: 'done' | 'waiting' | 'locked';
}

/** The chapter's six messages with their stars. */
export function slots(list: readonly Slot[]): HTMLElement {
  return h(
    'ol',
    { class: 'dd-slots', 'aria-label': 'Messages in this chapter' },
    ...list.map((slot) =>
      h(
        'li',
        {
          class: 'dd-slot',
          'data-state': slot.state,
          'aria-label': `${slot.label}: ${slot.state === 'done' ? `${slot.stars} of 3 stars` : slot.state === 'waiting' ? 'waiting' : 'not yet'}`,
        },
        slot.label,
        h(
          'span',
          { class: 'dd-slot__stars', 'aria-hidden': 'true' },
          slot.state === 'done'
            ? '★'.repeat(slot.stars) + '☆'.repeat(3 - slot.stars)
            : slot.state === 'waiting'
              ? '●'
              : '·',
        ),
      ),
    ),
  );
}

/** The three stars a message can earn, marked when met so far. */
export function goals(list: ReadonlyArray<[string, boolean]>): HTMLElement {
  return h(
    'ul',
    { class: 'dd-goals', 'aria-label': 'Stars' },
    ...list.map(([text, met]) => h('li', { 'data-met': String(met) }, text)),
  );
}

/** A strip of key hints: `[['←', '→'], 'turn the wheel']`. */
export function hints(list: ReadonlyArray<[readonly string[], string]>): HTMLElement {
  return h(
    'div',
    { class: 'dd-hints' },
    ...list.map(([labels, text]) => h('span', {}, ...keys(labels), ` ${text}`)),
  );
}

/** A tag pointing at a machine with a message waiting. */
export function waitingTag(machine: string, key: string): HTMLElement {
  return h(
    'div',
    { class: 'dd-tag', role: 'status' },
    h('span', { class: 'dd-tag__dot', 'aria-hidden': 'true' }),
    `${machine}: a message is waiting`,
    h('kbd', {}, key),
  );
}

export interface SentLetter {
  letter: string;
  verdict?: Verdict;
  current?: boolean;
  /** Share of the time left, 0–1, for the current letter. */
  timeLeft?: number;
}

const MARKS: Record<Verdict, string> = { right: '✓', late: '!', wrong: '✗' };

/** The word being sent, letter by letter, with the judge's marks and the clock on the current one. */
export function sendWord(letters: readonly SentLetter[]): HTMLElement {
  return h(
    'ol',
    { class: 'dd-word', 'aria-label': 'Word to send' },
    ...letters.map((item) => {
      const element = h(
        'li',
        {
          class: 'dd-letter',
          'data-verdict': item.verdict,
          'data-current': item.current ? 'true' : undefined,
          'aria-label': `${item.letter}${item.verdict ? `, ${item.verdict}` : item.current ? ', sending now' : ''}`,
        },
        item.letter,
      );
      if (item.verdict)
        element.append(
          h('span', { class: 'dd-letter__mark', 'aria-hidden': 'true' }, MARKS[item.verdict]),
        );
      if (item.current && item.timeLeft !== undefined) element.append(timerRing(item.timeLeft));
      return element;
    }),
  );
}

function timerRing(left: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '3');
  rect.setAttribute('y', '3');
  rect.setAttribute('width', '94');
  rect.setAttribute('height', '94');
  rect.setAttribute('rx', '16');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', 'var(--dd-near)');
  rect.setAttribute('stroke-width', '5');
  rect.setAttribute('pathLength', '100');
  rect.setAttribute('stroke-dasharray', `${Math.max(0, Math.min(1, left)) * 100} 100`);
  rect.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(rect);
  return svg;
}

export function timerBar(left: number, label: string): HTMLElement {
  const fill = h('i');
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, left)) * 100)}%`;
  return h(
    'div',
    { class: 'dd-timer', role: 'timer', 'aria-label': label },
    h('span', {}, label),
    h('div', { class: 'dd-timer__bar' }, fill),
  );
}

export function stamp(text: string, color?: string): HTMLElement {
  const element = h('div', { class: 'dd-stamp', 'aria-hidden': 'true' }, text);
  if (color) element.style.color = color;
  return element;
}

/** Where the Hall's pause pill sits; drawn by the workbench only. */
export function hallPill(): HTMLElement {
  return h('div', { class: 'dd-hall-pill', 'aria-hidden': 'true' }, 'Pause · Esc');
}
