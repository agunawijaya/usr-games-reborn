import { type CardId, type Rank, rankOf } from '@usr-games/kit/cards';
import { type GameEvent, seeEvent, type SeatEvent } from '../engine/events';
import type { Book } from '../engine/game';
import { Knowledge } from '../engine/knowledge';
import type { Table } from '../engine/table';
import { type MatchSetup, RIVALS } from '../modes/match';
import type { GameSummary } from '../modes/packages';
import { CAST, castAt, landingPoint } from '../render/cast';
import {
  type Flight,
  LAP_TIME,
  type LapFish,
  RIVAL_LEAP_TIME,
  type RivalLeap,
} from '../render/effects';
import { LEAP } from '../render/leap';
import type { Point } from '../render/layout';
import type { Look } from '../render/look';
import type { PondScene, PondView, RivalKind } from '../render/pond-view';
import type { Mood } from '../render/rivals/common';
import type { Ripple } from '../render/water';
import type { Hud, HudModel } from '../ui/hud';
import { countWord, type LogLine, logLine, namesFor, rankWord } from '../ui/words';
import { lineFor, type LineKind } from './lines';
import type { PondSound } from './sound';
import { type Step, StepQueue } from './steps';

/**
 * Plays a game of Go Fish at the pond. The engine decides in an instant; the director shows it
 * at a pace people can follow: every ask spoken, every handover flying across the water, every
 * "Go fish!" a cast and a reel, every book a fish. It keeps a *display* of hands and buckets
 * that changes only as each step lands, so a card drawn appears in your hand when the reel
 * brings it in and not before.
 *
 * Input, when it is your turn: choose a rival (click a name, or press 1–3; Enter picks the one
 * you asked last), then a rank (click a card or a rank button, or press A, 2–9, 0, J, Q, K).
 * Backspace goes back to choosing a rival; N opens or closes the notebook; in Classic 1993, P
 * switches the original's computer to its pro mode, as typing `p` did.
 */

export interface Moment {
  kind: 'first-book' | 'golden' | 'three-in-turn' | 'lucky-three' | 'pro-mode';
}

export interface DirectorOptions {
  setup: MatchSetup;
  table: Table;
  view: PondView;
  /** No HUD in the attract mode: nobody plays there. */
  hud: Hud | null;
  root: HTMLElement;
  look(): Look;
  reducedMotion(): boolean;
  /** Steps play this much faster: 1 relaxed, 1.6 brisk. */
  pace(): number;
  notebookOpen: boolean;
  sound: PondSound;
  status: { title: string; mode: string };
  announce(text: string): void;
  onMoment(moment: Moment): void;
  onNotebook(open: boolean): void;
  onEnd(summary: GameSummary, table: Table): void;
}

interface Display {
  hand: CardId[];
  rivalCards: number[];
  pond: number;
  /** Books made, per seat. */
  books: Book[][];
}

interface RivalState {
  kind: RivalKind;
  name: string;
  mood: Mood;
  since: number;
}

const MOOD_HOLD = 2.4;
const SPEECH_HOLD = 1.9;
const RANK_KEYS: Readonly<Record<string, Rank>> = {
  a: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '0': 10,
  t: 10,
  j: 11,
  q: 12,
  k: 13,
};

export class Director {
  private readonly options: DirectorOptions;
  private readonly table: Table;
  private readonly view: PondView;
  private readonly queue = new StepQueue();
  private readonly knowledge = new Knowledge(0);
  private readonly names: ReturnType<typeof namesFor>;
  private readonly rivals: RivalState[];
  private readonly display: Display;
  private lines: LogLine[] = [];
  private lastSeen: SeatEvent | undefined;
  private time = 0;
  private last = 0;
  private frameId = 0;
  private paused = false;
  private stopped = false;
  private phase: 'playing' | 'your-turn' | 'over' = 'playing';
  private stage: 'rival' | 'rank' = 'rival';
  private selected: number | null = null;
  private lastAsked: number | null = null;
  private hoverRank: Rank | null = null;
  private speech: { rival: number; text: string; loud: boolean; until: number } | null = null;
  /** What the ask bar says while answers play out. */
  private message: string | null = null;
  /** A word of news carried into your turn ("Lucky catch!", "Ask again!"). */
  private note: string | null = null;
  private notebookOpen: boolean;
  private notebookUsed: boolean;
  private hudDirty = true;
  private lineCounter = 0;
  // What is moving right now.
  private cast: PondScene['cast'];
  private leap: PondScene['leap'];
  private flights: Flight[] = [];
  private rivalLeaps: RivalLeap[] = [];
  private ripples: Ripple[] = [];
  private lap: PondScene['lap'];
  // Counted for packages and the results card.
  private luckyCasts = 0;
  private booksThisTurn = 0;
  private mostBooksInATurn = 0;
  private taunt = false;
  /** The browser tests run the pond fast; players never do. */
  testSpeed = 1;
  private readonly keys = (event: KeyboardEvent) => this.onKey(event);
  private readonly pointerMove = (event: PointerEvent) => this.onPointerMove(event);
  private readonly pointerDown = (event: PointerEvent) => this.onPointerDown(event);

