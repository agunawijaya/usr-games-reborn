import { indexOf, newGame, type GameState, other, play } from '../engine/game';
import { fivePoints, fourMoves } from '../engine/solver';
import type { Look } from '../render/look';
import { coachCard, readCard, type ResultsModel, resultsCard, seatCard } from '../ui/cards';
import { h } from '../ui/dom';
import { sideOf, tally, threatViews } from './read';
import type { FivefoldSound } from './sound';
import { BoardStage } from './stage';

/**
 * The tutorial, about ninety seconds: make five; block a four; turn an open three into an open
 * four and finish; then switch on Read the board and use it. Each step sets up a small position
 * on a 15 × 15 board, says what to do beside the board, and moves on when it is done.
 */

/** What a step asks for: five, a block, an open four, or Read the board switched on. */
type Goal = 'five' | 'block' | 'open-four' | 'read';

interface Step {
  title: string;
  text: string;
  /** Moves to set up, first player first, as [x, y]; you play the side to move. */
  setup: [number, number][];
  goal: Goal;
  /** After a right move, the other side blocks one of your points of five. */
  reply?: boolean;
  /** A second goal in the same position. */
  then?: { text: string; goal: Goal };
}

const STEPS: readonly Step[] = [
  {
    title: 'Five in a row wins',
    text: 'Four of yours stand in a row. Place the fifth at either end.',
    setup: [
      [5, 7],
      [5, 10],
      [6, 7],
      [6, 10],
      [7, 7],
      [9, 11],
      [8, 7],
      [10, 4],
    ],
    goal: 'five',
  },
  {
    title: 'A four must be answered',
    text: 'The other side has four in a row, blocked at one end. Put your piece on the open end, or it makes five.',
    setup: [
      [6, 5],
      [5, 9],
      [10, 3],
      [6, 9],
      [4, 9],
      [7, 9],
      [12, 12],
      [8, 9],
    ],
    goal: 'block',
  },
  {
    title: 'An open three is a promise',
    text: 'Three in a row with room at both ends. One more makes an open four: two ways to five, and only one can be blocked.',
    setup: [
      [6, 7],
      [6, 3],
      [7, 7],
      [11, 11],
      [8, 7],
      [2, 12],
    ],
    goal: 'open-four',
    reply: true,
    then: { text: 'They blocked one end. Make five at the other.', goal: 'five' },
  },
  {
    title: 'Read the board',
    text: 'Switch on Read the board: press T, or use the switch on the left.',
    setup: [
      [7, 7],
      [8, 6],
      [12, 6],
      [9, 6],
      [7, 8],
      [10, 6],
      [3, 3],
      [11, 6],
    ],
    goal: 'read',
    then: {
      text: 'Solid lines are fours, dashed lines open threes; rings show where they complete. Block their four.',
      goal: 'block',
    },
  },
];

export interface TutorialHooks {
  look(): Look;
  reducedMotion(): boolean;
  sound: FivefoldSound;
  ownPause: boolean;
  inHall: boolean;
  onDone(): void;
  onGameMenu(): void;
  onPause(): void;
}

export class TutorialSession {
  readonly stage: BoardStage;
  private index = 0;
  private game: GameState = newGame(15, 'freestyle');
  private phase: 'goal' | 'then' | 'done' = 'goal';
  private readOn = false;
  private destroyed = false;
  private finished = false;

  constructor(
    root: HTMLElement,
    private readonly hooks: TutorialHooks,
  ) {
    this.stage = new BoardStage(root, {
      look: hooks.look(),
      reducedMotion: hooks.reducedMotion(),
      ownPause: hooks.ownPause,
      inHall: hooks.inHall,
      size: 15,
    });
    this.stage.screen.onGameMenu(() => hooks.onGameMenu());
    this.stage.screen.onPause(() => hooks.onPause());
    this.stage.sessionKeys = (event) => {
      if (event.key.toLowerCase() !== 't') return false;
      this.setRead(!this.readOn);
      return true;
    };
    this.begin(0);
    this.stage.focusBoard();
  }

  get isOver(): boolean {
    return this.finished;
  }

  private get step(): Step {
    return STEPS[this.index]!;
  }

  private at(x: number, y: number): number {
    return indexOf(this.game, x, y);
  }

  private begin(index: number): void {
    this.index = index;
    this.phase = 'goal';
    this.readOn = false;
    this.game = newGame(15, 'freestyle');
    for (const [x, y] of this.step.setup) play(this.game, this.at(x, y));
    this.stage.reset(15, this.game.moves);
    this.stage.setHand(sideOf(this.game.toMove), (p) => this.move(p));
    this.refresh();
  }

  private setRead(on: boolean): void {
    this.readOn = on;
    if (on && this.step.goal === 'read' && this.phase === 'goal') this.phase = 'then';
    this.refresh();
  }

