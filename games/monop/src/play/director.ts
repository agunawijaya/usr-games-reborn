import { Vector3 } from 'three';
import { BOARDS, SEAT_COLOURS } from '../boards/themes';
import { cardText } from '../engine/cards';
import { GROUPS, groupOf } from '../engine/state';
import type { DeckId } from '../boards/layout';
import type { Action, GameEvent } from '../engine/types';
import type { TableSound } from '../sound/table';
import type { CameraRig } from '../render/world/camera';
import type { BoardWorld, CameraShot, WorldState } from '../render/world/world';
import type { PlaySession, Stagehand } from './session';
import { describe, who } from './words';

/**
 * The director turns the engine's events into moments on screen: the dice tumble in the tray,
 * the token walks the street a space at a time with the camera following, coins rise from a
 * lot when rent is paid, a storey goes up in steps like stop-motion, and the first landmark in
 * a district sets off the board's celebration. A district made whole hangs bunting along its
 * street; a player in debt has sale boards on their lots; the end of the game lights the
 * winner's lots. Every moment takes the time the simulated clock gives it (NOTES.md, "The
 * clock"), scaled by the pace, cut short for reduced motion, and skippable with Enter.
 */

export interface DirectorHooks {
  /** Redraw the panels. */
  refresh(session: PlaySession): void;
  /** A district has come alive: the screen clears its lists so the moment can be seen. */
  momentStarts(): void;
  /** A coin amount rising from a point on the screen: green when it comes to you, red when it leaves you. */
  pop(x: number, y: number, amount: number, tone: Tone): void;
  /** Coins flying from one seat's token to another seat's purse. */
  arc?(from: number, to: number, amount: number): void;
  /** Where a space is on the screen when the flat map is showing; null for the town. */
  spacePoint?(space: number): { x: number; y: number; ahead: boolean } | null;
  reducedMotion(): boolean;
  /** Camera moves and full-length celebrations; off keeps the overview. */
  cinematics(): boolean;
  readonly sound?: TableSound;
}

export type Tone = 'gain' | 'loss' | 'neutral';

export interface ShownCard {
  readonly deckName: string;
  readonly text: string;
  readonly deck: DeckId;
}

export interface Moment {
  readonly kicker: string;
  readonly title: string;
  readonly detail: string;
}

/** Seconds each kind of moment holds the table, before the pace is applied. */
const HOLD: Partial<Record<GameEvent['type'], number>> = {
  rolled: 1.25,
  salary: 0.5,
  bought: 1.3,
  rent: 1.4,
  transfer: 0.8,
  paid: 1.1,
  collected: 0.8,
  auctionOpened: 0.6,
  bid: 0.7,
  auctionWon: 1.2,
  sold: 0.6,
  mortgaged: 0.6,
  lockup: 1.2,
  free: 0.6,
  debt: 0.4,
  traded: 1.6,
  resigned: 1.5,
  over: 1,
  turn: 0.35,
};
const CARD_SECONDS = 3;
const SECONDS_PER_SPACE = 0.28;
const BUILD_SECONDS = 1.2;
const LANDMARK_SECONDS = 4.2;
/** Construction is shown in steps, like stop-motion, which suits the miniature and keeps rebuilding cheap. */
const BUILD_STEPS = 8;

export class Director implements Stagehand {
  /** Banner over the board: what is happening now. */
  banner: { dice?: readonly [number, number]; text: string } | null = null;
  /** The last few things that happened, newest first. */
  log: string[] = [];
  card: ShownCard | null = null;
  moment: Moment | null = null;
  pace = 1;
  private paused = false;
  private walking = new Map<number, { at: number; hop: number }>();
  private construction: { space: number; progress: number } | null = null;
  private skipCard: (() => void) | null = null;
  private readonly landmarked = new Set<number>();
  private throws = 0;
  /** Districts already held whole, so each is announced once. */
  private whole: Set<number> | null = null;
  /** Who owned each lot when the picture was last drawn, to see what a resignation cleared. */
  private shownOwners: readonly (number | null)[] = [];
  /** The winner's colour over their lots at the end. */
  private beacon: { seat: number; colour: string } | null = null;
  private skipping = false;