  constructor(options: DirectorOptions) {
    this.options = options;
    this.table = options.table;
    this.view = options.view;
    this.notebookOpen = options.notebookOpen;
    this.notebookUsed = options.notebookOpen;
    this.names = namesFor(options.setup.rivals.map((id) => RIVALS[id].name));
    this.rivals = options.setup.rivals.map((id) => ({
      kind: RIVALS[id].kind,
      name: RIVALS[id].name,
      mood: 'idle',
      since: -10,
    }));
    const players = options.setup.rivals.length + 1;
    this.display = {
      hand: [],
      rivalCards: new Array<number>(players - 1).fill(0),
      pond: 52,
      books: Array.from({ length: players }, () => []),
    };
    if (options.setup.rivals.length === 1) {
      this.selected = 0;
      this.stage = 'rank';
    }
    this.queueEvents(this.table.log);
    if (options.hud) {
      window.addEventListener('keydown', this.keys);
      this.view.element.addEventListener('pointermove', this.pointerMove);
      this.view.element.addEventListener('pointerdown', this.pointerDown);
    }
  }

  start(): void {
    this.options.sound.ambience(true);
    this.last = performance.now();
    const frame = (now: number) => {
      if (this.stopped) return;
      this.tick(Math.min(0.1, (now - this.last) / 1000));
      this.last = now;
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frameId);
    this.options.sound.ambience(false);
    window.removeEventListener('keydown', this.keys);
    this.view.element.removeEventListener('pointermove', this.pointerMove);
    this.view.element.removeEventListener('pointerdown', this.pointerDown);
  }

  pause(): void {
    this.paused = true;
    this.options.sound.ambience(false);
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
    if (this.phase !== 'over') this.options.sound.ambience(true);
  }

  /** Advances the clock and draws; the tests and stills call it directly. */
  tick(dt: number): void {
    if (this.paused) return;
    this.time += dt;
    const speed = this.options.pace() * (this.options.reducedMotion() ? 3 : 1) * this.testSpeed;
    this.queue.advance(dt * speed);
    if (!this.queue.busy) this.whatNext();
    this.expire();
    this.draw();
  }

  /** Plays everything queued at once (tests; skipping ahead). */
  settle(): void {
    for (let guard = 0; guard < 2000 && this.phase === 'playing'; guard++) {
      this.queue.flush();
      if (!this.queue.busy) this.whatNext();
      if (!this.queue.busy && this.phase !== 'playing') break;
    }
    this.draw();
  }

  /** Any legal ask of yours, for the browser tests' stand-in player. */
  firstLegalAsk(): { rival: number; rank: Rank } | null {
    if (this.phase !== 'your-turn') return null;
    for (const card of this.display.hand) {
      for (let rival = 0; rival < this.rivals.length; rival++) {
        if (this.table.isLegal({ target: rival + 1, rank: rankOf(card) }))
          return { rival, rank: rankOf(card) };
      }
    }
    return null;
  }

  /** A careful ask from your own notebook, the way Miso reasons, for the documentation runs. */
  bestAsk(): { rival: number; rank: Rank } | null {
    if (this.phase !== 'your-turn') return null;
    let best: { rival: number; rank: Rank } | null = null;
    let bestScore = -Infinity;
    for (const rank of new Set(this.display.hand.map(rankOf))) {
      const held = this.display.hand.filter((card) => rankOf(card) === rank).length;
      for (let rival = 0; rival < this.rivals.length; rival++) {
        if (!this.table.isLegal({ target: rival + 1, rank })) continue;
        const odds = this.knowledge.chanceHolds(rival + 1, rank);
        const score = odds >= 1 ? 1000 + held : held + odds * 0.5 - (odds < 0.03 ? 5 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = { rival, rank };
        }
      }
    }
    return best;
  }

  get isYourTurn(): boolean {
    return this.phase === 'your-turn';
  }

  get isOver(): boolean {
    return this.phase === 'over';
  }

  get notebook(): boolean {
    return this.notebookOpen;
  }

  // —— what happens next ——

