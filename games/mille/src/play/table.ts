import { type Driver, driverCoup, driverDecide, newDriver } from '../ai/players';
import { cloneHand } from '../ai/sly';
import { CARD_COPY } from '../content/cards';
import { narrate, reasonFor } from '../content/narration';
import {
  type Kind,
  type Safety,
  DISTANCES,
  SAFETIES,
  familyOf,
  isDistance,
  isHazard,
  isSafety,
} from '../engine/cards';
import {
  type Action,
  type HandEvent,
  type HandState,
  type Side,
  PICK_SLOT,
  canCoup,
  mustDraw,
  other,
  playVerdict,
  seatsOf,
} from '../engine/hand';
import { bankedTotals, type MatchState, step } from '../engine/match';
import { scoreSide } from '../engine/score';
import { CARD_ASPECT } from '../render/card-art';
import { drawBanner, drawCoupBurst } from '../render/effects';
import type { Rect, TableLayout } from '../render/layout';
import type { Look } from '../render/look';
import { alpha, easeInOut, easeOutCubic } from '../render/paint';
import type { Route } from '../render/routes';
import { Stage } from '../render/stage';
import type { FlyingCard } from '../render/table';
import { h } from '../ui/dom';
import { Hud } from '../ui/hud';
import { confirmDialog } from '../ui/dialogs';
import type { DriverClient } from './driver-client';
import { RoadMotion } from './road-motion';
import { type TableSound, cueFor } from './sound';
import { handView, sideView } from './view';

/**
 * The table in play: the match, the beats that animate each thing that happens, the road's
 * motion, and the player's hands on it all (pointer, drag, keys). It knows nothing of menus;
 * the app gives it hooks for what lies around a hand.
 */

export interface TableHooks {
  look(): Look;
  reducedMotion(): boolean;
  helper(): boolean;
  route(handNo: number): Route;
  names: readonly string[];
  /** e.g. "Quick hand · Classic". */
  modeLine(): string;
  sound: TableSound;
  drivers: DriverClient;
  /** After every settled move: the moment to save. */
  onProgress(match: MatchState): void;
  /** Something happened (for packages and records along the way). */
  onEvents?(events: readonly HandEvent[], match: MatchState): void;
  /** The hand is over and has been scored: the app shows the score sheet. */
  onHandOver(match: MatchState): void;
}

const HUMAN = 0;

interface Beat {
  ms: number;
  elapsed: number;
  started: boolean;
  begin?: () => void;
  flying?: (t: number) => FlyingCard[];
  hidden?: string[];
  overlay?: (ctx: CanvasRenderingContext2D, layout: TableLayout, t: number) => void;
  end?: () => void;
  /** Held after its time until this is true (a car still driving to the flag). */
  until?: () => boolean;
}

type Mode = 'idle' | 'play' | 'coup' | 'extension' | 'thinking' | 'over' | 'paused';

export class Table {
  readonly element = h('div', { class: 'dt-table' });
  private readonly stage: Stage;
  private readonly hud = new Hud();
  private readonly controls = h('div', { class: 'dt-controls' });
  private readonly handButtons: HTMLButtonElement[] = [];
  private readonly tip = h('p', { class: 'dt-tip', role: 'note', hidden: true });
  private readonly actionBar = h('div', { class: 'dt-actions', hidden: true });
  private readonly prompt = h('div', { class: 'dt-prompt', hidden: true });
  private readonly log = h('p', { class: 'dt-sr', 'aria-live': 'polite' });
  private shown: HandState;
  private motion: RoadMotion;
  private beats: Beat[] = [];
  private mode: Mode = 'idle';
  private selected: number | null = null;
  private hovered: number | null = null;
  /** The hand slot the tip is speaking about, while it shows. */
  private tipSlot: number | null = null;
  private hoverTarget: string | null = null;
  private drag: { slot: number; x: number; y: number; moved: boolean; pointer: number } | null =
    null;
  private caption = '';
  private frame = 0;
  private last = 0;
  private timer = 0;
  private destroyed = false;
  private pausedMode: Mode | null = null;
  /** The coup fourré window the player has already turned down. */
  private passedWindow: HandState['coupWindow'] = null;
  private dialogOpen = false;
  /** Tests and the workbench can let Classic play the player's seat. */
  private autopilot: Driver | null = null;
  private readonly keys = (event: KeyboardEvent) => this.onKey(event);
  private readonly resize: ResizeObserver;

  constructor(
    host: HTMLElement,
    private match: MatchState,
    private readonly hooks: TableHooks,
  ) {
    this.stage = new Stage(hooks.look());
    this.shown = cloneHand(match.hand);
    this.motion = new RoadMotion(this.shown);
    this.element.append(
      this.stage.canvas,
      this.hud.element,
      this.controls,
      this.tip,
      this.actionBar,
      this.prompt,
      this.log,
    );
    this.buildControls();
    host.append(this.element);
    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(this.element);
    this.onResize();
    window.addEventListener('keydown', this.keys);
    this.hooks.sound.ambience(this.route().id);
    this.last = performance.now();
    this.frame = requestAnimationFrame((now) => this.tick(now));
    this.advance();
  }

  get current(): MatchState {
    return this.match;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    window.removeEventListener('keydown', this.keys);
    this.resize.disconnect();
    this.hooks.sound.stop();
    this.element.remove();
  }

  /** The next hand of a game has been dealt: show it fresh. */
  newHand(match: MatchState): void {
    this.match = match;
    this.shown = cloneHand(match.hand);
    this.motion.reset(this.shown);
    this.passedWindow = null;
    this.selected = null;
    this.mode = 'idle';
    this.hooks.sound.ambience(this.route().id);
    this.advance();
  }

