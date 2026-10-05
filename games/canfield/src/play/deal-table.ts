import {
  attachCardPointer,
  type CardId,
  cardName,
  type DragTracker,
  type DropTarget,
  rankLabel,
  snapPull,
  snapTarget,
} from '@usr-games/kit/cards';
import {
  anyCardCanMove,
  bestMove,
  canSweepHome,
  countFor,
  describeMove,
  plainHint,
  sweepMove,
} from '../engine/assist';
import { COMMAND_EXAMPLES, parseCommand } from '../engine/commands';
import {
  buyStage,
  canUndo,
  cardsHome,
  endGame,
  type Game,
  knownCards,
  payForHint,
  playMove,
  pointsOf,
  setInsight,
  statementOfGame,
  undoMove,
} from '../engine/game';
import { addStatements, netOf, priceOf, type Statement } from '../engine/ledger';
import {
  applyMove,
  canBuild,
  canHome,
  foundationFor,
  type From,
  type Layout,
  legalMoves,
  liftCounts,
  type Move,
  type RuleEvent,
  TABLEAU,
  type TableauIndex,
} from '../engine/rules';
import { solve } from '../engine/solver';
import { centreOf, contains, fanStep, type Rect } from '../render/layout';
import type { Look } from '../render/look';
import {
  type DragView,
  finishOrder,
  finishSeconds,
  type FinishView,
  labelBottom,
  type Place,
  type TableModel,
  TableView,
} from '../render/table-view';
import { h } from '../ui/dom';
import { Hud, type HudAction, type HudStat } from '../ui/hud';
import {
  confirmDialog,
  insightPanel,
  ledgerEntries,
  ledgerPanel,
  money,
  stagePrompt,
} from '../ui/panels';
import { Animator } from './animator';
import { formatTime, GameClock } from './clock';
import type { SolverClient } from './solver-client';
import type { TableSound } from './sound';

/**
 * One deal at the table: the rules engine, the table on screen, and every way of playing it —
 * dragging cards (they lean as they move and snap to a legal place), clicking them to their best
 * place, a keyboard cursor, and the original's typed commands. It knows nothing of menus or
 * saves; the app hears about progress and the end of the deal through its hooks.
 */

export interface BankView {
  /** The balance before this deal. */
  balance: number;
  sitting: Statement;
  lifetime: Statement;
}

export interface DealHooks {
  look(): Look;
  reducedMotion(): boolean;
  fourColour(): boolean;
  sound: TableSound;
  solver: SolverClient;
  /** The account around a Bank deal; null in Points. */
  bank(): BankView | null;
  /** "Standard · Points", "Daily Deal #36", "Challenge 4 · Win without Insight". */
  modeLine(): string;
  onProgress(game: Game, elapsedMs: number): void;
  onEnd(game: Game, elapsedMs: number): void;
  onHelp(): void;
  /** Coaching layers (the tutorial) watch every step. */
  onStep?(game: Game, events: readonly RuleEvent[]): void;
}

type Pick =
  | { kind: 'cards'; from: From; cards: CardId[]; corner: { x: number; y: number } }
  | { kind: 'hand' };

interface Drag {
  from: From;
  cards: CardId[];
  tracker: DragTracker;
  targets: DropTarget<Place>[];
  snap: DropTarget<Place> | null;
}

const ROWS: Place[][] = [
  [
    { kind: 'stock' },
    { kind: 'foundation', index: 0 },
    { kind: 'foundation', index: 1 },
    { kind: 'foundation', index: 2 },
    { kind: 'foundation', index: 3 },
    { kind: 'talon' },
    { kind: 'hand' },
  ],
  TABLEAU.map((index) => ({ kind: 'tableau' as const, index })),
];

function samePlace(a: Place | null, b: Place | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  return !('index' in a) || a.index === (b as typeof a).index;
}

function placeOfSource(from: From): Place {
  return from === 'stock' || from === 'talon' ? { kind: from } : { kind: 'tableau', index: from };
}

function sourceOfPlace(place: Place): From | null {
  if (place.kind === 'stock' || place.kind === 'talon') return place.kind;
  if (place.kind === 'tableau') return place.index as TableauIndex;
  return null;
}

/** A pause before the results, so the last card can be seen landing. */
const END_PAUSE = 0.7;

/**
 * How high three of the Hall's toasts reach above the bottom edge, in the tallest Hall style:
 * the score card keeps above it (the player's safe zones, docs/ARCHITECTURE.md).
 */
const TOAST_REACH = 64 + 330;
/** The full score card's height: its padding, and one row per figure. */
const CARD_PADDING = 14;
const STAT_ROW = 31;
/** The title plaque's left edge (thirteen.css), which a compact score card lines up with. */
const TITLE_LEFT = 20;

