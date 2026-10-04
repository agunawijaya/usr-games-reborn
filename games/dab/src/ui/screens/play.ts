import { createRng } from '@usr-games/kit';
import { declineEdge, handoutFrom } from '../../ai/endgame';
import { chooseMove } from '../../ai/opponents';
import { Position } from '../../ai/position';
import { boxColumn, boxEdges, boxRow, edgeDots, isHorizontal } from '../../engine/board';
import { components, controlOnCourse, isLong } from '../../engine/chains';
import {
  aim,
  type Cursor,
  cursorEdge,
  cursorOn,
  type Direction,
  type OriginalKey,
  originalStep,
  startCursor,
} from '../../game/cursor';
import type { KeyAction } from '../../game/keys';
import { isDoubleCross, Match, type Turn } from '../../game/match';
import { LADDER } from '../../game/modes';
import { PUZZLE_HINTS, PUZZLES } from '../../game/puzzles';
import { recordDaily } from '../../game/saves';
import type { PlaySetup } from '../../game/setups';
import { TUTORIAL } from '../../game/tutorial';
import { BoardView, type ViewScene } from '../../render/board-view';
import type { Region } from '../../render/frame';
import type { App, Screen } from '../app';
import { confirmCard, introCard, type IntroModel, resultsCard, type ResultsModel } from '../cards';
import { h } from '../dom';
import { coachCard, cutBanner, type Handlers, type SideModel, sidePanel, topBar } from '../hud';
import { Timeline } from '../timeline';

/**
 * The play screen: the board, the people round it, and the game as it happens. One class for
 * every mode; the mode only changes the cards and the side panel.
 */
export function playScreen(app: App, setup: PlaySetup): Screen {
  return new PlayScreen(app, setup).screen;
}

type Overlay = 'intro' | 'none' | 'confirm' | 'results';

const AIMS = {
  'aim-up': 'up',
  'aim-down': 'down',
  'aim-left': 'left',
  'aim-right': 'right',
} as const satisfies Partial<Record<KeyAction, Direction>>;

const ORIGINAL = {
  'jump-left': 'h',
  'jump-down': 'j',
  'jump-up': 'k',
  'jump-right': 'l',
  'hop-up-left': 'y',
  'hop-up-right': 'u',
  'hop-down-left': 'b',
  'hop-down-right': 'n',
} as const satisfies Partial<Record<KeyAction, OriginalKey>>;

/** Seconds a computer waits before its line: thinking, taking a run, or after a double cross. */
const PACE = { first: 0.85, move: 0.6, run: 0.26, afterCross: 1.35 };

class PlayScreen {
  readonly screen: Screen;
  private match: Match;
  private readonly view: BoardView;
  private readonly timeline = new Timeline();
  private readonly canvas = h('canvas', { 'aria-hidden': 'true', 'data-testid': 'dx-board' });
  private readonly hud = h('div', { class: 'dx-hud' });
  private readonly layer = h('div', { class: 'dx-layer' });
  private readonly announcer = h('p', { class: 'dx-sr', role: 'status', 'aria-live': 'polite' });
  private readonly element: HTMLElement;
  private overlay: Overlay;
  private clock = 0;
  private lastFrame = 0;
  private frame = 0;
  private paused = false;
  private cursor: Cursor = startCursor();
  private cursorShown = false;
  private hover: number | null = null;
  private drag: { row: number; column: number } | null = null;
  private lens: boolean;
  private hint = false;
  private says: string;
  private computerAt = 0;
  private runQueue: number[] = [];
  private nextRunAt = 0;
  private boxRun = 0;
  private banner: { element: HTMLElement; until: number } | null = null;
  private region: Region = { x: 0, y: 0, width: 1, height: 1 };
  private finishedAt: number | null = null;
  private tutorialOutcome: { text: string; done: boolean } | null = null;

