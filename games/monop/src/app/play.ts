import { LAYOUT } from '../boards/layout';
import { BOARDS, SEAT_COLOURS, type BoardId } from '../boards/themes';
import { landingHeat, tradeMeter } from '../engine/coach';
import { Rival } from '../engine/ai';
import { PERSONALITIES } from '../engine/rivals';
import { DEED_SPACES, deedOf, groupHasBuildings, groupOf, whyNotOffer } from '../engine/state';
import type { Action, GameState, Rules, SeatSetup, TradeOffer } from '../engine/types';
import type { CameraRig } from '../render/world/camera';
import type { BoardWorld } from '../render/world/world';
import { Director } from '../play/director';
import type { Scenario } from '../scenarios/catalogue';
import type { TableSound } from '../sound/table';
import { FlatMap } from '../render/map/flat-map';
import type { WorldState } from '../render/world/world';
import { Pilot } from '../scenarios/pilot';
import { who } from '../play/words';
import { PlaySession, type SavedPlay } from '../play/session';
import {
  buildOptions,
  hudView,
  moneyOptions,
  personSeat,
  type Framing,
  type ScreenState,
} from '../play/view';
import { renderHud } from '../ui/hud';
import { coinIcon, element } from '../ui/parts';
import {
  popCoins,
  renderAuction,
  renderCard,
  renderDebt,
  renderList,
  renderMoment,
  renderNotice,
  type ListRow,
} from '../ui/panels';
import { renderTable, type TableDeed, type TablePartner } from '../ui/table';

/**
 * The play screen: the world behind, the panels over it, and the person's hands on the game.
 * Every button has a key (Space roll, B buy, P auction, H build, M mortgage, T trade, E end,
 * Enter for the main choice, arrows to look at lots, Esc to close what is open), and every
 * key does what its button does.
 */

export interface PlayOptions {
  readonly board: BoardId;
  readonly seed: string;
  readonly rules: Rules;
  readonly seats: readonly SeatSetup[];
  readonly coach: boolean;
  readonly pace: number;
  /** Workbench only: a rival's mind makes the person's moves, through the same path as keys. */
  readonly autopilot?: boolean;
  readonly prepare?: (state: GameState) => void;
  /** The game's name on the board badge, and a scenario's goals and restrictions. */
  readonly framing: Framing;
  /** The scenario being played, so the workbench autopilot can chase its goals. */
  readonly scenario?: Scenario;
  readonly sound?: TableSound;
  /** Camera moves and full-length celebrations; off keeps the overview. */
  cinematics(): boolean;
  /** Start on the flat map instead of the town. */
  readonly mapView?: boolean;
  /** The player switched between the map and the town (V), to remember it. */
  onMapView?(on: boolean): void;
  readonly resume?: SavedPlay;
  /** Play has stopped for a person: the game can be saved. */
  onSettle?(session: PlaySession): void;
  reducedMotion(): boolean;
  onOver(session: PlaySession): void;
}

interface Draft {
  partner: number;
  give: Set<number>;
  get: Set<number>;
  giveCoins: number;
  getCoins: number;
  /** The rival's last word on this table, if any. */
  reply?: { kind: 'decline' | 'accept'; text: string };
}

/** Seconds the person has to call in an auction before passing. */
const AUCTION_CLOCK = 9;

export class PlayScreen {
  readonly session: PlaySession;
  readonly director: Director;
  private readonly screen: ScreenState;
  private readonly hud = element('div', 'dd-hud');
  private readonly fx = element('div', 'dd-fx');
  private readonly heat = element('div', 'dd-heat');
  private readonly overlay = element('div', 'dd-overlay');
  private draft: Draft | null = null;
  private lastOffer: TradeOffer | null = null;
  private notice: { text: string; until: number } | null = null;
  private clock: { key: string; elapsed: number } | null = null;
  private confirmLeave = 0;
  /** The person is answering a rival's offer with one of their own. */
  private countering = false;
  private readonly stopTick: () => void;
  private finished = false;
  private pilot: { decide(state: GameState): Action } | null = null;
  private finishing = false;
  private map: FlatMap | null = null;
  private picture: WorldState | null = null;
  private piloting = false;
  private coached: boolean;

