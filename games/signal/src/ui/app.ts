import type {
  AppearanceState,
  GameContext,
  GameResult,
  PauseMenuItem,
  ResultReceipt,
} from '@usr-games/kit';
import { Sounds } from '../audio/sounds';
import type { FreeKind } from '../engine/generate';
import type { PackageId } from '../game/packages';
import type { Update } from '../game/records';
import { openSaves, type Saves } from '../game/saves';
import { DesignCanvas, type DesignFrame, toDesign } from '../render/frame';
import { type DeskPalette, type Look, paletteFor } from '../render/palette';
import { h } from './dom';

/**
 * The game's shell: one canvas for the desk and its machines, one interface layer over it, one
 * screen at a time, and the bridges to the Hall (appearance, pause, saves, results, packages).
 * Screens never talk to the Hall directly.
 */
export interface Screen {
  readonly element: HTMLElement;
  /** True on the game menu, where Escape takes the player back to the Hall. */
  readonly onTitle?: boolean;
  pauseItems?(): PauseMenuItem[];
  layout?(frame: DesignFrame): void;
  paint(ctx: CanvasRenderingContext2D, frame: DesignFrame, pal: DeskPalette, time: number): void;
  tick?(dt: number, time: number): void;
  /** Returns true when the key was used. */
  onKey?(event: KeyboardEvent): boolean;
  onKeyUp?(event: KeyboardEvent): boolean;
  onPointer?(
    kind: 'down' | 'move' | 'up',
    point: { x: number; y: number },
    event: PointerEvent,
  ): boolean;
  onWheel?(deltaY: number): boolean;
  onLook?(): void;
  onPause?(): void;
  onResume?(): void;
  focus?(): void;
  destroy?(): void;
}

export type ScreenFactory = (app: App) => Screen;

export function lookOf(state: Pick<AppearanceState, 'appearance'>): Look {
  return state.appearance === 'dark' ? 'night' : 'morning';
}

export class App {
  readonly root: HTMLElement;
  readonly layer: HTMLElement;
  readonly canvas = new DesignCanvas('dd-stage');
  readonly saves: Saves;
  readonly sounds: Sounds;
  look: Look;
  reducedMotion: boolean;
  /** Screens register themselves here (see index.ts), so modules do not import in circles. */
  go!: Navigator;
  /** Seconds on the game clock; it stops while paused or hidden. */
  clock = 0;
  private screen: Screen | null = null;
  private readonly stops: Array<() => void> = [];
  private paused = false;
  private frameId = 0;
  private last: number | null = null;