export class DealTable {
  readonly element: HTMLDivElement;
  private readonly view: TableView;
  private readonly hud: Hud;
  private readonly animator: Animator;
  private readonly clock: GameClock;
  private readonly side = h('div', { class: 'td-side' });
  private readonly stageSlot = h('div', { class: 'td-stage-slot' });
  private readonly notice = h('div', {
    class: 'td-notice',
    role: 'status',
    'data-testid': 'td-notice',
  });
  private readonly live = h('div', { class: 'td-sr', 'aria-live': 'polite' });
  private readonly unhook: (() => void)[] = [];
  private game: Game;
  private version = 0;
  private drag: Drag | null = null;
  private selected: { from: From; count: number } | null = null;
  private cursor: Place = { kind: 'talon' };
  private keyboard = false;
  private hint: { from: Place; to: Place } | null = null;
  private shake: { cards: Set<CardId>; at: number } | null = null;
  private finish: FinishView | null = null;
  private endsAt: number | null = null;
  private sweeping = false;
  private ledgerOpen = false;
  private frame = 0;
  private paused = false;
  private destroyed = false;
  private noticeTimer = 0;
  private hudTimer = 0;

  constructor(
    private readonly host: HTMLElement,
    start: { game: Game; elapsedMs: number },
    private readonly hooks: DealHooks,
  ) {
    this.game = start.game;
    this.clock = new GameClock(start.elapsedMs);
    this.view = new TableView(hooks.look(), hooks.reducedMotion(), hooks.fourColour());
    this.animator = new Animator(this.view, this.game.layout, hooks.sound);
    this.hud = new Hud(
      (action) => this.onHud(action),
      (text) => this.onCommand(text),
    );
    this.element = h(
      'div',
      {
        class: 'td-play',
        tabindex: '0',
        role: 'application',
        'aria-roledescription': 'card table',
        'aria-label':
          'Thirteen Down. Arrow keys move between piles, Enter picks cards up and puts them down, Space sends a card to its best place, D deals.',
        'data-testid': 'td-play',
      },
      this.view.element,
      this.hud.element,
      this.side,
      this.stageSlot,
      this.notice,
      this.live,
    );
    host.append(this.element);
    // The workbench's browser tests reach the table through this; production builds drop it.
    if (import.meta.env.DEV)
      Object.assign(window, {
        __tdTable: this,
        __tdAssist: { legalMoves, bestMove, canHome, applyMove, solve },
      });
    this.listen();
    this.layoutAll();
    this.view.sprites.warmUp(this.game.deal);
    this.refresh();
    if (this.game.ending === null) this.clock.start();
    this.requestFrame();
  }

  // —— outside world ——

  get current(): Game {
    return this.game;
  }

  elapsedMs(): number {
    return this.clock.ms();
  }

  pause(): void {
    this.paused = true;
    this.clock.stop();
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  resume(): void {
    if (this.destroyed) return;
    this.paused = false;
    if (this.game.ending === null) this.clock.start();
    this.requestFrame();
  }

  setLook(): void {
    this.view.setLook(this.hooks.look(), this.hooks.reducedMotion());
    this.view.setFourColour(this.hooks.fourColour());
    this.layoutAll();
    this.requestFrame();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.noticeTimer);
    clearInterval(this.hudTimer);
    this.clock.stop();
    for (const stop of this.unhook) stop();
    this.element.remove();
  }

  /** Where a place is on screen, for a coach pointing at it. */
  placeRect(place: Place): Rect {
    return this.view.placeRect(place, this.game.layout);
  }

  /** The free column below the talon and hand, where panels and the coach stand. */
  sideRect(): Rect {
    return this.view.table.decor;
  }

  /** Where the cards of a source are on screen: the top card, or a tableau card by depth. */
  sourceRect(from: From, depth?: number): Rect {
    if (from === 'stock' || from === 'talon') return this.view.rectOf({ kind: from });
    const rects = this.cardRects(from);
    return rects[depth ?? rects.length - 1] ?? this.view.rectOf({ kind: 'tableau', index: from });
  }

  /** Lights a place (or a move from one place to another) for the player to look at. */
  guide(from: Place | null, to: Place | null = from): void {
    this.hint = from && to ? { from, to } : null;
    this.requestFrame();
  }

  /** Asks to end the deal, as the original's `q`. */
  async quit(): Promise<void> {
    if (this.game.ending !== null) return;
    const home = cardsHome(this.game);
    const sure = await confirmDialog(this.element, {
      title: 'End this deal?',
      body: `The ${home} cards home so far will count.`,
      confirm: 'End the deal',
      cancel: 'Keep playing',
    });
    if (sure) this.end(endGame(this.game, this.clock.ms()));
  }

  // —— set-up ——

  private listen(): void {
    const resize = new ResizeObserver(() => this.layoutAll());
    resize.observe(this.host);
    this.unhook.push(() => resize.disconnect());
    this.unhook.push(
      attachCardPointer<Pick>(this.view.element, {
        pick: (point) => this.pick(point),
        origin: (item) => (item.kind === 'cards' ? item.corner : { x: 0, y: 0 }),
        tap: (item) => this.onTap(item, false),
        doubleTap: (item) => this.onTap(item, true),
        dragStart: (item, tracker) => this.onDragStart(item, tracker),
        dragMove: () => this.onDragMove(),
        dragEnd: () => this.onDragEnd(),
      }),
    );
    const keys = (event: KeyboardEvent) => this.onKey(event);
    window.addEventListener('keydown', keys);
    this.unhook.push(() => window.removeEventListener('keydown', keys));
    const pointer = () => {
      this.keyboard = false;
    };
    this.view.element.addEventListener('pointerdown', pointer);
    const hidden = () => {
      if (document.hidden) this.clock.stop();
      else if (!this.paused && this.game.ending === null) this.clock.start();
    };
    document.addEventListener('visibilitychange', hidden);
    this.unhook.push(() => document.removeEventListener('visibilitychange', hidden));
    this.hudTimer = window.setInterval(() => this.refreshHud(), 500);
  }