  constructor(
    private readonly root: HTMLElement,
    private readonly world: BoardWorld,
    rig: CameraRig,
    private readonly options: PlayOptions,
  ) {
    this.screen = { selected: null, panel: 'none', coach: options.coach };
    this.coached = options.coach;
    this.director = new Director(world, rig, {
      refresh: () => this.refresh(),
      pop: (x, y, amount, tone) => popCoins(this.fx, x, y, amount, tone),
      arc: (from, to, amount) => this.arcCoins(from, to, amount),
      spacePoint: (space) => (this.map ? { ...this.map.spacePoint(space), ahead: true } : null),
      reducedMotion: options.reducedMotion,
      cinematics: options.cinematics,
      ...(options.sound ? { sound: options.sound } : {}),
      momentStarts: () => {
        this.screen.panel = 'none';
      },
    });
    this.director.pace = options.pace;
    this.session = new PlaySession(
      {
        board: options.board,
        seed: options.seed,
        rules: options.rules,
        seats: options.seats,
        ...(options.prepare ? { prepare: options.prepare } : {}),
        ...(options.framing.goals ? { goals: options.framing.goals } : {}),
        ...(options.framing.restrictions ? { restrictions: options.framing.restrictions } : {}),
        ...(options.resume ? { resume: options.resume } : {}),
        ...(options.onSettle ? { onSettle: options.onSettle } : {}),
      },
      this.director,
    );
    root.append(this.heat, this.fx, this.hud, this.overlay);
    this.hud.addEventListener('click', (e) => this.onClick(e));
    this.overlay.addEventListener('click', (e) => this.onClick(e));
    world.stage.canvas.addEventListener('click', this.onWorldClick);
    this.stopTick = world.stage.onTick((seconds) => this.tick(seconds));
    this.buildHeat();
    if (options.mapView) this.setMapView(true);
  }

  start(): void {
    if (this.options.autopilot) {
      const scenario = this.options.scenario;
      const ledger = this.session.ledger;
      if (scenario) {
        const pilot = new Pilot(scenario, this.options.seed);
        this.pilot = { decide: (state) => pilot.decide(state, ledger) };
      } else {
        const rival = new Rival(this.person, 'steady', 'medium', `${this.options.seed}/pilot`);
        this.pilot = { decide: (state) => rival.decide(state).action };
      }
    }
    this.director.draw(this.session);
    this.session.start();
  }

  /** Workbench autopilot: moves for the person after a short pause, as a person might. */
  private steer(): void {
    if (!this.pilot || this.piloting || !this.myMove || this.director.card) return;
    this.piloting = true;
    void this.director.wait(0.7).then(async () => {
      this.piloting = false;
      if (!this.myMove || this.finished) return;
      await this.act(this.pilot!.decide(this.session.state));
    });
  }

  destroy(): void {
    this.session.end();
    this.stopTick();
    this.setMapView(false);
    this.world.stage.canvas.removeEventListener('click', this.onWorldClick);
    for (const layer of [this.heat, this.fx, this.hud, this.overlay]) layer.remove();
  }

  get mapView(): boolean {
    return this.map !== null;
  }

  /**
   * Switches between the town and the flat map. On the map the world keeps time for the
   * game's moments but draws nothing, and the map is drawn from every picture the world is given.
   */
  setMapView(on: boolean): void {
    if (on === this.mapView) return;
    const canvas = this.world.stage.canvas;
    if (on) {
      const map = new FlatMap(this.root, BOARDS[this.options.board], () => this.mapMargins());
      this.root.insertBefore(map.canvas, this.heat);
      map.canvas.addEventListener('click', this.onMapClick);
      this.map = map;
      this.world.onShow = (picture) => {
        this.picture = picture;
        this.drawMap();
      };
      this.world.stage.drawing = false;
      canvas.style.visibility = 'hidden';
      this.director.draw(this.session);
    } else {
      this.map?.canvas.removeEventListener('click', this.onMapClick);
      this.map?.dispose();
      this.map = null;
      this.world.onShow = null;
      this.world.stage.drawing = true;
      canvas.style.visibility = '';
    }
    this.refresh();
  }

  /** The map sits between the players' panel and its mirror on the right, under the banner. */
  private mapMargins(): { left: number; right: number; top: number; bottom: number } {
    const box = this.root.getBoundingClientRect();
    const left = this.hud.querySelector('.dd-left')?.getBoundingClientRect();
    const side = left ? left.right - box.left + 18 : 300;
    return { left: side, right: side, top: 72, bottom: 92 };
  }

  private drawMap(): void {
    if (!this.map || !this.picture) return;
    const heat = this.heatShown() ? landingHeat(this.session.state) : null;
    this.map.draw(this.picture, heat, this.screen.selected);
  }

  private readonly onMapClick = (event: MouseEvent): void => {
    if (!this.map) return;
    const box = this.map.canvas.getBoundingClientRect();
    const space = this.map.pickLot(event.clientX - box.left, event.clientY - box.top);
    this.screen.selected = space === this.screen.selected ? null : space;
    this.refresh();
  };

