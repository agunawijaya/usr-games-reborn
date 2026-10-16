import { createRng, type Drone, type Patch, type Synth } from '@usr-games/kit';
import type { BoardId } from '../boards/themes';
import type { GameEvent, GameState } from '../engine/types';
import { TUNES, barPatch, barSeconds } from './music';
import {
  BACK,
  BEDS,
  BID,
  BUILD,
  BUY,
  CALLS,
  CARD,
  DEAL,
  DEBT,
  DICE,
  DISTRICT,
  FREE,
  GAVEL,
  LANDMARK,
  LOCKUP,
  NO_DEAL,
  OUT,
  SALARY,
  SELECT,
  STEP,
  coinsPatch,
  finale,
} from './patches';

/**
 * The table's sound: the board's bed and its calls now and then, the board's tune, and the
 * sounds of play. Sound effects and music are the player's two switches; the Hall's volume and
 * mute sit over both. Everything stops while the game is paused, and the tune plays a bar at a
 * time so a pause silences it within a bar.
 */

export interface SoundPrefs {
  readonly effects: boolean;
  readonly music: boolean;
}

const TICK_MS = 100;

export class TableSound {
  private board: BoardId = 'harbour';
  private bed: Drone | null = null;
  /** A scene is up (the menu's town or a game), so the bed and the tune may play. */
  private live = false;
  private paused = false;
  private readonly rng = createRng('monop:sound');
  private calls: number[] = [];
  private bar = 0;
  private restBars = 0;
  private nextBarAt = 0;
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly synth: Synth,
    private readonly prefs: () => SoundPrefs,
  ) {
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  destroy(): void {
    clearInterval(this.timer);
    this.bed?.stop(0.3);
    this.bed = null;
  }

  setBoard(board: BoardId): void {
    if (board === this.board) return;
    this.board = board;
    this.bed?.stop(1.2);
    this.bed = null;
    this.calls = [];
    this.bar = 0;
    this.restBars = 1;
    this.refresh();
  }

  setLive(live: boolean): void {
    this.live = live;
    this.refresh();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.refresh();
  }

  /** Brings the bed in line with the switches; call after the player changes them. */
  refresh(): void {
    const wanted = this.live && !this.paused && this.prefs().effects;
    if (wanted && !this.bed) this.bed = this.synth.drone(BEDS[this.board]);
    if (!wanted && this.bed) {
      this.bed.stop(0.8);
      this.bed = null;
    }
  }

  /** Lets the browser start audio: call from a key press or a click. */
  wake(): void {
    void this.synth.resume();
    this.refresh();
  }

  private play(patch: Patch): void {
    if (!this.paused && this.prefs().effects) this.synth.play(patch);
  }

  private tick(): void {
    if (!this.live || this.paused) return;
    const now = performance.now() / 1000;
    if (this.prefs().effects) {
      CALLS[this.board].forEach((call, i) => {
        const due = this.calls[i];
        if (due === undefined) {
          this.calls[i] = now + this.rng.float(...call.every) * 0.6;
          return;
        }
        if (now < due) return;
        this.synth.play(call.patch);
        this.calls[i] = now + this.rng.float(...call.every);
      });
    }
    if (!this.prefs().music) return;
    const tune = TUNES[this.board];
    const length = barSeconds(tune);
    // After a pause the tune picks up from where it was, not from where the clock is.
    if (this.nextBarAt < now - length) this.nextBarAt = now;
    if (now < this.nextBarAt) return;
    this.nextBarAt += length;
    if (this.restBars > 0) {
      this.restBars -= 1;
      return;
    }
    this.synth.play(barPatch(tune, this.bar));
    this.bar += 1;
    if (this.bar >= tune.bars.length) {
      this.bar = 0;
      this.restBars = tune.rest;
    }
  }

  // —— the sounds of play ——

  /** The sound for one of the engine's events, as the director shows it. */
  event(event: GameEvent, state: GameState): void {
    const person = (seat: number) => state.seats[seat]?.kind === 'human';
    switch (event.type) {
      case 'rolled':
        return this.play(DICE);
      case 'salary':
        return person(event.seat) ? this.play(SALARY) : undefined;
      case 'bought':
        return this.play(BUY[this.board]);
      case 'rent':
        return this.play(
          coinsPatch(person(event.to), person(event.to) || person(event.from) ? 0.16 : 0.09),
        );
      case 'transfer':
        return this.play(coinsPatch(person(event.to), 0.1));
      case 'paid':
        return this.play(coinsPatch(false, 0.07));
      case 'collected':
        return this.play(coinsPatch(person(event.seat), 0.1));
      case 'card':
        return this.play(CARD);
      case 'auctionOpened':
        return this.play(GAVEL);
      case 'bid':
        return this.play(BID);
      case 'auctionWon':
        return event.seat === null ? undefined : this.play(GAVEL);
      case 'built':
        return event.level < 5 ? this.play(BUILD[this.board]) : undefined;
      case 'lockup':
        return this.play(LOCKUP);
      case 'free':
        return this.play(FREE);
      case 'debt':
        return person(event.seat) ? this.play(DEBT) : undefined;
      case 'traded':
        return this.play(DEAL);
      case 'declinedTrade':
        return person(event.offer.from) || person(event.offer.to) ? this.play(NO_DEAL) : undefined;
      case 'resigned':
        return this.play(OUT);
      default:
        return undefined;
    }
  }

  /** A token's hop from one space to the next. */
  step(): void {
    this.play(STEP);
  }

  landmark(): void {
    this.play(LANDMARK[this.board]);
  }

  district(): void {
    this.play(DISTRICT);
  }

  finale(won: boolean): void {
    this.play(finale(won));
  }

  select(): void {
    this.play(SELECT);
  }

  back(): void {
    this.play(BACK);
  }
}