  constructor(
    private readonly world: BoardWorld,
    private readonly rig: CameraRig,
    private readonly hooks: DirectorHooks,
  ) {}

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Lets the person close a card early. */
  dismissCard(): void {
    this.skipCard?.();
  }

  /** Cuts the moment on screen short: a walk, a building going up, a celebration. */
  skip(): void {
    this.skipping = true;
    this.skipCard?.();
  }

  /** The world's picture of the session as shown so far. */
  draw(session: PlaySession): void {
    const picture = this.worldState(session);
    this.shownOwners = picture.owners;
    // Districts whole, and landmarks standing, when play begins (a scenario's table, a saved
    // game) are not news.
    if (this.whole === null) {
      this.world.setProgress(this.progress(session), session.display.round);
      this.whole = new Set(picture.wholeDistricts);
      GROUPS.forEach((lots, group) => {
        if (lots.some((s) => picture.levels[s] === 5)) this.landmarked.add(group);
      });
    }
    this.world.show(picture);
  }

  /** How far through the game it is, 0–1; a Classic game counts forty rounds as a long day. */
  private progress(session: PlaySession): number {
    const rules = session.state.rules;
    const rounds = rules.mode === 'classic' ? 40 : rules.rounds;
    return Math.min(1, session.display.round / rounds);
  }

  /** Districts held whole in the picture, by group. */
  private wholeDistricts(session: PlaySession): number[] {
    const owners = session.display.owners;
    return GROUPS.flatMap((lots, group) => {
      const owner = owners[lots[0]!] ?? null;
      return owner !== null && lots.every((s) => owners[s] === owner) ? [group] : [];
    });
  }

  private worldState(session: PlaySession): WorldState {
    const { display, state } = session;
    const theme = BOARDS[state.board];
    const tokens = state.seats.flatMap((seat, index) => {
      if (display.out[index]) return [];
      const walking = this.walking.get(index);
      return [
        {
          seat: index,
          token: seat.token,
          colour: SEAT_COLOURS[index]!,
          at: walking?.at ?? display.positions[index]!,
          hop: walking?.hop ?? 0,
        },
      ];
    });
    const debtors = display.coins.flatMap((coins, seat) =>
      coins < 0 && !display.out[seat] ? [seat] : [],
    );
    return {
      owners: display.owners,
      levels: display.levels,
      mortgaged: display.mortgaged,
      seatColours: SEAT_COLOURS,
      seatTokens: state.seats.map((s) => s.token ?? theme.tokens[0]!.id),
      tokens,
      ...(this.construction ? { construction: this.construction } : {}),
      wholeDistricts: this.wholeDistricts(session),
      ...(debtors.length ? { debtors } : {}),
      ...(this.beacon ? { beacon: this.beacon } : {}),
    };
  }

  // —— time ——

  wait(seconds: number): Promise<void> {
    return this.tween(seconds, () => {});
  }

  /** Runs `step` every frame with progress 0–1 for `seconds` on the table's clock. */
  private tween(seconds: number, step: (p: number) => void): Promise<void> {
    const total = Math.max(0, seconds) / this.pace;
    if (total === 0) {
      step(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let elapsed = 0;
      const stop = this.world.stage.onTick((dt) => {
        if (this.paused) return;
        elapsed += dt;
        const p = this.skipping ? 1 : Math.min(1, elapsed / total);
        step(p);
        if (p >= 1) {
          this.skipping = false;
          stop();
          resolve();
        }
      });
    });
  }

  private hold(event: GameEvent): number {
    const base = HOLD[event.type] ?? 0;
    return this.hooks.reducedMotion() ? base * 0.6 : base;
  }

  // —— camera ——