  setPaused(paused: boolean): void {
    this.director.setPaused(paused);
  }

  setCoach(on: boolean): void {
    this.screen.coach = on;
    this.coached ||= on;
    this.refresh();
  }

  get coach(): boolean {
    return this.screen.coach;
  }

  /** Whether the coach was on at any point: such a game sets no best-worth record. */
  get everCoached(): boolean {
    return this.coached;
  }

  private get person(): number {
    return personSeat(this.session);
  }

  private get myMove(): boolean {
    return this.session.awaitingPerson && this.session.actor === this.person;
  }

  // —— drawing ——

  refresh(): void {
    if (this.finished) return;
    const focused = document.activeElement as HTMLElement | null;
    const focusSelector =
      focused && this.root.contains(focused) && (focused.dataset.act || focused.dataset.action)
        ? Object.entries(focused.dataset)
            .map(
              ([key, value]) =>
                `[data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${value}"]`,
            )
            .join('')
        : null;
    renderHud(this.hud, {
      ...hudView(this.session, this.director, this.screen, this.options.framing),
      mapView: this.mapView,
    });
    this.renderOverlay();
    this.drawMap();
    if (focusSelector) this.root.querySelector<HTMLElement>(focusSelector)?.focus();
    const personOut = this.session.display.out[this.person] === true;
    if ((this.session.over || personOut) && !this.session.busy) this.maybeFinish();
    else this.steer();
  }

  /**
   * The end: the winner's moment over the town, then the recap. The recap waits for the last
   * moment on screen to end, and comes straight away for a player who went broke.
   */
  private maybeFinish(): void {
    if (this.director.moment || this.director.card || this.finishing) return;
    this.finishing = true;
    const { state, verdict } = this.session;
    const person = this.session.owner;
    const broke = this.session.display.out[person] === true;
    const winner = verdict ? (verdict.won ? person : null) : state.winner;
    const moment =
      winner !== null && !broke
        ? this.director.victory(this.session, winner, winner === person)
        : Promise.resolve(this.options.sound?.finale(false));
    void moment.then(() => {
      this.finished = true;
      this.session.end();
      this.options.onOver(this.session);
    });
  }

  /** Coins fly from the payer's token to the payee's purse in the players' panel. */
  private arcCoins(from: number, to: number, amount: number): void {
    const purse = this.hud.querySelectorAll<HTMLElement>('.dd-seat')[to]?.querySelector('.dd-coin');
    const start = this.world.tokenPosition(from);
    if (!purse || (!start && !this.map)) return;
    const origin = this.map
      ? { ...(this.map.tokenPoint(from) ?? { x: 0, y: 0 }), ahead: true }
      : this.world.screenPoint(start!.setY(start!.y + 1.5));
    if (!origin.ahead) return;
    const box = this.root.getBoundingClientRect();
    const target = purse.getBoundingClientRect();
    const end = {
      x: target.left + target.width / 2 - box.left,
      y: target.top + target.height / 2 - box.top,
    };
    const lift = Math.min(160, Math.abs(end.x - origin.x) * 0.35 + 60);
    const count = Math.min(6, 2 + Math.floor(amount / 120));
    const seconds = 0.75 / this.options.pace;
    for (let i = 0; i < count; i++) {
      const coin = element('span', 'dd-flying-coin', coinIcon());
      this.fx.append(coin);
      const mid = { x: (origin.x + end.x) / 2, y: Math.min(origin.y, end.y) - lift };
      coin
        .animate(
          [
            { transform: `translate(${origin.x}px, ${origin.y}px) scale(0.7)`, opacity: 0 },
            { transform: `translate(${mid.x}px, ${mid.y}px) scale(1.1)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${end.x}px, ${end.y}px) scale(0.8)`, opacity: 0.9 },
          ],
          { duration: seconds * 1000, delay: i * 70, easing: 'ease-in-out', fill: 'backwards' },
        )
        .finished.then(
          () => coin.remove(),
          () => coin.remove(),
        );
    }
  }

