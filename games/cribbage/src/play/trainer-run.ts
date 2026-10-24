import { createRng, type Rng } from '@usr-games/kit';
import { cardName } from '@usr-games/kit/cards';
import {
  isRightCount,
  RELAXED_HANDS,
  SPRINT_SECONDS,
  type TrainerHand,
  trainerHand,
} from '../engine/trainer';
import type { Look } from '../render/look';
import type { TableView } from '../render/scene';
import { comboLabel, type Hud } from '../ui/hud';
import { ClaimPad } from '../ui/table-controls';
import { emptyModel, startLeap } from './model';
import type { TableSound } from './sound';
import { Stage } from './stage';

/**
 * The counting trainer at the table: a hand appears on the counting stage, you type its total,
 * and every combination lights up to show how it adds up. Each hand counted right pegs its
 * points on your side of the board, so the board keeps the round's score. The sprint runs for
 * two minutes (the hand in front of you when the time is up still counts); the relaxed round is
 * ten hands with no clock.
 */

export type TrainerMode = 'sprint' | 'relaxed';

export interface TrainerResult {
  mode: TrainerMode;
  right: number;
  hands: number;
  points: number;
  seconds: number;
}

export interface TrainerOptions {
  view: TableView;
  hud: Hud;
  look(): Look;
  reducedMotion(): boolean;
  sound: TableSound;
  announce(text: string): void;
  mode: TrainerMode;
  seed: string;
  onEnd(result: TrainerResult): void;
}

export class TrainerRun {
  private readonly stage: Stage;
  private readonly claimPad = new ClaimPad();
  private readonly rng: Rng;
  private hand: TrainerHand | null = null;
  private right = 0;
  private hands = 0;
  private points = 0;
  private timeUp = false;
  private finished = false;
  private nextReady = false;

  constructor(private readonly options: TrainerOptions) {
    this.rng = createRng(`${options.seed}:trainer`);
    const model = emptyModel(['You', 'Trainer'], 121);
    model.stock = 0;
    this.stage = new Stage(options.view, model, options.look, options.reducedMotion, () =>
      this.tickClock(),
    );
    options.hud.sheet.append(this.claimPad.element);
    options.hud.setPrompt(null);
    options.hud.setKeys([
      ['0–9', 'your count'],
      ['Enter', 'count it, then the next hand'],
      ['Esc', 'pause'],
    ]);
  }

  start(): void {
    this.stage.start();
    this.deal();
  }

  stop(): void {
    this.stage.stop();
    this.claimPad.element.remove();
    this.options.hud.setLedger(null);
  }

  pause(): void {
    this.stage.pause();
  }

  resume(): void {
    this.stage.resume();
  }

  get counted(): number {
    return this.right;
  }

  /** For the browser tests: the total of the hand on the stage. */
  get expected(): number | null {
    return this.claimPad.isOpen ? (this.hand?.count.total ?? null) : null;
  }

  private remaining(): number {
    return Math.max(0, SPRINT_SECONDS - this.stage.now);
  }

  private tickClock(): void {
    const label = this.options.mode === 'sprint' ? 'Two-minute sprint' : 'Ten hands, no clock';
    const left =
      this.options.mode === 'sprint'
        ? `${Math.floor(this.remaining() / 60)}:${String(Math.floor(this.remaining() % 60)).padStart(2, '0')} left`
        : `hand ${Math.min(RELAXED_HANDS, this.hands + 1)} of ${RELAXED_HANDS}`;
    this.options.hud.setStatus('Counting trainer', `${label} · ${left} · ${this.right} right`);
    if (this.options.mode === 'sprint' && !this.timeUp && this.remaining() <= 0) {
      this.timeUp = true;
      this.options.announce('Time is up. Finish this hand.');
    }
  }

  private deal(): void {
    if (this.finished) return;
    const done = this.options.mode === 'sprint' ? this.timeUp : this.hands >= RELAXED_HANDS;
    if (done) return this.end();
    const hand = trainerHand(this.rng);
    this.hand = hand;
    const model = this.stage.model;
    model.show = {
      seat: 0,
      isCrib: hand.isCrib,
      cards: hand.hand,
      starter: hand.starter,
      combos: [],
      active: -1,
      activeStart: this.stage.now,
      step: 0.5,
      gold: 0,
      waitingForClaim: true,
    };
    this.options.hud.setLedger(null);
    this.options.sound.deal(5);
    this.claimPad.open(
      hand.isCrib ? 'A crib: how many points?' : 'A hand: how many points?',
      (value) => this.submit(value),
    );
    this.options.announce(
      `${hand.isCrib ? 'A crib' : 'A hand'}: ${hand.hand.map(cardName).join(', ')}, and the starter, the ${cardName(hand.starter)}.`,
    );
  }

  private submit(value: number): void {
    const hand = this.hand;
    if (!hand) return;
    this.claimPad.close();
    this.hands++;
    const right = isRightCount(value, hand.count.total);
    if (right) {
      this.right++;
      this.points += hand.count.total;
    }
    const model = this.stage.model;
    const show = model.show!;
    show.waitingForClaim = false;
    show.combos = hand.count.combos;
    const title = hand.isCrib ? 'The crib' : 'The hand';
    const combos = hand.count.combos;
    let running = 0;
    combos.forEach((combo, index) => {
      running += combo.points;
      const total = running;
      this.stage.after(0.3 + index * 0.45, () => {
        show.active = index;
        show.activeStart = this.stage.now;
        this.options.hud.setLedger({ title, combos, shown: index + 1, total });
        this.options.sound.chime(index);
      });
    });
    const settle = 0.3 + combos.length * 0.45 + 0.2;
    this.stage.after(settle, () => {
      show.active = combos.length;
      const total = hand.count.total;
      const note = right
        ? value === 19 && total === 0
          ? 'Nineteen: nothing in it. Right!'
          : `Right: ${total}.`
        : `You said ${value}; it’s ${total}${total === 0 ? ' (nineteen, as the old players say)' : ''}.`;
      this.options.hud.setLedger({ title, combos, shown: combos.length, total, note });
      this.options.sound.total(total);
      if (right && total > 0) {
        const from =
          model.pegs[0].at[0] > model.pegs[0].at[1] ? model.pegs[0].at[0] : model.pegs[0].at[1];
        const back = Math.min(model.pegs[0].at[0], model.pegs[0].at[1]);
        startLeap(model, 0, back, Math.min(121, from + total), this.stage.now);
        this.options.sound.peg(total);
      }
      this.options.announce(`${note} ${combos.map(comboLabel).join(', ')}.`);
      this.nextReady = true;
      this.stage.after(right ? 1.3 : 2.4, () => this.next());
    });
  }

  /** Enter after a hand is counted moves straight on to the next. */
  next(): void {
    if (!this.nextReady || this.finished) return;
    this.nextReady = false;
    this.stage.clearTimers();
    this.deal();
  }

  private end(): void {
    if (this.finished) return;
    this.finished = true;
    this.claimPad.close();
    this.options.onEnd({
      mode: this.options.mode,
      right: this.right,
      hands: this.hands,
      points: this.points,
      seconds: Math.round(this.stage.now),
    });
  }
}