  private layoutAll(): void {
    const box = this.host.getBoundingClientRect();
    const width = Math.max(320, Math.round(box.width || window.innerWidth));
    const height = Math.max(320, Math.round(box.height || window.innerHeight));
    this.view.resize(width, height, window.devicePixelRatio || 1);
    this.animator.settle(this.now());
    this.placeScoreCard();
    const decor = this.view.table.decor;
    Object.assign(this.side.style, {
      left: `${Math.round(decor.x)}px`,
      top: `${Math.round(decor.y)}px`,
      width: `${Math.round(decor.w)}px`,
      maxHeight: `${Math.round(decor.h)}px`,
    });
    this.fitSide();
    this.requestFrame();
  }

  /**
   * The score card stands under the reserve. On a short screen the full card would reach down
   * into the Hall's toasts, so it becomes one row tucked under the reserve's label instead.
   */
  private placeScoreCard(): void {
    const t = this.view.table;
    const rows = this.game.scoring === 'bank' ? 4 : 3;
    const top = t.reserve.y + t.card.h * 1.27;
    if (top + CARD_PADDING + rows * STAT_ROW <= t.height - TOAST_REACH) {
      this.hud.place({
        x: t.reserve.x - t.card.w * 0.12,
        y: top,
        w: Math.max(t.card.w * 1.24, 196),
        compact: false,
      });
      return;
    }
    this.hud.place({
      x: TITLE_LEFT,
      y: labelBottom(t, t.reserve) + 4,
      w: t.tableau[0]!.x - TITLE_LEFT - 12,
      compact: true,
    });
  }

  /** Beside a short table the panels drop their finer rows rather than hide under the HUD. */
  private fitSide(): void {
    this.side.classList.remove('is-short');
    if (this.side.scrollHeight > this.side.clientHeight + 1) this.side.classList.add('is-short');
  }

  private now(): number {
    return performance.now() / 1000;
  }

  private get motion(): boolean {
    return !this.hooks.reducedMotion();
  }

  // —— drawing ——