  private renderOverlay(): void {
    this.overlay.replaceChildren();
    const { state } = this.session;
    const phase = state.phase;
    if (this.director.moment) renderMoment(this.overlay, this.director.moment);
    if (this.director.card) {
      renderCard(this.overlay, this.director.card);
      return;
    }
    if (phase.kind === 'auction') {
      this.renderAuctionPanel();
      return;
    }
    if (
      phase.kind === 'trade' &&
      (phase.offer.to === this.person || phase.offer.from === this.person)
    ) {
      this.renderTradePanel();
      return;
    }
    if (
      phase.kind === 'debt' &&
      phase.seat === this.person &&
      this.myMove &&
      this.screen.panel !== 'trade'
    ) {
      this.renderDebtPanel(-state.seats[this.person]!.coins);
      return;
    }
    if (this.screen.panel === 'trade' && this.draft) {
      this.renderTradePanel();
      return;
    }
    if (this.screen.panel === 'build') this.renderBuildPanel();
    if (this.screen.panel === 'mortgage') this.renderMoneyPanel();
    if (this.notice && this.notice.until > performance.now())
      renderNotice(this.overlay, this.notice.text);
  }

  private say(text: string): void {
    this.notice = { text, until: performance.now() + 2600 };
    this.renderOverlay();
  }

  private renderBuildPanel(): void {
    const theme = BOARDS[this.session.state.board];
    const rows: ListRow[] = buildOptions(this.session).map((o) => ({
      act: 'do-build',
      space: o.space,
      title: `${o.level === 5 ? 'Landmark' : `Storey ${o.level}`} on ${theme.spaces[o.space]}`,
      ...(this.screen.coach && o.advice ? { detail: o.advice } : {}),
      amount: o.cost,
    }));
    renderList(
      this.overlay,
      'Build',
      rows,
      'Own a whole district, with no lot mortgaged, to build on it.',
    );
  }

  private renderMoneyPanel(): void {
    const theme = BOARDS[this.session.state.board];
    const rows: ListRow[] = moneyOptions(this.session).map((m) => ({
      act: `do-${m.kind}`,
      space: m.space,
      title: `${m.kind === 'sell' ? 'Sell a storey on' : m.kind === 'mortgage' ? 'Mortgage' : 'Pay off'} ${theme.spaces[m.space]}`,
      amount: m.amount,
      tone: m.kind === 'unmortgage' ? 'loss' : 'gain',
    }));
    renderList(
      this.overlay,
      'Mortgage and sell',
      rows,
      'Nothing to mortgage, sell or pay off right now.',
    );
  }

  private renderDebtPanel(short: number): void {
    const theme = BOARDS[this.session.state.board];
    const moves = moneyOptions(this.session, false).map((m) => ({
      act: `do-${m.kind}`,
      space: m.space,
      label: `${m.kind === 'sell' ? 'Sell a storey on' : 'Mortgage'} ${theme.spaces[m.space]}`,
      amount: m.amount,
    }));
    renderDebt(this.overlay, { short, moves });
  }

  private renderAuctionPanel(): void {
    const { state } = this.session;
    if (state.phase.kind !== 'auction') return;
    const auction = state.phase.auction;
    const theme = BOARDS[state.board];
    const group = groupOf(auction.space);
    const calling = auction.bidders[auction.at]!;
    const high = auction.high?.amount ?? 0;
    const mine = this.myMove && calling === this.person;
    const purse = state.seats[this.person]!.coins;
    const bids = [Math.max(10, high + 10), high + 50, high + 100].filter(
      (b, i, all) => all.indexOf(b) === i && (b <= purse || state.rules.bankLends),
    );
    renderAuction(this.overlay, {
      lot: theme.spaces[auction.space]!,
      groupColour: group === null ? '#4b5563' : theme.groups[group]!.colour,
      price: deedOf(state, auction.space).price,
      high: auction.high
        ? { name: this.nameOf(auction.high.seat), amount: auction.high.amount }
        : null,
      bidders: state.seats.flatMap((seat, index) =>
        seat.out
          ? []
          : [
              {
                name: this.nameOf(index),
                colour: SEAT_COLOURS[index]!,
                ...(seat.personality ? { portrait: seat.personality } : {}),
                token: seat.token,
                passed: !auction.bidders.includes(index),
                calling: index === calling,
              },
            ],
      ),
      yourCall: mine ? { bids, clock: 1 - (this.clock?.elapsed ?? 0) / AUCTION_CLOCK } : null,
    });
  }

  private nameOf(seat: number): string {
    return who(this.session.state, seat);
  }

  private partnerView(seat: number): TablePartner {
    const s = this.session.state.seats[seat]!;
    const personality = s.personality ? PERSONALITIES[s.personality] : null;
    return {
      seat,
      name: personality?.name ?? s.name,
      title: personality?.title ?? '',
      colour: SEAT_COLOURS[seat]!,
      ...(s.personality ? { portrait: s.personality } : {}),
      token: s.token,
    };
  }