  private whatNext(): void {
    if (this.phase === 'over') return;
    if (this.table.over) {
      this.phase = 'over';
      return;
    }
    if (this.table.awaitingPerson) {
      if (this.phase !== 'your-turn') {
        this.phase = 'your-turn';
        if (this.options.setup.rivals.length > 1) this.stage = 'rival';
        this.options.announce(`${this.note ? `${this.note} ` : ''}${this.yourTurnHint()}`);
        this.hudDirty = true;
      }
      return;
    }
    // A rival's turn: a moment's thought, then the ask.
    const seat = this.table.turn;
    this.queue.push({
      duration: seat === 0 ? 0.6 : 0.95,
      start: () => {
        if (seat > 0) this.setMood(seat - 1, 'thinking');
      },
      end: () => {
        if (seat > 0) this.setMood(seat - 1, 'idle');
        this.queueEvents(this.table.step());
      },
    });
  }

  private yourTurnHint(): string {
    if (this.options.setup.rivals.length === 1)
      return `Your turn. Choose a rank to ask ${this.rivals[0]!.name} for.`;
    const again =
      this.lastAsked !== null ? ` Enter asks ${this.rivals[this.lastAsked]!.name} again.` : '';
    return `Your turn. Choose who to ask: ${this.rivals.map((r, i) => `${i + 1} ${r.name}`).join(', ')}.${again}`;
  }

  // —— your asks ——

  chooseRival(index: number): void {
    if (index < 0 || index >= this.rivals.length) return;
    if (this.table.state.seats[index + 1]!.hand.length === 0 && this.phase === 'your-turn') {
      this.options.announce(`${this.rivals[index]!.name} has no cards to ask for.`);
      return;
    }
    this.selected = index;
    this.stage = 'rank';
    this.hudDirty = true;
    if (this.phase === 'your-turn')
      this.options.announce(`Asking ${this.rivals[index]!.name}. Now choose a rank.`);
  }

  ask(rank: Rank): void {
    if (this.phase !== 'your-turn') return;
    const target = this.stage === 'rank' ? this.selected : null;
    if (target === null) {
      this.options.announce(this.yourTurnHint());
      return;
    }
    const ask = { target: target + 1, rank };
    if (!this.table.isLegal(ask)) {
      const holds = this.display.hand.some((card) => rankOf(card) === rank);
      this.options.announce(
        holds
          ? `${this.rivals[target]!.name} has no cards left to ask.`
          : `You have no ${rankWord(rank)} to ask with.`,
      );
      return;
    }
    this.phase = 'playing';
    this.lastAsked = target;
    this.hoverRank = null;
    this.note = null;
    this.hudDirty = true;
    this.queueEvents(this.table.play(ask));
  }

  toggleNotebook(): void {
    this.notebookOpen = !this.notebookOpen;
    if (this.notebookOpen) this.notebookUsed = true;
    this.options.onNotebook(this.notebookOpen);
    this.options.announce(this.notebookOpen ? 'Notebook open.' : 'Notebook closed.');
    this.hudDirty = true;
  }

  /** Classic 1993: the original's `p`. */
  switchToPro(): void {
    if (this.options.setup.rules !== 'classic' || this.phase === 'over') return;
    const rival = this.rivals[0]!;
    if (!this.table.switchToPro(1)) {
      this.say(0, `${rival.name} is already paying close attention.`);
      return;
    }
    this.say(
      0,
      rival.kind === 'otter' ? 'Ooh! I’ll pay attention now.' : 'Very well. Watching closely.',
    );
    this.options.announce(`Pro mode: ${rival.name} now remembers what you ask for.`);
    this.options.onMoment({ kind: 'pro-mode' });
  }