  private requestFrame(): void {
    if (this.frame || this.paused || this.destroyed) return;
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private model(now: number): TableModel {
    const hidden = this.animator.hidden(now);
    let drag: DragView | null = null;
    if (this.drag) {
      for (const card of this.drag.cards) hidden.add(card);
      const corner = this.drag.tracker.corner();
      const snap = this.drag.snap;
      const centre = {
        x: corner.x + this.view.table.card.w / 2,
        y: corner.y + this.view.table.card.h / 2,
      };
      drag = {
        cards: this.drag.cards,
        from: this.drag.from,
        corner,
        velocity: this.drag.tracker.velocity,
        snap: snap
          ? {
              x: snap.anchor.x - this.view.table.card.w / 2,
              y: snap.anchor.y - this.view.table.card.h / 2,
            }
          : null,
        pull: snap ? snapPull(centre, snap.anchor, this.reach()) : 0,
      };
    }
    const targets: Place[] = this.drag
      ? this.drag.targets.map((t) => t.id)
      : this.selected
        ? this.selectionTargets()
        : [];
    return {
      layout: this.game.layout,
      blooms: this.animator.blooms,
      drag,
      targets,
      cursor: this.keyboard ? this.cursor : null,
      selected: this.selected
        ? { place: placeOfSource(this.selected.from), count: this.selected.count }
        : null,
      hint: this.hint,
      flights: this.animator.current(now),
      hidden,
      finish: this.finish,
      labels: true,
      shake: this.shake,
    };
  }

  private draw(): void {
    this.frame = 0;
    if (this.destroyed) return;
    const now = this.now();
    this.animator.tick(now);
    this.advance(now);
    const model = this.model(now);
    this.view.render(model, now);
    if (
      this.view.isAnimating(model, now) ||
      this.animator.busy(now) ||
      this.sweeping ||
      this.endsAt !== null
    )
      this.requestFrame();
  }

  /** Moves the deal on by itself: the sweep home, the finish, the end. */
  private advance(now: number): void {
    if (this.sweeping && !this.animator.busy(now)) this.sweepStep();
    if (this.endsAt !== null && now >= this.endsAt) {
      this.endsAt = null;
      this.hooks.onEnd(this.game, this.clock.ms());
    }
  }

  // —— the score card and the panels ——

  private stats(): HudStat[] {
    const game = this.game;
    const time = { id: 'time', label: 'Time', value: formatTime(this.clock.ms()) };
    const pass = { id: 'pass', label: 'Pass', value: String(game.layout.run) };
    const bank = this.hooks.bank();
    if (game.scoring === 'bank' && bank) {
      const net = netOf(statementOfGame(game));
      return [
        { id: 'balance', label: 'Balance', value: money(bank.balance + net) },
        { id: 'deal', label: 'This deal', value: money(net) },
        time,
        pass,
      ];
    }
    return [
      { id: 'score', label: 'Score', value: String(pointsOf(game, this.clock.ms()).total) },
      time,
      pass,
    ];
  }

  private refreshHud(): void {
    if (this.destroyed) return;
    const game = this.game;
    const layout = game.layout;
    const bank = game.scoring === 'bank';
    const price = (kind: 'undo' | 'hint' | 'insight' | 'run') => {
      const value = priceOf(kind, game.scoring);
      if (value === 0) return '';
      return bank ? `$${value}` : `−${value}`;
    };
    const turnOver = layout.hand.length === 0 && layout.talon.length > 0;
    this.hud.update({
      title: 'Thirteen Down',
      modeLine: `${this.hooks.modeLine()} · Base ${rankLabel(layout.baseRank)}`,
      stats: this.stats(),
      dealLabel: turnOver ? 'Turn over' : 'Deal',
      canDeal: game.ending === null && (layout.hand.length > 0 || layout.talon.length > 0),
      canUndo: canUndo(game),
      insightOn: game.insight,
      prices: {
        deal: turnOver && game.rules === 'standard' ? price('run') : '',
        undo: price('undo'),
        hint: price('hint'),
        insight: bank ? '$1/card' : '−1/card',
      },
      showLedger: bank,
      ended: game.ending !== null,
    });
  }

  private refreshPanels(): void {
    const game = this.game;
    const panels: HTMLElement[] = [];
    if (game.insight) {
      const seen = new Set(knownCards(game));
      panels.push(
        insightPanel({
          talon: game.layout.talon,
          hand: [...game.layout.hand].reverse(),
          seen,
          reserve: game.layout.stock.length,
          price: game.scoring === 'bank' ? '$1' : '1 point',
          charged: game.listed.length,
        }),
      );
    }
    const bank = this.hooks.bank();
    if (game.scoring === 'bank' && this.ledgerOpen && bank) {
      const deal = statementOfGame(game);
      panels.push(
        ledgerPanel({
          entries: ledgerEntries(game.account.charges, deal.winnings),
          deal,
          sitting: addStatements(bank.sitting, deal),
          lifetime: addStatements(bank.lifetime, deal),
          balance: bank.balance + netOf(deal),
        }),
      );
    }
    this.side.replaceChildren(...panels);
    this.fitSide();
    const stage = game.layout.stage;
    if (game.scoring === 'bank' && game.ending === null && stage !== 'full')
      this.stageSlot.replaceChildren(
        stagePrompt({ stage, cardsHome: cardsHome(game) }, (choice) => this.onStage(choice)),
      );
    else this.stageSlot.replaceChildren();
  }

  private refresh(): void {
    this.refreshHud();
    this.refreshPanels();
  }

  private say(text: string): void {
    this.live.textContent = text;
  }

  private tell(text: string, action?: { label: string; run: () => void }): void {
    clearTimeout(this.noticeTimer);
    this.notice.replaceChildren(h('span', {}, text));
    if (action)
      this.notice.append(
        h('button', { type: 'button', class: 'td-button', onclick: action.run }, action.label),
      );
    this.notice.classList.add('is-shown');
    if (!action)
      this.noticeTimer = window.setTimeout(() => this.notice.classList.remove('is-shown'), 3200);
    this.say(text);
  }

  private hideNotice(): void {
    clearTimeout(this.noticeTimer);
    this.notice.classList.remove('is-shown');
  }

  // —— moves ——

  private refuse(cards: readonly CardId[], message: string): void {
    this.hooks.sound.nope();
    this.shake = { cards: new Set(cards), at: this.now() };
    this.tell(message);
    this.requestFrame();
  }

  /** The Bank asks for its stage before a move: the inspection first, the game before the hand. */
  private stageBlocks(move: Move): string | null {
    const stage = this.game.layout.stage;
    if (stage === 'dealt') return 'Inspect the deal first ($13), or walk away.';
    if (stage === 'inspection' && move.kind === 'deal')
      return 'Play it out ($26) to deal from the hand.';
    return null;
  }

  private commit(
    move: Move,
    dropped?: { cards: readonly CardId[]; corner: { x: number; y: number }; step: number },
  ): boolean {
    if (this.game.ending !== null) return false;
    const blocked = this.stageBlocks(move);
    if (blocked) {
      this.refuse(dropped?.cards ?? [], blocked);
      this.stageSlot.firstElementChild?.classList.add('is-asking');
      return false;
    }
    const before = this.game.layout;
    const words = describeMove(before, move);
    const step = playMove(this.game, move, this.clock.ms());
    if (!step) return false;
    const now = this.now();
    if (!dropped) this.animator.settle(now);
    this.game = step.game;
    this.version++;
    const lands = this.animator.play(
      before,
      step.game.layout,
      step.events,
      now,
      this.motion,
      dropped,
    );
    this.say(words.charAt(0).toUpperCase() + words.slice(1));
    this.afterStep(step.events, lands);
    return true;
  }

  private afterStep(events: readonly RuleEvent[], lands: number): void {
    this.hint = null;
    this.selected = null;
    this.hideNotice();
    this.hooks.onStep?.(this.game, events);
    const game = this.game;
    if (game.insight && events.some((e) => e.kind === 'exposed')) this.hooks.sound.insight(true);
    if (game.ending !== null) this.end(game, lands);
    else {
      this.sweeping = canSweepHome(game.layout);
      if (!this.sweeping && game.layout.stage === 'full' && !anyCardCanMove(game.layout))
        this.tell('No card can move, however you deal.', {
          label: 'End the deal',
          run: () => this.end(endGame(this.game, this.clock.ms())),
        });
      this.hooks.onProgress(game, this.clock.ms());
    }
    this.refresh();
    this.requestFrame();
  }

  private sweepStep(): void {
    const move = sweepMove(this.game.layout);
    if (!move) {
      this.sweeping = false;
      return;
    }
    this.commit(move);
  }

  /** The deal is over: a won deal blooms and spirals first, the rest pause a moment. */
  private end(game: Game, lands = this.now()): void {
    this.game = game;
    this.sweeping = false;
    this.clock.stop();
    this.drag = null;
    this.selected = null;
    this.hideNotice();
    if (game.ending === 'won') {
      const at = Math.max(this.now(), lands) + 0.3;
      this.animator.bloomAll(at);
      this.finish = { startedAt: at, cards: finishOrder(game.layout.foundations) };
      window.setTimeout(() => this.hooks.sound.bloom(), Math.max(0, (at - this.now()) * 1000));
      window.setTimeout(
        () => this.hooks.sound.finish(),
        Math.max(0, (at + 1.1 - this.now()) * 1000),
      );
      this.endsAt = at + (this.motion ? finishSeconds(this.finish) : 0.6) + 0.4;
    } else {
      this.endsAt = Math.max(this.now(), lands) + END_PAUSE;
    }
    this.refresh();
    this.requestFrame();
  }

  // —— picking cards up ——

  private reach(): number {
    return this.view.table.card.h * 0.95;
  }

  private cardRects(index: number): Rect[] {
    const pile = this.game.layout.tableau[index]!;
    const { w, h: height } = this.view.table.card;
    return pile.map((_, depth) => {
      const at = this.view.tableauCard(index, depth, pile.length);
      return { x: at.x, y: at.y, w, h: height };
    });
  }

  /** What a press at this point picks up. */
  private pick(point: { x: number; y: number }): Pick | null {
    if (this.game.ending !== null) return null;
    const t = this.view.table;
    const layout = this.game.layout;
    if (contains(t.hand, point.x, point.y) && (layout.hand.length > 0 || layout.talon.length > 0))
      return { kind: 'hand' };
    if (contains(t.reserve, point.x, point.y) && layout.stock.length > 0)
      return {
        kind: 'cards',
        from: 'stock',
        cards: [layout.stock.at(-1)!],
        corner: { x: t.reserve.x, y: t.reserve.y },
      };
    if (contains(t.talon, point.x, point.y) && layout.talon.length > 0)
      return {
        kind: 'cards',
        from: 'talon',
        cards: [layout.talon.at(-1)!],
        corner: { x: t.talon.x, y: t.talon.y },
      };
    for (const index of TABLEAU) {
      const rects = this.cardRects(index);
      for (let depth = rects.length - 1; depth >= 0; depth--) {
        const rect = rects[depth]!;
        if (!contains(rect, point.x, point.y)) continue;
        const pile = layout.tableau[index]!;
        // The top card alone, or from where it was grasped: the whole pile in Standard.
        const top = depth === pile.length - 1;
        const from = layout.rules === 'standard' && !top ? 0 : depth;
        const corner = this.view.tableauCard(index, from, pile.length);
        return { kind: 'cards', from: index, cards: pile.slice(from), corner };
      }
    }
    return null;
  }

  private onTap(item: Pick, double: boolean): void {
    this.keyboard = false;
    if (item.kind === 'hand') {
      this.commit({ kind: 'deal' });
      return;
    }
    const layout = this.game.layout;
    const count = item.cards.length;
    const home =
      count === 1 && canHome(layout, item.from)
        ? ({ kind: 'home', from: item.from } as Move)
        : null;
    const move = double
      ? (home ?? bestMove(layout, item.from, count))
      : (home ?? this.clickMove(item.from, count));
    if (move) this.commit(move);
    else this.refuse(item.cards, `The ${cardName(item.cards[0]!)} has nowhere to go.`);
  }

  /** What a click on cards from a place does: home, a build, a space; a pile's longest run that fits. */
  clickMove(from: From, upTo: number): Move | null {
    const layout = this.game.layout;
    if (upTo === 1 && canHome(layout, from)) return { kind: 'home', from };
    if (from === 'stock' || from === 'talon') return bestMove(layout, from, 1);
    for (const to of TABLEAU) {
      if (layout.tableau[to]!.length === 0) continue;
      const count = countFor(layout, from, to, upTo);
      if (count !== null) return { kind: 'build', from, to, count };
    }
    return canHome(layout, from) ? { kind: 'home', from } : null;
  }

  private dropTargets(from: From, cards: readonly CardId[]): DropTarget<Place>[] {
    const layout = this.game.layout;
    const t = this.view.table;
    const targets: DropTarget<Place>[] = [];
    if (cards.length === 1 && canHome(layout, from)) {
      const index = foundationFor(layout, cards[0]!);
      targets.push({
        id: { kind: 'foundation', index },
        anchor: centreOf(t.foundations[index]!),
        accepts: true,
      });
    }
    for (const to of TABLEAU) {
      if (!canBuild(layout, from, to, cards.length)) continue;
      const at = this.view.landing({ kind: 'tableau', index: to }, layout);
      targets.push({
        id: { kind: 'tableau', index: to },
        anchor: { x: at.x + t.card.w / 2, y: at.y + t.card.h / 2 },
        accepts: true,
      });
    }
    return targets;
  }

  private onDragStart(item: Pick, tracker: DragTracker): void {
    if (item.kind !== 'cards') return;
    this.keyboard = false;
    this.selected = null;
    this.hint = null;
    this.animator.settle(this.now());
    this.drag = {
      from: item.from,
      cards: item.cards,
      tracker,
      targets: this.dropTargets(item.from, item.cards),
      snap: null,
    };
    this.requestFrame();
  }

  private onDragMove(): void {
    const drag = this.drag;
    if (!drag) return;
    const corner = drag.tracker.corner();
    const t = this.view.table;
    drag.snap = snapTarget(
      { x: corner.x + t.card.w / 2, y: corner.y + t.card.h / 2 },
      drag.targets,
      this.reach(),
    );
    this.requestFrame();
  }

  private onDragEnd(): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    const corner = drag.tracker.corner();
    const step = fanStep(this.view.table, 8);
    const target = drag.snap?.id;
    let moved = false;
    if (target?.kind === 'foundation')
      moved = this.commit({ kind: 'home', from: drag.from }, { cards: drag.cards, corner, step });
    else if (target?.kind === 'tableau')
      moved = this.commit(
        {
          kind: 'build',
          from: drag.from,
          to: target.index as TableauIndex,
          count: drag.cards.length,
        },
        { cards: drag.cards, corner, step },
      );
    if (!moved) {
      this.animator.bounceBack(drag.cards, corner, step, this.game.layout, this.now(), this.motion);
      if (!target && drag.targets.length === 0) this.hooks.sound.nope();
    }
    this.requestFrame();
  }

