import type { PauseMenuItem, ResultReceipt } from '@usr-games/kit';
import type { DailyRoom } from '../../data/daily';
import type { PlayableRoom } from '../../data/house';
import { ROOMS } from '../../data/house';
import { createRoom } from '../../engine/room';
import { legality, mustZoom } from '../../engine/rules';
import { starCount, starsFor, scoreRoom } from '../../engine/scoring';
import {
  canUndo,
  current,
  initialState,
  type NightSession,
  nextWave,
  nightScore,
  nightTangled,
  play,
  type RoomSession,
  startNight,
  startSession,
  undo,
} from '../../engine/session';
import { solve } from '../../engine/solver';
import type { Action, Point, RoomState, Step, TurnEvent } from '../../engine/types';
import {
  type LadderRun,
  nightLadder,
  type NightLadderRun,
  rivalsBehind,
  roomLadder,
} from '../../game/ladder';
import { addDaily, addNight, mergeRoomRecord, PACE_FACTOR, starsEarned } from '../../game/saves';
import { BoardView } from '../../render/board-view';
import { RIVAL_COATS, type SceneTheme } from '../../render/palette';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { MOVES, type MoveAction } from '../keys';
import { PlayPanel } from './play-panel';
import { introCard, nightResults, roomResults, waveCard } from './results';

/**
 * Playing a room: the House, Today's Mess or the Long Night. Input becomes actions, actions go
 * through the rules, and the board animates what happened. Steps can be typed faster than they
 * animate: a new step finishes the current animation at once and goes next.
 */

export type PlayMode =
  | { kind: 'house'; room: PlayableRoom }
  | { kind: 'daily'; room: DailyRoom; dateKey: string; number: number }
  | { kind: 'night'; seed: string; startWave: number };

const LOAF_LIMIT = 300;

export function playScreen(app: App, mode: PlayMode): Screen {
  return new PlayScreen(app, mode).screen;
}

class PlayScreen {
  readonly screen: Screen;
  private board = h('div', { class: 'zm-board' });
  private canvas = h('canvas', {
    tabindex: '0',
    role: 'application',
    'aria-roledescription': 'game board',
    'aria-label': 'The room. Use the movement keys to step, or click a square next to the cat.',
    dataset: { testid: 'zm-board' },
  });
  private view: BoardView;
  private panel: PlayPanel;
  private session: RoomSession;
  private night: NightSession | null = null;
  private par: { turns: number; actions: readonly Action[] } | null = null;
  private ladder: LadderRun[] | null = null;
  private nightRivals: NightLadderRun[] | null = null;
  private busy = false;
  private pending: (() => Promise<unknown>) | null = null;
  private stopLoaf = false;
  private ended = false;
  private overlay: HTMLElement | null = null;
  private resultsPane: HTMLElement | null = null;
  private playElement!: HTMLElement;
  private startedAt = performance.now();
  private observer: ResizeObserver;
  private dragFrom: Point | null = null;
  private watching = false;
  /** A loss is reported only once the player moves on: an undo takes it back. */
  private pendingLoss: (() => void) | null = null;