  /** The whole board from the corner the start is on, the table's resting view. */
  overview(): CameraShot {
    return { target: new Vector3(0, 0, 3), distance: 108, elevation: 0.86, azimuth: 0.6 };
  }

  /** Close on a point by a lot, from the park side, so its front and sign face the camera. */
  private near(point: Vector3, space: number, distance = 52, elevation = 0.62): CameraShot {
    const lot = this.world.layout.lots[space]!;
    const inward = Math.atan2(-lot.out.x, -lot.out.z);
    return {
      target: point.clone().setY(Math.max(1.2, point.y)),
      distance,
      elevation,
      azimuth: inward + 0.5,
    };
  }

  private follow(seat: number, space: number): void {
    if (!this.hooks.cinematics()) return;
    const position = this.world.tokenPosition(seat);
    if (!position) return;
    // Each board says how: the colony's lots stand out on the rim, so its camera looks further out.
    const shot = this.world.followShot;
    const lot = this.world.layout.lots[space]!;
    position.addScaledVector(lot.out, shot.outward);
    this.rig.aim(this.near(position, space, shot.distance, shot.elevation), 1.4);
  }

  // —— the moments ——

  async play(event: GameEvent, session: PlaySession): Promise<void> {
    this.hooks.sound?.event(event, session.state);
    const line = describe(event, session.state);
    if (line && event.type !== 'card') {
      this.log = [line, ...this.log].slice(0, 4);
      this.banner = { text: line, ...(event.type === 'rolled' ? { dice: event.dice } : {}) };
    }
    switch (event.type) {
      case 'turn':
        this.rig.aim(this.overview(), 0.8);
        this.world.setProgress(this.progress(session), session.display.round);
        this.banner = {
          text: `${who(session.state, event.seat) === 'You' ? 'Your' : `${who(session.state, event.seat)}'s`} turn`,
        };
        break;
      case 'rolled':
        this.world.throwDice(
          event.dice,
          this.hooks.reducedMotion() ? 0 : 1.1 / this.pace,
          ++this.throws,
        );
        break;
      case 'moved':
        this.hooks.refresh(session);
        await this.walk(event.seat, event.from, event.steps, session);
        this.draw(session);
        this.hooks.refresh(session);
        return;
      case 'resigned': {
        // Lots handed back to the bank settle into empty plots in a little dust.
        const cleared = this.shownOwners.flatMap((owner, space) =>
          owner === event.seat && event.to === null ? [space] : [],
        );
        this.draw(session);
        if (!this.hooks.reducedMotion()) this.world.puff(cleared);
        break;
      }
      case 'bought':
      case 'auctionWon':
      case 'traded':
        this.draw(session);
        this.popFor(event, session);
        await this.announceDistricts(session);
        break;
      case 'mortgaged':
      case 'sold':
        this.draw(session);
        break;
      case 'card':
        await this.showCard(event.deck, event.card, session);
        return;
      case 'built':
        await this.build(event.space, event.level, event.seat, session);
        return;
      case 'lockup':
        this.draw(session);
        this.follow(event.seat, 10);
        break;
      default:
        break;
    }
    if (event.type !== 'bought' && event.type !== 'auctionWon' && event.type !== 'traded')
      this.popFor(event, session);
    this.hooks.refresh(session);
    await this.wait(this.hold(event));
  }

  /** A district newly held whole: bunting goes up along its street and the table hears it. */
  private async announceDistricts(session: PlaySession): Promise<void> {
    const now = this.wholeDistricts(session);
    const known = this.whole ?? new Set<number>();
    const fresh = now.filter((group) => !known.has(group));
    this.whole = new Set(now);
    for (const group of fresh) {
      const lots = GROUPS[group]!;
      const owner = session.display.owners[lots[0]!]!;
      const theme = BOARDS[session.state.board];
      const name = who(session.state, owner);
      this.hooks.momentStarts();
      this.moment = {
        kicker: 'District complete',
        title: `${theme.groups[group]!.name} is whole`,
        detail: `${name === 'You' ? 'Yours' : `${name}'s`} now: its rent doubles, and it can be built on`,
      };
      this.hooks.sound?.district();
      if (this.hooks.cinematics() && !this.hooks.reducedMotion()) {
        const middle = lots[Math.floor(lots.length / 2)]!;
        this.rig.aim(this.near(this.world.lotPoint(middle, 2), middle, 58, 0.55), 1.4);
      }
      this.hooks.refresh(session);
      await this.wait(this.hooks.reducedMotion() ? 1 : 1.8);
      this.moment = null;
      this.hooks.refresh(session);
    }
  }