  // —— the keyboard ——

  private selectionTargets(): Place[] {
    const selection = this.selected;
    if (!selection) return [];
    const cards = this.cardsOf(selection.from, selection.count);
    const places: Place[] = this.dropTargets(selection.from, cards).map((t) => t.id);
    const layout = this.game.layout;
    // A whole pile selected can still send its top card home.
    if (cards.length > 1 && canHome(layout, selection.from))
      places.push({ kind: 'foundation', index: foundationFor(layout, cards.at(-1)!) });
    if (typeof selection.from === 'number')
      for (const to of TABLEAU)
        if (
          !places.some((p) => samePlace(p, { kind: 'tableau', index: to })) &&
          countFor(layout, selection.from, to, selection.count) !== null
        )
          places.push({ kind: 'tableau', index: to });
    return places;
  }

  private cardsOf(from: From, count: number): CardId[] {
    const layout = this.game.layout;
    if (from === 'stock') return layout.stock.slice(-1);
    if (from === 'talon') return layout.talon.slice(-1);
    return layout.tableau[from]!.slice(-count);
  }

  private moveCursor(dx: number, dy: number): void {
    const row = ROWS.findIndex((r) => r.some((p) => samePlace(p, this.cursor)));
    const index = ROWS[row]!.findIndex((p) => samePlace(p, this.cursor));
    if (dy !== 0) {
      const target = row === 0 ? 1 : 0;
      const mapped = row === 0 ? Math.max(0, Math.min(3, index - 1)) : index + 1;
      this.cursor = ROWS[target]![mapped]!;
    } else {
      const next = Math.max(0, Math.min(ROWS[row]!.length - 1, index + dx));
      this.cursor = ROWS[row]![next]!;
    }
    this.say(this.describePlace(this.cursor));
    this.requestFrame();
  }