  private deedChips(
    owner: number,
    chosen: ReadonlySet<number>,
    changed: ReadonlySet<number> = new Set(),
  ): TableDeed[] {
    const { state } = this.session;
    const theme = BOARDS[state.board];
    return DEED_SPACES.filter((s) => state.deeds[s]!.owner === owner || chosen.has(s)).map(
      (space) => {
        const group = groupOf(space);
        const kind = LAYOUT[space]!.kind;
        return {
          space,
          name: theme.spaces[space]!,
          groupName:
            group === null
              ? kind === 'transit'
                ? 'Transit'
                : 'Utility'
              : theme.groups[group]!.name,
          groupColour: group === null ? '#4b5563' : theme.groups[group]!.colour,
          value: deedOf(state, space).price,
          mortgaged: state.deeds[space]!.mortgaged,
          chosen: chosen.has(space),
          changed: changed.has(space),
          ...(state.rules.tradeOnlyUnbuilt && group !== null && groupHasBuildings(state, group)
            ? { blocked: 'Sell the district’s buildings before trading it.' }
            : {}),
        };
      },
    );
  }

  private renderTradePanel(): void {
    const { state } = this.session;
    const phase = state.phase;
    const others = state.seats.flatMap((s, i) =>
      i !== this.person && !s.out ? [this.partnerView(i)] : [],
    );
    if (phase.kind === 'trade' && phase.offer.to === this.person) {
      // An offer to the person: from their side, what they give is what the rival asks for.
      const offer = phase.offer;
      const before = this.lastOffer && this.lastOffer.to === offer.from ? this.lastOffer : null;
      const giveSet = new Set(offer.get.deeds);
      const getSet = new Set(offer.give.deeds);
      const changedGive = new Set(
        [...giveSet].filter((s) => before && !before.give.deeds.includes(s)),
      );
      const changedGet = new Set(
        [...getSet].filter((s) => before && !before.get.deeds.includes(s)),
      );
      const meter = this.meterFor({
        from: this.person,
        to: offer.from,
        give: offer.get,
        get: offer.give,
      });
      const line =
        this.session.lastLine && this.session.lastLine.seat === offer.from
          ? this.session.lastLine.text
          : '';
      renderTable(this.overlay, {
        mode: 'incoming',
        partners: others,
        partner: this.partnerView(offer.from),
        mine: this.deedChips(this.person, giveSet, changedGive).filter((d) => d.chosen),
        theirs: this.deedChips(offer.from, getSet, changedGet).filter((d) => d.chosen),
        giveCoins: offer.get.coins,
        getCoins: offer.give.coins,
        coinsChanged: {
          give: before !== null && offer.get.coins !== before.give.coins,
          get: before !== null && offer.give.coins !== before.get.coins,
        },
        ...(meter ? { meter } : {}),
        reply: { kind: before ? 'counter' : 'offer', text: line },
      });
      return;
    }
    if (phase.kind === 'trade' && phase.offer.from === this.person) {
      // The rival is thinking about the person's offer.
      const offer = phase.offer;
      renderTable(this.overlay, {
        mode: 'incoming',
        partners: others,
        partner: this.partnerView(offer.to),
        mine: this.deedChips(this.person, new Set(offer.give.deeds)).filter((d) => d.chosen),
        theirs: this.deedChips(offer.to, new Set(offer.get.deeds)).filter((d) => d.chosen),
        giveCoins: offer.give.coins,
        getCoins: offer.get.coins,
        reply: { kind: 'offer', text: `${this.nameOf(offer.to)} is thinking it over…` },
      });
      this.overlay
        .querySelectorAll('.dd-trade-actions button')
        .forEach((b) => ((b as HTMLButtonElement).disabled = true));
      return;
    }
    const draft = this.draft;
    if (!draft) return;
    const offer = this.draftOffer(draft);
    const problem = whyNotOffer(state, offer);
    const meter = problem ? undefined : this.meterFor(offer);
    renderTable(this.overlay, {
      mode: 'compose',
      partners: others,
      partner: this.partnerView(draft.partner),
      mine: this.deedChips(this.person, draft.give),
      theirs: this.deedChips(draft.partner, draft.get),
      giveCoins: draft.giveCoins,
      getCoins: draft.getCoins,
      ...(meter ? { meter } : {}),
      ...(draft.reply ? { reply: draft.reply } : {}),
      ...(problem && problem !== 'The offer is empty.' ? { problem } : {}),
    });
    if (problem)
      this.overlay.querySelector<HTMLButtonElement>('[data-act="offer"]')!.disabled = true;
  }

