import type { TableLayout } from '../render/layout';
import type { Look } from '../render/look';
import { formatPoints, h } from './dom';

/**
 * The score bar across the top and the line of play above the hand: what the hand is, who
 * leads, and what happens next. Text lives in the page, not the canvas, so it reads sharply and
 * screen readers hear it.
 */

export interface HudState {
  route: string;
  /** e.g. "Hand 2 · game to 5,000". */
  progress: string;
  names: [string, string];
  totals: [number, number];
  /** The current hand's running score for each side. */
  hand: [number, number];
  status: string;
}

export class Hud {
  readonly element = h('div', { class: 'dt-hud' });
  private readonly route = h('span', { class: 'dt-hud__route' });
  private readonly progress = h('span', { class: 'dt-hud__progress' });
  private readonly scores = h('div', { class: 'dt-hud__scores', 'aria-label': 'Scores' });
  readonly status = h('p', { class: 'dt-status', 'aria-live': 'polite' });
  private readonly keys = h('div', { class: 'dt-keys', 'aria-hidden': 'true' });

  constructor() {
    const brand = h(
      'div',
      { class: 'dt-hud__brand' },
      h('span', { class: 'dt-hud__mark' }, 'Detour'),
      this.route,
      this.progress,
    );
    this.element.append(
      h('div', { class: 'dt-hud__bar' }, brand, this.scores),
      this.status,
      this.keys,
    );
  }

  update(state: HudState, look: Look): void {
    this.route.textContent = state.route;
    this.progress.textContent = state.progress;
    this.scores.replaceChildren(
      ...([0, 1] as const).map((side) =>
        h(
          'span',
          {
            class: `dt-score dt-score--${side === 0 ? 'you' : 'rival'}`,
            style: `--dt-car:${look.cars[side].bodyDeep}`,
          },
          h('span', { class: 'dt-score__name' }, state.names[side]),
          h(
            'strong',
            { class: 'dt-score__total' },
            formatPoints(state.totals[side] + state.hand[side]),
          ),
          h('span', { class: 'dt-score__hand' }, `+${formatPoints(state.hand[side])} this hand`),
        ),
      ),
    );
    this.status.textContent = state.status;
  }

  /** Fades the status line (still read out) while a tip or action bar stands over it. */
  quietStatus(quiet: boolean): void {
    this.status.classList.toggle('is-quiet', quiet);
  }

  /** Puts the status line over the hand and a key under each hand card. */
  place(layout: TableLayout): void {
    const s = layout.scale;
    this.element.style.setProperty('--dt-scale', String(s));
    const bar = this.element.querySelector<HTMLElement>('.dt-hud__bar')!;
    bar.style.height = `${layout.bar.h}px`;
    Object.assign(this.status.style, {
      left: `${layout.status.x}px`,
      top: `${layout.status.y}px`,
      width: `${layout.status.w}px`,
      height: `${layout.status.h}px`,
    });
    this.keys.replaceChildren(
      ...layout.hand.map((rect, slot) =>
        h(
          'span',
          {
            class: 'dt-key',
            style: `left:${rect.x + rect.w / 2}px;top:${rect.y + rect.h + 8 * s}px`,
          },
          slot === 0 ? 'P' : String(slot),
        ),
      ),
    );
  }
}