  private onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.paused)
      return;
    if ((event.target as HTMLElement | null)?.closest?.('input, select, textarea')) return;
    const key = event.key.toLowerCase();
    if (key === 'n') {
      event.preventDefault();
      this.toggleNotebook();
      return;
    }
    if (key === 'p' && this.options.setup.rules === 'classic') {
      event.preventDefault();
      this.switchToPro();
      return;
    }
    if (this.phase !== 'your-turn') return;
    const many = this.rivals.length > 1;
    if (key === 'enter' && many && this.stage === 'rival') {
      // Enter on a focused button is that button's; only a bare Enter picks the last rival.
      if ((event.target as HTMLElement | null)?.closest?.('button')) return;
      event.preventDefault();
      this.chooseRival(this.lastAsked ?? 0);
      return;
    }
    if (key === 'backspace' && many) {
      event.preventDefault();
      this.stage = 'rival';
      this.hudDirty = true;
      this.options.announce(this.yourTurnHint());
      return;
    }
    if (many && this.stage === 'rival' && /^[1-3]$/.test(key)) {
      const index = Number(key) - 1;
      if (index < this.rivals.length) {
        event.preventDefault();
        this.chooseRival(index);
        return;
      }
    }
    const rank = RANK_KEYS[key];
    if (rank && (this.stage === 'rank' || !/^[0-9]$/.test(key))) {
      event.preventDefault();
      this.ask(rank);
    }
  }

  private cardAt(event: PointerEvent): CardId | null {
    const box = this.view.element.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const slots = this.view.handSlots(this.display.hand, this.liftedRank());
    const { width, height } = {
      width: this.view.layout.hand.cardHeight / 1.4,
      height: this.view.layout.hand.cardHeight,
    };
    // The topmost card under the pointer: later cards lie over earlier ones.
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i]!;
      if (Math.abs(x - slot.x) <= width / 2 && Math.abs(y - slot.y) <= height / 2) return slot.card;
    }
    return null;
  }

  private onPointerMove(event: PointerEvent): void {
    const card = this.phase === 'your-turn' ? this.cardAt(event) : null;
    const rank = card === null ? null : rankOf(card);
    this.view.element.style.cursor = card === null ? '' : 'pointer';
    if (rank !== this.hoverRank) {
      this.hoverRank = rank;
      this.hudDirty = true;
    }
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const card = this.phase === 'your-turn' ? this.cardAt(event) : null;
    if (card !== null) this.ask(rankOf(card));
  }

  private liftedRank(): Rank | undefined {
    return this.hoverRank ?? undefined;
  }

  // —— moods and words ——

  private setMood(index: number, mood: Mood): void {
    const rival = this.rivals[index];
    if (!rival) return;
    rival.mood = mood;
    rival.since = this.time;
  }

  private say(index: number, text: string, loud = false): void {
    this.speech = { rival: index, text, loud, until: this.time + SPEECH_HOLD };
    this.hudDirty = true;
  }

  private sayLine(index: number, moment: LineKind, rank?: Rank): void {
    const rival = this.rivals[index];
    if (!rival) return;
    this.say(
      index,
      lineFor(rival.kind, moment, this.lineCounter++, rank ? rankWord(rank) : undefined),
      moment === 'goFish',
    );
  }

  private expire(): void {
    for (const rival of this.rivals) {
      if (
        rival.mood !== 'thinking' &&
        rival.mood !== 'idle' &&
        this.time - rival.since > MOOD_HOLD
      ) {
        rival.mood = 'idle';
        rival.since = this.time;
      }
    }
    if (this.speech && this.time > this.speech.until) {
      this.speech = null;
      this.hudDirty = true;
    }
    this.ripples = this.ripples.filter((r) => this.time - r.start < 2.6);
  }

  // —— where things are ——

  private seatPoint(seat: number, card?: CardId): Point {
    if (seat === 0)
      return card === undefined
        ? { x: this.view.layout.hand.cx, y: this.view.layout.hand.baseline - 60 }
        : this.view.handPoint(card, this.display.hand);
    const index = seat - 1;
    return this.view.rivalHand(index, this.rivals.length, this.rivals[index]!.kind);
  }

  private who(seat: number): string {
    return this.names.title(seat);
  }

  // —— the notebook ——

  private see(event: GameEvent): void {
    const seen = seeEvent(event, 0);
    this.knowledge.observe(seen);
    const line = logLine(seen, this.lastSeen, this.names);
    if (line) this.lines = [line, ...this.lines].slice(0, 30);
    this.lastSeen = seen;
    this.hudDirty = true;
  }

  // —— events into steps ——

  private queueEvents(events: readonly GameEvent[]): void {
    for (let i = 0; i < events.length; i++) {
      const event = events[i]!;
      const steps = this.stepsFor(event, events[i - 1]);
      this.queue.push(...steps);
    }
  }

  private stepsFor(event: GameEvent, previous: GameEvent | undefined): Step[] {
    switch (event.kind) {
      case 'deal':
        return [this.dealStep(event)];
      case 'turn':
        return [this.turnStep(event.seat)];
      case 'ask':
        return [this.askStep(event)];
      case 'give':
        return [this.giveStep(event)];
      case 'go-fish':
        return [this.goFishStep(event)];
      case 'draw':
        return this.drawSteps(event, previous);
      case 'book':
        return [this.bookStep(event)];
      case 'end':
        return [this.endStep(event)];
    }
  }

  private dealStep(event: Extract<GameEvent, { kind: 'deal' }>): Step {
    const size = event.hands[0]!.length;
    const players = event.hands.length;
    const per = 0.07;
    return {
      duration: size * players * per + 0.45,
      start: () => {
        this.options.sound.deal(size * players);
        this.see(event);
        this.flights = [];
        event.hands.forEach((hand, seat) => {
          hand.forEach((card, round) => {
            const order = round * players + seat;
            this.flights.push({
              card: seat === 0 ? card : null,
              from: this.view.pilePoint,
              to: seat === 0 ? this.view.handPoint(card, event.hands[0]!) : this.seatPoint(seat),
              age: 0,
              duration: 0.4,
              delay: order * per,
              turnUp: seat === 0,
              fromScale: 0.6,
              toScale: seat === 0 ? 1 : 0.35,
            });
          });
        });
        this.display.pond = 52;
      },
      frame: (age) => {
        for (const flight of this.flights) flight.age = age;
        const landed = Math.floor(Math.max(0, age - 0.4) / per);
        this.display.pond = 52 - Math.min(size * players, landed + 1);
      },
      end: () => {
        this.flights = [];
        this.display.hand = [...event.hands[0]!];
        this.display.rivalCards = event.hands.slice(1).map((hand) => hand.length);
        this.display.pond = 52 - size * players;
        const starter =
          event.starter === 0 ? 'You ask first.' : `${this.who(event.starter)} asks first.`;
        this.options.announce(`${size === 5 ? 'Five' : 'Seven'} cards each. ${starter}`);
        this.message = starter;
        this.hudDirty = true;
      },
    };
  }

  private turnStep(seat: number): Step {
    return {
      duration: 0.3,
      start: () => {
        this.booksThisTurn = 0;
        if (seat > 0) this.options.announce(`${this.who(seat)}’s turn.`);
        this.hudDirty = true;
      },
    };
  }

  private askStep(event: Extract<GameEvent, { kind: 'ask' }>): Step {
    const mine = event.asker === 0;
    return {
      duration: mine ? 0.45 : 1.05,
      start: () => {
        this.options.sound.ask();
        this.see(event);
        if (!mine) this.sayLine(event.asker - 1, 'asks', event.rank);
        const text = `${this.who(event.asker)} ${mine ? 'ask' : 'asks'} ${this.names.of(event.target)} for ${rankWord(event.rank)}.`;
        this.message = mine ? text.replace(/\.$/, '…') : null;
        this.options.announce(text);
      },
    };
  }

  private giveStep(event: Extract<GameEvent, { kind: 'give' }>): Step {
    const count = event.cards.length;
    return {
      duration: 0.95,
      start: () => {
        this.options.sound.give(count);
        this.see(event);
        const from = event.cards.map((card) =>
          this.seatPoint(event.from, event.from === 0 ? card : undefined),
        );
        if (event.from === 0)
          this.display.hand = this.display.hand.filter((card) => !event.cards.includes(card));
        else this.display.rivalCards[event.from - 1]! -= count;
        this.flights = event.cards.map((card, i) => ({
          card,
          from: from[i]!,
          to: this.seatPoint(event.to, event.to === 0 ? card : undefined),
          age: 0,
          duration: 0.6,
          delay: i * 0.08,
          fromScale: event.from === 0 ? 1 : 0.45,
          toScale: event.to === 0 ? 1 : 0.45,
        }));
        if (event.from > 0) {
          this.setMood(event.from - 1, 'grumpy');
          if (event.to > 0) this.setMood(event.to - 1, 'delighted');
          this.sayLine(event.from - 1, 'grumpy');
        } else if (event.to > 0) {
          this.setMood(event.to - 1, 'delighted');
          this.sayLine(event.to - 1, 'delighted');
        }
        const what = `${countWord(count)} ${rankWord(event.rank, count)}`;
        this.message =
          event.to === 0
            ? `${this.who(event.from)} hands you ${what}!`
            : event.from === 0
              ? `You hand ${this.names.of(event.to)} ${what}.`
              : `${this.who(event.from)} hands ${this.names.of(event.to)} ${what}.`;
        if (event.to === 0) this.note = 'Ask again!';
        this.options.announce(
          event.to === 0
            ? `${this.who(event.from)} hands you ${what}. Ask again.`
            : `${this.who(event.from)} ${event.from === 0 ? 'hand' : 'hands'} ${this.names.of(event.to)} ${what}.`,
        );
      },
      frame: (age) => {
        for (const flight of this.flights) flight.age = age;
      },
      end: () => {
        this.flights = [];
        if (event.to === 0) this.display.hand = [...this.display.hand, ...event.cards];
        else this.display.rivalCards[event.to - 1]! += count;
        this.hudDirty = true;
      },
    };
  }

  private goFishStep(event: Extract<GameEvent, { kind: 'go-fish' }>): Step {
    return {
      duration: 0.95,
      start: () => {
        this.options.sound.goFish();
        this.see(event);
        if (event.target > 0) {
          this.setMood(event.target - 1, 'delighted');
          this.sayLine(event.target - 1, 'goFish');
        }
        this.message =
          event.target === 0
            ? `You have no ${rankWord(event.rank)}. ${this.who(event.asker)} goes fishing.`
            : event.asker === 0
              ? `${this.who(event.target)} has no ${rankWord(event.rank)}. Go fish!`
              : `${this.who(event.target)} has no ${rankWord(event.rank)}.`;
        this.options.announce(`${this.who(event.target)}: Go fish! No ${rankWord(event.rank)}.`);
      },
    };
  }

  private drawSteps(
    event: Extract<GameEvent, { kind: 'draw' }>,
    previous: GameEvent | undefined,
  ): Step[] {
    const asked = previous?.kind === 'go-fish' ? previous.rank : null;
    if (event.seat === 0 && event.why === 'fish') return this.castSteps(event, asked);
    return [this.otherDrawStep(event, asked)];
  }

  /** Your "Go Fish!": the cast, the bite, the reel, and the card swinging home into your hand. */
  private castSteps(event: Extract<GameEvent, { kind: 'draw' }>, asked: Rank | null): Step[] {
    const layout = () => this.view.layout;
    let landed = false;
    let bitten = false;
    const cast: Step = {
      duration: CAST.reeled,
      start: () => {
        this.options.sound.cast();
        this.cast = { age: 0, card: event.card, lucky: event.lucky };
        this.message = asked ? `Casting for ${rankWord(asked, 1)}…` : 'Casting…';
      },
      frame: (age) => {
        this.cast = { age, card: event.card, lucky: event.lucky };
        const landing = landingPoint(layout());
        if (!landed && age >= CAST.landed) {
          landed = true;
          this.options.sound.splash(0.7);
          this.ripples.push({ ...landing, start: this.time, strength: 1 });
        }
        if (!bitten && age >= CAST.bite) {
          bitten = true;
          this.options.sound.reel();
          this.options.sound.splash(1);
          this.ripples.push({ ...landing, start: this.time, strength: 1.3 });
          this.display.pond -= 1;
          this.see(event);
        }
      },
    };
    const home: Step = {
      duration: 0.5,
      start: () => {
        this.cast = undefined;
        const hook = castAt(layout(), CAST.reeled).end;
        this.flights = [
          {
            card: event.card,
            from: { x: hook.x, y: hook.y + 70 * layout().s },
            to: this.view.handPoint(event.card, this.display.hand),
            age: 0,
            duration: 0.5,
            turnUp: true,
            fromScale: 0.9,
            toScale: 1,
            glow: event.lucky ? 'rgba(255, 220, 120, 0.95)' : undefined,
          },
        ];
      },
      frame: (age) => {
        for (const flight of this.flights) flight.age = age;
      },
      end: () => {
        this.flights = [];
        this.display.hand = [...this.display.hand, event.card];
        const caught = `${rankWord(rankOf(event.card), 1)}`;
        if (event.lucky) {
          this.luckyCasts++;
          this.options.sound.lucky();
          this.note = 'Lucky catch! Ask again.';
          this.message = `A ${caught}, the very rank you asked for!`;
          this.options.announce(`Lucky catch: you fished up a ${caught}. Ask again.`);
          if (this.luckyCasts === 3) this.options.onMoment({ kind: 'lucky-three' });
        } else {
          this.message = `You caught a ${caught}.`;
          this.options.announce(`You caught a ${caught}.`);
        }
        this.hudDirty = true;
      },
    };
    return [cast, home];
  }

  /** A rival's draw (face down unless it is a lucky catch, which is shown), or a refill. */
  private otherDrawStep(event: Extract<GameEvent, { kind: 'draw' }>, asked: Rank | null): Step {
    const shown = event.lucky || event.seat === 0;
    return {
      duration: event.lucky ? 1.1 : 0.7,
      start: () => {
        this.see(event);
        this.display.pond -= 1;
        this.options.sound.splash(0.4);
        this.ripples.push({ ...this.view.pilePoint, start: this.time, strength: 0.5 });
        this.flights = [
          {
            card: shown ? event.card : null,
            from: this.view.pilePoint,
            to: this.seatPoint(event.seat, event.seat === 0 ? event.card : undefined),
            age: 0,
            duration: event.lucky ? 0.9 : 0.55,
            turnUp: event.seat === 0,
            fromScale: 0.7,
            toScale: event.seat === 0 ? 1 : 0.45,
            glow: event.lucky ? 'rgba(255, 220, 120, 0.95)' : undefined,
          },
        ];
        if (event.seat > 0 && event.lucky) {
          this.options.sound.lucky();
          this.setMood(event.seat - 1, 'delighted');
          this.sayLine(event.seat - 1, 'luckyCast', asked ?? undefined);
          this.options.announce(
            `${this.who(event.seat)} fished up the ${rankWord(rankOf(event.card), 1)} asked for, and asks again.`,
          );
        } else if (event.seat > 0) {
          this.options.announce(`${this.who(event.seat)} draws from the pond.`);
        } else {
          this.options.announce(
            `Your hand was empty: you draw a ${rankWord(rankOf(event.card), 1)}.`,
          );
        }
      },
      frame: (age) => {
        for (const flight of this.flights) flight.age = age;
      },
      end: () => {
        this.flights = [];
        if (event.seat === 0) this.display.hand = [...this.display.hand, event.card];
        else this.display.rivalCards[event.seat - 1]! += 1;
        this.hudDirty = true;
      },
    };
  }

  private bookStep(event: Extract<GameEvent, { kind: 'book' }>): Step {
    const mine = event.seat === 0;
    let chimed = false;
    return {
      duration: mine ? LEAP.done : RIVAL_LEAP_TIME + 0.15,
      start: () => {
        this.see(event);
        const fishName = rankWord(event.rank);
        if (mine) {
          this.display.hand = this.display.hand.filter((card) => !event.cards.includes(card));
          this.leap = { rank: event.rank, golden: event.golden, cards: event.cards, age: 0 };
          this.message = `A book of ${fishName}!${event.golden ? ' And it is golden!' : ''}`;
          this.booksThisTurn++;
          this.mostBooksInATurn = Math.max(this.mostBooksInATurn, this.booksThisTurn);
        } else {
          const index = event.seat - 1;
          this.display.rivalCards[index]! -= 4;
          this.rivalLeaps = [
            {
              rank: event.rank,
              golden: event.golden,
              from: this.seatPoint(event.seat),
              to: this.view.diveSpot(index, this.rivals.length),
              age: 0,
            },
          ];
          this.options.sound.book(event.golden);
          chimed = true;
          this.setMood(index, 'delighted');
          this.sayLine(index, 'book');
        }
        this.options.announce(
          `${this.who(event.seat)} ${mine ? 'make' : 'makes'} a book of ${fishName}${event.golden ? ', a golden fish' : ''}.`,
        );
        this.hudDirty = true;
      },
      frame: (age) => {
        if (mine) {
          this.leap = { rank: event.rank, golden: event.golden, cards: event.cards, age };
          if (!chimed && age >= LEAP.fused) {
            chimed = true;
            this.options.sound.book(event.golden);
          }
        } else {
          for (const leap of this.rivalLeaps) leap.age = age;
        }
      },
      end: () => {
        if (mine) {
          this.leap = undefined;
          this.options.sound.splash(0.5);
          this.display.books[0]!.push({ rank: event.rank, golden: event.golden });
          if (this.display.books[0]!.length === 1) this.options.onMoment({ kind: 'first-book' });
          if (event.golden) this.options.onMoment({ kind: 'golden' });
          if (this.booksThisTurn === 3) this.options.onMoment({ kind: 'three-in-turn' });
        } else {
          const spot = this.view.diveSpot(event.seat - 1, this.rivals.length);
          this.ripples.push({ ...spot, start: this.time, strength: 0.9 });
          this.options.sound.splash(0.6);
          this.rivalLeaps = [];
          this.display.books[event.seat]!.push({ rank: event.rank, golden: event.golden });
        }
        this.hudDirty = true;
      },
    };
  }

  private endStep(event: Extract<GameEvent, { kind: 'end' }>): Step {
    const youWon = event.winners.length === 1 && event.winners[0] === 0;
    const youTied = event.winners.length > 1 && event.winners.includes(0);
    return {
      duration: LAP_TIME + 0.3,
      start: () => {
        this.phase = 'over';
        this.taunt = event.taunt;
        if (youWon) this.options.sound.win();
        else this.options.sound.end();
        this.lap = { age: 0, fish: this.lapFish() };
        this.rivals.forEach((_, index) => {
          const seat = index + 1;
          this.setMood(
            index,
            event.winners.includes(seat) ? 'delighted' : youWon ? 'grumpy' : 'idle',
          );
        });
        const winnerRival = event.winners.find((seat) => seat > 0);
        if (event.taunt) {
          // The original's one-in-1024 parting line, in a rival's own words and never rude.
          const speaker = youWon ? this.lineCounter % this.rivals.length : (winnerRival ?? 1) - 1;
          this.sayLine(speaker, youWon ? 'tauntWin' : 'tauntLose');
          this.speech!.until = this.time + LAP_TIME + 2;
        } else if (winnerRival !== undefined && !youTied) {
          this.sayLine(winnerRival - 1, 'delighted');
        }
        this.message = youWon
          ? 'You win! Every fish swims a lap of the pond.'
          : youTied
            ? 'A tie at the top!'
            : 'The game is over.';
        this.options.announce(this.message);
        this.hudDirty = true;
      },
      frame: (age) => {
        if (this.lap) this.lap = { ...this.lap, age };
      },
      end: () => {
        this.lap = undefined;
        this.options.sound.ambience(false);
        this.options.onEnd(this.summary(event), this.table);
      },
    };
  }

  private lapFish(): LapFish[] {
    const fish: LapFish[] = [];
    this.display.books.forEach((books, owner) => {
      for (const book of books) fish.push({ rank: book.rank, golden: book.golden, owner });
    });
    return fish;
  }

  private summary(event: Extract<GameEvent, { kind: 'end' }>): GameSummary {
    const youWon = event.winners.length === 1 && event.winners[0] === 0;
    const outcome = youWon ? 'win' : event.winners.includes(0) ? 'draw' : 'loss';
    return {
      setup: this.options.setup,
      outcome,
      books: this.table.state.seats[0]!.books.map((book) => ({
        rank: book.rank,
        golden: book.golden,
      })),
      luckyCasts: this.luckyCasts,
      mostBooksInATurn: this.mostBooksInATurn,
      notebookUsed: this.notebookUsed,
      taunt: this.taunt,
    };
  }

  // —— drawing ——

  private draw(): void {
    this.view.draw(this.scene());
    if (this.options.hud && this.hudDirty) {
      this.hudDirty = false;
      this.options.hud.render(this.hudModel(), this.options.root);
    }
  }

  scene(): PondScene {
    return {
      time: this.time,
      rivals: this.rivals.map((rival, index) => ({
        kind: rival.kind,
        mood: rival.mood,
        moodAge: this.time - rival.since,
        cards: this.display.rivalCards[index] ?? 0,
      })),
      pond: Math.max(0, this.display.pond),
      hand: this.display.hand,
      lifted: this.liftedRank(),
      bucket: this.display.books[0]!,
      ripples: this.ripples,
      cast: this.cast,
      leap: this.leap,
      flights: this.flights,
      rivalLeaps: this.rivalLeaps,
      lap: this.lap,
      motion: this.options.reducedMotion() ? 0 : 1,
    };
  }

  hudModel(): HudModel {
    const layout = this.view.layout;
    const ranks = new Map<Rank, number>();
    for (const card of this.display.hand)
      ranks.set(rankOf(card), (ranks.get(rankOf(card)) ?? 0) + 1);
    const turnSeat = this.phase === 'over' ? -1 : this.table.turn;
    const yours = this.phase === 'your-turn';
    const choosing = yours && this.stage === 'rival' && this.rivals.length > 1;
    const target = this.selected === null ? null : this.rivals[this.selected]!.name;
    return {
      look: this.options.look(),
      s: layout.s,
      status: this.options.status,
      rivals: this.rivals.map((rival, index) => {
        const anchor = this.view.rivalAnchor(index, this.rivals.length, rival.kind);
        const books = this.display.books[index + 1]!;
        return {
          name: rival.name,
          cards: this.display.rivalCards[index] ?? 0,
          books: books.length,
          goldens: books.filter((book) => book.golden).length,
          selected: this.selected === index && (yours ? !choosing : false),
          turn: turnSeat === index + 1,
          anchor: { x: anchor.base.x, top: anchor.top },
          choosing,
        };
      }),
      speech: this.speech
        ? { rival: this.speech.rival, text: this.speech.text, loud: this.speech.loud }
        : null,
      ask: {
        rect: layout.askBar,
        mode: !yours ? 'message' : choosing ? 'choose-rival' : 'choose-rank',
        target,
        again: this.lastAsked === null ? null : this.rivals[this.lastAsked]!.name,
        ranks: [...ranks].sort((a, b) => a[0] - b[0]).map(([rank, count]) => ({ rank, count })),
        selectedRank: this.hoverRank,
        message: this.message ?? 'Watching the pond…',
        note: yours ? this.note : null,
      },
      notebook: {
        rect: layout.notebook,
        open: this.notebookOpen,
        rivals: this.rivals.map((rival) => rival.name),
        knowledge: this.knowledge,
        myRanks: new Set(ranks.keys()),
        lines: this.lines.slice(0, 9),
        selected: this.selected,
      },
      bucket: {
        anchor: {
          x: this.view.bucketMouth.x,
          y: layout.bucket.y + layout.bucket.h - 50 * layout.s,
        },
        fish: this.display.books[0]!.length,
        goldens: this.display.books[0]!.filter((book) => book.golden).length,
      },
      pond: {
        anchor: { x: layout.pile.x, y: layout.pile.y + 70 * layout.s },
        cards: Math.max(0, this.display.pond),
      },
    };
  }
}