  private meterFor(offer: TradeOffer) {
    if (!this.screen.coach) return undefined;
    const reading = tradeMeter(this.session.state, offer);
    return {
      balance: reading.balance,
      give: reading.offerer,
      get: reading.receiver,
      text: reading.text,
    };
  }

  private draftOffer(draft: Draft): TradeOffer {
    return {
      from: this.person,
      to: draft.partner,
      give: { deeds: [...draft.give], coins: draft.giveCoins, cards: 0 },
      get: { deeds: [...draft.get], coins: draft.getCoins, cards: 0 },
    };
  }

  // —— the heat map ——

  private readonly heatDots: HTMLElement[] = [];

  private buildHeat(): void {
    for (const space of DEED_SPACES) {
      const dot = element('span', 'dd-heat-dot');
      dot.dataset.space = String(space);
      this.heat.append(dot);
      this.heatDots.push(dot);
    }
  }

  /** The coach's landing heat shows while it is your move and nothing else is open. */
  private heatShown(): boolean {
    const phase = this.session.state.phase;
    return (
      this.screen.coach &&
      this.myMove &&
      (phase.kind === 'turn' || phase.kind === 'after') &&
      this.screen.panel === 'none'
    );
  }

  private tick(seconds: number): void {
    // On the map the heat tints the tiles themselves.
    const show = this.heatShown() && !this.map;
    this.heat.hidden = !show;
    if (show) {
      const heat = landingHeat(this.session.state);
      for (const dot of this.heatDots) {
        const space = Number(dot.dataset.space);
        const point = this.world.screenPoint(this.world.lotPoint(space, 0.4));
        const h = heat[space]!;
        dot.style.transform = `translate(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px) scale(${(0.55 + h * 0.75).toFixed(2)})`;
        dot.style.opacity = point.ahead ? (0.25 + (h - 0.6) * 1.6).toFixed(2) : '0';
      }
    }
    this.auctionTick(seconds);
    if (this.notice && this.notice.until <= performance.now()) {
      this.notice = null;
      this.renderOverlay();
    }
  }

  private auctionTick(seconds: number): void {
    const phase = this.session.state.phase;
    if (
      phase.kind !== 'auction' ||
      !this.myMove ||
      phase.auction.bidders[phase.auction.at] !== this.person
    ) {
      this.clock = null;
      return;
    }
    const key = `${phase.auction.space}:${phase.auction.high?.amount ?? 0}:${phase.auction.bidders.length}`;
    if (!this.clock || this.clock.key !== key) this.clock = { key, elapsed: 0 };
    if (this.director.card) return;
    this.clock.elapsed += seconds * this.options.pace;
    const bar = this.overlay.querySelector<HTMLElement>('.dd-auction-clock span');
    if (bar)
      bar.style.width = `${Math.max(0, (1 - this.clock.elapsed / AUCTION_CLOCK) * 100).toFixed(1)}%`;
    if (this.clock.elapsed >= AUCTION_CLOCK) {
      this.clock = null;
      void this.act({ type: 'pass', seat: this.person });
    }
  }

  // —— hands on the game ——

  private async act(action: Action): Promise<void> {
    if (action.type === 'propose') this.lastOffer = action.offer;
    const reason = await this.session.act(action);
    if (reason) this.say(reason);
    this.afterAct(action);
  }

  private afterAct(action: Action): void {
    const phase = this.session.state.phase;
    if (action.type === 'propose' && this.draft) {
      // The rival has answered: a deal closes the table; a plain no keeps it open to try again.
      const line = this.session.lastLine;
      if (phase.kind === 'trade') return;
      const accepted = line?.action.type === 'answer' && line.action.accept;
      if (accepted) {
        this.draft = null;
        this.screen.panel = 'none';
      } else if (line) {
        this.draft.reply = { kind: 'decline', text: line.text };
      }
    }
    if (action.type === 'answer' || action.type === 'endTurn') {
      this.draft = null;
      if (this.screen.panel === 'trade') this.screen.panel = 'none';
    }
    if (
      (action.type === 'build' ||
        action.type === 'mortgage' ||
        action.type === 'unmortgage' ||
        action.type === 'sell') &&
      this.screen.panel !== 'none'
    ) {
      // Keep the list open for the next storey, unless nothing is left in it.
      const empty =
        this.screen.panel === 'build'
          ? buildOptions(this.session).length === 0
          : moneyOptions(this.session).length === 0;
      if (empty) this.screen.panel = 'none';
    }
    this.refresh();
  }