  setLook(): void {
    this.stage.setLook(this.hooks.look());
    this.element.dataset.look = this.hooks.look().name;
  }

  pause(): void {
    if (this.mode === 'paused') return;
    this.pausedMode = this.mode;
    this.mode = 'paused';
    clearTimeout(this.timer);
    this.hooks.sound.stop();
    this.refresh();
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = this.pausedMode ?? 'idle';
    this.pausedMode = null;
    this.last = performance.now();
    this.hooks.sound.ambience(this.route().id);
    if (this.mode === 'thinking' || this.mode === 'idle') {
      this.mode = 'idle';
      this.advance();
    }
    // The pause menu may have changed a setting (the helper) the table shows.
    this.refresh();
  }

  focus(): void {
    (this.handButtons.find((b) => !b.hidden) ?? this.element).focus();
  }

  private route(): Route {
    return this.hooks.route(this.match.handNo);
  }

  private teams(): boolean {
    return this.match.config.teams;
  }

  /** The player is seat 0, on side 0, in the duel and in the team game alike. */
  private mySide(): Side {
    return 0;
  }

  private who(seat: number): string {
    return this.hooks.names[seat] ?? 'Someone';
  }

  private sideName(side: Side): string {
    if (side === this.mySide()) return this.teams() ? 'your team' : 'you';
    return this.teams() ? 'the rivals' : 'your rival';
  }

  // —— the loop ——

