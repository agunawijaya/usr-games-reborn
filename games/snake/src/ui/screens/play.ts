import { type ChamberPlan } from '../../engine/chambers';
import { type Cell, directionBetween, moved, same } from '../../engine/geometry';
import { isOpen } from '../../engine/garden';
import {
  chaseView,
  isAsleep,
  type LuckyBreak,
  type Peek,
  type Round,
  type TurnEvent,
} from '../../engine/round';
import { strikeChances } from '../../engine/snake';
import { countDigit, jumpFor, type Jump, STEP_ACTIONS } from '../../game/keys';
import { bestFor, recordDaily, sizeKey } from '../../game/saves';
import { Session, type SessionMode, type SessionStats } from '../../game/session';
import { cellAt } from '../../render/frame';
import { type Flash, GardenView, type Moment, type Motion } from '../../render/garden-view';
import type { GlintTier } from '../../render/glint';
import type { Look } from '../../render/look';
import { fullness, glintTier, sceneFor } from '../../render/scene';
import type { SnakeMood } from '../../render/snake';
import type { App, Screen } from '../app';
import { formatGlints, h } from '../dom';
import {
  type HudModel,
  luckyCard,
  pocketsAndBoldness,
  sidePanel,
  topBar,
  vaultCard,
  winkCard,
} from '../hud';

export interface PlaySpec {
  readonly mode: SessionMode;
  readonly seed: string;
  readonly classicSize?: { width: number; height: number };
}

/** Seconds: one glide between squares, and the pace of a walk of several steps. */
const GLIDE = 0.14;
const WALK = 0.17;
const FLASH = 0.6;

type Overlay = 'none' | 'map' | 'door' | 'warp' | 'leave' | 'capture' | 'bank' | 'results';

interface Capture {
  readonly started: number;
  readonly wink: boolean;
  readonly dialAt: number;
  readonly roll: LuckyBreak;
  readonly spillTiers: readonly GlintTier[];
  settled: boolean;
}

interface Banking {
  readonly started: number;
  readonly banked: number;
  readonly pourTiers: readonly GlintTier[];
}

export function playScreen(app: App, spec: PlaySpec): Screen {
  return new PlayScreen(app, spec).screen;
}

class PlayScreen {
  readonly screen: Screen;
  private readonly session: Session;
  private readonly view: GardenView;
  private readonly canvas = h('canvas', { 'aria-hidden': 'true', 'data-testid': 'fp-board' });
  private readonly hud = h('div', { class: 'fp-hud' });
  private readonly layer = h('div', { class: 'fp-layer' });
  private readonly announcer = h('p', { class: 'fp-sr', role: 'status', 'aria-live': 'polite' });
  private readonly element: HTMLElement;
  private overlay: Overlay = 'none';
  private clock = 0;
  private lastFrame = 0;
  private frame = 0;
  private paused = false;
  private motion: Motion | null = null;
  private motionStart = 0;
  private flashes: Array<{ flash: Flash; born: number }> = [];
  private queue: number[] = [];
  private lastStepAt = 0;
  private count = '';
  private lastCommand: { direction: number; times: number } | null = null;
  private pendingAfterGlide: TurnEvent | null = null;
  private facing: 1 | -1 = 1;
  private peekShown: { peek: Peek; until: number } | null = null;
  private hover: Cell | null = null;
  private armed: { target: Cell; steps: number[] } | null = null;
  private capture: Capture | null = null;
  /** After a capture that ends the game: the coil and the spilled glints stay on the stones. */
  private held: { spillTiers: readonly GlintTier[] } | null = null;
  /** The meter holds the boldness the snake had when it caught you. */
  private frozenBoldness: number | null = null;
  private banking: Banking | null = null;
  private region = { x: 0, y: 0, width: 1, height: 1 };
  private readonly seedNumber: number;
  private peeked = false;