  private openTrade(partner?: number): void {
    const others = this.session.state.seats.flatMap((s, i) =>
      i !== this.person && !s.out ? [i] : [],
    );
    if (others.length === 0) return;
    this.draft = {
      partner: partner ?? others[0]!,
      give: new Set(),
      get: new Set(),
      giveCoins: 0,
      getCoins: 0,
    };
    this.screen.panel = 'trade';
    this.refresh();
  }

  /** Turns an offer from a rival into a draft the person can change and send back. */
  private counterDraft(): void {
    const phase = this.session.state.phase;
    if (phase.kind !== 'trade' || phase.offer.to !== this.person) return;
    const offer = phase.offer;
    this.draft = {
      partner: offer.from,
      give: new Set(offer.get.deeds),
      get: new Set(offer.give.deeds),
      giveCoins: offer.get.coins,
      getCoins: offer.give.coins,
    };
    this.screen.panel = 'trade';
    this.countering = true;
    this.refresh();
  }

  private sendDraft(): void {
    if (!this.draft) return;
    const offer = this.draftOffer(this.draft);
    const phase = this.session.state.phase;
    if (this.countering && phase.kind === 'trade' && phase.offer.to === this.person) {
      this.countering = false;
      this.lastOffer = offer;
      void this.act({ type: 'answer', accept: false, counter: offer });
      return;
    }
    void this.act({ type: 'propose', offer });
  }