  private tick(now: number): void {
    if (this.destroyed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.mode !== 'paused') {
      this.motion.update(dt, this.shown, this.hooks.reducedMotion());
      this.runBeats(dt * 1000);
    }
    this.draw();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private runBeats(ms: number): void {
    const beat = this.beats[0];
    if (!beat) return;
    if (!beat.started) {
      beat.started = true;
      beat.begin?.();
    }
    beat.elapsed += ms;
    if (beat.elapsed < beat.ms || (beat.until && !beat.until())) return;
    beat.end?.();
    this.beats.shift();
    if (this.beats.length === 0) this.settle();
  }

  private draw(): void {
    const look = this.hooks.look();
    const beat = this.beats[0];
    const t = beat && beat.started ? Math.min(1, beat.elapsed / Math.max(1, beat.ms)) : 0;
    const flying = [...(beat?.flying?.(t) ?? []), ...this.dragCard()];
    const hidden = [...(beat?.hidden ?? [])];
    if (this.drag?.moved) hidden.push(`hand-${this.drag.slot}`);
    const state = this.shown;
    const sides = ([0, 1] as const).map((side) =>
      sideView(state, side, look, this.placardName(side)),
    );
    const hand = handView(state, HUMAN, {
      helper: this.hooks.helper(),
      selected: this.selected,
      hover: this.hovered,
    }).map((card, slot) => ({
      ...card,
      parry: this.mode === 'coup' && canCoup(this.match.hand, HUMAN, slot),
      dim: card.dim && this.mode === 'play',
    }));
    this.stage.render(
      this.motion.scene(state, look, this.route()),
      {
        sides: [sides[0]!, sides[1]!],
        hand,
        deckLeft: state.deck.length,
        discardTop: state.discards.length ? state.cards[state.discards.at(-1)!]! : null,
        targets: this.targets(),
        hover: this.hoverTarget,
        flying,
        hidden,
        time: performance.now() / 1000,
      },
      beat?.overlay ? (ctx, layout) => beat.overlay!(ctx, layout, t) : undefined,
    );
  }

  private placardName(side: Side): string {
    if (side === this.mySide()) return this.teams() ? 'Your team' : 'Your car';
    return this.teams() ? 'Rivals' : 'Rival';
  }

  // —— what happens next ——

  setAutoplay(on: boolean): void {
    this.autopilot = on ? newDriver('classic', 'autopilot') : null;
    if (on && (this.mode === 'play' || this.mode === 'coup' || this.mode === 'idle')) {
      this.mode = 'idle';
      this.advance();
    }
  }

  /** When nothing is moving: hand the turn to whoever has it. */
  private advance(): void {
    if (this.destroyed || this.mode === 'paused' || this.beats.length > 0 || this.dialogOpen)
      return;
    const hand = this.match.hand;
    this.refresh();
    if (hand.over) {
      this.mode = 'over';
      this.refresh();
      return;
    }
    if (this.autopilot && (hand.turn === HUMAN || this.playerMayParry())) {
      this.mode = 'thinking';
      const pilot = this.autopilot;
      const parry = hand.seats[HUMAN]!.hand.findIndex((_, slot) => canCoup(hand, HUMAN, slot));
      this.timer = window.setTimeout(() => {
        if (this.mode !== 'thinking') return;
        this.act(
          parry >= 0
            ? { type: 'coup', seat: HUMAN, slot: parry }
            : driverDecide(hand, HUMAN, pilot),
        );
      }, 60);
      return;
    }
    if (this.playerMayParry()) {
      this.mode = 'coup';
      this.refresh();
      return;
    }
    if (hand.turn === HUMAN) {
      if (hand.awaitingExtension) {
        this.mode = 'extension';
        this.refresh();
        void this.askExtension();
        return;
      }
      if (mustDraw(hand, HUMAN)) {
        this.mode = 'idle';
        this.timer = window.setTimeout(
          () => this.act({ type: 'draw', seat: HUMAN }),
          this.hooks.reducedMotion() ? 0 : 220,
        );
        return;
      }
      this.mode = 'play';
      this.refresh();
      return;
    }
    this.mode = 'thinking';
    this.refresh();
    const pace = this.hooks.reducedMotion() ? 250 : mustDraw(hand, hand.turn) ? 260 : 620;
    const asked = performance.now();
    void this.driverAction().then((action) => {
      if (this.destroyed || this.mode !== 'thinking') return;
      const wait = Math.max(0, pace - (performance.now() - asked));
      this.timer = window.setTimeout(() => {
        if (this.mode === 'thinking') this.act(action);
      }, wait);
    });
  }

  /** The player holds the safety for a hazard that has just hit their side, and has not passed. */
  private playerMayParry(): boolean {
    const hand = this.match.hand;
    const window = hand.coupWindow;
    if (!window || window === this.passedWindow) return false;
    if (window.side !== this.mySide()) return false;
    if (hand.turn !== HUMAN && !this.teams()) return false;
    return hand.seats[HUMAN]!.hand.some((_, slot) => canCoup(hand, HUMAN, slot));
  }

  /** The driven seats' move: an out-of-turn parry first, else the move of the seat whose turn it is. */
  private async driverAction(): Promise<Action> {
    const hand = this.match.hand;
    const window = hand.coupWindow;
    if (window) {
      for (const seat of seatsOf(hand, window.side)) {
        const driver = this.match.drivers[seat];
        if (seat === hand.turn || !driver) continue;
        const slot = driverCoup(hand, seat, driver);
        if (slot !== null) return { type: 'coup', seat, slot };
      }
    }
    const driver = this.match.drivers[hand.turn] as Driver;
    if (driver.level === 'sly' && !mustDraw(hand, hand.turn)) {
      return this.hooks.drivers.decide(cloneHand(hand), hand.turn, driver);
    }
    return driverDecide(hand, hand.turn, driver);
  }

  /** Does an action, then queues the beats that show it. */
  private act(action: Action): void {
    if (this.destroyed || this.match.hand.over) return;
    this.hideTip();
    this.selected = null;
    this.mode = 'idle';
    const before = cloneHand(this.match.hand);
    const events = step(this.match, action);
    const after = cloneHand(this.match.hand);
    this.hooks.onEvents?.(events, this.match);
    this.queue(before, after, events);
    this.refresh();
  }

  /** All beats done: the shown hand catches up, the game is saved, and the next turn starts. */
  private settle(): void {
    this.shown = cloneHand(this.match.hand);
    this.hooks.onProgress(this.match);
    if (this.match.hand.over) {
      this.mode = 'over';
      this.refresh();
      this.hooks.onHandOver(this.match);
      return;
    }
    this.advance();
  }

  // —— beats ——

  private quick(): boolean {
    return this.hooks.reducedMotion();
  }

  private queue(before: HandState, after: HandState, events: readonly HandEvent[]): void {
    const layout = () => this.stage.layout;
    for (const event of events) {
      const line = narrate(
        event,
        (s) => this.who(s),
        (side) => this.sideName(side),
        (c) => after.cards[c]!,
      );
      switch (event.type) {
        case 'draw':
          this.beats.push(this.drawBeat(after, event));
          break;
        case 'play':
          if (event.coup) this.beats.push(...this.coupBeats(before, after, event, line));
          else this.beats.push(...this.playBeats(before, after, event, line));
          break;
        case 'discard':
          this.beats.push(
            this.flightBeat(
              before,
              after,
              event.seat,
              event.card,
              after.cards[event.card]!,
              layout().discard,
              'flick',
              line,
            ),
          );
          break;
        case 'trip':
          this.beats.push({
            ms: this.quick() ? 300 : 900,
            elapsed: 0,
            started: false,
            begin: () => {
              this.say(line);
              this.hooks.sound.play('horn');
            },
            until: () => this.motion.hasArrived(after),
            overlay: (ctx, l, t) =>
              drawBanner(
                ctx,
                l.width / 2,
                l.road.y + l.road.h * 0.42,
                l.scale * 0.8,
                `${event.miles} MILES!`,
                this.trip(event.side),
                Math.min(1, t * 2.5),
                this.hooks.look(),
              ),
          });
          break;
        case 'extension':
          this.beats.push({
            ms: this.quick() ? 300 : 1300,
            elapsed: 0,
            started: false,
            begin: () => {
              this.say(line);
              if (event.extend) this.hooks.sound.play('extend');
            },
            overlay: (ctx, l, t) =>
              drawBanner(
                ctx,
                l.width / 2,
                l.road.y + l.road.h * 0.42,
                l.scale * 0.8,
                event.extend ? 'ON TO 1000!' : 'STOPPING AT 700',
                event.extend
                  ? 'The trip is longer now: whoever makes 1000 first scores the trip'
                  : '',
                Math.min(1, t * 2.5),
                this.hooks.look(),
              ),
          });
          break;
        case 'over':
          this.beats.push({
            ms: this.quick() ? 200 : 700,
            elapsed: 0,
            started: false,
            begin: () => this.say(line),
          });
          break;
      }
    }
  }

  private trip(side: Side): string {
    return side === this.mySide() ? 'Trip complete: +400' : 'Your rival completes the trip';
  }

  private say(line: string | null): void {
    if (!line) return;
    this.caption = line;
    this.log.textContent = line;
    this.refresh();
  }

  /** Where a seat's cards come from and go to when they are not in the player's hand. */
  private seatAnchor(seat: number): Rect {
    const l = this.stage.layout;
    const side = this.match.hand.seats[seat]!.side;
    const placard = l.sides[side === this.mySide() ? 0 : 1].panel;
    return {
      x: placard.x + placard.w * 0.62,
      y: placard.y - 40 * l.scale,
      w: l.hand[0]!.w * 0.8,
      h: l.hand[0]!.h * 0.8,
    };
  }

  private drawBeat(after: HandState, event: Extract<HandEvent, { type: 'draw' }>): Beat {
    const l = this.stage.layout;
    const mine = event.seat === HUMAN;
    const slots = event.cards.map((card) => after.seats[event.seat]!.hand.indexOf(card));
    return {
      ms: this.quick() ? 1 : mine ? 300 : 220,
      elapsed: 0,
      started: false,
      begin: () => this.hooks.sound.play('draw'),
      flying: (t) =>
        event.cards.map((card, i) => {
          const from = centreOf(l.deck);
          const to = mine ? centreOf(l.hand[slots[i]!]!) : centreOf(this.seatAnchor(event.seat));
          const k = easeOutCubic(t);
          return {
            kind: mine && t > 0.5 ? after.cards[card]! : null,
            x: from.x + (to.x - from.x) * k,
            y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 40 * l.scale,
            w: l.deck.w * (mine ? 1 : 1 - 0.3 * k),
            rotation: (mine ? 0.06 : -0.2) * Math.sin(k * Math.PI),
            alpha: mine ? 1 : 1 - k * 0.8,
            height: 0.5,
          };
        }),
      hidden: mine ? slots.map((s) => `hand-${s}`) : [],
      end: () => {
        this.shown = cloneHand(after);
      },
    };
  }

  /** A card flies from its owner to `target`; the shown hand catches up when it lands. */
  private flightBeat(
    before: HandState,
    after: HandState,
    seat: number,
    card: number,
    kind: Kind,
    target: Rect,
    cue: Parameters<TableSound['play']>[0],
    line: string | null,
    rotateTo = 0,
  ): Beat {
    const l = this.stage.layout;
    const slot = before.seats[seat]!.hand.indexOf(card);
    const from =
      seat === HUMAN && slot >= 0 ? centreOf(l.hand[slot]!) : centreOf(this.seatAnchor(seat));
    const startW = seat === HUMAN && slot >= 0 ? l.hand[slot]!.w : l.hand[0]!.w * 0.8;
    const to = centreOf(target);
    const endW = rotateTo ? target.h / CARD_ASPECT : target.w;
    return {
      ms: this.quick() ? 1 : 430,
      elapsed: 0,
      started: false,
      begin: () => this.say(line),
      flying: (t) => {
        const k = easeInOut(t);
        return [
          {
            kind,
            x: from.x + (to.x - from.x) * k,
            y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 90 * l.scale,
            w: startW + (endW - startW) * k,
            rotation: Math.sin(k * Math.PI) * 0.18 + rotateTo * k,
            alpha: 1,
            height: Math.sin(k * Math.PI),
          },
        ];
      },
      hidden: seat === HUMAN ? [`hand-${slot}`] : [],
      end: () => {
        this.shown = cloneHand(after);
        this.hooks.sound.play(cue);
      },
    };
  }

  private playBeats(
    before: HandState,
    after: HandState,
    event: Extract<HandEvent, { type: 'play' }>,
    line: string | null,
  ): Beat[] {
    const l = this.stage.layout;
    const place = event.side === this.mySide() ? 0 : 1;
    const slots = l.sides[place];
    let target: Rect;
    if (event.pile === 'miles') target = slots.miles[DISTANCES.indexOf(event.kind as never)]!;
    else if (event.pile === 'safety')
      target = slots.safeties[SAFETIES.indexOf(event.kind as Safety)]!;
    else target = event.pile === 'speed' ? slots.speed : slots.battle;
    if (event.pile === 'miles')
      target = {
        x: target.x,
        y: target.y - target.w * 0.6,
        w: target.w * 0.7,
        h: target.w * 0.7 * CARD_ASPECT,
      };
    const landing = this.flightBeat(
      before,
      after,
      event.seat,
      event.card,
      event.kind,
      target,
      isDistance(event.kind) ? 'flick' : cueFor(event.kind),
      line,
    );
    const performed = landing.end!;
    landing.end = () => {
      performed();
      const roadSide = event.side === this.mySide() ? 0 : 1;
      if (isDistance(event.kind)) this.hooks.sound.play('engine');
      else this.motion.perform(roadSide as Side, event.kind);
      if (isSafety(event.kind)) this.motion.parry(roadSide as Side);
      if (event.cleared) this.motion.perform(roadSide as Side, clearingFix(event.cleared));
    };
    const beats = [landing];
    // Let a hazard's little scene play before anyone moves again.
    if (isHazard(event.kind) && !this.quick()) beats.push({ ms: 450, elapsed: 0, started: false });
    return beats;
  }

  /** The signature moment: time slows, the safety slams down, the hazard bounces back, the banner lands. */
  private coupBeats(
    before: HandState,
    after: HandState,
    event: Extract<HandEvent, { type: 'play' }>,
    line: string | null,
  ): Beat[] {
    const l = () => this.stage.layout;
    const look = () => this.hooks.look();
    const place = event.side === this.mySide() ? 0 : 1;
    const hazard = event.cleared ?? 'redLight';
    const slotRect = () => l().sides[place].safeties[SAFETIES.indexOf(event.kind as Safety)]!;
    const battleRect = () =>
      hazard === 'slowZone' ? l().sides[place].speed : l().sides[place].battle;
    const rivalRect = () => l().sides[place === 0 ? 1 : 0].battle;
    const roadSide = (event.side === this.mySide() ? 0 : 1) as Side;
    const slam = this.flightBeat(
      before,
      after,
      event.seat,
      event.card,
      event.kind,
      slotRect(),
      'slam',
      line,
      Math.PI / 2,
    );
    const landed = slam.end!;
    slam.ms = this.quick() ? 1 : 520;
    slam.begin = () => {
      this.say(line);
      this.motion.setSlowMotion(true);
    };
    slam.overlay = (ctx, layout) => veil(ctx, layout, look());
    slam.hidden = [...(slam.hidden ?? []), `safety-${place}-${event.kind}`];
    slam.end = () => {
      landed();
      this.hooks.sound.play('coup');
      this.motion.parry(roadSide);
      this.motion.perform(roadSide, clearingFix(hazard));
    };
    const show: Beat = {
      ms: this.quick() ? 1100 : 1900,
      elapsed: 0,
      started: false,
      overlay: (ctx, layout, t) => {
        if (!this.quick()) veil(ctx, layout, look(), 1 - Math.max(0, (t - 0.8) / 0.2));
        const slot = centreOf(slotRect());
        if (!this.quick())
          drawCoupBurst(ctx, slot.x, slot.y, 190 * layout.scale, Math.min(1, t * 1.4), look());
        // The hazard is knocked off the pile and back across the table.
        if (!this.quick() && t < 0.75) {
          const from = centreOf(battleRect());
          const to = centreOf(rivalRect());
          const k = easeOutCubic(t / 0.75);
          const w = battleRect().w * 1.05;
          const image = this.stage.sprites.face(hazard, w, w * CARD_ASPECT);
          ctx.save();
          ctx.globalAlpha = 1 - k * 0.9;
          ctx.translate(
            from.x + (to.x - from.x) * k,
            from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 160 * layout.scale,
          );
          ctx.rotate(k * 2.4);
          ctx.drawImage(image, -w / 2, -(w * CARD_ASPECT) / 2, w, w * CARD_ASPECT);
          ctx.restore();
        }
        drawBanner(
          ctx,
          layout.width / 2,
          layout.road.y + layout.road.h + 150 * layout.scale,
          layout.scale,
          'COUP FOURRÉ!',
          `+300  ·  ${CARD_COPY[event.kind].name} parries the ${CARD_COPY[hazard].name.toLowerCase()}`,
          Math.min(1, t * 3),
          look(),
        );
      },
      end: () => this.motion.setSlowMotion(false),
    };
    return [slam, show];
  }

  // —— the player's hands ——

  private buildControls(): void {
    for (let slot = 0; slot < 7; slot++) {
      const button = h('button', {
        class: 'dt-card',
        type: 'button',
        'data-slot': slot,
      }) as HTMLButtonElement;
      button.addEventListener('pointerdown', (e) => this.onPointerDown(e, slot));
      button.addEventListener('pointermove', (e) => this.onPointerMove(e));
      button.addEventListener('pointerup', (e) => this.onPointerUp(e));
      button.addEventListener('pointercancel', () => this.cancelDrag());
      button.addEventListener('pointerenter', () => {
        this.hovered = slot;
        this.showReason(slot);
      });
      button.addEventListener('pointerleave', () => {
        if (this.hovered === slot) this.hovered = null;
        if (this.selected === null) this.hideTip();
      });
      button.addEventListener('focus', () => {
        this.hovered = slot;
        this.showReason(slot);
      });
      button.addEventListener('blur', () => {
        if (this.hovered === slot) this.hovered = null;
      });
      button.addEventListener('dblclick', () => this.use(slot));
      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (this.selected === slot) this.use(slot);
          else this.select(slot);
        }
      });
      this.handButtons.push(button);
      this.controls.append(button);
    }
    // Piles are painted, not built: a click on one lands where the chosen card would go.
    const canvas = this.stage.canvas;
    canvas.addEventListener('pointermove', (e) => {
      const at = this.local(e);
      this.hoverTarget = this.targetAt(at.x, at.y, 0);
      canvas.style.cursor = this.hoverTarget ? 'pointer' : '';
    });
    canvas.addEventListener('pointerleave', () => (this.hoverTarget = null));
    canvas.addEventListener('click', (e) => {
      const at = this.local(e);
      const key = this.targetAt(at.x, at.y, 0);
      if (key) this.chooseTarget(key);
    });
  }

  private local(event: PointerEvent | MouseEvent): { x: number; y: number } {
    const box = this.element.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private onResize(): void {
    const box = this.element.getBoundingClientRect();
    const width = Math.max(320, Math.round(box.width));
    const height = Math.max(240, Math.round(box.height));
    this.stage.resize(width, height, window.devicePixelRatio || 1);
    this.hud.place(this.stage.layout);
    this.placeControls();
    this.refresh();
  }

  private placeControls(): void {
    const l = this.stage.layout;
    l.hand.forEach((r, slot) => {
      Object.assign(this.handButtons[slot]!.style, {
        left: `${r.x}px`,
        top: `${r.y}px`,
        width: `${r.w}px`,
        height: `${r.h}px`,
      });
    });
    this.element.style.setProperty('--dt-scale', String(l.scale));
  }

  /** Where a pile lies on the table, by its key. */
  private targetRect(key: string): Rect | null {
    const l = this.stage.layout;
    const span = (rects: Rect[]): Rect => {
      const x = Math.min(...rects.map((r) => r.x));
      const y = Math.min(...rects.map((r) => r.y));
      return {
        x,
        y,
        w: Math.max(...rects.map((r) => r.x + r.w)) - x,
        h: Math.max(...rects.map((r) => r.y + r.h)) - y,
      };
    };
    switch (key) {
      case 'battle-0':
        return l.sides[0].battle;
      case 'speed-0':
        return l.sides[0].speed;
      case 'safety-0':
        return span(l.sides[0].safeties);
      case 'miles-0':
        return span([...l.sides[0].miles, l.sides[0].odometer]);
      case 'battle-1':
        return l.sides[1].battle;
      case 'speed-1':
        return l.sides[1].speed;
      case 'discard':
        return l.discard;
      case 'deck':
        return l.deck;
      default:
        return null;
    }
  }

  /** The centre of a pile on the page, for tests that click or drop onto the painted table. */
  pileCentre(key: string): { x: number; y: number } | null {
    const r = this.targetRect(key);
    if (!r) return null;
    const box = this.element.getBoundingClientRect();
    return { x: box.left + r.x + r.w / 2, y: box.top + r.y + r.h / 2 };
  }

  /** The destination of a card from the player's hand, as a placard key from the player's side. */
  private destination(kind: Kind): string {
    if (isDistance(kind)) return 'miles-0';
    if (isSafety(kind)) return 'safety-0';
    if (isHazard(kind)) return kind === 'slowZone' ? 'speed-1' : 'battle-1';
    return kind === 'openRoad' ? 'speed-0' : 'battle-0';
  }

  private targets(): string[] {
    const slot = this.drag?.moved ? this.drag.slot : this.selected;
    if (slot === null || (this.mode !== 'play' && this.mode !== 'coup')) return [];
    const kind = this.kindAt(slot);
    if (!kind) return [];
    const out: string[] = [];
    if (this.canUse(slot)) out.push(this.destination(kind));
    if (this.canDiscard(slot)) out.push('discard');
    return out;
  }

  private kindAt(slot: number): Kind | null {
    const card = this.match.hand.seats[HUMAN]!.hand[slot];
    return card === null || card === undefined ? null : this.match.hand.cards[card]!;
  }

  private canUse(slot: number): boolean {
    if (this.mode === 'coup') return canCoup(this.match.hand, HUMAN, slot);
    return this.mode === 'play' && playVerdict(this.match.hand, HUMAN, slot) === 'ok';
  }

  private canDiscard(slot: number): boolean {
    return this.mode === 'play' && !mustDraw(this.match.hand, HUMAN) && this.kindAt(slot) !== null;
  }

  select(slot: number): void {
    if ((this.mode !== 'play' && this.mode !== 'coup') || this.kindAt(slot) === null) return;
    this.selected = this.selected === slot ? null : slot;
    this.hooks.sound.play('tick');
    this.showReason(slot);
    this.refresh();
  }

  /** Plays the card in `slot` where it goes, if it can go anywhere. */
  use(slot: number | null = this.selected): void {
    if (slot === null) return;
    if (this.mode === 'coup' && canCoup(this.match.hand, HUMAN, slot)) {
      this.act({ type: 'coup', seat: HUMAN, slot });
      return;
    }
    if (!this.canUse(slot)) {
      this.selected = slot;
      this.showReason(slot, true);
      this.refresh();
      return;
    }
    this.act({ type: 'play', seat: HUMAN, slot });
  }

  async discard(slot: number | null = this.selected): Promise<void> {
    if (slot === null || !this.canDiscard(slot)) return;
    const kind = this.kindAt(slot)!;
    if (isSafety(kind)) {
      this.dialogOpen = true;
      const sure = await confirmDialog(this.element, {
        title: `Throw away ${CARD_COPY[kind].name}?`,
        body: 'There is only one in the deck and it will not come back this hand. Laid instead, it scores 100, keeps you safe and gives you another turn.',
        confirm: 'Throw it away',
        cancel: 'Keep it',
      });
      this.dialogOpen = false;
      if (!sure || this.mode !== 'play') {
        this.focus();
        return;
      }
    }
    this.act({ type: 'discard', seat: HUMAN, slot });
  }

  /** At a coup fourré: let the moment pass and draw on (or let the turn go on in a team game). */
  passParry(): void {
    if (this.mode !== 'coup') return;
    this.passedWindow = this.match.hand.coupWindow;
    this.mode = 'idle';
    this.selected = null;
    this.advance();
  }

  parry(): void {
    if (this.mode !== 'coup') return;
    const slot = this.match.hand.seats[HUMAN]!.hand.findIndex((_, s) =>
      canCoup(this.match.hand, HUMAN, s),
    );
    if (slot >= 0) this.act({ type: 'coup', seat: HUMAN, slot });
  }

  private chooseTarget(key: string): void {
    if (key === 'deck') {
      if (this.mode === 'coup') this.passParry();
      return;
    }
    const slot = this.selected;
    if (slot === null) return;
    if (key === 'discard') void this.discard(slot);
    else if (key === this.destination(this.kindAt(slot)!)) this.use(slot);
  }

  private async askExtension(): Promise<void> {
    this.dialogOpen = true;
    this.hooks.sound.play('horn');
    const yes = await confirmDialog(this.element, {
      title: '700 miles! Extend the trip to 1000?',
      body: 'Go on and the hand lasts longer: 200 more points if you make 1000 first. Fall short and the trip bonus is lost, and your rival can still finish it.',
      confirm: 'Extend to 1000',
      cancel: 'Stop at 700',
      confirmKey: 'Y',
      cancelKey: 'N',
    });
    this.dialogOpen = false;
    if (this.match.hand.awaitingExtension) this.act({ type: 'extend', seat: HUMAN, extend: yes });
  }

  // —— pointer and keys ——

  private onPointerDown(event: PointerEvent, slot: number): void {
    if (event.button !== 0 || (this.mode !== 'play' && this.mode !== 'coup')) return;
    if (this.kindAt(slot) === null) return;
    this.drag = {
      slot,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointer: event.pointerId,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const box = this.element.getBoundingClientRect();
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      this.selected = drag.slot;
    }
    if (drag.moved) {
      this.pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
      this.hoverTarget = this.targetAt(this.pointer.x, this.pointer.y);
    }
  }

  private pointer = { x: 0, y: 0 };

  private onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    this.drag = null;
    if (!drag.moved) {
      this.select(drag.slot);
      return;
    }
    const target = this.hoverTarget;
    this.hoverTarget = null;
    if (target) {
      this.selected = drag.slot;
      this.chooseTarget(target);
    }
  }

  private cancelDrag(): void {
    this.drag = null;
    this.hoverTarget = null;
  }

  /** A legal destination under the pointer (the deck too, when it means "let the parry pass"). */
  private targetAt(x: number, y: number, pad = 30 * this.stage.layout.scale): string | null {
    const keys = [...this.targets(), ...(this.mode === 'coup' ? ['deck'] : [])];
    for (const key of keys) {
      const r = this.targetRect(key);
      if (r && x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad)
        return key;
    }
    return null;
  }

  private dragCard(): FlyingCard[] {
    const drag = this.drag;
    if (!drag?.moved) return [];
    const kind = this.kindAt(drag.slot);
    const w = this.stage.layout.hand[0]!.w;
    return [
      { kind, x: this.pointer.x, y: this.pointer.y, w, rotation: 0.05, alpha: 0.95, height: 1 },
    ];
  }

  private onKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.dialogOpen)
      return;
    if (this.mode === 'paused' || this.mode === 'over') return;
    const key = event.key.toLowerCase();
    if (/^[1-6]$/.test(key) || key === 'p') {
      const slot = key === 'p' ? PICK_SLOT : Number(key);
      if (key === 'p' && this.mode === 'coup') {
        event.preventDefault();
        this.passParry();
        return;
      }
      event.preventDefault();
      this.select(slot);
      this.handButtons[slot]?.focus();
      return;
    }
    if (key === 'c' && this.mode === 'coup') {
      event.preventDefault();
      this.parry();
      return;
    }
    if (key === 'u') {
      event.preventDefault();
      this.use();
      return;
    }
    if (key === 'd') {
      event.preventDefault();
      void this.discard();
      return;
    }
    if (key === 'arrowleft' || key === 'arrowright') {
      event.preventDefault();
      const filled = [0, 1, 2, 3, 4, 5, 6].filter((s) => this.kindAt(s) !== null);
      if (filled.length === 0) return;
      const at = this.selected === null ? -1 : filled.indexOf(this.selected);
      const next =
        filled[
          (at + (key === 'arrowright' ? 1 : filled.length - 1) + filled.length) % filled.length
        ]!;
      this.selected = next;
      this.handButtons[next]?.focus();
      this.showReason(next);
      this.refresh();
    }
  }

  // —— words on the table ——

  private showReason(slot: number, insist = false): void {
    const kind = this.kindAt(slot);
    if (!kind || (!this.hooks.helper() && !insist)) {
      this.hideTip();
      return;
    }
    const copy = CARD_COPY[kind];
    let reason = '';
    if (this.mode === 'play') {
      const verdict = playVerdict(this.match.hand, HUMAN, slot);
      if (verdict !== 'ok') reason = reasonFor(verdict, this.teams());
    }
    if (this.mode === 'coup' && canCoup(this.match.hand, HUMAN, slot))
      reason = 'Lay it now for a coup fourré: +300.';
    this.tip.textContent = reason ? `${copy.name}: ${reason}` : `${copy.name}: ${copy.does}`;
    this.tip.dataset.blocked = reason && this.mode === 'play' ? 'true' : 'false';
    this.tip.hidden = false;
    this.tipSlot = slot;
    this.arrangeOverlays();
  }

  private hideTip(): void {
    this.tip.hidden = true;
    this.tipSlot = null;
    this.arrangeOverlays();
  }

  /**
   * The action bar (or the coup prompt) sits just above its card and the tip above that, over
   * the status line, which steps aside while either shows; it says the same thing less exactly.
   */
  private arrangeOverlays(): void {
    const l = this.stage.layout;
    const gap = 8 * l.scale;
    let bar: HTMLElement | null = null;
    if (!this.prompt.hidden) bar = this.prompt;
    else if (!this.actionBar.hidden) bar = this.actionBar;
    if (this.tipSlot !== null && !this.tip.hidden) {
      const r = l.hand[this.tipSlot]!;
      const barAbove = bar !== null && bar.dataset.slot === String(this.tipSlot);
      const top = r.y - gap - (barAbove ? bar!.offsetHeight + gap : 0);
      Object.assign(this.tip.style, { left: `${r.x + r.w / 2}px`, top: `${top}px` });
    }
    this.hud.quietStatus(!this.tip.hidden || bar !== null);
  }

  /** Brings the page's chrome up to date: score bar, line of play, buttons, prompts. */
  private refresh(): void {
    const hand = this.match.hand;
    const mine = this.mySide();
    const live = [scoreSide(this.shown, mine).total, scoreSide(this.shown, other(mine)).total] as [
      number,
      number,
    ];
    const banked = bankedTotals(this.match);
    const totals = [banked[mine], banked[other(mine)]] as [number, number];
    const look = this.hooks.look();
    this.hud.update(
      {
        route: this.route().name,
        progress: this.hooks.modeLine(),
        names: this.teams() ? ['Your team', 'Rivals'] : ['You', 'Rival'],
        totals,
        hand: live,
        status: this.statusLine(),
      },
      look,
    );
    this.element.dataset.mode = this.mode;
    this.element.dataset.helper = String(this.hooks.helper());
    // Hand buttons: names for screen readers, pressed when chosen.
    this.handButtons.forEach((button, slot) => {
      const kind = this.kindAt(slot);
      button.hidden = kind === null;
      if (!kind) return;
      const copy = CARD_COPY[kind];
      const verdict = this.mode === 'play' ? playVerdict(hand, HUMAN, slot) : 'ok';
      const blocked =
        verdict !== 'ok' ? ` Cannot play now: ${reasonFor(verdict, this.teams())}` : '';
      button.setAttribute(
        'aria-label',
        `${slot === 0 ? 'New card' : `Card ${slot}`}: ${copy.name}, ${familyOf(kind)}. ${copy.does}${blocked}`,
      );
      button.setAttribute('aria-pressed', String(this.selected === slot));
    });
    this.updateActionBar();
    this.updatePrompt();
    this.arrangeOverlays();
  }

  private statusLine(): string {
    const hand = this.match.hand;
    switch (this.mode) {
      case 'coup': {
        const slot = hand.seats[HUMAN]!.hand.findIndex((_, s) => canCoup(hand, HUMAN, s));
        const kind = this.kindAt(slot);
        return `Coup fourré! Lay ${kind ? CARD_COPY[kind].name : 'your safety'} now (C), or let it pass (P).`;
      }
      case 'play':
        return this.hooks.helper()
          ? 'Your turn: play a card or throw one away. Click it, drag it, or press its number.'
          : 'Your turn.';
      case 'thinking':
        return `${this.who(hand.turn)} is thinking…`;
      case 'extension':
        return '700 miles! Extend to 1000?';
      case 'over':
        return 'The hand is over.';
      default:
        return this.caption;
    }
  }

  private updateActionBar(): void {
    const slot = this.selected;
    // At a coup fourré the prompt over the safety speaks for every card.
    if (slot === null || this.mode !== 'play' || this.kindAt(slot) === null) {
      this.actionBar.hidden = true;
      return;
    }
    const kind = this.kindAt(slot)!;
    const buttons: HTMLButtonElement[] = [];
    if (this.canUse(slot)) {
      const where = this.destination(kind);
      const label = where.endsWith('-1') ? 'Throw at rival' : isDistance(kind) ? 'Drive' : 'Play';
      buttons.push(
        h(
          'button',
          { class: 'dt-action dt-action--go', type: 'button', onclick: () => this.use(slot) },
          label,
          h('kbd', {}, 'U'),
        ) as HTMLButtonElement,
      );
    }
    if (this.canDiscard(slot)) {
      buttons.push(
        h(
          'button',
          { class: 'dt-action', type: 'button', onclick: () => void this.discard(slot) },
          'Throw away',
          h('kbd', {}, 'D'),
        ) as HTMLButtonElement,
      );
    }
    if (buttons.length === 0) {
      this.actionBar.hidden = true;
      return;
    }
    this.actionBar.replaceChildren(...buttons);
    const r = this.stage.layout.hand[slot]!;
    Object.assign(this.actionBar.style, {
      left: `${r.x + r.w / 2}px`,
      top: `${r.y - 8 * this.stage.layout.scale}px`,
    });
    this.actionBar.dataset.slot = String(slot);
    this.actionBar.hidden = false;
  }

  private updatePrompt(): void {
    if (this.mode !== 'coup') {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.replaceChildren(
      h(
        'button',
        { class: 'dt-action dt-action--go', type: 'button', onclick: () => this.parry() },
        'Coup fourré!',
        h('kbd', {}, 'C'),
      ),
      h(
        'button',
        { class: 'dt-action', type: 'button', onclick: () => this.passParry() },
        'Let it pass',
        h('kbd', {}, 'P'),
      ),
    );
    // Over the safety that can parry, where the eye already is.
    const hand = this.match.hand;
    const slot = Math.max(
      0,
      hand.seats[HUMAN]!.hand.findIndex((_, s) => canCoup(hand, HUMAN, s)),
    );
    const l = this.stage.layout;
    const r = l.hand[slot]!;
    Object.assign(this.prompt.style, { left: `${r.x + r.w / 2}px`, top: `${r.y - 8 * l.scale}px` });
    this.prompt.dataset.slot = String(slot);
    this.prompt.hidden = false;
  }
}

function centreOf(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** The road scene a cleared hazard ends with: the remedy's fix. */
function clearingFix(hazard: Kind): Kind {
  switch (hazard) {
    case 'flatTyre':
      return 'spareTyre';
    case 'noFuel':
      return 'fillUp';
    case 'fenderBender':
      return 'mechanic';
    case 'slowZone':
      return 'openRoad';
    default:
      return 'greenLight';
  }
}

/** A wash over the table while time slows. */
function veil(ctx: CanvasRenderingContext2D, layout: TableLayout, look: Look, strength = 1): void {
  ctx.fillStyle = alpha(look.dark ? '#070b14' : '#efe5cf', (look.dark ? 0.5 : 0.55) * strength);
  ctx.fillRect(0, layout.road.y + layout.road.h, layout.width, layout.height);
}