  constructor(
    private app: App,
    private mode: PlayMode,
  ) {
    if (mode.kind === 'night') {
      this.night = startNight(mode.seed, mode.startWave);
      this.session = this.night.room;
    } else {
      this.session = startSession(createRoom(mode.room.spec));
      this.par =
        mode.kind === 'daily'
          ? { turns: mode.room.solution.turns, actions: mode.room.solution.actions }
          : this.solvePar(mode.room);
    }
    const prefs = app.saves.prefs.load();
    this.view = new BoardView(this.canvas, {
      look: app.look,
      theme: this.theme(),
      coat: app.coat(),
      reducedMotion: app.reducedMotion,
      pace: PACE_FACTOR[prefs.pace] * (mode.kind === 'night' ? 0.8 : 1),
      whiskers: prefs.whiskers,
    });
    this.view.setRoom(current(this.session), this.theme(), this.roomSeed());
    this.panel = new PlayPanel(app, this.panelInfo(), {
      loaf: () => this.request(() => this.loafRun('loaf')),
      zoom: () => this.request(() => this.act({ type: 'zoom' })),
      undo: () => this.undo(),
      nap: () => this.request(() => this.loafRun('nap')),
      toggleWhiskers: () => this.toggleWhiskers(),
    });
    this.board.append(this.canvas);
    const element = h(
      'section',
      {
        class: mode.kind === 'night' ? 'zm-screen zm-play zm-play--wide' : 'zm-screen zm-play',
        'aria-label': this.panelInfo().title,
      },
      this.board,
      this.panel.element,
    );
    this.playElement = element;
    this.observer = new ResizeObserver(() =>
      this.view.resize(this.board.clientWidth, this.board.clientHeight),
    );
    this.observer.observe(this.board);
    this.bindPointer();
    this.view.start();
    this.refresh();
    this.panel.say(this.openingLine());
    this.screen = {
      element,
      pauseItems: this.pauseItems(),
      onKey: (event) => this.onKey(event),
      onLook: (look, reducedMotion) => this.view.setOptions({ look, reducedMotion }),
      onPause: () => {
        this.stopLoaf = true;
      },
      focus: () => this.canvas.focus({ preventScroll: true }),
      destroy: () => {
        this.flushLoss();
        this.observer.disconnect();
        this.view.destroy();
      },
    };
    requestAnimationFrame(() => this.showIntro());
    // The rivals play the same room in the background; their results wait for the end.
    setTimeout(() => this.prepareRivals(), 30);
  }

  // -------------------------------------------------------------------------------------------
  // Mode details

  private theme(): SceneTheme {
    if (this.mode.kind === 'night') return 'great-hall';
    return this.mode.kind === 'house' ? this.mode.room.id : this.mode.room.theme;
  }

  private roomSeed(): number {
    const text =
      this.mode.kind === 'night'
        ? `${this.mode.seed}/${this.night?.wave}`
        : this.mode.room.spec.seed;
    let hash = 7;
    for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return hash % 100000;
  }

  private solvePar(room: PlayableRoom) {
    const solution = solve(createRoom(room.spec), { maxNodes: 2_000_000 });
    return { turns: room.par, actions: solution?.actions ?? [] };
  }

  private panelInfo() {
    const mode = this.mode;
    if (mode.kind === 'house') {
      return {
        eyebrow: `Room ${mode.room.index + 1} of ${ROOMS.length}`,
        title: mode.room.name,
        idea: mode.room.idea,
        par: mode.room.par,
        rules: 'house' as const,
        canUndo: true,
      };
    }
    if (mode.kind === 'daily') {
      return {
        eyebrow: `Today’s mess #${mode.number}`,
        title: mode.room.label,
        idea: 'One room for everyone today. The cats next door are playing it too.',
        par: mode.room.solution.turns,
        rules: 'house' as const,
        canUndo: true,
      };
    }
    return {
      eyebrow: `Long Night · wave ${this.night?.wave ?? 1}`,
      title: 'The great hall',
      idea: 'The 1980 original, rule for rule: ten more vacuums every wave.',
      par: null,
      rules: 'classic' as const,
      canUndo: false,
    };
  }

  private openingLine(): string {
    if (this.mode.kind === 'night')
      return 'Every vacuum rolls one square toward you after each move. Make them bump.';
    return 'Your move. After every step, each vacuum rolls one square toward you.';
  }

  private prepareRivals() {
    if (this.mode.kind === 'night')
      this.nightRivals = nightLadder(this.mode.seed, this.mode.startWave);
    else if (this.par) this.ladder = roomLadder(initialState(this.session), this.par);
  }

