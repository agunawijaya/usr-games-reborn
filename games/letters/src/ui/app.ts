import type {
  AppearanceState,
  GameContext,
  GameResult,
  PauseMenuItem,
  ResultReceipt,
} from '@usr-games/kit';
import { Sounds } from '../audio/sounds';
import type { Deal } from '../engine/deal';
import type { RoundState } from '../engine/round';
import type { ModeId, RoundPlan } from '../game/modes';
import type { PackageId } from '../game/packages';
import type { Records, WordBook } from '../game/records';
import { openSaves, type Saves } from '../game/saves';
import { BoardView } from '../render/board-view';
import { lookOf, type Palette, paletteFor } from '../render/palette';
import { SolverClient } from '../worker/client';
import { h } from './dom';
import { applyLook } from './look';

/**
 * The game's shell: one board on a stage that every screen shares (so a round's cubes stay put
 * when the reveal lights them), one screen at a time over it, and the bridges to the Hall
 * (appearance, pause, saves, results, packages). Screens never talk to the Hall directly.
 */
export interface Screen {
  readonly element: HTMLElement;
  /** True on the game menu, where Escape takes the player back to the Hall. */
  readonly onTitle?: boolean;
  readonly pauseItems?: readonly PauseMenuItem[];
  /** Returns true when the key was used. */
  onKey?(event: KeyboardEvent): boolean;
  onLook?(palette: Palette, reducedMotion: boolean): void;
  onPause?(): void;
  onResume?(): void;
  focus?(): void;
  destroy?(): void;
}

export interface Navigator {
  title(): void;
  setup(mode: Exclude<ModeId, 'tutorial' | 'daily'>): void;
  play(plan: RoundPlan): void;
  daily(): void;
  tutorial(): void;
  book(): void;
  records(): void;
  help(): void;
}

export type ScreenFactory = (app: App) => Screen;

/** The round in progress, as the workbench's tests read it. */
export interface LiveRound {
  plan: RoundPlan;
  deal: Deal | null;
  state: RoundState | null;
  phase: string;
}

export class App {
  readonly root: HTMLElement;
  readonly stage: HTMLElement;
  readonly layer: HTMLElement;
  readonly board: BoardView;
  readonly saves: Saves;
  readonly sounds: Sounds;
  readonly solver: SolverClient;
  palette: Palette;
  reducedMotion: boolean;
  /** Screens register themselves here (see index.ts) so modules do not import in circles. */
  go!: Navigator;
  live: LiveRound | null = null;
  private screen: Screen | null = null;
  private readonly stops: Array<() => void> = [];
  private paused = false;

  constructor(
    readonly host: HTMLElement,
    readonly context: GameContext,
  ) {
    const appearance = context.appearance();
    this.palette = paletteFor(lookOf(appearance));
    this.reducedMotion = appearance.reducedMotion;
    this.saves = openSaves(context);
    this.sounds = new Sounds(context.audio);
    this.solver = new SolverClient();
    this.board = new BoardView(this.palette, this.reducedMotion);
    this.board.onContact = (strength) => this.sounds.clatter(strength);
    this.stage = h('div', { class: 'chl-stage' }, this.board.element);
    this.layer = h('div', { class: 'chl-layer' });
    this.root = h('div', { class: 'chl-app', 'data-testid': 'chl-root' }, this.stage, this.layer);
    host.append(this.root);
    applyLook(this.root, this.palette, this.reducedMotion);

    const onKey = (event: KeyboardEvent) => this.onKey(event);
    const onVisibility = () => this.board.setVisible(!document.hidden && !this.paused);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    this.stops.push(
      () => window.removeEventListener('keydown', onKey),
      () => document.removeEventListener('visibilitychange', onVisibility),
      context.onAppearanceChange((state) => this.onAppearance(state)),
      context.onPause(() => {
        this.paused = true;
        this.screen?.onPause?.();
      }),
      context.onResume(() => {
        this.paused = false;
        this.screen?.onResume?.();
      }),
    );
  }

  get isPaused(): boolean {
    return this.paused;
  }

  show(factory: ScreenFactory) {
    this.screen?.destroy?.();
    this.layer.replaceChildren();
    const screen = factory(this);
    this.screen = screen;
    this.layer.append(screen.element);
    this.context.setOnTitleScreen(screen.onTitle === true);
    this.context.pauseMenuItems([...(screen.pauseItems ?? [])]);
    requestAnimationFrame(() => {
      if (this.screen === screen) screen.focus?.();
    });
  }

  refreshPauseItems() {
    this.context.pauseMenuItems([...(this.screen?.pauseItems ?? [])]);
  }

  records(): Records {
    return this.saves.loadRecords();
  }

  book(): WordBook {
    return this.saves.book.load();
  }

  /** Saves new records and installs whatever they earned. */
  keep(records: Records, earned: readonly PackageId[]) {
    this.saves.records.save(records);
    for (const id of earned) this.context.installPackage(id);
  }

  report(result: Omit<GameResult, 'presentation'>): ResultReceipt {
    return this.context.reportResult({ ...result, presentation: 'game' });
  }

  destroy() {
    this.screen?.destroy?.();
    this.screen = null;
    for (const stop of this.stops) stop();
    this.solver.dispose();
    this.board.destroy();
    this.root.remove();
  }

  private onAppearance(state: AppearanceState) {
    this.palette = paletteFor(lookOf(state));
    this.reducedMotion = state.reducedMotion;
    applyLook(this.root, this.palette, this.reducedMotion);
    this.board.setPalette(this.palette, this.reducedMotion);
    this.screen?.onLook?.(this.palette, this.reducedMotion);
  }

  private onKey(event: KeyboardEvent) {
    if (this.paused || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      return;
    }
    if (this.screen?.onKey?.(event)) event.preventDefault();
  }
}