  private describePlace(place: Place): string {
    const layout = this.game.layout;
    switch (place.kind) {
      case 'stock': {
        const top = layout.stock.at(-1);
        return top === undefined
          ? 'Reserve, empty.'
          : `Reserve, ${layout.stock.length} cards, the ${cardName(top)} on top.`;
      }
      case 'talon': {
        const top = layout.talon.at(-1);
        return top === undefined
          ? 'Talon, empty.'
          : `Talon, ${layout.talon.length} cards, the ${cardName(top)} showing.`;
      }
      case 'hand':
        return `Hand, ${layout.hand.length} cards face down.`;
      case 'foundation': {
        const pile = layout.foundations[place.index];
        return pile
          ? `Foundation ${place.index + 1}, ${pile.length} cards, up to the ${cardName(pile.at(-1)!)}.`
          : `Foundation ${place.index + 1}, waiting for a ${rankLabel(layout.baseRank)}.`;
      }
      case 'tableau': {
        const pile = layout.tableau[place.index]!;
        return pile.length === 0
          ? `Pile ${place.index + 1}, a space.`
          : `Pile ${place.index + 1}, ${pile.length} cards, from the ${cardName(pile[0]!)} down to the ${cardName(pile.at(-1)!)}.`;
      }
    }
  }

  /** Enter: pick up the cards under the cursor, or put the picked-up cards down there. */
  private enter(): void {
    const layout = this.game.layout;
    if (this.cursor.kind === 'hand') {
      this.commit({ kind: 'deal' });
      return;
    }
    const selection = this.selected;
    if (selection) {
      if (samePlace(placeOfSource(selection.from), this.cursor)) {
        this.selected = null;
        this.say('Put back.');
        this.requestFrame();
        return;
      }
      let move: Move | null = null;
      if (this.cursor.kind === 'foundation' && canHome(layout, selection.from))
        move = { kind: 'home', from: selection.from };
      else if (this.cursor.kind === 'tableau') {
        const count = countFor(layout, selection.from, this.cursor.index, selection.count);
        if (count !== null)
          move = {
            kind: 'build',
            from: selection.from,
            to: this.cursor.index as TableauIndex,
            count,
          };
      }
      if (move) this.commit(move);
      else
        this.refuse(this.cardsOf(selection.from, selection.count), 'Those cards cannot go there.');
      return;
    }
    const from = sourceOfPlace(this.cursor);
    if (from === null) return;
    const count =
      from === 'stock' || from === 'talon'
        ? 1
        : Math.max(...(liftCounts(layout, from).length ? liftCounts(layout, from) : [0]));
    if (
      count === 0 ||
      (from === 'stock' && layout.stock.length === 0) ||
      (from === 'talon' && layout.talon.length === 0)
    ) {
      this.refuse([], 'Nothing to pick up there.');
      return;
    }
    this.selected = { from, count };
    const cards = this.cardsOf(from, count);
    this.say(
      `Picked up ${cards.length > 1 ? `${cards.length} cards from ` : ''}the ${cardName(cards[0]!)}. Move to a place and press Enter.`,
    );
    this.requestFrame();
  }

