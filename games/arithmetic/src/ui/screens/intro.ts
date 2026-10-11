import {
  type EventSpec,
  eventCount,
  eventName,
  MODE_NAMES,
  parChoicesFor,
  sieveLevel,
  sumsLevel,
} from '../../engine/events';
import type { App, Screen, ScreenFactory } from '../app';
import { h } from '../dom';
import type { RunPlan } from '../flow';
import { place } from '../hud';
import { icon } from '../icons';

/**
 * The card before each event: what it is, how it is played, and Start. Enter starts it, so a
 * keyboard player never needs the mouse between events.
 */

/** One line on how to play each mode. */
const HOW: Record<EventSpec['mode'], string> = {
  sums: 'Type each answer and press Enter. A wrong answer stays until you get it.',
  split: 'Pick a prime that goes into the number, again and again, until only primes are left.',
  sieve: 'Pick a prime to sweep away its multiples. Clear the board in as few picks as you can.',
  spell: 'Put each number into words, then write words back as a number.',
};

export function eventDetail(spec: EventSpec, plan: Pick<RunPlan, 'tempo'>): string {
  const tempo = plan.tempo === 'rush' ? 'Rush, against the clock' : 'Calm, no clock';
  switch (spec.mode) {
    case 'sums': {
      const rule = spec.level === 'custom' ? undefined : sumsLevel(spec.level).rule;
      return [`${eventCount(spec)} sums`, tempo, rule].filter(Boolean).join(' · ');
    }
    case 'split':
      return `${eventCount(spec)} numbers to split · ${tempo}`;
    case 'sieve': {
      const level = sieveLevel(spec.level);
      return `${level.first.toLocaleString('en-US')} to ${level.last.toLocaleString('en-US')} · par ${parChoicesFor(spec)} picks · ${tempo}`;
    }
    case 'spell':
      return `${eventCount(spec)} numbers in words · ${tempo}`;
  }
}

export function introScreen(
  plan: RunPlan,
  index: number,
  levelName: string | null,
  onStart: () => void,
): ScreenFactory {
  return (app: App): Screen => {
    const spec = plan.events[index]!;
    const start = h(
      'button',
      {
        class: 'ns-button ns-button--primary ns-start',
        type: 'button',
        onclick: onStart,
        'data-testid': 'ns-intro-start',
      },
      'Start',
      h('small', {}, 'Enter'),
    );
    const card = h(
      'section',
      { class: 'ns-card ns-intro', 'aria-label': 'Next event' },
      plan.events.length > 1
        ? h(
            'span',
            { class: 'ns-label' },
            `${plan.title} · event ${index + 1} of ${plan.events.length}`,
          )
        : h('span', { class: 'ns-label' }, plan.title),
      h(
        'div',
        { class: 'ns-intro__mode' },
        icon(spec.mode, 'ns-intro__icon'),
        h('h2', { class: 'ns-card__title' }, MODE_NAMES[spec.mode]),
      ),
      h('p', { class: 'ns-intro__level' }, levelName ?? eventName(spec)),
      h('p', { class: 'ns-muted' }, eventDetail(spec, plan)),
      h('p', {}, HOW[spec.mode]),
      start,
    );
    const root = h('div', { class: 'ns-play' }, card);
    app.setScene({ kind: 'ready' });

    function layout() {
      const l = app.layout;
      const w = Math.min(760 * l.s + 120, l.width - 64);
      place(card, { x: (l.width - w) / 2, y: l.board.y, w, h: Math.max(380 * l.s, 300) });
      card.style.height = 'auto';
    }

    return {
      element: root,
      layout: 'play',
      onLayout: layout,
      onKey(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          onStart();
          return true;
        }
        return false;
      },
      focus: () => start.focus(),
    };
  };
}