  private get goal(): Goal {
    return this.phase === 'then' ? this.step.then!.goal : this.step.goal;
  }

  /** The points that do what the step asks, worked out from the position. */
  private targets(): number[] {
    const game = this.game;
    const me = game.toMove;
    switch (this.goal) {
      case 'five':
        return fivePoints(game, me);
      case 'block':
        return fivePoints(game, other(me));
      case 'open-four':
        return fourMoves(game, me).filter((p) => {
          game.board[p] = me;
          const open = fivePoints(game, me).length >= 2;
          game.board[p] = null;
          return open;
        });
      case 'read':
        return [];
    }
  }

  private move(p: number): void {
    if (this.phase === 'done' || this.game.board[p] !== null || this.goal === 'read') return;
    const side = sideOf(this.game.toMove);
    if (!this.targets().includes(p)) {
      this.stage.announce('Not there: look again at the hint beside the board.');
      this.hint = true;
      this.refresh();
      return;
    }
    this.hint = false;
    play(this.game, p);
    this.stage.place(p, side, 'You');
    this.hooks.sound.place(this.hooks.look().dark, true);
    if (this.phase === 'goal' && this.step.reply) {
      this.stage.setHand(null);
      setTimeout(() => {
        if (this.destroyed) return;
        const block = fivePoints(this.game, this.game.board[p]!)[0]!;
        play(this.game, block);
        this.stage.place(block, sideOf(this.game.board[block]!), 'The other side');
        this.hooks.sound.place(this.hooks.look().dark, false);
        this.phase = 'then';
        this.stage.setHand(sideOf(this.game.toMove), (r) => this.move(r));
        this.refresh();
      }, 600);
      return;
    }
    if (this.phase === 'goal' && this.step.then) {
      this.phase = 'then';
      this.refresh();
      return;
    }
    void this.stepDone();
  }

  private hint = false;

  private async stepDone(): Promise<void> {
    this.phase = 'done';
    this.stage.setHand(null);
    this.refresh();
    if (this.game.winningLine) {
      this.hooks.sound.win(this.hooks.look().dark);
      await this.stage.showWin(this.game.winningLine, sideOf(this.game.winner!));
    } else await new Promise((resolve) => setTimeout(resolve, 900));
    if (this.destroyed) return;
    if (this.index + 1 < STEPS.length) this.begin(this.index + 1);
    else {
      this.finished = true;
      this.hooks.onDone();
    }
  }

  private refresh(): void {
    const look = this.hooks.look();
    const step = this.step;
    const threats = this.readOn ? threatViews(this.game) : [];
    this.stage.setThreats(threats);
    this.stage.screen.setContext(`Tutorial · step ${this.index + 1} of ${STEPS.length}`);
    const text =
      this.phase === 'done' ? 'Well done.' : this.phase === 'then' ? step.then!.text : step.text;
    const you = sideOf(this.game.toMove);
    const showRead = step.goal === 'read' || this.readOn;
    const dots = h(
      'p',
      { class: 'ff-pips', 'aria-hidden': 'true' },
      ...STEPS.map((_, i) => h('span', { class: `ff-pip${i <= this.index ? ' is-on' : ''}` })),
    );
    this.stage.screen.setSides(
      [
        coachCard(
          `Step ${this.index + 1} of ${STEPS.length}`,
          step.title,
          this.hint ? `${text} (Not there — try again.)` : text,
          dots,
        ),
        showRead
          ? readCard({
              on: this.readOn,
              allowed: true,
              mine: { name: 'You', tally: tally(threats, you) },
              theirs: { name: 'Them', tally: tally(threats, (1 - you) as 0 | 1) },
              toggle: (on) => this.setRead(on),
            })
          : seatCard({ look, side: you, kicker: 'Your seat', name: 'You' }),
      ],
      [
        h(
          'section',
          { class: 'ff-card ff-info' },
          h('p', { class: 'ff-kicker' }, 'The game'),
          h('h2', { class: 'ff-seat__name' }, 'Five in a row'),
          h(
            'p',
            { class: 'ff-info__line' },
            'Take turns placing pieces where the lines cross. Five in an unbroken line wins: across, down or on a slant.',
          ),
          h(
            'p',
            { class: 'ff-info__line' },
            'Point and click, or move the cursor with the arrow keys and press Enter.',
          ),
          fivePoints(this.game, this.game.toMove).length > 0 && this.phase !== 'done'
            ? h('p', { class: 'ff-info__line is-urgent' }, 'Five is one move away.')
            : null,
        ),
      ],
    );
    this.stage.announce(text);
  }

  pause(): void {}

  resume(): void {}

  setLook(look: Look): void {
    this.stage.setLook(look);
    this.refresh();
  }

  showResults(model: ResultsModel): void {
    this.stage.screen.setOverlay(resultsCard(model));
  }

  destroy(): void {
    this.destroyed = true;
    this.stage.destroy();
  }
}