  constructor(
    readonly host: HTMLElement,
    readonly context: GameContext,
  ) {
    const appearance = context.appearance();
    this.look = lookOf(appearance);
    this.reducedMotion = appearance.reducedMotion;
    this.saves = openSaves(context);
    this.sounds = new Sounds(context.audio);
    this.root = h('div', { class: 'dd', 'data-look': this.look, 'data-testid': 'dd-root' });
    this.layer = h('div', { class: 'dd-layer' });
    this.root.append(this.canvas.element, this.layer);
    host.append(this.root);
    this.applyLook();

    const onKey = (event: KeyboardEvent) => this.onKey(event, 'down');
    const onKeyUp = (event: KeyboardEvent) => this.onKey(event, 'up');
    const onVisibility = () => (this.last = null);
    const observer = new ResizeObserver(() => this.relayout());
    observer.observe(this.root);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    const pointer = (kind: 'down' | 'move' | 'up') => (event: PointerEvent) => {
      const rect = this.canvas.element.getBoundingClientRect();
      const point = toDesign(
        this.canvas.frame,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      if (kind === 'down') this.sounds.unlock();
      if (this.screen?.onPointer?.(kind, point, event)) event.preventDefault();
    };
    const down = pointer('down');
    const move = pointer('move');
    const up = pointer('up');
    this.canvas.element.addEventListener('pointerdown', down);
    const wheel = (event: WheelEvent) => {
      if (this.screen?.onWheel?.(event.deltaY)) event.preventDefault();
    };
    this.canvas.element.addEventListener('wheel', wheel, { passive: false });
    this.stops.push(() => this.canvas.element.removeEventListener('wheel', wheel));
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    this.stops.push(
      () => window.removeEventListener('keydown', onKey),
      () => window.removeEventListener('keyup', onKeyUp),
      () => document.removeEventListener('visibilitychange', onVisibility),
      () => observer.disconnect(),
      () => this.canvas.element.removeEventListener('pointerdown', down),
      () => window.removeEventListener('pointermove', move),
      () => window.removeEventListener('pointerup', up),
      context.onAppearanceChange((state) => this.onAppearance(state)),
      context.onPause(() => {
        this.paused = true;
        this.screen?.onPause?.();
      }),
      context.onResume(() => {
        this.paused = false;
        this.last = null;
        this.screen?.onResume?.();
      }),
    );
    this.relayout();
    this.start();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get pal(): DeskPalette {
    return paletteFor(this.look);
  }

  get frame(): DesignFrame {
    return this.canvas.frame;
  }

  show(factory: ScreenFactory) {
    this.screen?.destroy?.();
    this.layer.replaceChildren();
    const screen = factory(this);
    this.screen = screen;
    this.layer.append(screen.element);
    this.context.setOnTitleScreen(screen.onTitle === true);
    this.refreshPauseItems();
    screen.layout?.(this.canvas.frame);
    this.paint();
    requestAnimationFrame(() => {
      if (this.screen === screen) screen.focus?.();
    });
  }

  refreshPauseItems() {
    this.context.pauseMenuItems(this.screen?.pauseItems?.() ?? []);
  }

  /** Saves records and installs whatever they earned. */
  keep(update: Update) {
    this.saves.records.save(update.records);
    for (const id of update.earned) this.context.installPackage(id satisfies PackageId);
  }

  report(result: Omit<GameResult, 'presentation'>): ResultReceipt {
    return this.context.reportResult({ ...result, presentation: 'game' });
  }

  private relayout() {
    const width = Math.max(320, this.root.clientWidth || 1280);
    const height = Math.max(240, this.root.clientHeight || 720);
    this.canvas.resize(width, height);
    this.root.style.setProperty('--s', String(this.canvas.frame.scale));
    this.screen?.layout?.(this.canvas.frame);
    this.paint();
  }

  private start() {
    const tick = (now: number) => {
      const visible = !document.hidden && !this.paused;
      if (visible) {
        const dt = this.last === null ? 0 : Math.min(0.1, (now - this.last) / 1000);
        this.last = now;
        this.clock += dt;
        this.screen?.tick?.(dt, this.clock);
        this.paint();
      } else {
        this.last = null;
      }
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private paint() {
    const screen = this.screen;
    if (!screen) return;
    const pal = this.pal;
    const started = performance.now();
    this.canvas.paint((ctx, frame) => screen.paint(ctx, frame, pal, this.clock));
    // The workbench's performance probe: milliseconds spent painting, last 240 frames.
    if (import.meta.env.DEV) {
      const probe = window as unknown as { __ddPaint?: number[] };
      (probe.__ddPaint ??= []).push(performance.now() - started);
      if (probe.__ddPaint.length > 240) probe.__ddPaint.shift();
    }
  }

  private applyLook() {
    this.root.dataset.look = this.look;
    this.root.dataset.motion = this.reducedMotion ? 'reduce' : 'full';
  }

  private onAppearance(state: AppearanceState) {
    this.look = lookOf(state);
    this.reducedMotion = state.reducedMotion;
    this.applyLook();
    this.screen?.onLook?.();
    this.paint();
  }

  private onKey(event: KeyboardEvent, phase: 'down' | 'up') {
    if (this.paused || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
      return;
    if (phase === 'down') this.sounds.unlock();
    const handled = phase === 'down' ? this.screen?.onKey?.(event) : this.screen?.onKeyUp?.(event);
    if (handled) event.preventDefault();
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    this.screen?.destroy?.();
    this.screen = null;
    for (const stop of this.stops) stop();
    this.root.remove();
  }
}

/** Where the screens can send the player; filled in by index.ts. */
export interface Navigator {
  title(): void;
  room(chapter?: number): void;
  message(id: string): void;
  daily(): void;
  free(): void;
  freeRound(kind: FreeKind): void;
  sandbox(mode?: 'make' | 'print'): void;
  friend(code: string): void;
  logbook(): void;
  help(): void;
  settings(): void;
}

/** Whether a key event came from a text field, where typing belongs to the field. */
export function inField(event: Event): boolean {
  const target = event.target as HTMLElement | null;
  return (
    !!target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  );
}
