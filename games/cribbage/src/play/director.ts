import { createRng } from '@usr-games/kit';
import {
  attachCardPointer,
  type CardId,
  cardLabel,
  cardName,
  snapTarget,
} from '@usr-games/kit/cards';
import { byRank } from '../engine/cards';
import { rankDiscards } from '../engine/ai/expect';
import { rankPlays } from '../engine/ai/lookahead';
import { type Level, type Mind, mindFor } from '../engine/ai/minds';
import {
  cardsShown,
  currentShowStep,
  discardView,
  hasLaidAway,
  layAway,
  type MatchEvent,
  type MatchState,
  needsClaim,
  nextHand,
  playableCards,
  playCard,
  playView,
  other,
  RIVAL,
  type Seat,
  showNext,
  skunkOf,
  type ShowStep,
  type Step,
  YOU,
} from '../engine/match';
import type { PegCombo } from '../engine/peg';
import type { HandCount } from '../engine/score';
import type { GameSummary } from '../modes/packages';
import { CARD, cardWidth, LAYOUT, toDesign } from '../render/layout';
import type { Look } from '../render/look';
import type { TableView } from '../render/scene';
import { button, comboLabel, type Hud } from '../ui/hud';
import { ClaimPad, CoachNote, HandButtons } from '../ui/table-controls';
import { buildScene, emptyModel, type ShowState, startLeap, type TableModel } from './model';
import type { TableSound } from './sound';
import { CardVisuals } from './visuals';

/**
 * A game at the table. The director keeps the game's true state and, a little behind it, the
 * table as shown: each event the engine reports becomes a beat of animation (a card laid, a peg
 * jumping, a combination lighting up), and only when the table has caught up does it ask for
 * the next move, from you or from the computer. It owns the input at the table (pointer, drag
 * and keys), the coach, the counting of hands and claims, and it tells the app about anything
 * worth keeping (a big hand for the album, a package earned) and about the end of the game.
 */

export interface Tallies {
  thirtyOnes: number;
  hisHeels: number;
  bestCount: number;
  claims: number;
  rightClaims: number;
  pegged: number;
  shown: number;
}

export const NO_TALLIES = (): Tallies => ({
  thirtyOnes: 0,
  hisHeels: 0,
  bestCount: 0,
  claims: 0,
  rightClaims: 0,
  pegged: 0,
  shown: 0,
});

export type Moment =
  | { kind: 'thirty-one' }
  | { kind: 'his-heels' }
  | { kind: 'counted'; hand: CardId[]; starter: CardId; isCrib: boolean; total: number };

export interface DirectorHooks {
  announce(text: string): void;
  /** After every move: the state to keep for Continue. */
  onStep(state: MatchState, tallies: Tallies): void;
  onMoment(moment: Moment): void;
  onEnd(summary: GameSummary, state: MatchState): void;
}

export interface DirectorOptions {
  root: HTMLElement;
  view: TableView;
  hud: Hud;
  sound: TableSound;
  look(): Look;
  reducedMotion(): boolean;
  /** 1 for relaxed, more for brisk. */
  pace(): number;
  coach(): boolean;
  level: Level;
  names: [string, string];
  seed: string;
  state: MatchState;
  /** The events that made `state` from nothing (a new game); empty when continuing. */
  opening: MatchEvent[];
  tallies?: Tallies;
  hooks: DirectorHooks;
  /** For the attract mode: a computer plays your seat too, and nothing waits for input. */
  autopilot?: Mind;
}

type Waiting = 'lay-away' | 'play' | 'claim' | 'next-hand' | null;

interface Beat {
  at: number;
  run: () => void;
}

const COMBO_WORDS: Record<PegCombo['kind'], string> = {
  fifteen: 'Fifteen',
  'thirty-one': 'Thirty-one',
  pair: 'Pair',
  run: 'Run',
};

const RUN_WORDS = ['', '', '', 'three', 'four', 'five', 'six', 'seven'];

/** "Fifteen and a pair", "Run of four", "Thirty-one". */
export function pegWords(combos: readonly PegCombo[]): string {
  const words = combos.map((combo) => {
    if (combo.kind === 'pair') {
      return combo.points >= 12 ? 'Double pair royal' : combo.points >= 6 ? 'Pair royal' : 'Pair';
    }
    if (combo.kind === 'run') return `Run of ${RUN_WORDS[combo.points] ?? combo.points}`;
    return COMBO_WORDS[combo.kind];
  });
  if (words.length <= 1) return words[0] ?? '';
  const last = words[words.length - 1]!;
  const article = /^(Pair|Run|Double)/.test(last) ? 'a ' : '';
  return `${words.slice(0, -1).join(', ')} and ${article}${last.toLowerCase()}`;
}

export class Director {
  private state: MatchState;
  private readonly model: TableModel;
  private readonly visuals = new CardVisuals();
  private readonly handButtons: HandButtons;
  private readonly coachNote = new CoachNote();
  private readonly claimPad = new ClaimPad();
  private readonly tallies: Tallies;
  private beats: Beat[] = [];
  private cursor = 0;
  private now = 0;
  private wall = 0;
  private last = 0;
  private frame = 0;
  private paused = false;
  private stopped = false;
  private finished = false;
  private waiting: Waiting = null;
  private thinking = false;
  /** Space pressed during a count: the rest of it plays quickly. */
  private quickening = false;
  private claimStaged = false;
  private coachFor = '';
  testSpeed = 1;
  private readonly unhook: (() => void)[] = [];

