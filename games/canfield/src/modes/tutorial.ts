import { type CardId, parseCard } from '@usr-games/kit/cards';
import type { Game } from '../engine/game';
import type { RuleEvent } from '../engine/rules';
import type { DealTable } from '../play/deal-table';
import type { Place } from '../render/table-view';
import { h } from '../ui/dom';

/**
 * The ninety-second tutorial: an easy deal arranged so the first moves teach the table — a card
 * home, a build in alternating colours, a space filled from the reserve, a deal of three — with
 * a coach pointing at each place. After the lessons the deal is the player's to finish.
 */

/**
 * Base 3♥. The 4♥ waits in pile 1 and the 9♣ and 8♦ in piles 2 and 3; the reserve shows the K♠;
 * the first deal shows the 2♣, the second the 5♥. Found by searching for the easiest win with
 * this opening (`solve` settles it in 71 positions).
 */
export const TUTORIAL_DEAL: CardId[] = [
  7, 39, 34, 48, 33, 12, 47, 35, 0, 45, 44, 37, 51, 28, 29, 8, 20, 49, 19, 26, 1, 5, 22, 30, 32, 10,
  23, 4, 17, 40, 6, 13, 3, 46, 25, 18, 21, 38, 15, 11, 2, 41, 31, 43, 24, 14, 36, 16, 42, 27, 50, 9,
];

const card = (text: string) => parseCard(text)!;

interface Lesson {
  text: string;
  /** Where the coach points, and what lights up. */
  at: Place;
  to?: Place;
  /** The step is learned when this happens; without it, a Next button moves on. */
  done?: (events: readonly RuleEvent[], game: Game) => boolean;
}

const homeOf = (id: CardId) => (events: readonly RuleEvent[]) =>
  events.some((e) => e.kind === 'home' && e.card === id && !e.auto);

const LESSONS: Lesson[] = [
  {
    text: 'This is the reserve: thirteen cards, the top one face up. Empty it and you are halfway home.',
    at: { kind: 'stock' },
  },
  {
    text: 'The first foundation card sets the base for all four: here every foundation starts at 3 and climbs, round from king to ace. Send the 4♥ home: drag it onto the 3♥, or click it.',
    at: { kind: 'tableau', index: 0 },
    to: { kind: 'foundation', index: 0 },
    done: homeOf(card('4h')),
  },
  {
    text: 'Behind each foundation a lotus opens a petal for every card. The tableau builds down in alternating colours: put the red 8♦ on the black 9♣.',
    at: { kind: 'tableau', index: 2 },
    to: { kind: 'tableau', index: 1 },
    done: (events) => events.some((e) => e.kind === 'built' && e.cards[0] === card('8d')),
  },
  {
    text: 'Spaces are filled from the reserve only, when you choose. Move the K♠ into a space: drag it, or click it.',
    at: { kind: 'stock' },
    to: { kind: 'tableau', index: 0 },
    done: (events) => events.some((e) => e.kind === 'built' && e.from === 'stock'),
  },
  {
    text: 'Deal three from the hand: click the hand, or press D. Only the top card of the talon shows.',
    at: { kind: 'hand' },
    to: { kind: 'talon' },
    done: (events) => events.some((e) => e.kind === 'dealt' && !e.auto),
  },
  {
    text: 'The 5♥ climbs onto the 4♥. Double-click it to send it home.',
    at: { kind: 'talon' },
    to: { kind: 'foundation', index: 0 },
    done: homeOf(card('5h')),
  },
  {
    text: 'Insight (C) lists the cards you have already seen, at a point a card. Hints (H) and undo (Z) cost points too. Nerve scores best.',
    at: { kind: 'talon' },
  },
  {
    text: 'That is the table. Finish this deal: it can be won.',
    at: { kind: 'foundation', index: 1 },
  },
];

export class Tutor {
  private index = 0;
  private readonly bubble = h('section', {
    class: 'td-coach',
    role: 'status',
    'aria-live': 'polite',
    'data-testid': 'td-coach',
  });

  constructor(
    private readonly root: HTMLElement,
    private readonly table: DealTable,
    private readonly reducedMotion: () => boolean,
  ) {
    root.append(this.bubble);
    this.show();
  }

  /** Every step of play: a lesson moves on once its move is made. */
  step(game: Game, events: readonly RuleEvent[]): void {
    const lesson = LESSONS[this.index];
    if (lesson?.done?.(events, game)) this.next();
    else this.point();
  }

  private next(): void {
    this.index++;
    this.show();
  }

  private point(): void {
    const lesson = LESSONS[this.index];
    if (!lesson) return;
    this.table.guide(lesson.at, lesson.to ?? lesson.at);
  }

  private show(): void {
    const lesson = LESSONS[this.index];
    if (!lesson) {
      this.destroy();
      return;
    }
    const last = this.index === LESSONS.length - 1;
    this.bubble.replaceChildren(
      h('p', { class: 'td-coach__step' }, `${this.index + 1} of ${LESSONS.length}`),
      h('p', { class: 'td-coach__text' }, lesson.text),
      h(
        'div',
        { class: 'td-coach__actions' },
        lesson.done
          ? null
          : h(
              'button',
              {
                type: 'button',
                class: 'td-button td-button--primary',
                'data-testid': 'td-coach-next',
                onclick: () => this.next(),
              },
              last ? 'Play on' : 'Next',
            ),
        last
          ? null
          : h(
              'button',
              {
                type: 'button',
                class: 'td-button',
                'data-testid': 'td-coach-skip',
                onclick: () => this.destroy(),
              },
              'Skip the lessons',
            ),
      ),
    );
    this.place();
    this.point();
    this.bubble.classList.toggle('is-still', this.reducedMotion());
  }

  /** In the free column beside the table, so it never covers a card; the outlines point. */
  private place(): void {
    const side = this.table.sideRect();
    Object.assign(this.bubble.style, {
      left: `${Math.round(side.x)}px`,
      top: `${Math.round(side.y)}px`,
      width: `${Math.round(side.w)}px`,
    });
  }

  destroy(): void {
    this.table.guide(null);
    this.bubble.remove();
    this.index = LESSONS.length;
  }
}
