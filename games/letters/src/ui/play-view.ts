import type { BoardView } from '../render/board-view';
import type { Palette } from '../render/palette';
import { h } from './dom';
import {
  bestCard,
  type BestCard,
  brandBar,
  clockPanel,
  type ClockPanel,
  coverageCard,
  type CoverageCard,
  currentWord,
  type CurrentWord,
  hintLine,
  ruleCard,
  type RuleCard,
  scorePanel,
  type ScorePanel,
  wordWall,
  type WordWall,
} from './hud';
import { applyLook } from './look';

/**
 * The play screen's frame over the shared board: a three-column grid of HUD on the left
 * (clock, score, chain), the board's own space in the middle and coverage and the word wall
 * on the right. The left column keeps clear of the bottom-left corner, where the
 * Hall stacks its toasts, and the right of the top-right corner, where its Pause pill sits.
 */
export class PlayView {
  readonly element: HTMLElement;
  readonly clock: ClockPanel;
  readonly score: ScorePanel;
  readonly cover: CoverageCard;
  readonly wall: WordWall;
  readonly current: CurrentWord;
  readonly best: BestCard;
  readonly rule: RuleCard;
  private readonly slot: HTMLElement;
  private readonly observer: ResizeObserver;
  /** Called after the board has been placed, for anything laid over the cubes. */
  onPlaced: (() => void) | null = null;

  constructor(
    readonly board: BoardView,
    palette: Palette,
    reducedMotion: boolean,
  ) {
    this.clock = clockPanel();
    this.score = scorePanel();
    this.cover = coverageCard();
    this.wall = wordWall();
    this.current = currentWord();
    this.best = bestCard();
    this.slot = h('div', { class: 'chl-play__board', tabindex: -1, 'aria-label': 'The board' });
    this.rule = ruleCard();
    this.element = h(
      'div',
      { class: 'chl-screen chl-play' },
      h(
        'div',
        { class: 'chl-play__grid' },
        h('div', { class: 'chl-play__brand' }, brandBar()),
        h('div', { class: 'chl-play__current' }, this.current.element),
        h(
          'div',
          { class: 'chl-play__hud' },
          h('div', { class: 'chl-status' }, this.clock.element, this.score.element),
          this.rule.element,
          this.best.element,
        ),
        this.slot,
        h('div', { class: 'chl-play__side' }, this.cover.element, this.wall.element),
        h('div', { class: 'chl-play__hint' }, hintLine()),
      ),
    );
    applyLook(this.element, palette, reducedMotion);
    this.observer = new ResizeObserver(() => this.placeBoard());
    this.observer.observe(this.slot);
    this.observer.observe(this.element);
  }

  setLook(palette: Palette, reducedMotion: boolean) {
    applyLook(this.element, palette, reducedMotion);
  }

  /** The board's space in the grid, handed to the renderer in the view's own pixels. */
  placeBoard() {
    const frame = this.element.getBoundingClientRect();
    const slot = this.slot.getBoundingClientRect();
    this.board.setBoardRect({
      x: slot.left - frame.left,
      y: slot.top - frame.top,
      width: slot.width,
      height: slot.height,
    });
    this.onPlaced?.();
  }

  destroy() {
    this.observer.disconnect();
    this.element.remove();
  }
}