  private onClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act], [data-action]');
    if (!target || (target as HTMLButtonElement).disabled) return;
    const act = target.dataset.act ?? target.dataset.action!;
    this.dispatch(act, target.dataset);
    // After a mouse click Enter should mean the main choice again, not this button.
    if ((event as MouseEvent).detail > 0) (document.activeElement as HTMLElement | null)?.blur();
  }

  private dispatch(act: string, data: DOMStringMap): void {
    const space = data.space !== undefined ? Number(data.space) : -1;
    switch (act) {
      case 'roll':
        return void this.act({ type: 'roll' });
      case 'buy':
        return void this.act({ type: 'buy' });
      case 'pass':
        return void this.act({ type: 'decline' });
      case 'fine':
        return void this.act({ type: 'payFine' });
      case 'card':
        return void this.act({ type: 'useCard' });
      case 'tax-flat':
        return void this.act({ type: 'taxChoice', choice: 'flat' });
      case 'tax-tenth':
        return void this.act({ type: 'taxChoice', choice: 'tenth' });
      case 'end':
        this.screen.panel = 'none';
        return void this.act({ type: 'endTurn' });
      case 'build':
      case 'mortgage':
        this.screen.panel = this.screen.panel === act ? 'none' : act;
        return this.refresh();
      case 'trade':
        return this.openTrade();
      case 'map':
        this.setMapView(!this.mapView);
        return this.options.onMapView?.(this.mapView);
      case 'close':
        this.screen.panel = 'none';
        this.draft = null;
        this.countering = false;
        return this.refresh();
      case 'do-build':
        return void this.act({ type: 'build', space });
      case 'do-mortgage':
        return void this.act({ type: 'mortgage', space });
      case 'do-unmortgage':
        return void this.act({ type: 'unmortgage', space });
      case 'do-sell':
        return void this.act({ type: 'sell', space });
      case 'card-ok':
        return this.director.dismissCard();
      case 'bid':
        return void this.act({ type: 'bid', seat: this.person, amount: Number(data.amount) });
      case 'fold':
        return void this.act({ type: 'pass', seat: this.person });
      case 'partner':
        return this.openTrade(Number(data.seat));
      case 'toggle': {
        if (!this.draft) return;
        const set = data.side === 'give' ? this.draft.give : this.draft.get;
        if (set.has(space)) set.delete(space);
        else set.add(space);
        delete this.draft.reply;
        return this.refresh();
      }
      case 'coins': {
        if (!this.draft) return;
        const key = data.side === 'give' ? 'giveCoins' : 'getCoins';
        this.draft[key] = Math.max(0, this.draft[key] + Number(data.delta));
        delete this.draft.reply;
        return this.refresh();
      }
      case 'offer':
        return this.sendDraft();
      case 'accept':
        return void this.act({ type: 'answer', accept: true });
      case 'decline':
        return void this.act({ type: 'answer', accept: false });
      case 'counter':
        return this.counterDraft();
      case 'resign': {
        const now = performance.now();
        if (now - this.confirmLeave > 3000) {
          this.confirmLeave = now;
          return this.say(
            'Press again to leave the game: everything you own goes to whoever you owe.',
          );
        }
        return void this.act({ type: 'resign' });
      }
      default:
        return;
    }
  }

  private readonly onWorldClick = (event: MouseEvent): void => {
    const box = this.world.stage.canvas.getBoundingClientRect();
    const space = this.world.pickLot(event.clientX - box.left, event.clientY - box.top);
    this.screen.selected = space === this.screen.selected ? null : space;
    this.refresh();
  };

  /** The rows a number key picks in the open list. */
  private numbered(): HTMLElement[] {
    return [
      ...this.overlay.querySelectorAll<HTMLElement>(
        '.dd-rows [data-act], .dd-auction-bids [data-act="bid"], .dd-trade-tabs [data-act]',
      ),
    ];
  }

  /** Handles a key for the play screen; returns true if it was used. */
  handleKey(event: KeyboardEvent): boolean {
    if (this.finished) return false;
    const key = event.key;
    const phase = this.session.state.phase;
    if (this.director.card) {
      if (key === 'Enter' || key === ' ' || key === 'Escape') {
        this.director.dismissCard();
        return true;
      }
      return false;
    }
    // While a move is being shown, Enter or Space cuts the moment short.
    if (this.session.busy || this.finishing) {
      if (key === 'Enter' || key === ' ') {
        this.director.skip();
        return true;
      }
      if (this.finishing) return false;
    }
    if (/^[1-9]$/.test(key)) {
      const pick = this.numbered()[Number(key) - 1];
      if (pick && !(pick as HTMLButtonElement).disabled) {
        this.dispatch(pick.dataset.act!, pick.dataset);
        return true;
      }
    }
    const tradeOpen = phase.kind === 'trade' || (this.screen.panel === 'trade' && this.draft);
    if (tradeOpen) {
      if (
        key === 'Enter' &&
        !(
          document.activeElement instanceof HTMLButtonElement &&
          document.activeElement.closest('.dd-trade')
        )
      ) {
        const primary = this.overlay.querySelector<HTMLButtonElement>(
          '.dd-trade-actions .dd-action--primary',
        );
        if (primary && !primary.disabled) this.dispatch(primary.dataset.act!, primary.dataset);
        return true;
      }
      if (key === 'Escape') {
        this.dispatch(
          phase.kind === 'trade' && phase.offer.to === this.person && !this.countering
            ? 'decline'
            : 'close',
          {},
        );
        return true;
      }
      if ((key === 'c' || key === 'C') && phase.kind === 'trade') {
        this.counterDraft();
        return true;
      }
      return false;
    }
    if (phase.kind === 'auction') {
      if (key === 'p' || key === 'P') {
        this.dispatch('fold', {});
        return true;
      }
      return false;
    }
    if (phase.kind === 'debt') {
      const act =
        key === 't' || key === 'T' ? 'trade' : key === 'l' || key === 'L' ? 'resign' : null;
      if (!act) return false;
      this.dispatch(act, {});
      return true;
    }
    if (key === 'Escape') {
      if (this.screen.panel !== 'none' || this.screen.selected !== null) {
        this.screen.panel = 'none';
        this.screen.selected = null;
        this.refresh();
        return true;
      }
      return false;
    }
    if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown') {
      this.stepSelection(key === 'ArrowRight' || key === 'ArrowUp' ? 1 : -1);
      return true;
    }
    if (key === 'v' || key === 'V') {
      this.dispatch('map', {});
      return true;
    }
    // F pays: the lock-up's fine, or the flat sum at the Berkeley income tax.
    const shortcut: Record<string, readonly string[]> = {
      ' ': ['roll'],
      b: ['buy'],
      p: ['pass'],
      f: ['fine', 'tax-flat'],
      w: ['tax-tenth'],
      u: ['card'],
      h: ['build'],
      m: ['mortgage'],
      t: ['trade'],
      e: ['end'],
    };
    const primary = this.primaryAction();
    const wanted = key === 'Enter' ? (primary ? [primary] : null) : shortcut[key.toLowerCase()];
    if (!wanted) return false;
    for (const action of wanted) {
      const button = this.hud.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (!button || button.disabled) continue;
      this.dispatch(action, button.dataset);
      break;
    }
    return true;
  }

  private primaryAction(): string | undefined {
    return this.hud.querySelector<HTMLButtonElement>('.dd-action--primary:not(:disabled)')?.dataset
      .action;
  }

  /** Arrow keys walk the picked lot round the board, deeds only. */
  private stepSelection(direction: number): void {
    const start = this.screen.selected ?? this.session.display.positions[this.person]!;
    let space = start;
    do space = (space + direction + 40) % 40;
    while (!DEED_SPACES.includes(space));
    this.screen.selected = space;
    this.refresh();
  }
}