  /**
   * The end of the game: the camera rises over the whole town at dusk and the winner's lots
   * light up in their colour. Short without cinematics, and Enter skips it.
   */
  async victory(session: PlaySession, seat: number, won: boolean): Promise<void> {
    this.beacon = { seat, colour: SEAT_COLOURS[seat]! };
    this.draw(session);
    this.hooks.sound?.finale(won);
    const name = who(session.state, seat);
    this.hooks.momentStarts();
    this.moment = {
      kicker: 'The final reckoning',
      title: name === 'You' ? 'The town is yours' : `${name} takes the town`,
      detail: 'Every lot they own lit in their colour',
    };
    this.hooks.refresh(session);
    const full = this.hooks.cinematics() && !this.hooks.reducedMotion();
    if (full)
      this.rig.aim(
        { target: new Vector3(0, 0, 0), distance: 150, elevation: 1.02, azimuth: 0.95 },
        0.45,
      );
    await this.wait(full ? 3.4 : 1.4);
    this.moment = null;
  }

  async say(seat: number, line: string, action: Action, session: PlaySession): Promise<void> {
    const person = (s: number) => session.state.seats[s]!.kind === 'human';
    const involvesPerson =
      (action.type === 'propose' && person(action.offer.to)) ||
      (action.type === 'answer' &&
        session.state.phase.kind === 'trade' &&
        person(session.state.phase.offer.from));
    this.banner = { text: `${who(session.state, seat)}: “${line}”` };
    this.hooks.refresh(session);
    // The trade table shows a line meant for the person; between rivals it is a passing remark.
    await this.wait(involvesPerson ? 0.4 : 2.2);
  }

  refresh(session: PlaySession): void {
    this.hooks.refresh(session);
  }

  private async walk(
    seat: number,
    from: number,
    steps: number,
    session: PlaySession,
  ): Promise<void> {
    if (steps === 0 || this.hooks.reducedMotion()) {
      this.walking.delete(seat);
      this.draw(session);
      this.follow(seat, session.display.positions[seat]!);
      await this.wait(steps === 0 ? 0.6 : 0.3);
      return;
    }
    const distance = Math.abs(steps);
    const direction = Math.sign(steps);
    let hops = 0;
    await this.tween(0.4 + distance * SECONDS_PER_SPACE, (p) => {
      const travelled = Math.min(distance, p * (distance + 0.4));
      const whole = Math.floor(travelled);
      if (whole > hops) {
        hops = whole;
        this.hooks.sound?.step();
      }
      const at = (from + direction * travelled + 40) % 40;
      this.walking.set(seat, { at, hop: travelled - whole });
      this.draw(session);
      this.follow(seat, Math.floor(at) % 40);
    });
    this.walking.delete(seat);
  }

  private async showCard(deck: DeckId, card: number, session: PlaySession): Promise<void> {
    const theme = BOARDS[session.state.board];
    this.card = {
      deck,
      deckName: theme.decks[deck],
      text: cardText(session.state.board, deck, card),
    };
    this.log = [`Drew a ${theme.decks[deck]} card`, ...this.log].slice(0, 4);
    this.hooks.refresh(session);
    await Promise.race([
      this.wait(CARD_SECONDS),
      new Promise<void>((resolve) => (this.skipCard = resolve)),
    ]);
    this.skipCard = null;
    this.card = null;
    this.hooks.refresh(session);
  }

