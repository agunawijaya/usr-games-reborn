import type { Weighing } from '../engine/campbell/mind';
import { opponentById, type OpponentId } from '../engine/opponents';
import type { Look } from '../render/look';
import type { SideIndex } from '../render/view';
import { infoCard, opponentCard, seatCard } from '../ui/cards';
import { h } from '../ui/dom';
import { BoardStage, pointName } from './stage';

/**
 * The replay of a finished game: step through it move by move, and before each of the opponent's
 * moves see what the 1994 search weighed — the points it rated for both sides, the frames it found
 * forcing, its choice and your best point. ← → step, Home and End jump, Space plays it through.
 */

export interface ReplayGame {
  size: number;
  moves: readonly number[];
  weighings: readonly (Weighing | null)[];
  opponent: OpponentId | null;
  you: SideIndex;
  /** How the game ended, for the last step's caption. */
  ending: string;
}

export interface ReplayHooks {
  look(): Look;
  reducedMotion(): boolean;
  ownPause: boolean;
  inHall: boolean;
  onBack(): void;
  onGameMenu(): void;
  onPause(): void;
}

export class ReplaySession {
  readonly stage: BoardStage;
  private index: number;
  private showWeighing = true;
  private timer = 0;

  constructor(
    root: HTMLElement,
    private readonly replay: ReplayGame,
    private readonly hooks: ReplayHooks,
  ) {
    this.stage = new BoardStage(root, {
      look: hooks.look(),
      reducedMotion: hooks.reducedMotion(),
      ownPause: hooks.ownPause,
      inHall: hooks.inHall,
      size: replay.size,
    });
    this.stage.screen.onGameMenu(() => hooks.onGameMenu());
    this.stage.screen.onPause(() => hooks.onPause());
    this.stage.sessionKeys = (event) => this.onKey(event);
    // Start at the opponent's first move, where there is something to see.
    const first = replay.weighings.findIndex((w) => w !== null);
    this.index = first < 0 ? 0 : first;
    this.show();
    this.stage.focusBoard();
  }

  get isOver(): boolean {
    return false;
  }

  private onKey(event: KeyboardEvent): boolean {
    switch (event.key) {
      case 'ArrowLeft':
        this.go(this.index - 1);
        return true;
      case 'ArrowRight':
        this.go(this.index + 1);
        return true;
      case 'Home':
        this.go(0);
        return true;
      case 'End':
        this.go(this.replay.moves.length);
        return true;
      case ' ':
        this.togglePlay();
        return true;
    }
    if (event.key.toLowerCase() === 'w') {
      this.showWeighing = !this.showWeighing;
      this.show();
      return true;
    }
    return false;
  }

  go(index: number): void {
    this.index = Math.max(0, Math.min(this.replay.moves.length, index));
    this.show();
  }

  togglePlay(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    } else {
      if (this.index >= this.replay.moves.length) this.index = 0;
      this.timer = window.setInterval(() => {
        if (this.index >= this.replay.moves.length) this.togglePlay();
        else this.go(this.index + 1);
      }, 900);
    }
    this.show();
  }

  private show(): void {
    const { replay, index } = this;
    this.stage.reset(replay.size, replay.moves.slice(0, index));
    const next = replay.moves[index];
    const weighing = index < replay.moves.length ? (replay.weighings[index] ?? null) : null;
    const mover = (index % 2) as SideIndex;
    this.stage.setWeighing(this.showWeighing ? weighing : null, mover);
    this.refresh(weighing, next, mover);
  }

  private caption(weighing: Weighing | null, next: number | undefined, mover: SideIndex): string {
    const size = this.replay.size;
    const name = this.replay.opponent ? opponentById(this.replay.opponent).name : 'The program';
    if (next === undefined) return this.replay.ending;
    if (mover === this.replay.you)
      return `Your move ${Math.floor(this.index / 2) + 1}: ${pointName(size, next)}.`;
    if (!weighing)
      return `${name} played ${pointName(size, next)} without searching: a five to make, or one to block.`;
    const own = weighing.forcing[mover]!.length;
    const theirs = weighing.forcing[1 - mover]!.length;
    const parts = [
      `${name} played ${pointName(size, next)}.`,
      own > 0
        ? `It saw ${own} frame${own === 1 ? '' : 's'} of its own in a forcing combination`
        : 'It saw no forcing combination of its own',
      theirs > 0 ? `and ${theirs} of yours.` : 'and none of yours.',
    ];
    if (weighing.blocking) parts.push('Your threat came first, so it blocked.');
    else if (weighing.chosen !== next)
      parts.push(`It rated ${pointName(size, weighing.chosen)} highest, but played elsewhere.`);
    return parts.join(' ');
  }

  private refresh(weighing: Weighing | null, next: number | undefined, mover: SideIndex): void {
    const look = this.hooks.look();
    const { replay } = this;
    this.stage.screen.setContext(`Replay · move ${this.index} of ${replay.moves.length}`);
    const button = (label: string, key: string, run: () => void, disabled = false) =>
      h(
        'button',
        { type: 'button', class: 'ff-button', onclick: run, disabled },
        label,
        h('kbd', {}, key),
      );
    const controls = h(
      'div',
      { class: 'ff-card__actions ff-replay__controls' },
      button('First', 'Home', () => this.go(0), this.index === 0),
      button('Back', '←', () => this.go(this.index - 1), this.index === 0),
      button(this.timer ? 'Stop' : 'Play', 'Space', () => this.togglePlay()),
      button('Next', '→', () => this.go(this.index + 1), this.index >= replay.moves.length),
      button('Last', 'End', () => this.go(replay.moves.length), this.index >= replay.moves.length),
    );
    const done = h(
      'button',
      { type: 'button', class: 'ff-button ff-button--primary', onclick: () => this.hooks.onBack() },
      'Back to the results',
    );
    const theirSide = (1 - replay.you) as SideIndex;
    this.stage.screen.setSides(
      [
        infoCard(
          `Replay · move ${Math.min(this.index + 1, replay.moves.length)} of ${replay.moves.length}`,
          'What it weighed',
          this.caption(weighing, next, mover),
          controls,
          h(
            'label',
            { class: 'ff-switch ff-switch--small' },
            h('span', {}, 'Show its thinking ', h('kbd', {}, 'W')),
            h('input', {
              type: 'checkbox',
              role: 'switch',
              checked: this.showWeighing,
              onchange: () => {
                this.showWeighing = !this.showWeighing;
                this.show();
              },
            }),
            h('span', { class: 'ff-switch__track', 'aria-hidden': 'true' }),
          ),
          done,
        ),
        seatCard({ look, side: replay.you, kicker: 'Your seat', name: 'You' }),
      ],
      [
        replay.opponent
          ? opponentCard({
              look,
              opponent: opponentById(replay.opponent),
              side: theirSide,
              speech: null,
              record: null,
            })
          : seatCard({
              look,
              side: theirSide,
              kicker: 'The other seat',
              name: look.pieces[theirSide]!.name,
            }),
        infoCard(
          'Reading its thinking',
          'Dots, lines, rings',
          'Dots mark the points the 1994 search rated, bigger the closer they came to an unstoppable combination, in each side’s colour.',
          'Dotted lines are frames — runs of five — it found part of a forcing combination. The solid ring is its choice; the dashed ring, your best point by its reckoning.',
        ),
      ],
    );
  }

  pause(): void {}

  resume(): void {}

  setLook(look: Look): void {
    this.stage.setLook(look);
    this.show();
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.stage.destroy();
  }
}