  /** Space: the best move for the cards under the cursor, as a click would. */
  private space(): void {
    if (this.cursor.kind === 'hand') {
      this.commit({ kind: 'deal' });
      return;
    }
    const from = sourceOfPlace(this.cursor);
    if (from === null) return;
    const layout = this.game.layout;
    const count = from === 'stock' || from === 'talon' ? 1 : layout.tableau[from]!.length;
    if (count === 0) return;
    const move = this.clickMove(from, count);
    if (move) this.commit(move);
    else this.refuse(this.cardsOf(from, count), 'Nothing there can move.');
  }

  private onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.paused)
      return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [role="dialog"]')) return;
    if (!this.element.isConnected || this.element.closest('[inert]')) return;
    if (this.game.ending !== null) return;
    const key = event.key;
    const stage = this.game.layout.stage;
    const handled = () => {
      event.preventDefault();
      this.keyboard = true;
    };
    switch (key) {
      case 'ArrowLeft':
        handled();
        return this.moveCursor(-1, 0);
      case 'ArrowRight':
        handled();
        return this.moveCursor(1, 0);
      case 'ArrowUp':
      case 'ArrowDown':
        handled();
        return this.moveCursor(0, key === 'ArrowUp' ? -1 : 1);
      case 'Enter':
        if (target?.closest('button')) return;
        handled();
        return this.enter();
      case ' ':
        if (target?.closest('button')) return;
        handled();
        return this.space();
      case 'Backspace':
      case 'Delete':
        if (this.selected) {
          handled();
          this.selected = null;
          this.requestFrame();
        }
        return;
      case '/':
        event.preventDefault();
        this.hud.command.focus();
        return;
      default:
        break;
    }
    const letter = key.toLowerCase();
    if (stageLetters(stage).includes(letter)) {
      event.preventDefault();
      if (letter === 'i') this.onStage('inspect');
      else if (letter === 'p') this.onStage('play-out');
      else this.onStage('walk-away');
      return;
    }
    const actions: Record<string, HudAction> = {
      d: 'deal',
      z: 'undo',
      h: 'hint',
      c: 'insight',
      l: 'ledger',
    };
    const action = actions[letter];
    if (action) {
      event.preventDefault();
      this.onHud(action);
    } else if (letter === 'x' && this.selected) {
      event.preventDefault();
      this.selected = null;
      this.requestFrame();
    }
  }

  // —— buttons, commands and the Bank ——

  private onHud(action: HudAction): void {
    switch (action) {
      case 'deal':
        this.commit({ kind: 'deal' });
        break;
      case 'undo':
        this.undo();
        break;
      case 'hint':
        void this.askHint();
        break;
      case 'insight':
        this.toggleInsight();
        break;
      case 'ledger':
        if (this.game.scoring !== 'bank') return;
        this.ledgerOpen = !this.ledgerOpen;
        this.hooks.sound.ledger();
        this.refreshPanels();
        break;
    }
  }

  undo(): void {
    const next = undoMove(this.game, this.clock.ms());
    if (!next) {
      this.refuse([], 'Nothing to take back.');
      return;
    }
    this.game = next;
    this.version++;
    this.animator.reset(next.layout);
    this.sweeping = false;
    this.hint = null;
    this.selected = null;
    this.hooks.sound.undo();
    this.say('Took back the last move.');
    this.hooks.onProgress(next, this.clock.ms());
    this.refresh();
    this.requestFrame();
  }

  toggleInsight(): void {
    const on = !this.game.insight;
    this.game = setInsight(this.game, on, this.clock.ms());
    this.hooks.sound.insight(on);
    this.say(on ? 'Insight on.' : 'Insight off.');
    this.hooks.onProgress(this.game, this.clock.ms());
    this.refresh();
  }

  get insightOn(): boolean {
    return this.game.insight;
  }

  /** A hint from the solver: the first step of a winning line, or a plain guess when there is none. */
  async askHint(): Promise<void> {
    if (this.game.ending !== null) return;
    const version = this.version;
    const layout = this.game.layout;
    this.tell('Thinking…');
    const verdict = await this.hooks.solver.verdict(layout);
    if (this.destroyed || version !== this.version) return;
    this.game = payForHint(this.game, this.clock.ms());
    this.hooks.sound.hint();
    let moves: Move[];
    let lead = '';
    if (verdict.result === 'winnable') moves = verdict.line;
    else {
      const guess = plainHint(layout);
      moves = guess ? [guess] : [];
      lead =
        verdict.result === 'unwinnable'
          ? 'No winning line from here. '
          : 'Too tangled to see through; a guess: ';
    }
    const deals = moves.findIndex((m) => m.kind !== 'deal');
    const cardMove = deals >= 0 ? moves[deals]! : null;
    if (deals > 0 || !cardMove) {
      this.hint = { from: { kind: 'hand' }, to: { kind: 'talon' } };
      const times = deals > 0 ? deals : 1;
      this.tell(
        `${lead}Deal ${times === 1 ? 'once' : `${times} times`}${cardMove ? `, then ${describeMove(this.dealt(layout, deals), cardMove)}` : ''}.`,
      );
    } else {
      this.hint = {
        from: placeOfSource(cardMove.kind === 'deal' ? 'talon' : cardMove.from),
        to: this.destination(layout, cardMove),
      };
      this.tell(`${lead}${capitalise(describeMove(layout, cardMove))}.`);
    }
    this.refresh();
    this.requestFrame();
  }

  private dealt(layout: Layout, times: number): Layout {
    let state = layout;
    for (let i = 0; i < times; i++) {
      const step = playMove(
        { ...this.game, layout: state, ending: null },
        { kind: 'deal' },
        this.clock.ms(),
      );
      if (!step) break;
      state = step.game.layout;
    }
    return state;
  }

  private destination(layout: Layout, move: Move): Place {
    if (move.kind === 'home') {
      const card = (
        move.from === 'stock'
          ? layout.stock
          : move.from === 'talon'
            ? layout.talon
            : layout.tableau[move.from]!
      ).at(-1)!;
      return { kind: 'foundation', index: Math.max(0, foundationFor(layout, card)) };
    }
    if (move.kind === 'build') return { kind: 'tableau', index: move.to };
    return { kind: 'talon' };
  }

  private onCommand(text: string): void {
    const command = parseCommand(text, this.game.layout);
    this.element.focus();
    switch (command.kind) {
      case 'move':
        if (
          !this.commit(command.move) &&
          this.game.ending === null &&
          !this.stageBlocks(command.move)
        )
          this.refuse([], `“${text.trim()}” cannot be played now.`);
        break;
      case 'insight':
        this.toggleInsight();
        break;
      case 'ledger':
        this.onHud('ledger');
        break;
      case 'help':
        this.hooks.onHelp();
        break;
      case 'quit':
        void this.quit();
        break;
      case 'unknown':
        this.refuse([], `Moves look like ${COMMAND_EXAMPLES}.`);
        break;
    }
  }

  private onStage(choice: 'inspect' | 'play-out' | 'walk-away'): void {
    if (this.game.scoring !== 'bank' || this.game.ending !== null) return;
    const stage = this.game.layout.stage;
    if (choice === 'walk-away') {
      this.hooks.sound.ledger();
      this.end(endGame(this.game, this.clock.ms()));
      return;
    }
    if (choice === 'inspect' && stage !== 'dealt') return;
    if (choice === 'play-out' && stage === 'full') return;
    this.game = buyStage(this.game, choice === 'inspect' ? 'inspection' : 'full', this.clock.ms());
    this.hooks.sound.ledger();
    this.say(
      choice === 'inspect'
        ? 'Inspection bought: make your moves.'
        : 'Playing it out: deal from the hand when you like.',
    );
    this.hooks.onProgress(this.game, this.clock.ms());
    this.refresh();
  }
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The letters a Bank stage prompt answers to: I and W at the deal, P and W in the inspection. */
function stageLetters(stage: Layout['stage']): string[] {
  if (stage === 'dealt') return ['i', 'w'];
  if (stage === 'inspection') return ['p', 'w'];
  return [];
}