  private async build(
    space: number,
    level: number,
    seat: number,
    session: PlaySession,
  ): Promise<void> {
    // A landmark is framed from further back and lower, with room above it for the celebration;
    // each board says how (the colony's dome wants its planet behind, the book its lamp-lit page).
    const landmark = level === 5;
    const shot = this.world.landmarkShot;
    const point = this.world.lotPoint(space, landmark ? shot.height : 3);
    if (this.hooks.cinematics())
      this.rig.aim(
        this.near(point, space, landmark ? shot.distance : 46, landmark ? shot.elevation : 0.62),
        1.6,
      );
    if (!this.hooks.reducedMotion()) {
      let shownStep = -1;
      await this.tween(BUILD_SECONDS, (p) => {
        const step = Math.min(BUILD_STEPS, Math.floor(p * BUILD_STEPS));
        if (step === shownStep) return;
        shownStep = step;
        this.construction = { space, progress: Math.max(0.05, step / BUILD_STEPS) };
        this.draw(session);
      });
    }
    this.construction = null;
    this.draw(session);
    this.popFor({ type: 'built', seat, space, level }, session);
    this.hooks.refresh(session);
    const group = groupOf(space);
    if (level === 5 && group !== null && !this.landmarked.has(group)) {
      this.landmarked.add(group);
      await this.celebrate(space, group, seat, session);
      return;
    }
    await this.wait(0.5);
  }

  /** The board's signature moment, the first time a district gets its landmark. */
  private async celebrate(
    space: number,
    group: number,
    seat: number,
    session: PlaySession,
  ): Promise<void> {
    const theme = BOARDS[session.state.board];
    const lots = GROUPS[group]!.length;
    this.hooks.momentStarts();
    this.moment = {
      kicker: this.landmarked.size === 1 ? 'First landmark' : 'Landmark',
      title: `${theme.groups[group]!.name} comes alive`,
      detail: `${theme.spaces[space]} · ${who(session.state, seat) === 'You' ? `you own all ${lots === 2 ? 'both' : lots} streets` : `${who(session.state, seat)} owns the district`}`,
    };
    this.hooks.refresh(session);
    this.hooks.sound?.landmark();
    const reduced = this.hooks.reducedMotion();
    let shown = -1;
    await this.tween(reduced ? 1.5 : LANDMARK_SECONDS, (p) => {
      const moment = Math.round(p * LANDMARK_SECONDS * 20) / 20;
      if (reduced || moment === shown) return;
      shown = moment;
      this.world.celebrate(space, moment);
    });
    this.world.celebrate(null);
    this.moment = null;
    this.hooks.refresh(session);
  }

  /** Coins rising from where they changed hands. */
  private popFor(event: GameEvent, session: PlaySession): void {
    const person = (s: number) => session.state.seats[s]!.kind === 'human';
    const at = (space: number, amount: number, tone: Tone) => {
      const point =
        this.hooks.spacePoint?.(space) ?? this.world.screenPoint(this.world.lotPoint(space, 4));
      if (point.ahead) this.hooks.pop(point.x, point.y, amount, tone);
    };
    const mine = (seat: number, gain: boolean): Tone =>
      !person(seat) ? 'neutral' : gain ? 'gain' : 'loss';
    switch (event.type) {
      case 'rent':
        at(event.space, event.amount, person(event.to) ? 'gain' : mine(event.from, false));
        if (!this.hooks.reducedMotion()) this.hooks.arc?.(event.from, event.to, event.amount);
        return;
      case 'bought':
        at(event.space, event.price, mine(event.seat, false));
        return;
      case 'salary':
        at(0, event.amount, mine(event.seat, true));
        return;
      case 'paid':
        at(session.display.positions[event.seat]!, event.amount, mine(event.seat, false));
        return;
      case 'collected':
        at(session.display.positions[event.seat]!, event.amount, mine(event.seat, true));
        return;
      default:
        return;
    }
  }
}