  constructor(
    private readonly app: App,
    private readonly spec: PlaySpec,
  ) {
    this.session = new Session(spec.mode, spec.seed, spec.classicSize);
    this.seedNumber = [...spec.seed].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 9973;
    this.element = h(
      'div',
      { class: 'fp-play', 'data-testid': 'fp-play', 'data-mode': spec.mode },
      this.canvas,
      this.hud,
      this.layer,
      this.announcer,
    );
    this.view = new GardenView(this.canvas);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', () => {
      this.hover = null;
    });
    this.canvas.addEventListener('click', this.onClick);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('resize', this.onResize);

    const pauseItems = () => this.pauseItems();
    this.screen = {
      element: this.element,
      // A getter, so the Hall's pause menu always shows the preview's current state.
      get pauseItems() {
        return pauseItems();
      },
      onKey: (event) => this.onKey(event),
      onLook: () => this.renderHud(),
      onPause: () => {
        this.paused = true;
      },
      onResume: () => {
        this.paused = false;
        this.lastFrame = 0;
      },
      focus: () => this.canvas.focus(),
      destroy: () => this.destroy(),
    };
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'application');
    this.canvas.setAttribute(
      'aria-label',
      'The garden. Step with the arrow keys or click a square.',
    );
    exposeTestHook(this);
    requestAnimationFrame(() => {
      this.onResize();
      if (this.session.run) this.showMap();
      else if (spec.mode === 'tutorial') this.renderCoach();
      this.loop(performance.now());
    });
  }

  // ------------------------------------------------------------------ layout and drawing

  private onResize = () => {
    const width = this.element.clientWidth || window.innerWidth;
    const height = this.element.clientHeight || window.innerHeight;
    const panel = width >= 1000;
    this.region = {
      x: 24,
      y: 88,
      width: width - (panel ? 300 + 24 + 48 : 48),
      height: height - 108,
    };
    this.element.classList.toggle('fp-compact', !panel);
    this.view.layout(width, height, this.region);
    this.renderHud();
  };

  private get look(): Look {
    return this.app.look;
  }

  private loop = (now: number) => {
    const delta = this.lastFrame ? Math.min(0.1, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (!this.paused) this.tick(delta);
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  private tick(delta: number) {
    this.clock += this.app.reducedMotion ? delta * 2 : delta;
    if (this.motion) {
      const t = this.app.reducedMotion ? 1 : (this.clock - this.motionStart) / GLIDE;
      this.motion = t >= 1 ? null : { ...this.motion, t };
      if (!this.motion && this.pendingAfterGlide) this.afterGlide();
    }
    this.flashes = this.flashes.filter(({ born }) => this.clock - born < FLASH);
    if (this.peekShown && this.clock > this.peekShown.until) this.peekShown = null;
    if (
      !this.motion &&
      this.queue.length &&
      this.overlay === 'none' &&
      this.clock - this.lastStepAt >= WALK
    ) {
      this.perform(this.queue.shift()!);
    }
    if (this.capture) this.advanceCapture();
    if (this.banking) this.advanceBanking();
  }

  private draw() {
    const round = this.session.round;
    const playing = this.session.phase === 'playing' && this.overlay === 'none';
    const strikes =
      this.app.saves.prefs.load().strikePreview && playing && !isAsleep(round)
        ? strikeChances(round.snake[0]!, chaseView(round))
        : null;
    this.view.render(
      sceneFor(round, this.look, this.seedNumber + this.session.depth, {
        motion: this.motion,
        flashes: this.flashes.map(({ flash, born }) => ({
          ...flash,
          age: (this.clock - born) / FLASH,
        })),
        strikes,
        peek: this.peekShown?.peek ?? null,
        path: playing ? this.pathPreview() : null,
        pose: this.motion ? 'walk' : 'idle',
        facing: this.facing,
        moment: this.moment(),
        mood: this.mood(),
        fullness: this.capture || this.held ? 0 : fullness(round),
      }),
      this.clock,
    );
  }

  private moment(): Moment | null {
    if (this.held) return { kind: 'coil', progress: 1, spill: 1, spillTiers: this.held.spillTiers };
    if (this.capture) {
      const t = this.clock - this.capture.started;
      return {
        kind: 'coil',
        progress: Math.min(1, t / 0.8),
        spill: Math.min(1, t / 1.3),
        spillTiers: this.capture.spillTiers,
      };
    }
    if (this.banking) {
      const t = this.clock - this.banking.started;
      return {
        kind: 'bank',
        open: Math.min(1, t / 0.5),
        pouring: t < 2.6,
        pourTiers: this.banking.pourTiers,
      };
    }
    return null;
  }

  private mood(): SnakeMood | undefined {
    if (this.banking) return 'sulk';
    if (this.held) return 'smug';
    if (!this.capture) return undefined;
    const t = this.clock - this.capture.started;
    return this.capture.wink && t > 1 && t < this.capture.dialAt ? 'wink' : 'smug';
  }

  // ------------------------------------------------------------------ the HUD

  private model(): HudModel {
    const s = this.session;
    const plan = s.plan;
    const round = s.round;
    const classic = s.mode === 'classic';
    return {
      chamber: s.depth,
      chambers: s.chambers,
      chamberName: plan?.name ?? (classic ? 'Classic' : 'Tutorial'),
      traits: plan ? plan.traits : classic ? this.classicTraits() : ['A small lawn to learn on'],
      pockets: s.pockets,
      warpCost: s.warpCost,
      boldness: this.frozenBoldness ?? sceneFor(round, this.look, 0).boldness,
      strikePreview: this.app.saves.prefs.load().strikePreview,
      where: this.where(),
      asleep: isAsleep(round),
      classic,
      count: this.count ? Number(this.count) : null,
    };
  }

  private classicTraits(): string[] {
    const { width, height } = this.session.round.garden;
    return [
      `${width} × ${height} board`,
      'The 1980 rules',
      `Glints worth ${this.session.round.chunk} each`,
    ];
  }

  private where(): string {
    const s = this.session;
    if (s.mode === 'daily')
      return `of ${s.chambers} · Daily Run #${this.app.context.daily.number()}`;
    if (s.mode === 'run') return `of ${s.chambers} · ${s.plan?.name ?? ''}`;
    if (s.mode === 'classic') return 'The 1980 game, one board';
    return 'Step, grab, peek, bank';
  }

  private renderHud() {
    const focused = (document.activeElement as HTMLElement | null)?.dataset?.key;
    const model = this.model();
    const handlers = {
      onMenu: () => this.askLeave(),
      onPeek: () => this.doPeek(),
      onWarp: () => this.askWarp(),
      onStrikePreview: () => this.toggleStrikes(),
    };
    this.hud.replaceChildren(
      topBar(model, handlers),
      pocketsAndBoldness(model, this.region.x + this.region.width / 2),
      sidePanel(model, handlers),
    );
    if (focused) this.hud.querySelector<HTMLElement>(`[data-key="${focused}"]`)?.focus();
    if (this.spec.mode === 'tutorial' && this.overlay === 'none') this.renderCoach();
  }

  private pauseItems() {
    const on = this.app.saves.prefs.load().strikePreview;
    return [
      {
        id: 'strikes',
        label: `Strike preview: ${on ? 'on' : 'off'}`,
        shortcut: 'S',
        run: () => this.toggleStrikes(),
      },
    ];
  }

  private toggleStrikes() {
    this.app.saves.prefs.update((p) => ({ ...p, strikePreview: !p.strikePreview }));
    this.app.refreshPauseItems();
    this.renderHud();
  }

  private say(text: string) {
    this.announcer.textContent = text;
  }

  // ------------------------------------------------------------------ input

  private onKey(event: KeyboardEvent): boolean {
    if (this.overlay !== 'none') return this.onOverlayKey(event);
    if (this.session.phase !== 'playing') return false;
    const digit = countDigit(event);
    if (digit !== null) {
      if (this.count === '' && digit === 0) return true;
      this.count = (this.count + digit).slice(-2);
      this.renderHud();
      return true;
    }
    const jump = jumpFor(event);
    if (jump) {
      this.walkJump(jump);
      return true;
    }
    const action = this.app.keys.actionFor(event);
    if (!action) return false;
    if (action === 'warp') this.askWarp();
    else if (action === 'peek') this.doPeek();
    else if (action === 'strikes') this.toggleStrikes();
    else if (action === 'repeat') {
      if (this.lastCommand) this.walk(this.lastCommand.direction, this.lastCommand.times);
    } else {
      const direction = STEP_ACTIONS.indexOf(action);
      const times = this.count ? Number(this.count) : 1;
      this.count = '';
      this.lastCommand = { direction, times };
      this.walk(direction, times);
    }
    return true;
  }

  private walk(direction: number, times: number) {
    this.armed = null;
    for (let i = 0; i < times; i++) this.queue.push(direction);
    if (this.queue.length > 99) this.queue.length = 99;
  }

  /** The original's capitals: walk to the glint's column or row. */
  private walkJump(jump: Jump) {
    const { you, glints } = this.session.round;
    const glint = glints[0];
    if (!glint) return;
    const plan: Record<Jump, [number, number]> = {
      'to-glint-column-west': [6, you.x - glint.x],
      'to-glint-column-east': [2, glint.x - you.x],
      'to-glint-row-north': [0, you.y - glint.y],
      'to-glint-row-south': [4, glint.y - you.y],
    };
    const [direction, times] = plan[jump];
    if (times > 0) this.walk(direction, times);
  }

  private onPointerMove = (event: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.hover = cellAt(this.view.frame, event.clientX - rect.left, event.clientY - rect.top);
    this.canvas.style.cursor = this.hover && this.lineTo(this.hover) ? 'pointer' : 'default';
  };

  /** Straight-line walks from you: the steps to `target`, or null if it is not in line or blocked. */
  private lineTo(target: Cell): number[] | null {
    const round = this.session.round;
    const dx = target.x - round.you.x;
    const dy = target.y - round.you.y;
    if (dx === 0 && dy === 0) return null;
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
    const direction = directionBetween({ x: 0, y: 0 }, { x: Math.sign(dx), y: Math.sign(dy) });
    if (!round.rules.diagonals && direction % 2 === 1) return null;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    let at = round.you;
    for (let i = 0; i < steps; i++) {
      at = moved(at, direction);
      if (!isOpen(round.garden, at)) return null;
    }
    return new Array<number>(steps).fill(direction);
  }

  private pathPreview(): Cell[] | null {
    const target = this.armed?.target ?? this.hover;
    if (!target) return null;
    const steps = this.armed?.steps ?? this.lineTo(target);
    if (!steps || steps.length < 2) return null;
    const cells: Cell[] = [];
    let at = this.session.round.you;
    for (const d of steps) {
      at = moved(at, d);
      cells.push(at);
    }
    return cells;
  }

  /** A click beside you steps; a click further along a line shows the walk, a second walks it. */
  private onClick = (event: MouseEvent) => {
    if (this.overlay !== 'none' || this.session.phase !== 'playing') return;
    const rect = this.canvas.getBoundingClientRect();
    const cell = cellAt(this.view.frame, event.clientX - rect.left, event.clientY - rect.top);
    if (!cell) return;
    const steps = this.lineTo(cell);
    if (!steps) return;
    if (steps.length === 1) {
      this.lastCommand = { direction: steps[0]!, times: 1 };
      this.walk(steps[0]!, 1);
      return;
    }
    if (this.armed && same(this.armed.target, cell)) {
      this.lastCommand = { direction: steps[0]!, times: steps.length };
      this.walk(steps[0]!, steps.length);
      return;
    }
    this.armed = { target: cell, steps };
    this.say(`Walk ${steps.length} squares? Click again to go.`);
  };

  private onContextMenu = (event: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const cell = cellAt(this.view.frame, event.clientX - rect.left, event.clientY - rect.top);
    if (!cell || !this.session.round.snake.some((s) => same(s, cell))) return;
    event.preventDefault();
    const percent = Math.round(this.model().boldness * 100);
    this.toast(
      isAsleep(this.session.round)
        ? 'Asleep until your third glint here. Do not tread on it.'
        : `Boldness ${percent}%: the chance it heads straight for you next. Empty pockets, never; full ones, more and more.`,
    );
  };

  // ------------------------------------------------------------------ turns

  private perform(direction: number) {
    const before = this.session.round;
    const turn = this.session.step(direction);
    this.lastStepAt = this.clock;
    for (const event of turn.events) this.onEvent(event, before);
    this.renderHud();
  }

  private onEvent(event: TurnEvent, before: typeof this.session.round) {
    switch (event.kind) {
      case 'bump':
        this.queue = [];
        this.flash('bump', before.you);
        this.app.sounds.bump();
        break;
      case 'step': {
        const dx = event.to.x - before.you.x;
        if (dx !== 0) this.facing = dx > 0 ? 1 : -1;
        this.motion = { you: before.you, snake: before.snake, t: 0 };
        this.motionStart = this.clock;
        this.app.sounds.footstep(this.session.round.moves % 2 === 0);
        break;
      }
      case 'pickup':
        this.flash('pickup', event.at);
        this.app.sounds.pickup(this.session.round.pickups);
        this.say(`A glint: ${formatGlints(this.session.pockets)} in your pockets.`);
        this.app.install('first-glint');
        if (this.session.round.pickups >= 15) this.app.install('greedy-guts');
        break;
      case 'snake':
        this.app.sounds.slither(this.model().boldness);
        break;
      case 'wake':
        this.flash('wake', this.session.round.snake[0]!);
        this.app.sounds.wake();
        this.toast('The snake wakes up.');
        break;
      case 'door':
      case 'caught':
        this.queue = [];
        this.pendingAfterGlide = event;
        if (this.app.reducedMotion || !this.motion) this.afterGlide();
        break;
    }
  }

  private afterGlide() {
    const event = this.pendingAfterGlide;
    this.pendingAfterGlide = null;
    if (event?.kind === 'door') this.atDoor();
    if (event?.kind === 'caught') this.startCapture();
  }

  private flash(kind: Flash['kind'], cell: Cell) {
    this.flashes.push({ flash: { kind, cell, age: 0 }, born: this.clock });
  }

  private doPeek() {
    if (this.session.phase !== 'playing' || this.overlay !== 'none') return;
    const seen = this.session.peek();
    this.peeked = true;
    this.app.saves.records.update((r) => ({ ...r, peeks: r.peeks + 1 }));
    if (this.app.saves.records.load().peeks >= 20) this.app.install('peek-a-boo');
    this.app.sounds.peek();
    if (seen) {
      this.peekShown = { peek: seen, until: this.clock + 1.8 };
      this.say(
        seen.target === 'glint' ? 'Arrows point toward a glint.' : 'Arrows point toward the door.',
      );
    } else {
      this.toast('Nothing in line from here. Try a step or two along.');
    }
    this.renderHud();
  }

  // ------------------------------------------------------------------ cards

  private showCard(
    card: HTMLElement,
    overlay: Overlay,
    place: 'centre' | 'aside' | 'top' = 'centre',
  ) {
    this.overlay = overlay;
    this.layer.replaceChildren(card);
    const r = this.region;
    // Beside the action, on the far side of the board from you, so the moment stays in view.
    const youOnLeft = this.session.round.you.x < this.session.round.garden.width / 2;
    const aside = youOnLeft ? r.x + r.width * 0.72 : r.x + r.width * 0.28;
    const x = place === 'aside' ? aside : r.x + r.width / 2;
    const y = place === 'top' ? r.y + r.height * 0.12 : r.y + r.height / 2;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
    card.style.transform = place === 'top' ? 'translateX(-50%)' : 'translate(-50%, -50%)';
    requestAnimationFrame(() => card.querySelector<HTMLElement>('[data-autofocus]')?.focus());
  }

  private closeCard() {
    this.overlay = 'none';
    this.layer.replaceChildren();
    this.canvas.focus();
    if (this.spec.mode === 'tutorial') this.renderCoach();
  }

  private toast(text: string) {
    const toast = h('p', { class: 'fp-toast fp-panel', role: 'status' }, text);
    this.element.append(toast);
    this.say(text);
    setTimeout(() => toast.remove(), 2800);
  }

  private button(
    label: string,
    key: string,
    onclick: () => void,
    primary = false,
    autofocus = false,
  ) {
    return h(
      'button',
      {
        class: primary ? 'fp-btn fp-btn-primary' : 'fp-btn',
        type: 'button',
        onclick,
        'data-autofocus': autofocus || null,
        'aria-keyshortcuts': key,
      },
      label,
      h('span', { class: 'fp-key', 'aria-hidden': 'true' }, key),
    );
  }

  private onOverlayKey(event: KeyboardEvent): boolean {
    const key = event.key.toLowerCase();
    switch (this.overlay) {
      case 'map':
        if (key === 'enter' || key === ' ') return this.click('[data-autofocus]');
        return false;
      case 'door':
        if (key === 'b') return this.click('[data-choice="bank"]');
        if (key === 'd') return this.click('[data-choice="deeper"]');
        return false;
      case 'warp':
        if (key === 'enter') return this.click('[data-choice="warp"]');
        if (key === 'n' || key === 'backspace') return this.click('[data-choice="stay"]');
        return false;
      case 'leave':
        if (key === 'enter') return this.click('[data-choice="stay"]');
        return false;
      case 'capture':
      case 'bank':
        if (key === 'enter' || key === ' ') {
          this.skipMoment();
          return true;
        }
        return false;
      case 'results':
        if (key === 'r') return this.click('[data-choice="again"]');
        if (key === 'h') return this.click('[data-choice="hall"]');
        return false;
      default:
        return false;
    }
  }

  private click(selector: string): boolean {
    const target = this.layer.querySelector<HTMLButtonElement>(selector);
    target?.click();
    return Boolean(target);
  }

  /** The chamber ahead, on the way down: shown as a run starts and after every "deeper". */
  private showMap() {
    const s = this.session;
    const plan = s.plan as ChamberPlan;
    const card = h(
      'section',
      {
        class: 'fp-card fp-panel fp-map',
        role: 'dialog',
        'aria-labelledby': 'fp-map-title',
        'data-testid': 'fp-map',
      },
      h(
        'span',
        { class: 'fp-eyebrow fp-eyebrow-calm' },
        s.mode === 'daily'
          ? `Daily Run #${this.app.context.daily.number()} · chamber ${s.depth} of ${s.chambers}`
          : `Chamber ${s.depth} of ${s.chambers}`,
      ),
      h('h1', { id: 'fp-map-title' }, plan.name),
      h(
        'div',
        { class: 'fp-chips' },
        ...plan.traits.map((t) => h('span', { class: 'fp-chip' }, t)),
      ),
      h(
        'p',
        {},
        s.depth === 1
          ? 'Glints appear one at a time. Every step you take, the snake takes one. The round hatch is the door.'
          : `You carry ${formatGlints(s.pockets)} glints down with you, and the snake has heard.`,
      ),
      this.button('Enter the chamber', 'Enter', () => this.closeCard(), true, true),
    );
    this.showCard(card, 'map');
  }

  private atDoor() {
    const s = this.session;
    if (!s.asksAtDoor) {
      this.startBank();
      return;
    }
    const next = s.run!.plans[s.run!.index + 1]!;
    const card = h(
      'section',
      {
        class: 'fp-card fp-panel fp-door',
        role: 'dialog',
        'aria-labelledby': 'fp-door-title',
        'data-testid': 'fp-door',
      },
      h('span', { class: 'fp-eyebrow fp-eyebrow-calm' }, `The door of chamber ${s.depth}`),
      h('h1', { id: 'fp-door-title' }, 'Bank it, or go deeper?'),
      h(
        'div',
        { class: 'fp-choices' },
        h(
          'button',
          {
            class: 'fp-choice',
            type: 'button',
            'data-choice': 'bank',
            'data-autofocus': true,
            onclick: () => this.startBank(),
          },
          h('b', {}, 'Bank'),
          h(
            'span',
            {},
            `Pour ${formatGlints(Math.max(0, s.pockets))} glints into the vault and end the run.`,
          ),
          h('span', { class: 'fp-key' }, 'B'),
        ),
        h(
          'button',
          {
            class: 'fp-choice fp-choice-deeper',
            type: 'button',
            'data-choice': 'deeper',
            onclick: () => this.goDeeper(),
          },
          h('b', {}, 'Go deeper'),
          h('span', {}, `${next.name}: glints worth ×${next.rate.toFixed(1)}, and a bolder snake.`),
          h('span', { class: 'fp-key' }, 'D'),
        ),
      ),
    );
    this.showCard(card, 'door');
  }

  private goDeeper() {
    this.charmCheck();
    this.session.deeper();
    this.layer.replaceChildren();
    this.motion = null;
    this.peekShown = null;
    this.renderHud();
    this.showMap();
  }

  private charmCheck() {
    if (this.session.stats.closestHere > 2) this.app.install('snake-charmer');
  }

  private askWarp() {
    if (this.session.phase !== 'playing' || this.overlay !== 'none') return;
    const cost = this.session.warpCost;
    const card = h(
      'section',
      {
        class: 'fp-card fp-panel',
        role: 'dialog',
        'aria-labelledby': 'fp-warp-title',
        'data-testid': 'fp-warp',
      },
      h('h1', { id: 'fp-warp-title' }, 'Warp away?'),
      h(
        'p',
        {},
        cost > 0
          ? `You land somewhere at random. It costs ${formatGlints(cost)} glints, a tenth of everything you have picked up${this.session.pockets - cost < 0 ? ', and leaves you owing' : ''}.`
          : 'You land somewhere at random. With nothing picked up yet, it costs nothing.',
      ),
      h(
        'div',
        { class: 'fp-row' },
        this.button('Warp', 'Enter', () => this.doWarp(), true, true),
        this.button('Stay', 'N', () => this.closeCard()),
      ),
    );
    card.querySelectorAll('button')[0]!.setAttribute('data-choice', 'warp');
    card.querySelectorAll('button')[1]!.setAttribute('data-choice', 'stay');
    this.showCard(card, 'warp');
  }

  private doWarp() {
    const from = this.session.round.you;
    this.session.warp();
    this.flash('warp-out', from);
    this.flash('warp-in', this.session.round.you);
    this.app.sounds.warp();
    this.motion = null;
    this.closeCard();
    this.renderHud();
  }

  private askLeave() {
    if (this.session.phase === 'over' || this.overlay === 'results') {
      this.app.go.title();
      return;
    }
    const card = h(
      'section',
      { class: 'fp-card fp-panel', role: 'dialog', 'aria-labelledby': 'fp-leave-title' },
      h('h1', { id: 'fp-leave-title' }, 'Leave this game?'),
      h('p', {}, 'Your pockets stay in the garden. Bank at a door to keep a haul.'),
      h(
        'div',
        { class: 'fp-row' },
        this.button('Keep playing', 'Enter', () => this.closeCard(), true, true),
        h(
          'button',
          {
            class: 'fp-btn',
            type: 'button',
            'data-choice': 'leave',
            onclick: () => this.app.go.title(),
          },
          'Game menu',
        ),
      ),
    );
    card.querySelector('button')!.setAttribute('data-choice', 'stay');
    this.showCard(card, 'leave');
  }

  // ------------------------------------------------------------------ the capture

  private spillTiers(): GlintTier[] {
    const round = this.session.round;
    const count = Math.max(6, Math.min(18, round.pickups + 4));
    const base = glintTier({ ...round, glints: [{ x: 0, y: 0 }] }, 0);
    return Array.from(
      { length: count },
      (_, i) => Math.max(0, Math.min(4, base + ((i * 7) % 3) - 1)) as GlintTier,
    );
  }

  private startCapture() {
    const s = this.session;
    const records = this.app.saves.records.load();
    const best = bestFor(
      records,
      s.mode === 'tutorial' ? 'run' : s.mode,
      s.mode === 'classic' ? s.round.garden : null,
    );
    const wink = s.mode !== 'tutorial' && s.pockets > best;
    this.frozenBoldness = this.model().boldness;
    const roll = s.luckyBreak();
    this.capture = {
      started: this.clock,
      wink,
      dialAt: wink ? 2.4 : 1.3,
      roll,
      spillTiers: this.spillTiers(),
      settled: false,
    };
    this.app.sounds.caught();
    if (wink) this.app.install('winked-at');
    this.overlay = 'capture';
    this.layer.replaceChildren();
    this.say('Caught! The snake coils round you and your satchel bursts.');
  }

  private advanceCapture() {
    const capture = this.capture!;
    const t = this.clock - capture.started;
    if (
      capture.wink &&
      t > 1 &&
      !this.layer.querySelector('[data-card="wink"]') &&
      t < capture.dialAt
    ) {
      const records = this.app.saves.records.load();
      const mode = this.session.mode === 'tutorial' ? 'run' : this.session.mode;
      const size = this.session.mode === 'classic' ? this.session.round.garden : null;
      const card = winkCard({ carrying: this.session.pockets, best: bestFor(records, mode, size) });
      card.dataset.card = 'wink';
      this.showCard(card, 'capture', 'aside');
      this.app.sounds.wink();
    }
    if (t < capture.dialAt) return;
    const spin = 2.1;
    const into = Math.min(1, (t - capture.dialAt) / spin);
    const target = capture.roll.roll * 36;
    const pointer = (1 - Math.pow(1 - into, 3)) * (720 + target);
    let dial = this.layer.querySelector<HTMLElement>('[data-card="dial"]');
    if (!dial) {
      const digit = capture.roll.digit;
      dial = luckyCard({
        digit: Math.max(0, digit),
        pointer: 0,
        spinning: true,
        pockets: this.session.pockets,
      });
      dial.dataset.card = 'dial';
      if (digit < 0)
        dial.querySelector('p')!.textContent =
          'You are in the red, so your pockets end on no digit at all. The dial spins anyway.';
      this.showCard(dial, 'capture', 'aside');
    }
    const hand = dial.querySelector<SVGGElement>('svg g[transform]');
    const previous = Number(dial.dataset.pointer ?? 0);
    if (Math.floor(pointer / 36) !== Math.floor(previous / 36)) this.app.sounds.tick();
    dial.dataset.pointer = String(pointer);
    hand?.setAttribute('transform', `rotate(${pointer % 360} 125 125)`);
    if (into >= 1 && !capture.settled) {
      capture.settled = true;
      setTimeout(() => this.settleCapture(), this.app.reducedMotion ? 300 : 900);
    }
  }

  private settleCapture() {
    const capture = this.capture;
    if (!capture) return;
    this.capture = null;
    this.layer.replaceChildren();
    this.overlay = 'none';
    if (capture.roll.escaped) {
      this.frozenBoldness = null;
      this.app.sounds.escaped();
      this.app.install('lucky-break');
      this.flash('warp-in', this.session.round.you);
      this.toast(
        `Lucky break! The dial stopped on ${capture.roll.roll}: you scramble free with everything.`,
      );
      this.renderHud();
      this.canvas.focus();
      return;
    }
    this.app.sounds.scrambled();
    this.held = { spillTiers: capture.spillTiers };
    this.finish();
  }

  private skipMoment() {
    if (this.capture && !this.capture.settled) {
      this.capture = { ...this.capture, started: this.clock - this.capture.dialAt - 2.1 };
    } else if (this.banking) {
      this.banking = { ...this.banking, started: this.clock - 3 };
    }
  }

  // ------------------------------------------------------------------ banking and the end

  private startBank() {
    const ending = this.session.bank();
    this.charmCheck();
    this.layer.replaceChildren();
    this.banking = {
      started: this.clock,
      banked: ending.banked ?? 0,
      pourTiers: this.spillTiers(),
    };
    this.overlay = 'bank';
    this.app.sounds.bank(this.session.stats.pickups);
    const records = this.app.saves.records.load();
    const best = bestFor(
      records,
      this.session.mode === 'tutorial' ? 'run' : this.session.mode,
      this.session.mode === 'classic' ? this.session.round.garden : null,
    );
    const card = vaultCard({
      banked: 0,
      chamber: this.session.depth,
      glints: this.session.stats.pickups,
      warps: this.session.stats.warps,
      best: (ending.banked ?? 0) > best && this.session.mode !== 'tutorial',
    });
    card.dataset.card = 'vault';
    this.showCard(card, 'bank', 'top');
  }

  private advanceBanking() {
    const banking = this.banking!;
    const t = this.clock - banking.started;
    const shown = Math.round(banking.banked * Math.min(1, Math.max(0, (t - 0.4) / 1.6)));
    const number = this.layer.querySelector('.fp-vault-number');
    if (number?.lastChild) number.lastChild.textContent = formatGlints(shown);
    if (t >= 3) {
      this.banking = null;
      this.finish();
    }
  }

  private finish() {
    const s = this.session;
    const ending = s.ending!;
    const banked = ending.banked;
    const records = this.app.saves.records.load();
    let first = false;
    let next = {
      ...records,
      peeks: records.peeks,
      luckyBreaks: records.luckyBreaks + s.stats.luckyBreaks,
    };
    if (banked !== null && s.mode !== 'tutorial') next = { ...next, banks: next.banks + 1 };
    if (s.mode === 'run') {
      next = {
        ...next,
        runBest: Math.max(next.runBest, banked ?? 0),
        runDeepest: Math.max(next.runDeepest, s.depth),
      };
    } else if (s.mode === 'daily') {
      const recorded = recordDaily(next, this.app.context.daily.dateKey(), {
        banked,
        chamber: s.depth,
        luckyBreaks: s.stats.luckyBreaks,
        winked: false,
      });
      next = recorded.records;
      first = recorded.first;
    } else if (s.mode === 'classic' && banked !== null) {
      const key = sizeKey(s.round.garden);
      next = {
        ...next,
        classicBest: { ...next.classicBest, [key]: Math.max(next.classicBest[key] ?? 0, banked) },
      };
    }
    this.app.saves.records.save(next);
    if (s.mode === 'tutorial') this.app.saves.prefs.update((p) => ({ ...p, tutorialDone: true }));

    if (banked !== null && s.mode !== 'tutorial') this.app.install('banked');
    if (banked !== null && s.stats.warps === 0 && (s.mode === 'run' || s.mode === 'daily'))
      this.app.install('no-warp-run');
    if (banked !== null && s.mode === 'run' && s.depth === 10) this.app.install('deep-pockets');
    if (s.mode === 'classic' && ending.pockets < 0) this.app.install('in-the-red');
    if (next.dailyRuns >= 7) this.app.install('daily-regular');

    const receipt =
      s.mode === 'tutorial'
        ? null
        : this.app.report({
            outcome: banked !== null ? 'win' : 'loss',
            score: banked ?? 0,
            stats: {
              glintsPicked: s.stats.pickups,
              chambersDeep: s.depth,
              banked: banked !== null ? 1 : 0,
              luckyBreaks: s.stats.luckyBreaks,
            },
            xpEvents: [
              ...(s.depth > 1 ? [{ id: 'chambers', xp: Math.min(15, (s.depth - 1) * 3) }] : []),
              ...(s.stats.luckyBreaks > 0 ? [{ id: 'lucky-break', xp: 5 }] : []),
            ],
            daily: s.mode === 'daily' && first,
            durationSeconds: Math.round((Date.now() - s.startedAt) / 1000),
          });
    this.showResults(first, receipt?.xpGained ?? null);
  }

  private shareLine(): string {
    const s = this.session;
    const ending = s.ending!;
    const lucky = `🍀${s.stats.luckyBreaks}`;
    const what =
      ending.banked !== null
        ? `banked 💎${formatGlints(ending.banked)} at chamber ${ending.chamber}`
        : `caught in chamber ${ending.chamber}`;
    return `Full Pockets #${this.app.context.daily.number()} · ${what} · ${lucky}`;
  }

  private showResults(firstDaily: boolean, xp: number | null) {
    const s = this.session;
    const ending = s.ending!;
    const banked = ending.banked;
    const tutorial = s.mode === 'tutorial';
    const title = tutorial ? 'Well walked.' : banked !== null ? 'Banked!' : 'Caught.';
    const lead = tutorial
      ? 'You stepped, grabbed, peeked and banked. The real chambers are waiting.'
      : banked !== null
        ? s.mode === 'classic'
          ? ending.pockets < 0
            ? `You left by the door owing ${formatGlints(-ending.pockets)} glints. The original allowed it too.`
            : 'You left by the door with your haul.'
          : `Safely in the vault, from chamber ${ending.chamber}${s.chambers ? ` of ${s.chambers}` : ''}.`
        : `The snake coiled round you in chamber ${ending.chamber}. You scrambled out with empty pockets.`;
    const share =
      s.mode === 'daily'
        ? h(
            'button',
            {
              class: 'fp-btn',
              type: 'button',
              'data-choice': 'share',
              onclick: async () => {
                const outcome = await this.app.context.share(this.shareLine());
                this.toast(
                  outcome === 'unavailable' ? this.shareLine() : 'Copied: paste it anywhere.',
                );
              },
            },
            'Share',
          )
        : null;
    const card = h(
      'section',
      {
        class: 'fp-card fp-panel fp-results',
        role: 'dialog',
        'aria-labelledby': 'fp-results-title',
        'data-testid': 'fp-results',
      },
      h(
        'span',
        { class: banked !== null ? 'fp-eyebrow fp-eyebrow-calm' : 'fp-eyebrow' },
        s.mode === 'daily'
          ? `Daily Run #${this.app.context.daily.number()}`
          : s.mode === 'classic'
            ? 'Classic'
            : tutorial
              ? 'Tutorial'
              : 'Run',
      ),
      h('h1', { id: 'fp-results-title' }, title),
      tutorial
        ? null
        : banked !== null
          ? h('div', { class: 'fp-vault-number' }, formatGlints(banked))
          : h(
              'div',
              { class: 'fp-lost' },
              h('s', {}, formatGlints(Math.max(0, ending.pockets))),
              h('span', {}, 'glints rolled away'),
            ),
      h('p', {}, lead),
      tutorial
        ? null
        : h(
            'div',
            { class: 'fp-tally' },
            h('span', {}, h('b', {}, String(s.stats.pickups)), ' glints picked up'),
            h(
              'span',
              {},
              h('b', {}, String(s.stats.warps)),
              s.stats.warps === 1 ? ' warp' : ' warps',
            ),
            h('span', {}, h('b', {}, String(s.stats.luckyBreaks)), ' lucky breaks'),
          ),
      s.mode === 'daily'
        ? h(
            'p',
            { class: 'fp-note' },
            firstDaily
              ? 'Your first finished Daily Run today: this one counts.'
              : 'Today’s Daily Run was already recorded; this one was for fun.',
          )
        : null,
      xp ? h('p', { class: 'fp-note' }, `+${xp} XP`) : null,
      h(
        'div',
        { class: 'fp-row' },
        h(
          'button',
          {
            class: 'fp-btn fp-btn-primary',
            type: 'button',
            'data-choice': 'again',
            'data-autofocus': true,
            onclick: () => this.playAgain(),
          },
          'Play again',
          h('span', { class: 'fp-key' }, 'R'),
        ),
        h(
          'button',
          {
            class: 'fp-btn',
            type: 'button',
            'data-choice': 'menu',
            onclick: () => this.app.go.title(),
          },
          'Game menu',
        ),
        h(
          'button',
          {
            class: 'fp-btn',
            type: 'button',
            'data-choice': 'hall',
            onclick: () => this.app.context.navigate('hall'),
          },
          'Back to the Hall',
          h('span', { class: 'fp-key' }, 'H'),
        ),
        share,
      ),
    );
    this.showCard(card, 'results', 'aside');
  }

  private playAgain() {
    const { mode } = this.spec;
    if (mode === 'run') this.app.go.run();
    else if (mode === 'daily') this.app.go.daily();
    else if (mode === 'classic') this.app.go.classic();
    else this.app.go.tutorial();
  }

  // ------------------------------------------------------------------ the tutorial

  private renderCoach() {
    this.element.querySelector('.fp-coach')?.remove();
    if (this.session.phase !== 'playing') return;
    const round = this.session.round;
    const text =
      round.moves === 0
        ? 'Step toward the glint with the arrow keys, W A S D, or by clicking a square next to you.'
        : round.pickups === 0
          ? 'Every step you take, the snake takes one too. With empty pockets it never heads straight for you. Grab the glint.'
          : !this.peeked
            ? 'Your satchel fills, and the snake grows bolder: watch its crown and the boldness meter. Press P to peek toward the next glint.'
            : 'Now walk to the door, the round hatch, and bank your haul.';
    const coach = h('p', { class: 'fp-coach fp-panel', role: 'status' }, text);
    coach.style.left = `${this.region.x + this.region.width / 2}px`;
    this.element.append(coach);
  }

  private destroy() {
    cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    if (testHook?.screen === this) testHook = null;
  }

  /** For the browser tests: the session, a way to stage a round, and the overlay showing. */
  get forTests() {
    return {
      session: this.session,
      overlay: this.overlay,
      /** The board's place on the page, to click a square. */
      frame: this.view.frame,
      /** Counts as if the chamber had been played, for screenshots. */
      played: (stats: Partial<SessionStats>) => Object.assign(this.session.stats, stats),
      stage: (patch: Partial<Round>) => {
        this.session.round = { ...this.session.round, ...patch };
        this.renderHud();
      },
    };
  }
}

let testHook: { screen: PlayScreen } | null = null;

/** `window.__fp`: the play screen's state for Playwright, as Robots' `__rr` is for its own. */
function exposeTestHook(screen: PlayScreen) {
  testHook = { screen };
  (window as unknown as { __fp: unknown }).__fp = {
    play: () => testHook?.screen.forTests ?? null,
  };
}