  constructor(
    private readonly app: App,
    private readonly setup: PlaySetup,
  ) {
    this.match = new Match(setup.spec);
    this.lens = setup.spec.lensAllowed && app.saves.prefs.load().lens;
    this.says = setup.rival?.says.hello ?? '';
    this.overlay = setup.spec.mode === 'tutorial' || setup.spec.mode === 'local' ? 'none' : 'intro';
    this.timeline.reducedMotion = app.reducedMotion;
    this.element = h(
      'div',
      { class: 'dx-play', 'data-testid': 'dx-play', 'data-mode': setup.spec.mode },
      this.canvas,
      this.hud,
      this.layer,
      this.announcer,
    );
    this.view = new BoardView(this.canvas);
    this.view.maxSpacing = setup.spec.mode === 'tutorial' ? 200 : 180;
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointerleave', () => {
      this.hover = null;
    });
    window.addEventListener('resize', this.onResize);

    const pauseItems = () => this.pauseItems();
    this.screen = {
      element: this.element,
      get pauseItems() {
        return pauseItems();
      },
      onKey: (event) => this.onKey(event),
      onLook: (_look, reducedMotion) => {
        this.timeline.reducedMotion = reducedMotion;
        this.renderHud();
      },
      onPause: () => {
        this.paused = true;
      },
      onResume: () => {
        this.paused = false;
        this.lastFrame = 0;
      },
      focus: () => this.focusFirst(),
      destroy: () => this.destroy(),
    };
    requestAnimationFrame(() => {
      this.layout();
      this.renderHud();
      if (this.overlay === 'intro') this.showIntro();
      else this.begin();
      this.frame = requestAnimationFrame(this.tick);
    });
    exposeTestHook(this);
  }

  // ------------------------------------------------------------------ flow

  private begin() {
    this.overlay = 'none';
    this.layer.replaceChildren();
    this.computerAt = this.clock + PACE.first;
    this.renderHud();
    this.say(`${this.match.seat.name} to draw first.`);
    // The board has the keyboard now: arrows aim, Enter draws, Tab still reaches the buttons.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  private restart() {
    this.app.show((a) =>
      playScreen(a, {
        ...this.setup,
        spec: { ...this.setup.spec, seed: `${this.setup.spec.seed}+` },
      }),
    );
  }

  private get humanToMove(): boolean {
    return this.overlay === 'none' && !this.match.over && this.match.seat.kind !== 'computer';
  }

  private tick = (now: number) => {
    const dt = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (!this.paused) {
      this.clock += dt;
      this.drive();
    }
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  /** Moves the game on: the queued run, the computer's line, the banner, the results. */
  private drive() {
    if (this.banner && this.clock > this.banner.until) {
      this.banner.element.remove();
      this.banner = null;
    }
    if (this.overlay !== 'none') return;
    if (this.match.over) {
      if (
        this.finishedAt !== null &&
        this.clock > this.finishedAt &&
        !this.timeline.busy(this.clock)
      ) {
        this.finishedAt = null;
        this.finish();
      }
      return;
    }
    if (this.runQueue.length && this.clock >= this.nextRunAt) {
      const edge = this.runQueue.shift()!;
      if (this.humanToMove && this.match.canDraw(edge)) this.play(edge);
      else this.runQueue = [];
      this.nextRunAt = this.clock + PACE.run;
      return;
    }
    if (this.match.computerToMove && this.clock >= this.computerAt) {
      this.play(this.match.computerMove());
    }
  }

  private play(edge: number) {
    const turn = this.match.draw(edge);
    this.boxRun = turn.closed.length > 0 ? this.boxRun + turn.closed.length : 0;
    this.timeline.line(edge, this.clock);
    this.timeline.fill(turn.closed, this.clock);
    this.app.sounds.line(this.app.look);
    if (turn.closed.length) {
      window.setTimeout(() => this.app.sounds.box(this.boxRun, turn.by === 0), 140);
    }
    if (isDoubleCross(turn)) this.doubleCross(turn);
    else this.quip(turn);
    this.say(this.describe(turn));
    if (this.cursorShown) this.keepCursorUseful();
    this.schedule(turn);
    if (this.setup.tutorial) this.checkTutorial();
    if (this.match.over) this.finishedAt = this.clock + 0.7;
    this.renderHud();
  }

  private schedule(turn: Turn) {
    if (!this.match.computerToMove) return;
    const position = Position.from(this.match.board);
    const pace = isDoubleCross(turn)
      ? PACE.afterCross
      : position.firstCapturable() >= 0
        ? PACE.run
        : PACE.move;
    this.computerAt = this.clock + (this.app.reducedMotion ? Math.min(pace, 0.4) : pace);
  }

  /** The double cross: the pair flashes, the scissors cut, the banner names it, the camera holds. */
  private doubleCross(turn: Turn) {
    this.timeline.markCross(turn.handedBack, this.cutEdge(turn), turn.by, this.clock);
    this.app.sounds.snip();
    const name = this.match.spec.seats[turn.by].name;
    const banner = cutBanner(name, turn.handedBack.length, null);
    banner.style.left = `${this.region.x + this.region.width / 2}px`;
    this.banner?.element.remove();
    this.banner = { element: banner, until: this.clock + 3.2 };
    this.element.append(banner);
    const rival = this.setup.rival;
    if (rival) this.says = turn.by === 0 ? rival.says.crossed : rival.says.crossing;
  }

  /** The line between the pair and the box the cutter took just before, if there was one. */
  private cutEdge(turn: Turn): number | null {
    const { board, turns } = this.match;
    for (let i = turns.length - 2; i >= 0 && turns[i]!.by === turn.by; i--) {
      for (const taken of turns[i]!.closed) {
        for (const kept of turn.handedBack) {
          const shared = boxEdges(board, taken).find((edge) =>
            boxEdges(board, kept).includes(edge),
          );
          if (shared !== undefined) return shared;
        }
      }
    }
    return null;
  }

  private quip(turn: Turn) {
    const rival = this.setup.rival;
    if (!rival || turn.by !== 1 || turn.closed.length === 0) return;
    if (this.boxRun >= 4) this.says = rival.says.feast;
  }

  // ------------------------------------------------------------------ drawing

  private draw() {
    const scene = this.scene();
    this.view.render(scene, this.clock);
    const hold = this.timeline.hold(this.clock);
    if (hold > 0 && this.timeline.cross) {
      const box = this.timeline.cross.domino[0]!;
      const f = this.view.frame;
      const x = f.x + (boxColumn(this.match.board, box) + 0.5) * f.spacing;
      const y = f.y + (boxRow(this.match.board, box) + 0.5) * f.spacing;
      this.canvas.style.transformOrigin = `${x}px ${y}px`;
      this.canvas.style.transform = `scale(${1 + 0.035 * hold})`;
    } else if (this.canvas.style.transform) {
      this.canvas.style.transform = '';
    }
  }

  private scene(): ViewScene {
    const board = this.match.board;
    const capturing = this.timeline.cross ? this.cascade() : { trail: [], falling: null };
    const showLens =
      this.lens || (this.setup.tutorial !== undefined && this.setup.tutorial.index >= 2);
    // In the tutorial the lens only points out pieces nobody has opened yet: the pair being
    // decided on has its own highlight.
    const lens = showLens
      ? components(board).filter((c) => (this.setup.tutorial ? !c.open : this.lens || isLong(c)))
      : null;
    const cursorEdgeNow =
      this.cursorShown && this.humanToMove ? cursorEdge(board, this.cursor) : -1;
    return {
      board,
      look: this.app.look,
      marks: [this.match.spec.seats[0].mark, this.match.spec.seats[1].mark],
      lens,
      cursor: cursorEdgeNow >= 0 ? cursorEdgeNow : null,
      anchor: cursorEdgeNow >= 0 ? [this.cursor.row, this.cursor.column] : null,
      hover: this.humanToMove ? this.hover : null,
      drawing: this.timeline.drawing(this.clock),
      filling: this.timeline.filling(this.clock),
      lineAges: this.timeline.ages(this.clock),
      doubleCross: this.timeline.moment(this.clock, capturing.trail, capturing.falling),
      seed: 5,
    };
  }

  /** While a double cross plays out: the run the player who kept control is taking. */
  private cascade(): { trail: number[]; falling: number | null } {
    if (this.match.board.toMove !== this.timeline.cross?.by) return { trail: [], falling: null };
    const position = Position.from(this.match.board);
    const start = position.firstCapturable();
    const last = this.match.turns.at(-1);
    const falling = last && last.closed.length ? last.closed[0]! : null;
    if (start < 0) return { trail: [], falling: null };
    return { trail: [...handoutFrom(position, start).boxes], falling };
  }

  private onResize = () => {
    this.layout();
    this.renderHud();
  };

  private layout() {
    const width = this.element.clientWidth || window.innerWidth;
    const height = this.element.clientHeight || window.innerHeight;
    const narrow = width < 900;
    if (this.setup.tutorial) {
      const card = Math.min(560, width * 0.38);
      this.region = narrow
        ? { x: 12, y: 84, width: width - 24, height: height * 0.5 - 84 }
        : { x: 24, y: 96, width: width - card - 96, height: height - 120 };
    } else {
      this.region = narrow
        ? { x: 12, y: 84, width: width - 24, height: height * 0.56 - 84 }
        : { x: 24, y: 96, width: width - 300 - 72, height: height - 120 };
    }
    this.view.layout(width, height, this.region);
    this.element.style.setProperty('--dx-centre', `${this.region.x + this.region.width / 2}px`);
  }

  // ------------------------------------------------------------------ the panels

  private renderHud() {
    const active = document.activeElement as HTMLElement | null;
    const focusedId = active && this.hud.contains(active) ? active.dataset.testid : undefined;
    const handlers: Handlers = {
      onMenu: () => this.askToLeave(),
      onLens: () => this.toggleLens(),
      onRun: () => this.takeRun(),
      onHint: () => {
        this.hint = true;
        this.renderHud();
      },
    };
    const model = this.sideModel();
    const children: HTMLElement[] = [topBar(model, handlers)];
    if (this.setup.tutorial) children.push(this.coach());
    else children.push(sidePanel(model, handlers));
    this.hud.replaceChildren(...children);
    if (focusedId) this.hud.querySelector<HTMLElement>(`[data-testid="${focusedId}"]`)?.focus();
  }

  private sideModel(): SideModel {
    const { board, spec } = this.match;
    const comps = components(board);
    const first = spec.first;
    const puzzle = this.setup.puzzle;
    return {
      names: [spec.seats[0].short, spec.seats[1].short],
      marks: [spec.seats[0].mark, spec.seats[1].mark],
      scores: board.scores,
      toMove: board.toMove,
      finished: this.match.over,
      match: this.matchTitle(),
      matchDetail: this.matchDetail(),
      rival: this.setup.rival
        ? { name: this.setup.rival.name, blurb: this.setup.rival.blurb, says: this.says }
        : null,
      puzzle: puzzle
        ? {
            goal: `Take at least ${puzzle.target} of the ${puzzle.open} boxes still open. Master plays the other side.`,
            hint: this.hint ? PUZZLE_HINTS[puzzle.kind] : null,
          }
        : null,
      lens: this.lens,
      lensAllowed: spec.lensAllowed,
      longChains: comps.filter((c) => c.kind === 'chain' && isLong(c)).length,
      loops: comps.filter((c) => c.kind === 'loop').length,
      control: controlOnCourse(board, first),
      runReady: this.runAvailable(),
    };
  }

  private matchTitle(): string {
    const { setup } = this;
    if (setup.ladder) return `Ladder · match ${setup.ladder.number} of ${LADDER.length}`;
    if (setup.daily) return `Daily Board #${setup.daily.number}`;
    if (setup.puzzle) return `Puzzle ${setup.puzzle.number} of ${PUZZLES.length}`;
    if (setup.spec.mode === 'local') return 'Two players';
    if (setup.spec.mode === 'tutorial') return 'Tutorial';
    return 'Custom board';
  }

  private matchDetail(): string {
    const { spec } = this.match;
    const size = `${spec.columns} × ${spec.rows}`;
    if (this.setup.rival) return `${size} against ${this.setup.rival.name}`;
    return `${size}, ${spec.seats[0].name} and ${spec.seats[1].name}`;
  }

  private coach(): HTMLElement {
    const { index, step } = this.setup.tutorial!;
    const card = coachCard(
      {
        step: index + 1,
        steps: TUTORIAL.length,
        title: step.title,
        body: step.lesson,
        options: step.options,
        prompt: step.prompt(this.match),
        outcome: this.tutorialOutcome,
      },
      {
        onNext: () => this.nextStep(),
        onRetry: () => this.app.go.tutorial(index),
      },
    );
    return card;
  }

  private checkTutorial() {
    const step = this.setup.tutorial!.step;
    const state = step.check(this.match);
    if (state === 'done') this.tutorialOutcome = { text: step.praise, done: true };
    else if (state === 'retry') this.tutorialOutcome = { text: step.retry ?? '', done: false };
    if (state !== 'playing') {
      this.runQueue = [];
      this.computerAt = Infinity;
    }
  }

  private nextStep() {
    const { index } = this.setup.tutorial!;
    if (index + 1 < TUTORIAL.length) {
      this.app.go.tutorial(index + 1);
      return;
    }
    this.app.saves.prefs.update((p) => ({ ...p, tutorialDone: true }));
    this.app.go.title();
  }

  // ------------------------------------------------------------------ cards

  private showIntro() {
    this.overlay = 'intro';
    const card = introCard(this.introModel(), () => this.begin());
    this.layer.replaceChildren(card);
    this.positionCard(card);
  }

  private introModel(): IntroModel {
    const { setup } = this;
    const { spec } = setup;
    const firstSeat = spec.seats[spec.first];
    const firstLine =
      firstSeat.kind === 'you' && firstSeat.name === 'You'
        ? 'You draw first.'
        : `${firstSeat.name} draws first.`;
    const size = `${spec.columns} × ${spec.rows} boxes`;
    const rival = setup.rival
      ? { name: setup.rival.name, blurb: setup.rival.blurb, mark: setup.rival.mark }
      : null;
    if (setup.puzzle) {
      const p = setup.puzzle;
      return {
        eyebrow: `Endgame puzzle ${p.number} of ${PUZZLES.length}`,
        title:
          p.kind === 'decline'
            ? 'Hand them back'
            : p.kind === 'sacrifice'
              ? 'Give before you must'
              : 'Choose your gift',
        lines: [
          `${p.columns} × ${p.rows} board, you to move.`,
          `Take at least ${p.target} of the ${p.open} boxes still open.`,
          'Master plays the other side, perfectly.',
        ],
        rival,
        start: 'Start the puzzle',
      };
    }
    if (setup.daily) {
      return {
        eyebrow: `Daily Board #${setup.daily.number}`,
        title: 'Today’s board',
        lines: [
          `${size}, opened with the same dozen lines for everyone today.`,
          'You draw first. The chain lens stays off.',
          'Your first finished Daily Board of the day is the one that counts.',
        ],
        rival,
        start: 'Start',
      };
    }
    const lines = [size, firstLine];
    if (setup.ladder)
      lines.push(
        setup.ladder.number === LADDER.length
          ? 'The last match of the ladder.'
          : 'Win to open the next match.',
      );
    return {
      eyebrow: this.matchTitle(),
      title: setup.rival ? `Against ${setup.rival.name}` : 'Custom board',
      lines,
      rival,
      start: 'Start the match',
    };
  }

  private positionCard(card: HTMLElement) {
    card.style.left = `${this.region.x + this.region.width / 2}px`;
    card.style.top = `${this.region.y + this.region.height / 2}px`;
    card.style.transform = 'translate(-50%, -50%)';
    requestAnimationFrame(() => card.querySelector<HTMLElement>('[data-autofocus]')?.focus());
  }

  private askToLeave() {
    if (this.match.over || this.match.turns.length === 0 || this.setup.spec.mode === 'tutorial') {
      this.app.go.title();
      return;
    }
    const before = this.overlay;
    this.overlay = 'confirm';
    const card = confirmCard(
      'Leave this game?',
      'The board will be cleared, and this game will not count.',
      { label: 'Leave', run: () => this.app.go.title() },
      () => {
        this.overlay = before === 'confirm' ? 'none' : before;
        card.remove();
        this.focusFirst();
      },
    );
    this.layer.append(card);
    this.positionCard(card);
  }

  // ------------------------------------------------------------------ the end

  private finish() {
    const { match, setup, app } = this;
    const [mine, theirs] = match.board.scores;
    const outcome = mine > theirs ? 'win' : mine < theirs ? 'loss' : 'tie';
    app.sounds.end(match.spec.mode === 'local' ? 'win' : outcome);
    if (setup.tutorial) {
      this.checkTutorial();
      this.renderHud();
      return;
    }
    const firstDaily = this.record(outcome);
    this.awards(outcome);
    const receipt = this.reportResult(outcome, firstDaily);
    this.showResults(outcome, firstDaily, receipt?.xpGained ?? null);
  }

  /** Saves what the game changed; returns whether a Daily Board was the day's first. */
  private record(outcome: 'win' | 'loss' | 'tie'): boolean {
    const { match, setup, app } = this;
    const versus = match.spec.seats[1].kind === 'computer';
    let first = false;
    app.saves.records.update((r) => {
      let next = {
        ...r,
        games: r.games + 1,
        wins: r.wins + (outcome === 'win' && versus ? 1 : 0),
        boxes: r.boxes + match.board.scores[0],
        crosses: r.crosses + match.stats.crosses[0],
      };
      if (outcome === 'win' && setup.ladder && !next.ladderWon.includes(setup.ladder.number)) {
        next = { ...next, ladderWon: [...next.ladderWon, setup.ladder.number] };
      }
      if (
        setup.puzzle &&
        this.puzzleSolved() &&
        !next.puzzlesSolved.includes(setup.puzzle.number)
      ) {
        next = { ...next, puzzlesSolved: [...next.puzzlesSolved, setup.puzzle.number] };
      }
      const opponent = match.spec.seats[1].opponent;
      if (outcome === 'win' && opponent && !setup.puzzle && !next.beaten.includes(opponent)) {
        next = { ...next, beaten: [...next.beaten, opponent] };
      }
      if (setup.daily) {
        const recorded = recordDaily(next, setup.daily.dateKey, {
          you: match.board.scores[0],
          rival: match.board.scores[1],
          crosses: match.stats.crosses[0],
        });
        first = recorded.first;
        next = recorded.records;
      }
      return next;
    });
    return first;
  }

  private puzzleSolved(): boolean {
    const puzzle = this.setup.puzzle;
    if (!puzzle) return false;
    const before = [...puzzle.owners].filter((c) => c === 'y').length;
    return this.match.board.scores[0] - before >= puzzle.target;
  }

  private awards(outcome: 'win' | 'loss' | 'tie') {
    const { match, setup, app } = this;
    const { stats, spec, board } = match;
    if (board.scores[0] > 0) app.install('first-box');
    if (stats.crosses[0] > 0) app.install('first-double-cross');
    const records = app.saves.records.load();
    if (records.dailyBoards >= 7) app.install('daily-regular');
    if (records.puzzlesSolved.length >= 30) app.install('puzzle-30');
    const opponent = spec.seats[1].opponent;
    if (outcome !== 'win' || !opponent || setup.puzzle) return;
    if (opponent === 'greedy-gus') app.install('beat-greedy-gus');
    if (opponent === 'pupil') app.install('beat-the-pupil');
    if (opponent === 'master' && spec.columns >= 4 && spec.rows >= 4)
      app.install('beat-master-4x4');
    if (board.scores[1] === 0) app.install('shut-out');
    if (stats.endedOnLoop) app.install('loop-de-loop');
    if (stats.openedLong[0] === 0 && stats.openedLong[1] > 0) app.install('control-freak');
    if (spec.columns >= 7 && spec.rows >= 7) app.install('big-board');
    if (stats.biggestGift[0] >= 4) app.install('sharing-is-winning');
  }

  private reportResult(outcome: 'win' | 'loss' | 'tie', firstDaily: boolean) {
    const { match, setup, app } = this;
    const local = match.spec.mode === 'local';
    const solved = setup.puzzle ? this.puzzleSolved() : null;
    return app.report({
      outcome: local
        ? 'complete'
        : solved !== null
          ? solved
            ? 'win'
            : 'loss'
          : outcome === 'tie'
            ? 'draw'
            : outcome,
      score: match.board.scores[0],
      stats: {
        boxesClosed: match.board.scores[0],
        doubleCrosses: match.stats.crosses[0],
        gamesWon: outcome === 'win' && !local ? 1 : 0,
      },
      xpEvents: [
        ...(match.stats.crosses[0] > 0
          ? [{ id: 'double-cross', xp: Math.min(15, match.stats.crosses[0] * 5) }]
          : []),
        ...(setup.ladder && outcome === 'win'
          ? [{ id: 'ladder-step', xp: 5 + setup.ladder.number }]
          : []),
      ],
      daily: setup.daily ? firstDaily : undefined,
      durationSeconds: Math.round((Date.now() - match.startedAt) / 1000),
    });
  }

  private showResults(outcome: 'win' | 'loss' | 'tie', firstDaily: boolean, xp: number | null) {
    this.overlay = 'results';
    const card = resultsCard(this.resultsModel(outcome, firstDaily, xp), {
      again: () => this.restart(),
      menu: () => this.app.go.title(),
      hall: () => this.app.context.navigate('hall'),
    });
    this.layer.replaceChildren(card);
    this.positionCard(card);
  }

  private resultsModel(
    outcome: 'win' | 'loss' | 'tie',
    firstDaily: boolean,
    xp: number | null,
  ): ResultsModel {
    const { match, setup } = this;
    const { stats, spec, board } = match;
    const names: [string, string] = [spec.seats[0].short, spec.seats[1].short];
    const rival = setup.rival;
    let title: string;
    let lead: string;
    if (setup.puzzle) {
      const solved = this.puzzleSolved();
      const before = [...setup.puzzle.owners].filter((c) => c === 'y').length;
      title = solved ? 'Solved!' : 'Not quite';
      lead = solved
        ? `You took ${board.scores[0] - before} of the ${setup.puzzle.open} open boxes: the most there were to take.`
        : `You took ${board.scores[0] - before}; ${setup.puzzle.target} were there for the taking. The best first move gives boxes away.`;
    } else if (spec.mode === 'local') {
      title = outcome === 'tie' ? 'A tie' : `${spec.seats[outcome === 'win' ? 0 : 1].name} wins!`;
      lead = `${board.scores[0] + board.scores[1]} boxes, every one of them argued over.`;
    } else {
      title =
        outcome === 'win'
          ? setup.ladder
            ? 'Match won!'
            : 'You win!'
          : outcome === 'tie'
            ? 'A tie'
            : `${names[1]} takes this one`;
      lead =
        outcome === 'win'
          ? stats.crosses[0] > 0
            ? 'You gave boxes away on purpose, and the board came back to you.'
            : 'More boxes on your side of the pavement.'
          : outcome === 'tie'
            ? 'Box for box, all square.'
            : stats.openedLong[0] > 0
              ? 'You had to open a long chain. Try keeping a safe line in hand, or a small piece to give first.'
              : board.scores[1] - board.scores[0] <= 3
                ? 'Close. Count the long chains early, and the endgame comes your way.'
                : 'Not this time. The last two steps of the tutorial hold the whole secret.';
    }
    const notes: string[] = [];
    if (setup.daily) {
      notes.push(
        firstDaily
          ? 'Your first finished Daily Board today: this one counts.'
          : 'Today’s Daily Board was already recorded; this one was for fun.',
      );
    }
    if (xp) notes.push(`+${xp} XP`);
    const ladder = setup.ladder;
    const nextLadder =
      ladder && outcome === 'win' && ladder.number < LADDER.length ? ladder.number + 1 : null;
    const nextPuzzle =
      setup.puzzle && setup.puzzle.number < PUZZLES.length ? setup.puzzle.number + 1 : null;
    return {
      eyebrow: this.matchTitle(),
      title,
      calm: outcome !== 'loss',
      score: board.scores,
      names,
      lead,
      quote:
        rival && !setup.puzzle ? (outcome === 'loss' ? rival.says.wins : rival.says.loses) : null,
      tally:
        spec.mode === 'local'
          ? []
          : [
              [
                String(stats.crosses[0]),
                stats.crosses[0] === 1 ? 'double cross' : 'double crosses',
              ],
              [String(stats.openedLong[1]), 'long chains opened for you'],
              [String(stats.openedLong[0]), 'opened by you'],
            ],
      notes,
      next: nextLadder
        ? { label: `Match ${nextLadder}`, run: () => this.app.go.ladderMatch(nextLadder) }
        : nextPuzzle
          ? { label: `Puzzle ${nextPuzzle}`, run: () => this.app.go.puzzle(nextPuzzle) }
          : null,
      share: setup.daily ? () => void this.share() : null,
    };
  }

  private shareLine(): string {
    const [you, rival] = this.match.board.scores;
    return `Double Cross #${this.setup.daily!.number} · ${you}–${rival} · ✂️${this.match.stats.crosses[0]}`;
  }

  private async share() {
    const outcome = await this.app.context.share(this.shareLine());
    this.toast(outcome === 'unavailable' ? this.shareLine() : 'Copied: paste it anywhere.');
  }

  private toast(text: string) {
    const toast = h('p', { class: 'dx-toast dx-panel', role: 'status' }, text);
    this.element.append(toast);
    window.setTimeout(() => toast.remove(), 2600);
  }

  // ------------------------------------------------------------------ input

  private onKey(event: KeyboardEvent): boolean {
    if (this.overlay === 'intro') {
      if (event.key === 'Enter' || event.key === ' ') {
        this.begin();
        return true;
      }
      return false;
    }
    if (this.overlay === 'results') return this.onResultsKey(event);
    if (this.overlay === 'confirm') return false;
    if (this.tutorialOutcome && event.key === 'Enter') {
      if (this.tutorialOutcome.done) this.nextStep();
      else this.app.go.tutorial(this.setup.tutorial!.index);
      return true;
    }
    if (isButton(event.target) && (event.key === 'Enter' || event.key === ' ')) return false;
    const action = this.app.keys.actionFor(event);
    if (!action) return false;
    const board = this.match.board;
    const aimed = AIMS[action as keyof typeof AIMS];
    if (aimed) {
      this.moveCursor(aim(board, this.cursor, aimed));
      return true;
    }
    const original = ORIGINAL[action as keyof typeof ORIGINAL];
    if (original) {
      this.moveCursor(
        cursorOn(board, originalStep(board, cursorEdge(board, this.cursor), original)),
      );
      return true;
    }
    if (action === 'draw') {
      if (!this.cursorShown) this.cursorShown = true;
      else this.tryDraw(cursorEdge(board, this.cursor));
      return true;
    }
    if (action === 'lens') {
      this.toggleLens();
      return this.match.spec.lensAllowed;
    }
    if (action === 'take-run') {
      this.takeRun();
      return true;
    }
    return false;
  }

  private onResultsKey(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    const click = (choice: string) => {
      this.layer.querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`)?.click();
      return true;
    };
    if (key === 'r') return click('again');
    if (key === 'h') return click('hall');
    if (key === 'n' && this.layer.querySelector('[data-choice="next"]')) return click('next');
    return false;
  }

  private moveCursor(cursor: Cursor) {
    this.cursor = cursor;
    this.cursorShown = true;
    const edge = cursorEdge(this.match.board, cursor);
    this.say(
      `${describeEdge(this.match.board, edge)}${this.match.board.drawn[edge] ? ', drawn' : ''}`,
    );
  }

  /** After a line, leave the cursor on the nearest line that is still free. */
  private keepCursorUseful() {
    const board = this.match.board;
    const here = cursorEdge(board, this.cursor);
    if (!board.drawn[here]) return;
    const middle = (edge: number) => {
      const [[r1, c1], [r2, c2]] = edgeDots(board, edge);
      return [(r1 + r2) / 2, (c1 + c2) / 2] as const;
    };
    const [hr, hc] = middle(here);
    let nearest = -1;
    let best = Infinity;
    board.drawn.forEach((drawn, edge) => {
      if (drawn) return;
      const [r, c] = middle(edge);
      const distance = Math.hypot(r - hr, c - hc);
      if (distance < best) {
        best = distance;
        nearest = edge;
      }
    });
    if (nearest >= 0) this.cursor = cursorOn(board, nearest);
  }

  private tryDraw(edge: number) {
    if (!this.humanToMove || edge < 0 || !this.match.canDraw(edge)) {
      this.app.sounds.bump();
      return;
    }
    this.runQueue = [];
    this.play(edge);
  }

  private toggleLens() {
    if (!this.match.spec.lensAllowed) return;
    this.lens = !this.lens;
    this.app.saves.prefs.update((p) => ({ ...p, lens: this.lens }));
    this.app.refreshPauseItems();
    this.renderHud();
  }

  /** The boxes there for you to take in a row, stopping where a double cross could be played. */
  private runEdges(): number[] {
    const position = Position.from(this.match.board);
    const edges: number[] = [];
    for (;;) {
      const box = position.firstCapturable();
      if (box < 0) break;
      const run = handoutFrom(position, box);
      if (declineEdge(position, run) >= 0 && edges.length > 0) break;
      const edge = position.lastSide(box);
      edges.push(edge);
      position.draw(edge);
    }
    return edges;
  }

  private runAvailable(): boolean {
    return this.humanToMove && Position.from(this.match.board).firstCapturable() >= 0;
  }

  private takeRun() {
    if (!this.runAvailable()) {
      this.app.sounds.bump();
      return;
    }
    this.runQueue = this.runEdges();
    this.nextRunAt = this.clock;
  }

  private pointer(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private nearDot(x: number, y: number): { row: number; column: number } | null {
    const f = this.view.frame;
    const column = Math.round((x - f.x) / f.spacing);
    const row = Math.round((y - f.y) / f.spacing);
    if (row < 0 || column < 0 || row > f.rows || column > f.columns) return null;
    const dx = x - (f.x + column * f.spacing);
    const dy = y - (f.y + row * f.spacing);
    return Math.hypot(dx, dy) < f.spacing * 0.22 ? { row, column } : null;
  }

  private onPointerMove = (event: PointerEvent) => {
    const { x, y } = this.pointer(event);
    if (this.drag) {
      const f = this.view.frame;
      const dx = x - (f.x + this.drag.column * f.spacing);
      const dy = y - (f.y + this.drag.row * f.spacing);
      if (Math.hypot(dx, dy) < f.spacing * 0.3) {
        this.hover = null;
        return;
      }
      const direction: Direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      const edge = cursorEdge(this.match.board, { ...this.drag, direction });
      this.hover = edge >= 0 && this.match.canDraw(edge) ? edge : null;
      return;
    }
    const edge = this.view.edgeAt(x, y);
    this.hover = edge !== null && this.match.canDraw(edge) ? edge : null;
    this.canvas.style.cursor = this.hover !== null && this.humanToMove ? 'pointer' : '';
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.humanToMove) return;
    const { x, y } = this.pointer(event);
    const dot = this.nearDot(x, y);
    if (dot) {
      this.drag = dot;
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    const dragging = this.drag !== null;
    this.drag = null;
    if (this.canvas.hasPointerCapture(event.pointerId))
      this.canvas.releasePointerCapture(event.pointerId);
    if (this.hover !== null) this.tryDraw(this.hover);
    else if (!dragging) {
      const { x, y } = this.pointer(event);
      const edge = this.view.edgeAt(x, y);
      if (edge !== null) this.tryDraw(edge);
    }
  };

  // ------------------------------------------------------------------ odds and ends

  private pauseItems() {
    const items = [];
    if (this.match.spec.lensAllowed) {
      items.push({
        id: 'lens',
        label: `Chain lens: ${this.lens ? 'on' : 'off'}`,
        shortcut: 'C',
        run: () => this.toggleLens(),
      });
    }
    if (this.setup.puzzle) {
      items.push({
        id: 'hint',
        label: 'Show a hint',
        run: () => ((this.hint = true), this.renderHud()),
      });
      items.push({ id: 'reset', label: 'Reset the puzzle', run: () => this.restart() });
    }
    return items;
  }

  private describe(turn: Turn): string {
    const name = this.match.spec.seats[turn.by].name;
    const where = describeEdge(this.match.board, turn.edge);
    if (isDoubleCross(turn))
      return `${name} drew ${where}: a double cross, ${turn.handedBack.length} boxes handed back.`;
    if (turn.closed.length)
      return `${name} drew ${where} and closed ${turn.closed.length === 1 ? 'a box' : 'two boxes'}.`;
    if (turn.handedOver)
      return `${name} drew ${where}, opening ${turn.handedOver === 1 ? 'a box' : `${turn.handedOver} boxes`}.`;
    return `${name} drew ${where}.`;
  }

  private say(text: string) {
    this.announcer.textContent = text;
  }

  private focusFirst() {
    const target =
      this.layer.querySelector<HTMLElement>('[data-autofocus]') ??
      this.hud.querySelector<HTMLElement>('[data-testid="dx-coach-next"]') ??
      this.hud.querySelector<HTMLElement>('[data-testid="dx-menu"]');
    target?.focus();
  }

  private destroy() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    this.banner?.element.remove();
    if (testHook?.screen === this) testHook = null;
  }

  /** For the browser tests: the match, the board's place on the page, and a way to play lines. */
  get forTests() {
    return {
      match: this.match,
      overlay: this.overlay,
      frame: this.view.frame,
      humanToMove: this.humanToMove,
      play: (edge: number) => this.tryDraw(edge),
      /** The line Master would draw for whoever is to move: lets a test play well. */
      suggest: () =>
        chooseMove('master', this.match.board, { rng: createRng('suggest'), clock: 0 }),
      /** Makes the computer move now instead of after its pause. */
      skipWait: () => {
        this.computerAt = this.clock;
        this.finishedAt = this.finishedAt === null ? null : this.clock;
      },
    };
  }
}

function isButton(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.tagName === 'BUTTON' || target.tagName === 'A');
}

/** A line in words, for the screen reader: which side of which box. */
export function describeEdge(board: { columns: number; rows: number }, edge: number): string {
  if (edge < 0) return 'no line';
  const [[row, column]] = edgeDots(board, edge);
  if (isHorizontal(board, edge)) {
    return row < board.rows
      ? `the top of box ${row + 1}, ${column + 1}`
      : `the bottom of box ${row}, ${column + 1}`;
  }
  return column < board.columns
    ? `the left of box ${row + 1}, ${column + 1}`
    : `the right of box ${row + 1}, ${column}`;
}

let testHook: { screen: PlayScreen } | null = null;

/** `window.__dx`: the play screen's state for Playwright. */
function exposeTestHook(screen: PlayScreen) {
  testHook = { screen };
  (window as unknown as { __dx: unknown }).__dx = {
    play: () => testHook?.screen.forTests ?? null,
  };
}