  constructor(private readonly options: DirectorOptions) {
    this.state = options.state;
    this.tallies = options.tallies ?? NO_TALLIES();
    this.model = emptyModel(options.names, options.state.options.length);
    this.handButtons = new HandButtons((card) => this.activate(card));
    const { hud } = options;
    hud.sheet.append(this.handButtons.element, this.coachNote.element, this.claimPad.element);
    this.unhook.push(
      attachCardPointer<CardId>(options.root, {
        pick: (point) => this.pick(point),
        tap: (card) => this.activate(card),
        dragStart: (card, tracker) => this.dragTo(card, tracker.position),
        dragMove: (card, tracker) => this.dragTo(card, tracker.position),
        dragEnd: (card, tracker) => this.drop(card, tracker.position),
      }),
    );
    const keys = (event: KeyboardEvent) => this.onKey(event);
    options.root.addEventListener('keydown', keys);
    this.unhook.push(() => options.root.removeEventListener('keydown', keys));
  }

  // —— running ——

  start(): void {
    if (this.options.opening.length > 0) this.enqueue(this.options.opening, this.state);
    else this.syncModel();
    this.updateStatus();
    this.last = performance.now();
    const tick = (time: number) => {
      if (this.stopped) return;
      // Long gaps (a hidden tab) are capped, so nothing jumps ahead when the player comes back.
      const dt = Math.min(0.2, Math.max(0, (time - this.last) / 1000));
      this.last = time;
      this.wall += dt;
      if (!this.paused) this.now += dt * this.speed();
      this.runDueBeats();
      if (!this.paused && this.idle()) this.advance();
      this.draw(dt);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    for (const unhook of this.unhook) unhook();
    this.handButtons.element.remove();
    this.coachNote.element.remove();
    this.claimPad.element.remove();
    this.options.sound.fireside(false);
  }

  pause(): void {
    this.paused = true;
    this.options.sound.fireside(false);
  }

  resume(): void {
    this.paused = false;
    this.last = performance.now();
    this.options.sound.fireside(this.options.look().dark);
  }

  get isOver(): boolean {
    return this.finished;
  }

  get waitingFor(): Waiting {
    return this.waiting;
  }

  get current(): MatchState {
    return this.state;
  }

  private speed(): number {
    const quicken = this.quickening ? 5 : 1;
    return this.options.pace() * this.testSpeed * quicken;
  }

  private tempo(): number {
    return this.options.reducedMotion() ? 0.6 : 1;
  }

  private idle(): boolean {
    return this.beats.length === 0 && this.now >= this.cursor;
  }

  /** Queues something to happen after everything already queued, then `seconds` of pause. */
  private beat(seconds: number, run: () => void = () => {}): void {
    const at = Math.max(this.cursor, this.now);
    this.beats.push({ at, run });
    this.cursor = at + seconds * this.tempo();
  }

  private runDueBeats(): void {
    while (this.beats.length > 0 && this.beats[0]!.at <= this.now) {
      const beat = this.beats.shift()!;
      beat.run();
    }
    if (this.idle()) this.quickening = false;
  }

  private draw(dt: number): void {
    const look = this.options.look();
    const still = this.options.reducedMotion();
    const scene = buildScene(this.model, {
      look,
      now: this.now,
      time: still ? 2 : this.wall,
      dt,
      still,
      visuals: this.visuals,
    });
    this.options.view.render(scene);
    this.placeHandButtons();
  }

  // —— from the game to the table ——

  private apply(step: Step): void {
    this.state = step.state;
    this.enqueue(step.events, step.state);
    this.options.hooks.onStep(this.state, { ...this.tallies });
  }

  private announce(text: string): void {
    this.options.hooks.announce(text);
  }

  private name(seat: Seat): string {
    return seat === YOU ? 'You' : this.options.names[1];
  }

  /** Turns each event into beats; `after` is the state once all of them have happened. */
  private enqueue(events: readonly MatchEvent[], after: MatchState): void {
    let counted = false;
    for (const event of events) {
      switch (event.type) {
        case 'cut-for-deal':
          this.cutForDealBeats(event.cuts[event.cuts.length - 1]!, event.dealer);
          break;
        case 'dealt':
          this.dealBeats(after, event.dealer);
          break;
        case 'laid-away':
          this.layAwayBeat(event.seat, event.cards);
          break;
        case 'starter':
          this.beat(0.75, () => {
            this.model.starter = event.card;
            this.model.stock = 39;
            this.options.sound.flip();
            this.announce(`The starter is the ${cardName(event.card)}.`);
          });
          break;
        case 'played':
          this.playedBeat(event.seat, event.card, event.count, event.combos);
          break;
        case 'scored':
          this.scoredBeat(event);
          break;
        case 'go':
          this.beat(0.8, () => {
            this.callout(
              'Go',
              event.seat === YOU ? { x: LAYOUT.centreX, y: 760 } : { x: LAYOUT.centreX, y: 250 },
            );
            this.options.sound.go();
            this.announce(
              event.seat === YOU ? 'You have a go.' : `${this.name(event.seat)} says go.`,
            );
          });
          break;
        case 'count-reset':
          this.beat(0.55, () => {
            this.model.turned = [...this.model.turned, ...this.model.pile];
            this.model.pile = [];
            this.model.count = 0;
            this.announce('The count starts again from nothing.');
          });
          break;
        case 'play-over':
          this.beat(1, () => {
            this.model.turned = [];
            this.model.pile = [];
            this.model.count = 0;
            this.model.yourHand = [...after.kept[YOU]];
            this.model.rivalHand = [...after.kept[RIVAL]];
            this.model.rivalFaceUp = true;
            this.model.playable = null;
            this.announce('The play is over. Time to count.');
          });
          break;
        case 'shown':
          counted = true;
          this.showBeats(event.step, event.count, event.claim);
          break;
        case 'hand-over':
          break;
        case 'game-over':
          this.gameOverBeats(event.winner, event.skunk);
          break;
      }
    }
    if (counted && after.phase !== 'game-over') {
      this.beat(0.45, () => {
        this.model.show = null;
        this.options.hud.setLedger(null);
      });
    }
  }

  private cutForDealBeats(cut: { you: CardId; rival: CardId }, dealer: Seat): void {
    this.beat(1.9, () => {
      this.model.cutForDeal = cut;
      this.options.sound.card();
      this.announce(
        `You cut the ${cardName(cut.you)}; ${this.options.names[1]} cuts the ${cardName(cut.rival)}. Low card deals: ${dealer === YOU ? 'you deal' : `${this.options.names[1]} deals`}.`,
      );
    });
    this.beat(0.5, () => {
      this.model.cutForDeal = null;
      this.callout(dealer === YOU ? 'Your deal' : `${this.options.names[1]} deals`, {
        x: LAYOUT.centreX,
        y: 520,
      });
    });
  }

  private dealBeats(after: MatchState, dealer: Seat): void {
    const yours = [...after.dealt[YOU]];
    const theirs = [...after.dealt[RIVAL]];
    this.beat(0.35, () => {
      this.model.show = null;
      this.model.yourHand = [];
      this.model.rivalHand = [];
      this.model.rivalFaceUp = false;
      this.model.crib = [];
      this.model.pile = [];
      this.model.turned = [];
      this.model.starter = null;
      this.model.count = 0;
      this.model.selected = [];
      this.model.coach = [];
      this.model.stock = 52;
      this.options.hud.setLedger(null);
    });
    this.beat(1.1, () => {
      this.model.dealer = dealer;
      this.model.dealHold.clear();
      // One at a time, the non-dealer first.
      const first = dealer === YOU ? theirs : yours;
      const second = dealer === YOU ? yours : theirs;
      for (let i = 0; i < 6; i++) {
        this.model.dealHold.set(first[i]!, this.now + i * 0.13);
        this.model.dealHold.set(second[i]!, this.now + i * 0.13 + 0.065);
      }
      this.model.yourHand = yours.sort(byRank);
      this.model.rivalHand = theirs;
      this.model.stock = 40;
      this.options.sound.deal(12);
      this.updateStatus();
      this.announce(
        `${dealer === YOU ? 'You deal' : `${this.options.names[1]} deals`}. Your cards: ${yours.map(cardName).join(', ')}.`,
      );
    });
  }

  private layAwayBeat(seat: Seat, cards: readonly CardId[]): void {
    this.beat(0.5, () => {
      if (seat === YOU) {
        this.model.yourHand = this.model.yourHand.filter((card) => !cards.includes(card));
        this.model.selected = [];
        this.model.coach = [];
      } else {
        this.model.rivalHand = this.model.rivalHand.filter((card) => !cards.includes(card));
      }
      this.model.crib = [...this.model.crib, ...cards];
      this.options.sound.card();
      if (seat === RIVAL) this.announce(`${this.options.names[1]} lays away two cards.`);
    });
  }

  private playedBeat(seat: Seat, card: CardId, count: number, combos: readonly PegCombo[]): void {
    if (seat === YOU && combos.some((c) => c.kind === 'thirty-one')) this.tallies.thirtyOnes++;
    this.beat(combos.length > 0 ? 0.5 : 0.62, () => {
      if (seat === YOU) this.model.yourHand = this.model.yourHand.filter((held) => held !== card);
      else this.model.rivalHand = this.model.rivalHand.filter((held) => held !== card);
      this.model.pile = [...this.model.pile, card];
      this.model.count = count;
      this.model.playable = null;
      this.model.coach = [];
      this.coachNote.show(null);
      if (count === 15 || count === 31) this.model.countFlashAt = this.now;
      this.options.sound.card();
      if (count === 31) {
        this.options.sound.thirtyOne();
        if (seat === YOU) this.options.hooks.onMoment({ kind: 'thirty-one' });
      }
      const points = combos.reduce((sum, combo) => sum + combo.points, 0);
      if (points > 0) {
        this.callout(
          pegWords(combos),
          this.pileTop(),
          `+${points} ${seat === YOU ? 'for you' : `for ${this.options.names[1]}`}`,
          this.comboColour(combos),
        );
      }
      this.announce(
        `${seat === YOU ? 'You lay' : `${this.options.names[1]} lays`} the ${cardName(card)}: ${count}.` +
          (points > 0 ? ` ${pegWords(combos)} for ${points}.` : ''),
      );
    });
  }

  private scoredBeat(event: Extract<MatchEvent, { type: 'scored' }>): void {
    const { seat, points, reason } = event;
    if (seat === YOU) {
      if (reason === 'play' || reason === 'go' || reason === 'last-card')
        this.tallies.pegged += points;
      if (reason === 'hand' || reason === 'crib') this.tallies.shown += points;
      if (reason === 'his-heels') this.tallies.hisHeels++;
    }
    this.beat(0.7, () => {
      startLeap(this.model, seat, event.back, event.to, this.now);
      this.options.sound.peg(points);
      const whose = seat === YOU ? 'for you' : `for ${this.options.names[1]}`;
      if (reason === 'his-heels') {
        this.callout(
          'His heels',
          { x: LAYOUT.starter.x + 60, y: LAYOUT.starter.y - 130 },
          `+2 ${whose}`,
        );
        if (seat === YOU) this.options.hooks.onMoment({ kind: 'his-heels' });
      } else if (reason === 'go') {
        this.callout('One for the go', this.pileTop(), `+1 ${whose}`);
      } else if (reason === 'last-card') {
        this.callout('One for last', this.pileTop(), `+1 ${whose}`);
      } else if (reason === 'over-count') {
        this.callout(
          'Over-count',
          { x: LAYOUT.centreX, y: 330 },
          `+2 for ${this.options.names[1]}`,
        );
      }
      this.announce(
        `${seat === YOU ? 'You peg' : `${this.options.names[1]} pegs`} ${points}, to ${event.to}.`,
      );
      this.updateStatus();
    });
  }

  private showBeats(
    step: ShowStep,
    count: HandCount,
    claim: Extract<MatchEvent, { type: 'shown' }>['claim'],
  ): void {
    const whose = this.showTitle(step);
    if (step.seat === YOU) {
      this.tallies.bestCount = Math.max(this.tallies.bestCount, count.total);
      if (claim) {
        this.tallies.claims++;
        if (claim.verdict === 'right') this.tallies.rightClaims++;
      }
    }
    if (!this.claimStaged) this.stageBeat(step, count.hand, false);
    this.claimStaged = false;
    const stepSeconds = 0.75;
    this.beat(0.25, () => {
      const show = this.model.show;
      if (!show) return;
      show.waitingForClaim = false;
      show.combos = count.combos;
      show.step = stepSeconds * this.tempo();
      this.options.hud.setLedger({ title: whose, combos: count.combos, shown: 0, total: 0 });
    });
    let running = 0;
    count.combos.forEach((combo, index) => {
      running += combo.points;
      const total = running;
      this.beat(stepSeconds, () => {
        const show = this.model.show;
        if (!show) return;
        show.active = index;
        show.activeStart = this.now;
        this.options.hud.setLedger({ title: whose, combos: count.combos, shown: index + 1, total });
        this.options.sound.chime(index);
        this.announce(`${comboLabel(combo)}, ${total}.`);
      });
    });
    const perfect = count.total === 29;
    this.beat(perfect ? 3.4 : 1.2, () => {
      const show = this.model.show;
      if (show) show.active = count.combos.length;
      this.options.hud.setLedger({
        title: whose,
        combos: count.combos,
        shown: count.combos.length,
        total: count.total,
        note: this.countNote(step, count, claim),
        perfect,
      });
      this.options.sound.total(count.total);
      if (perfect) {
        if (show) show.gold = 1;
        this.model.celebration = { start: this.now };
        this.options.sound.perfect();
        this.callout(
          'Twenty-nine!',
          { x: LAYOUT.centreX, y: 300 },
          undefined,
          this.options.look().gold,
          true,
          3,
        );
      }
      if (step.seat === YOU) {
        this.options.hooks.onMoment({
          kind: 'counted',
          hand: count.hand,
          starter: count.starter,
          isCrib: step.isCrib,
          total: count.total,
        });
      }
      this.announce(
        `${whose}: ${count.total}${count.total === 0 ? ', nineteen as the old players say' : ''}.`,
      );
    });
    if (perfect) this.beat(0.1, () => (this.model.celebration = null));
  }

  private stageBeat(step: ShowStep, cards: readonly CardId[], waitingForClaim: boolean): void {
    const starter = this.state.starter!;
    this.beat(0.7, () => {
      const show: ShowState = {
        seat: step.seat,
        isCrib: step.isCrib,
        cards: [...cards].sort(byRank),
        starter,
        combos: [],
        active: -1,
        activeStart: this.now,
        step: 0.75,
        gold: 0,
        waitingForClaim,
      };
      this.model.show = show;
      this.model.selected = [];
      this.model.coach = [];
      this.coachNote.show(null);
      this.setPrompt(null);
      if (!waitingForClaim) {
        this.options.hud.setKeys([
          ['Space', 'count faster'],
          ['Esc', 'pause'],
        ]);
      }
      if (step.isCrib) this.model.crib = [];
    });
  }

  private showTitle(step: ShowStep): string {
    if (step.seat === YOU) return step.isCrib ? 'Your crib' : 'Your hand';
    return `${this.options.names[1]}'s ${step.isCrib ? 'crib' : 'hand'}`;
  }

  private countNote(
    step: ShowStep,
    count: HandCount,
    claim: Extract<MatchEvent, { type: 'shown' }>['claim'],
  ): string | undefined {
    if (claim) {
      const said =
        claim.claimed === 19 && claim.read === 0 ? 'nineteen (nothing)' : String(claim.claimed);
      if (claim.verdict === 'right')
        return claim.claimed === 19
          ? 'Nineteen: nothing in it, and you knew it.'
          : `Counted true: ${count.total}.`;
      if (this.state.options.counting === 'classic-1980') {
        return claim.verdict === 'over'
          ? `You said ${said}; it’s really ${count.total}, and ${this.options.names[1]} pegs 2 for the over-count.`
          : `You said ${said}; it was worth ${count.total}. The other ${count.total - claim.read} stay on the table.`;
      }
      return `You said ${said}; it’s ${count.total}. Pegged in full all the same.`;
    }
    if (count.total === 0) {
      return step.seat === YOU
        ? 'Nineteen, as the old players say: not a point in it.'
        : 'Nineteen! Not a point in it.';
    }
    return undefined;
  }

  private gameOverBeats(winner: Seat, skunk: 'none' | 'skunk' | 'double-skunk'): void {
    this.beat(0.8, () => {
      this.options.sound.win();
      this.callout(
        winner === YOU ? 'You win!' : `${this.options.names[1]} wins`,
        { x: LAYOUT.centreX, y: 300 },
        undefined,
        undefined,
        winner === YOU,
        2.4,
      );
    });
    if (skunk !== 'none') {
      this.beat(2.6, () => {
        this.model.stamp = {
          word: skunk === 'double-skunk' ? 'Double skunk' : 'Skunk',
          start: this.now,
        };
        this.options.root.dataset.stamp = 'on';
        this.options.sound.stamp();
      });
    }
    this.beat(0.6, () => {
      delete this.options.root.dataset.stamp;
      this.finish();
    });
  }

  private callout(
    text: string,
    at: { x: number; y: number },
    detail?: string,
    colour?: string,
    golden = false,
    seconds = 1.7,
  ): void {
    this.model.callouts.push({
      text,
      detail,
      at,
      colour: colour ?? this.options.look().glow.fifteen,
      golden,
      start: this.now,
      duration: seconds,
    });
  }

  private comboColour(combos: readonly PegCombo[]): string {
    const glow = this.options.look().glow;
    if (combos.some((c) => c.kind === 'run')) return glow.run;
    if (combos.some((c) => c.kind === 'pair')) return glow.pair;
    return glow.fifteen;
  }

  private pileTop(): { x: number; y: number } {
    const index = Math.max(0, this.model.pile.length - 1);
    return { x: LAYOUT.pileStartX + index * LAYOUT.pileStep, y: LAYOUT.pileY - 150 };
  }

  /** Puts the table straight into the state of the game, for Continue. */
  private syncModel(): void {
    const state = this.state;
    const model = this.model;
    model.dealer = state.dealer;
    model.plates = [...state.scores];
    model.pegs = [
      { at: [state.backPegs[0], state.scores[0]], leap: null },
      { at: [state.backPegs[1], state.scores[1]], leap: null },
    ];
    model.stock = 40;
    model.crib = [...state.crib];
    model.starter = state.starter;
    if (state.phase === 'discard') {
      model.yourHand = hasLaidAway(state, YOU) ? [...state.kept[YOU]] : [...state.dealt[YOU]];
      model.rivalHand = hasLaidAway(state, RIVAL)
        ? [...state.kept[RIVAL]]
        : [...state.dealt[RIVAL]];
    } else if (state.phase === 'play' && state.play) {
      model.yourHand = [...state.play.inHand[YOU]];
      model.rivalHand = [...state.play.inHand[RIVAL]];
      model.pile = [...state.play.pile];
      model.count = state.play.count;
      const inPile = new Set(state.play.pile);
      model.turned = state.play.played
        .map((entry) => entry.card)
        .filter((card) => !inPile.has(card));
    } else {
      model.yourHand = [...state.kept[YOU]];
      model.rivalHand = [...state.kept[RIVAL]];
      model.rivalFaceUp = true;
    }
    // Once the crib has been counted it is gone from its corner.
    if (state.phase === 'hand-over') model.crib = [];
  }

  // —— what happens next ——

  private advance(): void {
    if (this.finished || this.stopped) return;
    const state = this.state;
    switch (state.phase) {
      case 'game-over':
        return;
      case 'discard':
        if (!hasLaidAway(state, RIVAL) && !this.thinking) return this.rivalLaysAway();
        if (!hasLaidAway(state, YOU)) return this.await('lay-away');
        return;
      case 'play':
        if (state.play!.turn === RIVAL) return this.rivalPlays();
        return this.await('play');
      case 'show':
        if (needsClaim(state)) {
          if (!this.claimStaged) return this.stageClaim();
          return this.await('claim');
        }
        return this.apply(showNext(state));
      case 'hand-over':
        return this.await('next-hand');
    }
  }

  private rivalRng() {
    const played = this.state.play?.played.length ?? -1;
    return createRng(`${this.options.seed}:ai:${this.state.hand}:${this.state.phase}:${played}`);
  }

  private rivalLaysAway(): void {
    this.thinking = true;
    const mind = mindFor(this.options.level);
    const thrown = mind.layAway(discardView(this.state, RIVAL), this.rivalRng());
    this.beat(0.4, () => {
      this.thinking = false;
      this.apply(layAway(this.state, RIVAL, thrown));
    });
  }

  private rivalPlays(): void {
    const count = this.state.play!.count;
    this.setPrompt(
      count === 0
        ? `${this.options.names[1]} leads`
        : `${this.options.names[1]} to play · <strong>${count}</strong> on the table`,
    );
    this.options.hud.setKeys([['Esc', 'pause']]);
    const mind = mindFor(this.options.level);
    const card = mind.play(playView(this.state, RIVAL), this.rivalRng());
    this.beat(0.75, () => this.apply(playCard(this.state, RIVAL, card)));
  }

  private stageClaim(): void {
    const step = currentShowStep(this.state)!;
    this.claimStaged = true;
    this.stageBeat(step, cardsShown(this.state, step), true);
    this.beat(0.2);
  }

  /** The attract mode's stand-in for you: it chooses after a moment, like a player would. */
  private autopilotMove(what: Exclude<Waiting, null>, mind: Mind): void {
    const rng = createRng(
      `${this.options.seed}:autopilot:${this.state.hand}:${this.state.play?.played.length ?? -1}`,
    );
    if (what === 'lay-away') {
      const thrown = mind.layAway(discardView(this.state, YOU), rng);
      this.beat(0.9, () => this.apply(layAway(this.state, YOU, thrown)));
    } else if (what === 'play') {
      const card = mind.play(playView(this.state, YOU), rng);
      this.beat(0.75, () => this.apply(playCard(this.state, YOU, card)));
    } else if (what === 'next-hand') {
      this.beat(1.6, () => this.apply(nextHand(this.state)));
    }
  }

  private await(what: Exclude<Waiting, null>): void {
    if (this.options.autopilot) return this.autopilotMove(what, this.options.autopilot);
    if (this.waiting === what) return;
    this.waiting = what;
    const state = this.state;
    switch (what) {
      case 'lay-away': {
        this.model.playable = null;
        this.model.cribSpot = true;
        this.refreshLayAwayPrompt();
        this.focusFirst();
        this.offerCoach();
        this.options.hud.setKeys([
          ['← →', 'choose a card'],
          ['Space', 'pick it'],
          ['T', 'throw to the crib'],
          ['C', 'coach'],
          ['Esc', 'pause'],
        ]);
        break;
      }
      case 'play': {
        this.model.playable = playableCards(state, YOU);
        this.setPrompt(
          state.play!.count === 0
            ? 'Your lead'
            : `Your turn · <strong>${state.play!.count}</strong> on the table`,
        );
        this.focusFirst();
        this.offerCoach();
        this.options.hud.setKeys([
          ['← →', 'choose a card'],
          ['Enter', 'lay it'],
          ['C', 'coach'],
          ['Esc', 'pause'],
        ]);
        this.announce(`Your turn. The count is ${state.play!.count}.`);
        break;
      }
      case 'claim': {
        const step = currentShowStep(state)!;
        this.setPrompt(null);
        this.options.hud.setLedger(null);
        this.claimPad.open(`${this.showTitle(step)}: how many points?`, (value) =>
          this.claim(value),
        );
        this.options.hud.setKeys([
          ['0–9', 'your count'],
          ['Enter', 'count it'],
          ['Esc', 'pause'],
        ]);
        this.announce(`${this.showTitle(step)}. Count it and type your total.`);
        break;
      }
      case 'next-hand': {
        const deal = button('Deal the next hand', () => this.dealNext(), 'Enter');
        deal.dataset.testid = 'ft-next-hand';
        this.setPrompt('The hand is counted.', [deal]);
        this.options.hud.setKeys([
          ['Enter', 'deal the next hand'],
          ['Esc', 'pause'],
        ]);
        deal.focus({ preventScroll: true });
        break;
      }
    }
  }

  private setPrompt(html: string | null, actions: HTMLElement[] = []): void {
    this.options.hud.setPrompt(html, actions);
  }

  private refreshLayAwayPrompt(): void {
    const whose = this.state.dealer === YOU ? 'your crib' : `${this.options.names[1]}'s crib`;
    const chosen = this.model.selected.length;
    const throwButton = button('Throw to the crib', () => this.throwSelected(), 'T');
    throwButton.dataset.testid = 'ft-throw';
    throwButton.disabled = chosen !== 2;
    this.setPrompt(
      `Lay away two cards for <strong>${whose}</strong>${chosen > 0 ? ` · ${chosen} of 2 chosen` : ''}`,
      [throwButton],
    );
  }

  private updateStatus(): void {
    const state = this.state;
    const dealer = state.dealer === YOU ? 'you deal' : `${this.options.names[1]} deals`;
    this.options.hud.setStatus(
      this.options.names[1],
      `Hand ${Math.max(1, state.hand)} · ${dealer} · game to ${state.options.length}`,
    );
  }

  // —— the coach ——

  private offerCoach(): void {
    const state = this.state;
    const key = `${state.hand}:${state.phase}:${state.play?.played.length ?? -1}:${this.waiting}`;
    if (!this.options.coach() || (this.waiting !== 'lay-away' && this.waiting !== 'play')) {
      this.model.coach = [];
      this.coachNote.show(null);
      return;
    }
    if (key === this.coachFor) return;
    this.coachFor = key;
    if (this.waiting === 'lay-away') {
      const options = rankDiscards(state.dealt[YOU], state.dealer === YOU);
      const best = options[0]!;
      this.model.coach = [...best.thrown];
      const sign = state.dealer === YOU ? '+' : '−';
      const line = (option: (typeof options)[number]) =>
        `${option.thrown.map(cardLabel).join(' ')}: hand ${option.handAverage.toFixed(1)}, crib ${sign}${option.cribAverage.toFixed(1)} = ${option.value.toFixed(1)}`;
      this.coachNote.show(
        [
          `Throw ${best.thrown.map(cardLabel).join(' and ')}.`,
          'Average points over every starter:',
          ...options.slice(0, 3).map(line),
        ],
        true,
      );
      return;
    }
    const view = playView(state, YOU);
    const ranked = rankPlays(view, createRng(`${this.options.seed}:coach:${key}`), 48);
    const best = ranked[0];
    if (!best) return;
    this.model.coach = [best.card];
    const next = ranked[1];
    const edge = next ? best.value - next.value : 0;
    this.coachNote.show([
      `Lay the ${cardName(best.card)}.`,
      next && edge > 0.05 && edge < 50
        ? `Looking ahead to the end of the play, it comes out about ${edge.toFixed(1)} ${edge >= 0.95 && edge < 1.05 ? 'point' : 'points'} better than the ${cardName(next.card)}.`
        : next && edge >= 50
          ? 'Looking ahead, it is the card that keeps the game in your hands.'
          : 'Looking ahead, the cards play much the same.',
    ]);
  }

  toggleCoach(on: boolean): void {
    this.coachFor = '';
    if (!on) {
      this.model.coach = [];
      this.coachNote.show(null);
      return;
    }
    this.offerCoach();
  }

  // —— your moves ——

  private activate(card: CardId): void {
    if (this.waiting === 'lay-away') {
      if (!this.model.yourHand.includes(card)) return;
      this.toggleSelected(card);
      return;
    }
    if (this.waiting === 'play') this.playYour(card);
  }

  private toggleSelected(card: CardId): void {
    const selected = this.model.selected;
    if (selected.includes(card)) this.model.selected = selected.filter((held) => held !== card);
    else if (selected.length < 2) this.model.selected = [...selected, card];
    else this.model.selected = [selected[1]!, card];
    this.options.sound.flip();
    this.refreshLayAwayPrompt();
    this.announce(
      `${cardName(card)} ${this.model.selected.includes(card) ? 'chosen for the crib' : 'kept'}. ${this.model.selected.length} of 2 chosen.`,
    );
  }

  /** Chooses these two and throws them (the browser tests' shortcut). */
  layAwayCards(cards: readonly CardId[]): void {
    if (this.waiting !== 'lay-away') return;
    this.model.selected = [...cards];
    this.throwSelected();
  }

  throwSelected(): void {
    if (this.waiting !== 'lay-away' || this.model.selected.length !== 2) return;
    const cards = [...this.model.selected];
    this.waiting = null;
    this.model.cribSpot = false;
    this.coachNote.show(null);
    this.setPrompt(null);
    this.apply(layAway(this.state, YOU, cards));
  }

  playYour(card: CardId): boolean {
    if (this.waiting !== 'play') return false;
    if (!playableCards(this.state, YOU).includes(card)) {
      this.announce(`The ${cardName(card)} would take the count past 31.`);
      return false;
    }
    this.waiting = null;
    this.setPrompt(null);
    this.coachNote.show(null);
    this.apply(playCard(this.state, YOU, card));
    return true;
  }

  claim(value: number): void {
    if (this.waiting !== 'claim') return;
    this.waiting = null;
    this.claimPad.close();
    this.apply(showNext(this.state, value));
  }

  dealNext(): void {
    if (this.waiting !== 'next-hand') return;
    this.waiting = null;
    this.setPrompt(null);
    this.apply(nextHand(this.state));
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const state = this.state;
    const summary: GameSummary = {
      level: this.options.level,
      length: state.options.length,
      counting: state.options.counting,
      outcome: state.winner === YOU ? 'win' : 'loss',
      skunk:
        state.winner === null
          ? 'none'
          : skunkOf(state.scores[other(state.winner)], state.options.length),
      scores: [...state.scores],
      hands: state.hand,
      thirtyOnes: this.tallies.thirtyOnes,
      hisHeels: this.tallies.hisHeels,
      bestCount: this.tallies.bestCount,
      claims: this.tallies.claims,
      rightClaims: this.tallies.rightClaims,
      pegged: this.tallies.pegged,
      shown: this.tallies.shown,
    };
    this.options.hooks.onEnd(summary, state);
  }

  // —— pointer and keys ——

  private handCardAt(design: { x: number; y: number }): CardId | null {
    const width = cardWidth(CARD.hand);
    // The rightmost card lies on top, so look from the right.
    for (const card of [...this.model.yourHand].reverse()) {
      const at = this.visuals.positionOf(card);
      if (!at) continue;
      if (Math.abs(design.x - at.x) <= width / 2 && Math.abs(design.y - at.y) <= CARD.hand / 2)
        return card;
    }
    return null;
  }

  private pick(point: { x: number; y: number }): CardId | null {
    if (this.waiting !== 'lay-away' && this.waiting !== 'play') return null;
    const design = toDesign(this.options.view.currentFrame, point);
    return this.handCardAt(design);
  }

  private dragTo(card: CardId, point: { x: number; y: number }): void {
    const design = toDesign(this.options.view.currentFrame, point);
    this.model.drag = { card, at: design };
  }

  private drop(card: CardId, point: { x: number; y: number }): void {
    const design = toDesign(this.options.view.currentFrame, point);
    this.model.drag = null;
    const crib = this.state.dealer === YOU ? LAYOUT.crib.you : LAYOUT.crib.rival;
    const pileAnchor = {
      x: LAYOUT.pileStartX + this.model.pile.length * LAYOUT.pileStep,
      y: LAYOUT.pileY,
    };
    const target = snapTarget(
      design,
      [
        { id: 'crib', anchor: crib, accepts: this.waiting === 'lay-away' },
        { id: 'pile', anchor: pileAnchor, accepts: this.waiting === 'play' },
        {
          id: 'pile-wide',
          anchor: { x: LAYOUT.centreX, y: LAYOUT.pileY },
          accepts: this.waiting === 'play',
        },
      ],
      330,
    );
    if (!target) return;
    if (target.id === 'crib') {
      if (!this.model.selected.includes(card)) this.toggleSelected(card);
      if (this.model.selected.length === 2) this.throwSelected();
      return;
    }
    this.playYour(card);
  }

  private placeHandButtons(): void {
    const reachable = this.waiting === 'lay-away' || this.waiting === 'play';
    if (!reachable) {
      this.handButtons.update([]);
      return;
    }
    const width = cardWidth(CARD.hand);
    const playable = this.waiting === 'play' ? playableCards(this.state, YOU) : null;
    this.handButtons.update(
      this.model.yourHand.flatMap((card) => {
        const at = this.visuals.positionOf(card);
        if (!at) return [];
        return [
          {
            card,
            x: at.x,
            y: at.y,
            width,
            height: CARD.hand,
            angle: 0,
            pressed: this.waiting === 'lay-away' ? this.model.selected.includes(card) : undefined,
            unavailable: playable ? !playable.includes(card) : false,
            hint: this.model.coach.includes(card) ? "the coach's pick" : undefined,
          },
        ];
      }),
    );
  }

  private focusFirst(): void {
    const cards = this.model.yourHand;
    if (cards.length === 0) return;
    const playable = this.waiting === 'play' ? playableCards(this.state, YOU) : cards;
    const first = cards.find((card) => playable.includes(card)) ?? cards[0]!;
    this.model.focus = first;
    // The buttons exist once the next frame has placed them.
    requestAnimationFrame(() => {
      if (this.waiting === 'lay-away' || this.waiting === 'play') this.handButtons.focus(first);
    });
  }

  private moveFocus(step: number): void {
    const cards = this.model.yourHand;
    if (cards.length === 0) return;
    const current = this.handButtons.focusedCard() ?? this.model.focus ?? cards[0]!;
    const index = Math.max(0, cards.indexOf(current));
    const next = cards[(index + step + cards.length) % cards.length]!;
    this.model.focus = next;
    this.handButtons.focus(next);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    const inField = (event.target as HTMLElement).closest('input, textarea, select');
    const key = event.key;
    if (this.waiting === 'lay-away' || this.waiting === 'play') {
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        event.preventDefault();
        this.moveFocus(key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      const focused = this.handButtons.focusedCard();
      // In the lay-away, Enter throws once two cards are chosen; Space always picks or puts back.
      if (key === 'Enter' && this.waiting === 'lay-away' && this.model.selected.length === 2) {
        event.preventDefault();
        this.throwSelected();
        return;
      }
      if ((key === 'Enter' || key === ' ') && focused !== null) {
        event.preventDefault();
        this.activate(focused);
        return;
      }
      if ((key === 't' || key === 'T') && this.waiting === 'lay-away') {
        event.preventDefault();
        this.throwSelected();
        return;
      }
    }
    if (this.waiting === 'next-hand' && key === 'Enter' && !inField) {
      event.preventDefault();
      this.dealNext();
      return;
    }
    if (key === ' ' && !inField && this.model.show && !this.idle()) {
      event.preventDefault();
      this.quickening = true;
      return;
    }
    if (key === 'Enter' && !inField && this.model.show && !this.idle()) {
      event.preventDefault();
      this.quickening = true;
    }
  }

  /** For documentation pictures and tests only: puts the pegs where a picture needs them. */
  rig(scores: [number, number]): void {
    this.state = {
      ...this.state,
      scores: [...scores],
      backPegs: [Math.max(0, scores[0] - 4), Math.max(0, scores[1] - 3)],
    };
    this.model.plates = [...scores];
    this.model.pegs = [
      { at: [this.state.backPegs[0], scores[0]], leap: null },
      { at: [this.state.backPegs[1], scores[1]], leap: null },
    ];
  }

  /** For the browser tests: the cards you may act on now. */
  choices(): CardId[] {
    if (this.waiting === 'play') return playableCards(this.state, YOU);
    if (this.waiting === 'lay-away') return [...this.state.dealt[YOU]];
    return [];
  }

  /** For the browser tests: Sharp's choice in your seat. */
  bestMove(): CardId[] {
    if (this.waiting === 'lay-away')
      return [...rankDiscards(this.state.dealt[YOU], this.state.dealer === YOU)[0]!.thrown];
    if (this.waiting === 'play') {
      return [rankPlays(playView(this.state, YOU), createRng('test'), 8)[0]!.card];
    }
    return [];
  }

  /** For the browser tests: the true count of the hand waiting for your claim. */
  trueCount(): number | null {
    if (this.waiting !== 'claim') return null;
    const preview = showNext({
      ...this.state,
      options: { ...this.state.options, counting: 'automatic' },
    });
    const shown = preview.events.find((e) => e.type === 'shown');
    return shown && shown.type === 'shown' ? shown.count.total : null;
  }
}