  private pauseItems(): PauseMenuItem[] {
    const items: PauseMenuItem[] = [
      {
        id: 'restart',
        label: this.mode.kind === 'night' ? 'Start the night again' : 'Restart the room',
        run: () => this.restart(),
      },
    ];
    if (this.mode.kind === 'house')
      items.push({ id: 'house', label: 'House map', run: () => this.app.go.house() });
    return items;
  }

  private restart() {
    if (this.mode.kind === 'house') this.app.go.room(this.mode.room.id);
    else if (this.mode.kind === 'daily') this.app.go.daily();
    else this.app.go.night(this.mode.startWave);
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private onKey(event: KeyboardEvent): boolean {
    if (this.overlay) return this.overlayKey(event);
    if (this.watching) return false;
    const action = this.app.keys.actionFor(event);
    if (!action || event.repeat) return action !== null;
    if (action in MOVES) {
      const [dx, dy] = MOVES[action as MoveAction];
      this.step(dx, dy);
    } else if (action === 'loaf') this.request(() => this.loafRun('loaf'));
    else if (action === 'zoom') this.request(() => this.act({ type: 'zoom' }));
    else if (action === 'undo') this.undo();
    else if (action === 'nap' && this.mode.kind === 'night')
      this.request(() => this.loafRun('nap'));
    else if (action === 'whiskers') this.toggleWhiskers();
    return true;
  }

  private overlayKey(event: KeyboardEvent): boolean {
    const keyed = this.overlay?.querySelector<HTMLButtonElement>(
      `[data-key="${event.key.toLowerCase()}"]`,
    );
    if (keyed && !event.ctrlKey && !event.metaKey && !event.altKey) {
      keyed.click();
      return true;
    }
    return false;
  }

  private bindPointer() {
    this.canvas.addEventListener('pointermove', (event) => {
      if (this.overlay || this.watching) return;
      const cell = this.view.cellFromClient(event.clientX, event.clientY);
      const cat = current(this.session).cat;
      const near = cell && Math.max(Math.abs(cell.x - cat.x), Math.abs(cell.y - cat.y)) <= 1;
      this.view.setHover(near ? cell : null);
    });
    this.canvas.addEventListener('pointerleave', () => this.view.setHover(null));
    this.canvas.addEventListener('pointerdown', (event) => {
      if (this.overlay || this.watching) return;
      this.dragFrom = this.view.cellFromClient(event.clientX, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointerup', (event) => {
      const from = this.dragFrom;
      this.dragFrom = null;
      if (this.overlay || this.watching || !from) return;
      const to = this.view.cellFromClient(event.clientX, event.clientY);
      const cat = current(this.session).cat;
      // Dragging the cat to a square works like clicking that square.
      const target = to ?? from;
      const fromCat = from.x === cat.x && from.y === cat.y;
      const aim = fromCat && to ? to : target;
      this.step(Math.sign(aim.x - cat.x) as Step, Math.sign(aim.y - cat.y) as Step);
    });
  }

  private step(dx: Step, dy: Step) {
    this.request(() => this.act({ type: 'step', dx, dy }));
  }

  /** Queues work; a new request ends the running animation and any loaf at once. */
  private request(work: () => Promise<unknown>) {
    if (this.ended || this.watching) return;
    this.stopLoaf = true;
    if (this.busy) {
      this.pending = work;
      this.view.finish();
      return;
    }
    void this.run(work);
  }

  private async run(work: () => Promise<unknown>) {
    this.busy = true;
    try {
      await work();
    } finally {
      this.busy = false;
    }
    const next = this.pending;
    this.pending = null;
    if (next && !this.ended) void this.run(next);
  }

  // -------------------------------------------------------------------------------------------
  // Turns

  private carefulPaws(): boolean {
    // The original always refused a step into reach; the house lets you switch that off.
    return this.mode.kind === 'night' || this.app.saves.prefs.load().carefulPaws;
  }

  private async act(action: Action): Promise<boolean> {
    const before = current(this.session);
    if (before.status !== 'playing') return false;
    const verdict = legality(before, action);
    if (verdict === 'blocked') {
      this.refuse('That square is taken.');
      return false;
    }
    if (
      verdict === 'unsafe' &&
      this.carefulPaws() &&
      !(action.type === 'wait' && action.mode === 'nap')
    ) {
      this.refuse(
        action.type === 'step' && action.dx === 0 && action.dy === 0
          ? 'Staying put here gets you caught. Move, or zoom.'
          : 'Not there: a vacuum could reach that square.',
      );
      return false;
    }
    const { session, events } = play(this.session, action);
    this.setSession(session);
    const after = current(session);
    this.app.sounds.turn(events);
    this.checkPackages(events);
    this.describe(events, after);
    this.refresh();
    await this.view.animateTurn(before, after, events);
    if (after.status !== 'playing') await this.finishRoom(after);
    else if (mustZoom(after) && action.type !== 'wait') {
      this.panel.say('Nowhere safe to step. Time to zoom!', true);
      this.panel.shakeZoom();
    }
    return true;
  }

  private setSession(session: RoomSession) {
    this.session = session;
    if (this.night) this.night = { ...this.night, room: session };
  }

  private async loafRun(mode: 'loaf' | 'nap') {
    this.stopLoaf = false;
    this.view.setLoafing(true);
    this.app.sounds.play('purr');
    let turns = 0;
    try {
      while (!this.stopLoaf && turns < LOAF_LIMIT) {
        const state = current(this.session);
        if (state.status !== 'playing') break;
        const action: Action = { type: 'wait', mode };
        if (mode === 'loaf' && legality(state, action) !== 'ok') {
          this.panel.say(
            turns === 0
              ? 'Too close to loaf: something can reach you. Move, or zoom.'
              : 'Loafing over: something came close. Your move.',
            turns === 0,
          );
          if (turns === 0) this.app.sounds.play('refuse');
          break;
        }
        const acted = await this.act(action);
        if (!acted) break;
        turns++;
      }
    } finally {
      this.view.setLoafing(false);
    }
  }

  private undo() {
    if (this.mode.kind === 'night' || !canUndo(this.session) || this.watching) return;
    this.stopLoaf = true;
    this.view.finish();
    this.pending = null;
    const wasOver = current(this.session).status !== 'playing';
    this.pendingLoss = null;
    this.setSession(undo(this.session));
    if (wasOver) {
      this.ended = false;
      this.closeOverlay();
      this.restoreTrails();
    } else this.view.showState(current(this.session));
    this.refresh();
    this.panel.say('Undone. Your move.');
  }

  private refuse(text: string) {
    this.app.sounds.play('refuse');
    this.panel.say(text, true);
    this.canvas.classList.remove('zm-shake');
    void this.canvas.offsetWidth;
    this.canvas.classList.add('zm-shake');
  }

  private toggleWhiskers() {
    const on = !this.app.saves.prefs.load().whiskers;
    this.app.saves.prefs.update((p) => ({ ...p, whiskers: on }));
    this.view.setOptions({ whiskers: on });
    this.panel.setWhiskers(on);
    this.panel.say(
      on
        ? 'Whiskers on: hatched squares are within a vacuum’s reach.'
        : 'Whiskers off. Trust your instincts.',
    );
  }

  private refresh() {
    const state = current(this.session);
    this.panel.update(state, {
      canUndo: this.mode.kind !== 'night' && canUndo(this.session),
      score: this.night ? nightScore(this.night) : undefined,
      wave: this.night?.wave,
    });
  }

  private describe(events: readonly TurnEvent[], after: RoomState) {
    const left = after.vacuums.filter((v) => v.alive).length;
    const tangled = events
      .filter((e) => e.type === 'bonk')
      .reduce((n, e) => n + (e.type === 'bonk' ? e.ids.length : 0), 0);
    const zoom = events.find((e) => e.type === 'cat-zoom');
    const lines: string[] = [];
    if (zoom && zoom.type === 'cat-zoom')
      lines.push(zoom.safe ? 'Zoom! A safe landing.' : 'Zoom! Wherever you land, you land.');
    if (tangled >= 4) lines.push(`Pile-up! ${tangled} vacuums tangled at once.`);
    else if (tangled > 0)
      lines.push(
        tangled === 1 ? 'Stuck! One rolled into a tangle.' : `Bonk! ${tangled} vacuums tangled.`,
      );
    if (events.some((e) => e.type === 'gulp')) lines.push('Gulp! The shop vac swallowed a tangle.');
    if (events.some((e) => e.type === 'safe-zoom-earned'))
      lines.push('Loafing paid off: a safe zoom earned.');
    if (events.some((e) => e.type === 'dock-spawn'))
      lines.push('The dock sent out another vacuum.');
    if (events.some((e) => e.type === 'dock-jammed')) lines.push('The dock is jammed for good.');
    if (after.status === 'playing' && (tangled > 0 || lines.length === 0))
      lines.push(left === 1 ? 'One vacuum left.' : `${left} vacuums left.`);
    this.panel.say(lines.join(' '));
  }

  private checkPackages(events: readonly TurnEvent[]) {
    let tangledNow = 0;
    for (const event of events) {
      if (event.type === 'bonk') {
        tangledNow += event.ids.length;
        if (event.ids.length >= 2 && event.onTangle === null) this.app.install('first-bonk');
        if (event.onTangle === 'sock') this.app.install('sock-trap');
      }
      if (event.type === 'safe-zoom-earned') this.app.install('earned-loaf');
      if (event.type === 'dock-jammed') this.app.install('jammed-dock');
    }
    if (tangledNow >= 4) this.app.install('domino-day');
  }

  // -------------------------------------------------------------------------------------------
  // The end of a room

  private async finishRoom(state: RoomState) {
    this.ended = true;
    if (state.status === 'cleared') {
      this.app.sounds.play('tidy');
      await this.view.revealTrails();
    } else {
      await new Promise((resolve) => setTimeout(resolve, this.app.reducedMotion ? 200 : 900));
    }
    if (this.mode.kind === 'night') {
      if (state.status === 'cleared') this.waveCleared(state);
      else this.nightOver();
      return;
    }
    this.roomOver(state);
  }

  private roomOver(state: RoomState) {
    if (this.mode.kind === 'night' || !this.par) return;
    if (!this.ladder) this.prepareRivals();
    const par = this.par.turns;
    const stars = starsFor(state, par);
    const cleared = state.status === 'cleared';
    const you = {
      outcome: cleared ? ('cleared' as const) : ('caught' as const),
      turns: state.turn,
      zooms: state.zooms,
    };
    const ladder = this.ladder ?? [];
    const professor = ladder.find((r) => r.id === 'professor');
    const xpEvents: { id: string; xp: number }[] = [];
    if (cleared) {
      xpEvents.push({ id: 'room-tidy', xp: 8 });
      if (stars.onPar) {
        xpEvents.push({ id: 'on-par', xp: 6 });
        this.app.install('right-on-par');
      }
      if (professor && (professor.outcome !== 'cleared' || state.turn < professor.turns))
        this.app.install('top-of-the-class');
    }
    if (this.mode.kind === 'house') {
      const room = this.mode.room;
      this.app.saves.house.update((house) => ({
        lastRoom: room.id,
        rooms: {
          ...house.rooms,
          [room.id]: mergeRoomRecord(house.rooms[room.id], {
            stars: [stars.tidy, stars.onPar, stars.noZoom],
            bestTurns: cleared ? state.turn : null,
            tidy: cleared,
          }),
        },
      }));
      if (cleared && room.id === 'hallway') this.app.install('hallway-tidy');
      if (starsEarned(this.app.saves.house.load()) >= ROOMS.length * 3)
        this.app.install('spotless');
    } else {
      const { dateKey } = this.mode;
      this.app.saves.daily.update((daily) =>
        addDaily(daily, dateKey, {
          outcome: you.outcome,
          turns: state.turn,
          par,
          zooms: state.zooms,
          undos: this.session.undos,
          ahead: rivalsBehind(you, ladder),
        }),
      );
      if (cleared) this.app.install('morning-tidy');
    }
    const report = () =>
      this.app.report({
        outcome: cleared ? 'win' : 'loss',
        score: scoreRoom(state, par),
        stats: { vacuumsTangled: state.tangled, roomsTidied: cleared ? 1 : 0 },
        xpEvents,
        daily: this.mode.kind === 'daily' && this.mode.dateKey === this.app.context.daily.dateKey(),
        durationSeconds: this.duration(),
      });
    let receipt: ResultReceipt | null = null;
    if (cleared) receipt = report();
    else this.pendingLoss = report;
    this.openResults(
      roomResults(this.app, {
        mode: this.mode,
        state,
        par,
        stars: [stars.tidy, stars.onPar, stars.noZoom],
        starTotal: starCount(stars),
        ladder,
        undos: this.session.undos,
        receipt,
        onWatch: (run) => void this.watch(run),
        onNext: () => this.next(),
        onAgain: () => this.restart(),
        onUndo: !cleared ? () => this.undo() : null,
      }),
    );
  }

  private flushLoss() {
    const report = this.pendingLoss;
    this.pendingLoss = null;
    report?.();
  }

  private next() {
    if (this.mode.kind !== 'house') return;
    const following = ROOMS[this.mode.room.index + 1];
    if (following) this.app.go.room(following.id);
    else this.app.go.house();
  }

  private waveCleared(state: RoomState) {
    if (!this.night) return;
    this.app.install('night-shift');
    const night = this.night;
    this.openOverlay(
      waveCard(this.app, {
        wave: night.wave,
        state,
        score: nightScore(night),
        advanceBonus: night.wave === night.startWave && night.startWave > 1,
        onNext: () => {
          this.closeOverlay();
          this.night = nextWave(night);
          this.session = this.night.room;
          this.ended = false;
          this.view.setRoom(current(this.session), 'great-hall', this.roomSeed());
          this.panel.setInfo(this.panelInfo());
          this.refresh();
          this.panel.say(
            `Wave ${this.night.wave}: ${current(this.session).vacuums.length} vacuums.`,
          );
          this.canvas.focus({ preventScroll: true });
        },
      }),
    );
  }

  private nightOver() {
    if (!this.night || this.mode.kind !== 'night') return;
    if (!this.nightRivals) this.prepareRivals();
    const night = this.night;
    const score = nightScore(night);
    const waves = night.cleared.length;
    const { progress, place } = addNight(this.app.saves.night.load(), {
      score,
      waves,
      dateKey: this.app.context.daily.dateKey(),
      startWave: night.startWave,
    });
    this.app.saves.night.save(progress);
    const receipt = this.app.report({
      outcome: waves > 0 ? 'win' : 'loss',
      score,
      stats: { vacuumsTangled: nightTangled(night), wavesCleared: waves, roomsTidied: 0 },
      xpEvents: waves > 0 ? [{ id: 'waves-cleared', xp: Math.min(25, waves * 5) }] : [],
      durationSeconds: this.duration(),
    });
    this.openResults(
      nightResults(this.app, {
        score,
        waves,
        lastWave: night.wave,
        place,
        rivals: this.nightRivals ?? [],
        receipt,
        onAgain: () => this.restart(),
      }),
    );
  }

  private duration(): number {
    return Math.max(1, Math.round((performance.now() - this.startedAt) / 1000));
  }

  // -------------------------------------------------------------------------------------------
  // Overlays and replays

  private showIntro() {
    // Skipping ahead in the Long Night starts a fresh screen; its intro has already been read.
    if (this.mode.kind === 'night' && this.mode.startWave > 1) {
      this.canvas.focus({ preventScroll: true });
      return;
    }
    const card = introCard(this.app, this.mode, {
      onStart: (startWave) => {
        if (this.mode.kind === 'night' && startWave && startWave !== this.mode.startWave) {
          this.app.go.night(startWave);
          return;
        }
        this.closeOverlay();
        this.canvas.focus({ preventScroll: true });
      },
    });
    this.openOverlay(card);
  }

  private openOverlay(element: HTMLElement) {
    this.closeOverlay();
    this.overlay = element;
    this.board.append(element);
    const first =
      element.querySelector<HTMLElement>('[data-autofocus]') ??
      element.querySelector<HTMLElement>('button');
    first?.focus({ preventScroll: true });
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
    if (this.resultsPane) {
      this.resultsPane = null;
      this.playElement.classList.remove('is-results');
      this.panel.element.hidden = false;
    }
  }

  /** Results sit beside the floor, so the drawing the vacuums left stays in view. */
  private openResults(content: HTMLElement) {
    this.closeOverlay();
    const pane = h('aside', { class: 'zm-results-pane', 'aria-label': 'Results' }, content);
    this.panel.element.hidden = true;
    this.playElement.classList.add('is-results');
    this.playElement.append(pane);
    this.resultsPane = pane;
    this.overlay = pane;
    const first =
      pane.querySelector<HTMLElement>('[data-autofocus]') ??
      pane.querySelector<HTMLElement>('button');
    first?.focus({ preventScroll: true });
  }

  /** Puts the player's own trails back on the floor after a replay or an undo. */
  private restoreTrails() {
    const initial = initialState(this.session);
    this.view.setRoom(initial, this.theme(), this.roomSeed());
    let replay = startSession(initial);
    for (const action of this.session.actions) {
      const result = play(replay, action);
      replay = result.session;
      this.view.traceTurn(result.events);
    }
    this.view.showState(current(this.session));
  }

  private async watch(run: LadderRun) {
    if (this.watching) return;
    // The results stay beside the floor while a rival plays the room again on it.
    const returnFocus = document.activeElement as HTMLElement | null;
    this.watching = true;
    let stopped = false;
    const banner = h(
      'div',
      { class: 'zm-banner', role: 'status' },
      `Watching ${run.name}`,
      h(
        'button',
        {
          type: 'button',
          class: 'zm-button zm-button--quiet',
          onclick: () => (stopped = true),
          dataset: { testid: 'zm-stop-watching' },
        },
        'Stop watching',
      ),
    );
    this.board.append(banner);
    const initial = initialState(this.session);
    this.view.setRoom(initial, this.theme(), this.roomSeed());
    this.view.setGhost(RIVAL_COATS[run.id]);
    this.view.setOptions({ pace: 0.55 });
    let replay = startSession(initial);
    for (const action of run.actions) {
      const before = current(replay);
      if (stopped || before.status !== 'playing' || !this.resultsPane) break;
      const { session, events } = play(replay, action);
      replay = session;
      this.view.setLoafing(action.type === 'wait');
      await this.view.animateTurn(before, current(session), events);
    }
    const end = current(replay);
    if (!stopped && end.status === 'cleared') await this.view.revealTrails();
    else if (!stopped) await new Promise((resolve) => setTimeout(resolve, 700));
    banner.remove();
    this.view.setGhost(null);
    this.view.setLoafing(false);
    this.view.setOptions({ pace: PACE_FACTOR[this.app.saves.prefs.load().pace] });
    this.restoreTrails();
    if (current(this.session).status === 'cleared') void this.view.revealTrails();
    this.watching = false;
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
}
